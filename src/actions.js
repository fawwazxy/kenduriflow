'use strict';
const crypto = require('crypto');
const store = require('./store');
const alloc = require('./allocate');
const learn = require('./learn');
const clock = require('./clock');
const { EVENT_TYPES, HOLD_MIN, DEMO } = require('./config');
const { isDate, parseTime, overlap, fmtTime, fmtDate, addDays } = require('./util');

const LANE_ISSUE = 'Cars are parked on the house side of the road';
const ISSUES = [
  'A car is blocking my driveway',
  LANE_ISSUE,
  'A car is parked on the grass verge',
  'Guests are crowding the road outside my gate'
];

function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  throw e;
}

// Every event handed out is on the right clock (real time in the real system).
function getEvent(id) {
  const ev = store.db.events.find((e) => e.id === id);
  if (!ev) fail(404, 'Event not found.');
  return clock.sync(ev);
}

function getEventByCode(code) {
  const ev = store.db.events.find((e) => e.code === code);
  if (!ev) fail(404, 'This event link is not valid.');
  return clock.sync(ev);
}

function slotLabel(slotId) {
  const f = alloc.findSlot(store.db, slotId);
  return f ? f.slot.label : slotId;
}

function log(ev, text, kind = '') {
  const db = store.db;
  db.logSeq = (db.logSeq || 0) + 1;
  db.logs.push({ id: db.logSeq, eventId: ev.id, clock: ev.live ? ev.live.clock : 0, at: new Date().toISOString(), text, kind });
  const mine = db.logs.filter((l) => l.eventId === ev.id);
  if (mine.length > 40) {
    const drop = new Set(mine.slice(0, mine.length - 40));
    db.logs = db.logs.filter((l) => !drop.has(l));
  }
}

// ---------- events ----------

function readEventInput(body, { id = null } = {}) {
  const db = store.db;
  body = body || {};
  const title = String(body.title || '').trim().slice(0, 60);
  if (!title) fail(400, 'Enter a name for the event.');
  const type = String(body.type || '');
  if (!EVENT_TYPES[type]) fail(400, 'Choose the type of event.');
  const house = Number(body.house);
  const h = alloc.houseByNo(db, house);
  if (!h) fail(400, 'Choose your house address.');
  const date = String(body.date || '');
  if (!isDate(date)) fail(400, 'Choose the date of the event.');
  const start = parseTime(body.start);
  if (start == null) fail(400, 'Enter a start time, for example 12:00.');
  // The real system takes new events from today onwards.
  const existing = id ? db.events.find((e) => e.id === id) : null;
  if (!DEMO && (!existing || existing.date !== date) && date < clock.now().date) fail(400, 'Choose a date from today onwards.');
  const duration = Math.round(Number(body.duration));
  if (!Number.isFinite(duration) || duration < 30 || duration > 720) fail(400, 'The event must last between 30 minutes and 12 hours.');
  if (start + duration > 24 * 60) fail(400, 'The event must finish by midnight.');
  const guests = Math.round(Number(body.guests));
  if (!Number.isFinite(guests) || guests < 10 || guests > 3000) fail(400, 'Expected guests must be between 10 and 3,000.');
  const vipSpaces = Math.round(Number(body.vipSpaces || 0));
  if (!Number.isFinite(vipSpaces) || vipSpaces < 0 || vipSpaces > 10) fail(400, 'Spaces for elderly or OKU guests must be between 0 and 10.');
  const hostName = String(body.hostName || '').trim().slice(0, 60);

  const clash = db.events.find((e) => e.id !== id && e.status !== 'cancelled' && e.house === house && e.date === date &&
    overlap(start, start + duration, e.start, e.start + e.duration));
  if (clash) fail(409, `No. ${house} already has "${clash.title}" from ${fmtTime(clash.start)} to ${fmtTime(clash.start + clash.duration)} that day.`);

  return { title, type, house, street: h.street, date, start, duration, guests, vipSpaces, hostName };
}

function makeCode(title) {
  const base = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .split('-').filter(Boolean).slice(0, 3).join('-') || 'event';
  let code;
  // The random part makes guest links impossible to guess.
  do { code = `${base}-${crypto.randomBytes(5).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6) || 'x'}`; } while (store.db.events.some((e) => e.code === code));
  return code;
}

function neighbourCount(ev) {
  return store.db.precinct.houses.filter((h) => h.no !== ev.house).length;
}

function createEvent(body) {
  const data = readEventInput(body);
  const db = store.db;
  const id = store.nextId('ev');
  const ev = Object.assign({ id, seq: db.seq, code: makeCode(data.title) }, data, {
    status: 'planned',
    createdAt: new Date().toISOString(),
    live: { clock: 0, running: false, finished: false, history: [], peak: 0 }
  });
  db.events.push(ev);
  clock.sync(ev);
  log(ev, `Event registered. ${neighbourCount(ev)} households and the guardhouse were notified.`, 'ok');
  return ev;
}

function updateEvent(id, body) {
  const ev = getEvent(id);
  if (ev.status === 'cancelled') fail(400, 'This event has been cancelled.');
  if (ev.live.running) fail(409, 'Pause the live event before changing its details.');
  const data = readEventInput(body, { id });
  const moved = data.house !== ev.house || data.date !== ev.date || data.start !== ev.start || data.duration !== ev.duration;
  Object.assign(ev, data);
  // The host cannot share their own driveway for their own event.
  store.db.shares = store.db.shares.filter((s) => !(s.eventId === ev.id && s.house === ev.house));
  log(ev, moved ? 'Details updated. Neighbours were sent the new date, time or address.' : 'Details updated.', 'ok');
  return ev;
}

function releaseCars(ev) {
  for (const c of store.db.cars) if (c.eventId === ev.id && c.leftAt == null) c.leftAt = ev.live.clock;
  store.db.holds = (store.db.holds || []).filter((h) => h.eventId !== ev.id);
}

function cancelEvent(id) {
  const ev = getEvent(id);
  if (ev.status === 'cancelled') return ev;
  ev.live.running = false;
  releaseCars(ev);
  ev.status = 'cancelled';
  log(ev, 'Event cancelled. Neighbours and the guardhouse were told.', 'bad');
  return ev;
}

function resetLive(ev) {
  const db = store.db;
  db.cars = db.cars.filter((c) => c.eventId !== ev.id);
  db.holds = (db.holds || []).filter((h) => h.eventId !== ev.id);
  db.logs = db.logs.filter((l) => l.eventId !== ev.id);
  db.reports = db.reports.filter((r) => r.eventId !== ev.id);
  db.learning = (db.learning || []).filter((o) => o.eventId !== ev.id);
  ev.live = { clock: 0, running: false, finished: false, history: [], peak: 0 };
  if (ev.status !== 'cancelled') ev.status = 'planned';
  log(ev, 'Live counts reset.');
  return ev;
}

// ---------- cars ----------

function placeCar(ev, zoneId, slotId, { vip = false, source = 'guard', blocking = false, street = null } = {}) {
  const car = {
    id: store.randomId('c'), eventId: ev.id, zoneId, slotId, vip: !!vip, blocking: !!blocking, street,
    source, arrivedAt: ev.live.clock, leftAt: null
  };
  store.db.cars.push(car);
  if (ev.status === 'planned' || ev.status === 'finished') ev.status = 'live';
  ev.live.finished = false;
  // The busiest moment actually counted, saved for learning when the event ends.
  const onsite = store.db.cars.filter((c) => c.eventId === ev.id && c.leftAt == null && !c.blocking).length;
  ev.live.peak = Math.max(ev.live.peak || 0, onsite);
  return car;
}

// Ends the event: frees every space and saves the real counts so future estimates improve.
function finishEvent(ev) {
  if (ev.status === 'cancelled') fail(400, 'This event has been cancelled.');
  const prediction = alloc.plan(store.db, ev).prediction;
  releaseCars(ev);
  ev.live.running = false;
  ev.live.finished = true;
  ev.status = 'finished';
  const o = learn.record(store.db, ev, prediction);
  const type = (EVENT_TYPES[ev.type] || EVENT_TYPES.wedding).short.toLowerCase();
  if (!o) log(ev, 'Event finished. Too few cars were counted to learn from.', 'ok');
  else if (o.simulated) log(ev, `Event finished. ${o.cars} cars in the simulation. Simulations are not used for learning.`, 'ok');
  else if (!o.used) log(ev, `Event finished. ${o.cars} cars were counted against ${o.predictedCars} predicted. That is too far off to trust, so it was not used for learning.`, 'ok');
  else log(ev, `Event finished. ${o.cars} cars counted against ${o.predictedCars} predicted. Saved to improve the next ${type} estimate.`, 'ok');
  log(ev, `Extra rubbish pickup booked for ${fmtDate(addDays(ev.date, 1))}, 8:00 am.`);
  return { event: ev, observation: o };
}

function who(source, vip) {
  if (source === 'guest') return vip ? 'Guest with an elderly or OKU passenger' : 'Guest';
  return vip ? 'Elderly or OKU car' : 'Car';
}

// Is this space part of this event's plan, and open? Returns the plan zone, or null.
function planZoneFor(ev, p, slotId) {
  const f = alloc.findSlot(store.db, slotId);
  if (!f) return null;
  const z = p.zones.find((x) => x.id === f.zone.id);
  return z && !z.closed && z.slots.includes(slotId) ? z : null;
}

// Send a car to the next free space (used by the guard "+1" button, the guest page and the simulation).
// A guest can ask for the space their page showed (slotId), or the space held for them (holdId).
function autoPark(ev, { vip = false, source = 'guard', p = null, occ = null, quiet = false, slotId = null, holdId = null } = {}) {
  if (ev.status === 'cancelled') fail(400, 'This event has been cancelled.');
  const db = store.db;
  p = p || alloc.plan(db, ev);
  if (holdId) {
    const h = (db.holds || []).find((x) => x.id === holdId && x.eventId === ev.id);
    if (h) {
      db.holds = db.holds.filter((x) => x !== h);
      slotId = h.slotId;
      vip = h.vip;
    }
  }
  occ = occ || alloc.occupancy(db);
  let n = null;
  if (slotId && !occ.has(slotId)) {
    const z = planZoneFor(ev, p, slotId);
    if (z) n = { zoneId: z.id, slotId };
  }
  n = n || alloc.nextSlot(db, ev, vip, p, occ);
  if (!n) {
    if (!quiet) log(ev, 'A car arrived but every zone is full. Hold it at the Persiaran Elmina layby.', 'bad');
    return null;
  }
  const car = placeCar(ev, n.zoneId, n.slotId, { vip, source });
  occ.set(n.slotId, car);
  if (!quiet) log(ev, `${who(source, vip)} sent to ${slotLabel(n.slotId)}.`);
  return car;
}

// Guard corrects the count by hand for one zone.
function guardAdd(ev, zoneId) {
  if (ev.status === 'cancelled') fail(400, 'This event has been cancelled.');
  const db = store.db;
  const p = alloc.plan(db, ev);
  const occ = alloc.occupancy(db);
  const z = p.zones.find((x) => x.id === zoneId);
  const zdef = alloc.zoneById(db, zoneId);
  if (!z || !zdef) fail(404, 'Zone not found.');
  if (z.closed) fail(400, `${zdef.name} is closed during this event.`);
  let slotId = z.slots.find((id) => !occ.has(id)) || null;
  if (!slotId && zdef.kind !== 'driveway') slotId = (zdef.slots.find((s) => !occ.has(s.id)) || {}).id || null;
  if (!slotId) {
    if (zdef.kind === 'kerb') {
      const car = placeCar(ev, zoneId, null, { blocking: true, street: zdef.street, source: 'guard' });
      log(ev, `A car is parked in the emergency lane on ${zdef.street}. Ask the driver to move.`, 'bad');
      return car;
    }
    fail(400, `No free space left in ${zdef.short === 'Driveways' ? 'the shared driveways' : zdef.name}.`);
  }
  const car = placeCar(ev, zoneId, slotId, { source: 'guard' });
  log(ev, `Guard recorded a car at ${slotLabel(slotId)}.`);
  return car;
}

function guardRemove(ev, zoneId) {
  const list = store.db.cars.filter((c) => c.eventId === ev.id && c.zoneId === zoneId && c.leftAt == null);
  if (!list.length) fail(400, 'No cars from this event are parked there.');
  const blocking = list.filter((c) => c.blocking);
  const car = blocking.length ? blocking[blocking.length - 1] : list[list.length - 1];
  car.leftAt = ev.live.clock;
  log(ev, car.blocking ? `The car in the emergency lane on ${car.street} has moved.` : `A car left ${slotLabel(car.slotId)}.`, car.blocking ? 'ok' : '');
  return car;
}

// Guard "−1 car leaving" at the entrance. The guard cannot see which space it came from,
// so the car that has been parked longest is freed.
function leaveOne(ev) {
  const list = store.db.cars.filter((c) => c.eventId === ev.id && c.leftAt == null && !c.blocking);
  if (!list.length) fail(400, 'No cars from this event are parked.');
  const car = list.reduce((a, c) => (c.arrivedAt < a.arrivedAt ? c : a), list[0]);
  car.leftAt = ev.live.clock;
  log(ev, `A car left. ${slotLabel(car.slotId)} is free again.`);
  return car;
}

// Guard taps "Car in the emergency lane". No camera is needed: the guard sees it and records it.
function laneBlock(ev) {
  if (ev.status === 'cancelled') fail(400, 'This event has been cancelled.');
  const kerb = store.db.precinct.zones.find((z) => z.kind === 'kerb' && z.street === ev.street);
  const car = placeCar(ev, kerb ? kerb.id : null, null, { blocking: true, street: ev.street, source: 'guard' });
  log(ev, `A car is parked in the emergency lane on ${ev.street}. Ask the driver to move.`, 'bad');
  return car;
}

// Lane is clear again: removes every car recorded in the lane on this street and closes house-side reports.
function laneClear(ev) {
  const db = store.db;
  let n = 0;
  for (const c of db.cars) if (c.leftAt == null && c.blocking && c.street === ev.street) { c.leftAt = ev.live.clock; n++; }
  const now = new Date().toISOString();
  for (const r of db.reports) if (!r.resolvedAt && r.issue === LANE_ISSUE && r.street === ev.street) { r.resolvedAt = now; n++; }
  if (!n) fail(400, 'The emergency lane is already clear.');
  log(ev, `Emergency lane on ${ev.street} is clear again.`, 'ok');
  return { cleared: n };
}

// Guest taps "Someone is already parked here". The space is recorded as full and the guest gets the next one.
function markTaken(ev, slotId) {
  if (ev.status === 'cancelled') fail(400, 'This event has been cancelled.');
  const db = store.db;
  const f = alloc.findSlot(db, slotId);
  if (!f) fail(404, 'Parking space not found.');
  const z = planZoneFor(ev, alloc.plan(db, ev), slotId);
  if (!z) fail(400, 'That space is not part of this event\'s parking plan.');
  if (alloc.occupancy(db).has(slotId)) return null;
  const car = placeCar(ev, z.id, slotId, { source: 'taken' });
  log(ev, `A guest found ${f.slot.label} already taken. It is now marked as full.`, 'bad');
  return car;
}

// ---------- holds: a guest on the way keeps a space for a few minutes ----------

function holdOut(h) {
  const f = alloc.findSlot(store.db, h.slotId);
  const z = f ? f.zone : null;
  return {
    // Seconds left, not a clock time: the guest's phone clock may differ from the server's.
    hold: h, secondsLeft: Math.max(0, Math.round((h.expiresAt - Date.now()) / 1000)),
    slotLabel: f ? f.slot.label : h.slotId,
    zoneName: z ? (z.kind === 'driveway' ? f.slot.label : z.name) : '',
    kind: z ? z.kind : null, color: z ? z.color : null,
    directions: z ? String(z.directions || '').replace('{house}', f.slot.house) : ''
  };
}

function createHold(ev, { vip = false } = {}) {
  if (ev.status === 'cancelled' || ev.status === 'finished') fail(400, 'This event is not taking cars.');
  const db = store.db;
  const n = alloc.nextSlot(db, ev, !!vip);
  if (!n) fail(409, 'Every parking zone is full right now. Please wait at the Persiaran Elmina layby.');
  const h = { id: store.randomId('h'), eventId: ev.id, slotId: n.slotId, vip: !!vip, createdAt: Date.now(), expiresAt: Date.now() + HOLD_MIN * 60000 };
  db.holds.push(h);
  log(ev, `A guest on the way is holding ${slotLabel(n.slotId)} for ${HOLD_MIN} minutes.`);
  return holdOut(h);
}

function getHold(id) {
  const h = (store.db.holds || []).find((x) => x.id === id);
  if (!h || h.expiresAt <= Date.now()) fail(404, 'This hold has run out.');
  return holdOut(h);
}

function cancelHold(id) {
  const db = store.db;
  const h = (db.holds || []).find((x) => x.id === id);
  if (!h) return { eventId: null };
  db.holds = db.holds.filter((x) => x !== h);
  return { eventId: h.eventId };
}

// The held space turned out to have a car in it: mark it full and hold the next one instead.
function holdTaken(id) {
  const db = store.db;
  const h = (db.holds || []).find((x) => x.id === id);
  if (!h) fail(404, 'This hold has run out.');
  const ev = getEvent(h.eventId);
  db.holds = db.holds.filter((x) => x !== h);
  markTaken(ev, h.slotId);
  return createHold(ev, { vip: h.vip });
}

// Removes holds that ran out. Returns the events they belonged to.
function pruneHolds(now = Date.now()) {
  const db = store.db;
  const gone = (db.holds || []).filter((h) => h.expiresAt <= now);
  if (!gone.length) return [];
  db.holds = db.holds.filter((h) => h.expiresAt > now);
  return [...new Set(gone.map((h) => h.eventId))];
}

// ---------- guest replies ----------

function saveRsvp(ev, { id, people, cars }) {
  if (ev.status === 'cancelled') fail(400, 'This event has been cancelled.');
  people = Math.round(Number(people));
  cars = Math.round(Number(cars));
  if (!Number.isFinite(people) || people < 1 || people > 20) fail(400, 'People coming must be between 1 and 20.');
  if (!Number.isFinite(cars) || cars < 0 || cars > 5) fail(400, 'Cars must be between 0 and 5.');
  const db = store.db;
  let r = id ? db.rsvps.find((x) => x.id === id && x.eventId === ev.id) : null;
  if (r) { r.people = people; r.cars = cars; r.at = new Date().toISOString(); } else {
    r = { id: store.randomId('rs'), eventId: ev.id, people, cars, at: new Date().toISOString() };
    db.rsvps.push(r);
  }
  return r;
}

// ---------- guard recount ----------

// The guard walks past a zone and enters how many of this event's cars are really there.
function recount(ev, zoneId, count) {
  if (ev.status === 'cancelled') fail(400, 'This event has been cancelled.');
  count = Math.round(Number(count));
  if (!Number.isFinite(count) || count < 0 || count > 200) fail(400, 'Enter the number of cars you can see, from 0 to 200.');
  const db = store.db;
  const zdef = alloc.zoneById(db, zoneId);
  if (!zdef) fail(404, 'Zone not found.');
  const mine = () => db.cars.filter((c) => c.eventId === ev.id && c.zoneId === zoneId && c.leftAt == null && !c.blocking);
  const before = mine().length;
  if (count < before) {
    mine().sort((a, b) => a.arrivedAt - b.arrivedAt).slice(0, before - count).forEach((c) => { c.leftAt = ev.live.clock; });
  } else if (count > before) {
    const p = alloc.plan(db, ev);
    const z = p.zones.find((x) => x.id === zoneId);
    if (!z || z.closed) fail(400, `${zdef.name} is not open for this event.`);
    const occ = alloc.occupancy(db);
    const free = z.slots.filter((id) => !occ.has(id) || (occ.get(id).hold && occ.get(id).eventId === ev.id));
    if (count - before > free.length) fail(400, `Only ${free.length} more spaces in ${zdef.short}. Check the number.`);
    free.slice(0, count - before).forEach((id) => {
      db.holds = (db.holds || []).filter((h) => h.slotId !== id);
      placeCar(ev, zoneId, id, { source: 'recount' });
    });
  }
  if (count !== before) log(ev, `Guard recounted ${zdef.short}: ${count} cars (was ${before}).`);
  return { zoneId, before, count };
}

// ---------- neighbour: keep the kerb opposite my gate clear ----------

function setFrontage({ house, on }) {
  const db = store.db;
  const h = alloc.houseByNo(db, house);
  if (!h) fail(400, 'Choose your house.');
  let f = db.frontage.find((x) => x.house === h.no);
  if (!f) { f = { house: h.no, on: !!on, at: new Date().toISOString() }; db.frontage.push(f); } else { f.on = !!on; f.at = new Date().toISOString(); }
  return { house: h.no, on: f.on, bays: alloc.baysOpposite(db, h).length };
}

function leaveCar(carId) {
  const car = store.db.cars.find((c) => c.id === carId);
  if (!car) fail(404, 'Parking record not found.');
  const ev = getEvent(car.eventId);
  if (car.leftAt == null) {
    car.leftAt = ev.live.clock;
    log(ev, `A guest left ${slotLabel(car.slotId)}.`);
  }
  return car;
}

// ---------- neighbours ----------

function setShare({ eventId, house, cars, on }) {
  const db = store.db;
  const ev = getEvent(eventId);
  house = Number(house);
  const h = alloc.houseByNo(db, house);
  if (!h) fail(400, 'Choose your house.');
  if (ev.status === 'cancelled') fail(400, 'This event has been cancelled.');
  if (ev.house === house) fail(400, 'You are the host of this event.');
  if (h.street !== ev.street) fail(400, 'Driveway sharing is for houses on the same street as the event.');
  cars = Math.max(1, Math.min(2, Math.round(Number(cars) || 1)));
  on = !!on;

  if (on) {
    const conflict = db.shares.find((s) => {
      if (!s.on || s.house !== house || s.eventId === eventId) return false;
      const o = db.events.find((e) => e.id === s.eventId);
      return o && o.status !== 'cancelled' && o.date === ev.date && overlap(ev.start, ev.start + ev.duration, o.start, o.start + o.duration);
    });
    if (conflict) {
      const o = db.events.find((e) => e.id === conflict.eventId);
      fail(409, `Your driveway is already shared with "${o.title}" at that time.`);
    }
  }
  const parked = db.cars.filter((c) => c.leftAt == null && c.eventId === eventId && c.slotId && c.slotId.startsWith(`D${house}-`)).length;
  const allowed = on ? cars : 0;
  if (parked > allowed) fail(409, `${parked} guest car${parked > 1 ? 's are' : ' is'} still parked in your driveway. Change this after they leave.`);

  let sh = db.shares.find((s) => s.eventId === eventId && s.house === house);
  const was = sh ? (sh.on ? sh.cars : 0) : 0;
  if (sh) { sh.on = on; sh.cars = cars; } else {
    sh = { id: store.nextId('sh'), eventId, house, cars, on, createdAt: new Date().toISOString() };
    db.shares.push(sh);
  }
  const now = on ? cars : 0;
  if (now !== was) log(ev, on ? `No. ${house} shared their driveway for ${cars} car${cars > 1 ? 's' : ''}.` : `No. ${house} stopped sharing their driveway.`, on ? 'ok' : '');
  return sh;
}

function addReport({ eventId, house, issue }) {
  const db = store.db;
  const ev = getEvent(eventId);
  const h = alloc.houseByNo(db, house);
  if (!h) fail(400, 'Choose your house.');
  if (!ISSUES.includes(issue)) fail(400, 'Choose what is happening.');
  if (ev.status === 'cancelled') fail(400, 'This event has been cancelled.');
  const r = { id: store.nextId('r'), eventId, house: h.no, street: h.street, issue, createdAt: new Date().toISOString(), clock: ev.live.clock, resolvedAt: null };
  db.reports.push(r);
  log(ev, `No. ${h.no} reported: ${issue.charAt(0).toLowerCase() + issue.slice(1)}.`, 'bad');
  return r;
}

function resolveReport(id) {
  const r = store.db.reports.find((x) => x.id === id);
  if (!r) fail(404, 'Report not found.');
  if (!r.resolvedAt) {
    r.resolvedAt = new Date().toISOString();
    const ev = store.db.events.find((e) => e.id === r.eventId);
    if (ev) log(ev, `Guard sorted the report from No. ${r.house}.`, 'ok');
  }
  return r;
}

module.exports = {
  ISSUES, LANE_ISSUE, fail, getEvent, getEventByCode, slotLabel, log, readEventInput, createEvent, updateEvent,
  cancelEvent, resetLive, releaseCars, finishEvent, autoPark, guardAdd, guardRemove, leaveOne, laneBlock, laneClear,
  markTaken, createHold, getHold, cancelHold, holdTaken, pruneHolds, saveRsvp, recount, setFrontage,
  leaveCar, setShare, addReport, resolveReport, neighbourCount
};

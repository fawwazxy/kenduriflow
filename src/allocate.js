'use strict';
const { FRIDAY_PRAYER } = require('./config');
const { overlap, dayOfWeek } = require('./util');
const { predict } = require('./predict');
const learn = require('./learn');

/**
 * Allocation engine.
 *
 * plan()      decides, before the event, how many cars go to each zone.
 * nextSlot()  decides, during the event, which exact space the next car gets.
 *
 * Rules:
 *  - Only the park side of each street is used. The house side is the emergency lane.
 *  - Driveways are used only when the owner has shared them for this event.
 *  - When two events overlap, each kerb space goes to the host whose house is nearer.
 *  - Order: own street kerb -> shared driveways -> other street kerb -> surau -> mall + shuttle.
 *  - The nearest kerb spaces are kept for elderly and OKU guests.
 */

const evEnd = (e) => e.start + e.duration;
const order = (e) => (e && typeof e.seq === 'number' ? e.seq : Infinity);
const center = (s) => ({ x: s.x + s.w / 2, y: s.y + s.h / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function houseByNo(db, no) { return db.precinct.houses.find((h) => h.no === Number(no)) || null; }
function zoneById(db, id) { return db.precinct.zones.find((z) => z.id === id) || null; }

const indexCache = new WeakMap();
function findSlot(db, slotId) {
  let m = indexCache.get(db.precinct);
  if (!m) {
    m = new Map();
    for (const z of db.precinct.zones) for (const s of z.slots) m.set(s.id, { zone: z, slot: s });
    indexCache.set(db.precinct, m);
  }
  return m.get(slotId) || null;
}

// Kerb bays opposite the gate of a neighbour who asked to keep it clear (so they can always drive out).
function keptClear(db) {
  const out = new Map();
  for (const f of (db.frontage || []).filter((x) => x.on)) {
    for (const id of baysOpposite(db, houseByNo(db, f.house))) out.set(id, f.house);
  }
  return out;
}

// The kerb bays directly opposite a house's driveway, plus a little turning room either side.
function baysOpposite(db, h) {
  const kerb = h && db.precinct.zones.find((z) => z.kind === 'kerb' && z.street === h.street);
  if (!kerb) return [];
  return kerb.slots.filter((s) => { const cx = s.x + s.w / 2; return cx >= h.porch.x - 4 && cx <= h.porch.x + h.porch.w + 4; }).map((s) => s.id);
}

function overlapping(db, ev) {
  return db.events.filter((o) => o.id !== ev.id && o.status !== 'cancelled' && o.date === ev.date &&
    overlap(ev.start, evEnd(ev), o.start, evEnd(o)));
}

function surauClosed(ev) {
  return dayOfWeek(ev.date) === 5 && overlap(ev.start, evEnd(ev), FRIDAY_PRAYER.start, FRIDAY_PRAYER.end);
}

function brief(e) {
  return { id: e.id || null, title: e.title, type: e.type, house: e.house, street: e.street, date: e.date, start: e.start, end: evEnd(e) };
}

function zoneOut(z, slotIds, walk, extra = {}) {
  return Object.assign({
    id: z.id, kind: z.kind, color: z.color, name: z.name, short: z.short, street: z.street || null,
    directions: z.directions, walk, slots: slotIds, capacity: slotIds.length,
    planned: 0, plannedSlots: [], closed: false
  }, extra);
}

function plan(db, ev, memo = new Map()) {
  if (ev.id && memo.has(ev.id)) return memo.get(ev.id);
  const P = db.precinct;
  const prediction = predict(ev, learn.estimate(db, ev));
  const others = overlapping(db, ev);
  const keep = keptClear(db);
  const competitors = [ev, ...others];
  const doorOf = new Map(competitors.map((e) => [e, (houseByNo(db, e.house) || { door: { x: 0, y: 0 } }).door]));
  const myDoor = doorOf.get(ev);

  // 1. Kerb spaces: each one goes to the nearest host among overlapping events.
  const held = [];
  const kerbOwned = {};
  const kerbZones = P.zones.filter((z) => z.kind === 'kerb');
  for (const z of kerbZones) {
    const mine = [];
    for (const s of z.slots) {
      if (keep.has(s.id)) continue;
      const c = center(s);
      let best = null;
      let bestD = Infinity;
      for (const e of competitors) {
        const d = dist(c, doorOf.get(e));
        if (best === null || d < bestD - 0.01 || (Math.abs(d - bestD) <= 0.01 && order(e) < order(best))) { best = e; bestD = d; }
      }
      if (best === ev) mine.push({ id: s.id, d: dist(c, myDoor) });
      else held.push({ slotId: s.id, by: brief(best) });
    }
    kerbOwned[z.id] = mine.sort((a, b) => a.d - b.d).map((m) => m.id);
  }

  // 2. Driveways shared by neighbours on the same street for this event.
  const dz = P.zones.find((z) => z.kind === 'driveway');
  const driveIds = [];
  const driveHouses = [];
  const myShares = ev.id ? db.shares.filter((s) => s.eventId === ev.id && s.on && s.house !== ev.house) : [];
  for (const sh of myShares) {
    const hs = dz.slots.filter((s) => s.house === sh.house);
    if (!hs.length || hs[0].street !== ev.street) continue;
    const take = hs.slice(0, Math.max(1, Math.min(hs.length, sh.cars)));
    take.forEach((s) => driveIds.push({ id: s.id, d: dist(center(s), myDoor) }));
    driveHouses.push({ house: sh.house, cars: take.length });
  }
  driveIds.sort((a, b) => a.d - b.d);
  driveHouses.sort((a, b) => a.house - b.house);
  for (const o of others) {
    for (const sh of db.shares.filter((s) => s.eventId === o.id && s.on)) {
      dz.slots.filter((s) => s.house === sh.house).slice(0, sh.cars).forEach((s) => held.push({ slotId: s.id, by: brief(o) }));
    }
  }

  // 3. Build the zone list in priority order.
  const zones = [];
  const own = kerbZones.find((z) => z.street === ev.street);
  const vipCount = own ? Math.min(Math.max(0, Number(ev.vipSpaces) || 0), kerbOwned[own.id].length) : 0;
  const vipSlots = own ? kerbOwned[own.id].slice(0, vipCount) : [];
  if (own) zones.push(zoneOut(own, kerbOwned[own.id], '1 min walk'));
  zones.push(zoneOut(dz, driveIds.map((d) => d.id), '1 to 2 min walk', { houses: driveHouses }));
  for (const z of kerbZones) if (z !== own) zones.push(zoneOut(z, kerbOwned[z.id], '3 min walk through the linear park'));
  for (const z of P.zones.filter((x) => x.kind === 'lot')) {
    const closed = !!(z.closedFridayPrayer && surauClosed(ev));
    // Lots are shared. Events registered earlier keep the spaces they planned.
    let earlier = 0;
    for (const o of others) {
      if (order(o) < order(ev)) {
        const oz = plan(db, o, memo).zones.find((x) => x.id === z.id);
        if (oz) earlier += oz.planned;
      }
    }
    const capacity = closed ? 0 : Math.max(0, z.slots.length - earlier);
    zones.push(zoneOut(z, z.slots.map((s) => s.id), z.shuttle ? 'Shuttle buggy to the house' : '4 min walk through the linear park',
      { closed, capacity, earlier, shuttle: !!z.shuttle }));
  }

  // 4. Fill the plan: closest zones first.
  let remaining = prediction.planned;
  for (const z of zones) {
    const take = Math.min(remaining, z.capacity);
    z.planned = take;
    remaining -= take;
    const from = z.kind === 'lot' ? (z.earlier || 0) : 0;
    z.plannedSlots = z.slots.slice(from, from + take);
  }

  // 5. Shuttle for the overflow car park (8-seater buggy, about 40 people an hour each).
  let shuttle = null;
  const sz = zones.find((z) => z.shuttle);
  if (sz && sz.planned > 0) {
    const riders = Math.ceil(sz.planned * prediction.peoplePerCar);
    const buggies = Math.max(1, Math.ceil(riders / 40));
    shuttle = { riders, buggies, every: Math.max(3, Math.round(12 / buggies)), rideMin: 6 };
    sz.walk = `Shuttle every ${shuttle.every} min, 6 min ride`;
  }

  const walkingCapacity = zones.filter((z) => !z.shuttle && !z.closed).reduce((a, z) => a + z.capacity, 0);
  const result = {
    prediction,
    zones,
    vipSlots,
    held,
    keptClear: keep,
    shortfall: remaining,
    walkingCapacity,
    shuttle,
    clashes: others.filter((o) => o.street === ev.street).map(brief),
    overlaps: others.map(brief),
    surauClosed: surauClosed(ev)
  };
  if (ev.id) memo.set(ev.id, result);
  return result;
}

// ---------- live ----------

// Spaces in use: parked cars, plus spaces held for a guest on the way (until the hold runs out).
function occupancy(db, now = Date.now()) {
  const m = new Map();
  for (const c of db.cars) if (c.leftAt == null && c.slotId) m.set(c.slotId, c);
  for (const h of db.holds || []) if (h.expiresAt > now && !m.has(h.slotId)) m.set(h.slotId, Object.assign({ hold: true }, h));
  return m;
}

// Spaces this event may use in a zone, in the order they should fill.
function candidateIds(ev, p, z, vip) {
  if (z.kind === 'kerb' && z.street === ev.street) {
    const vipSet = new Set(p.vipSlots);
    const rest = z.slots.filter((id) => !vipSet.has(id));
    return vip ? [...p.vipSlots, ...rest] : rest;
  }
  return z.slots;
}

function nextSlot(db, ev, vip = false, p = null, occ = null) {
  p = p || plan(db, ev);
  occ = occ || occupancy(db);
  for (const z of p.zones) {
    if (z.closed) continue;
    for (const id of candidateIds(ev, p, z, vip)) if (!occ.has(id)) return { zoneId: z.id, slotId: id };
  }
  return null;
}

function freeIn(ev, p, z, occ, vip = false) {
  if (z.closed) return 0;
  return candidateIds(ev, p, z, vip).filter((id) => !occ.has(id)).length;
}

module.exports = {
  plan, nextSlot, occupancy, candidateIds, freeIn, overlapping, findSlot, keptClear, baysOpposite,
  houseByNo, zoneById, evEnd, brief, surauClosed
};

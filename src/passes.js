'use strict';
const crypto = require('crypto');
const store = require('./store');
const alloc = require('./allocate');
const actions = require('./actions');

/**
 * Gate passes: every guest gets an ENTRY QR with the invitation, and an EXIT QR once they are inside.
 *
 *   entry QR (in)   the car is counted and parked: in the space the guest held, or the next free one
 *                   (the elderly/OKU spaces if the guest switched that on)
 *   exit QR (out)   frees the space
 *
 * Each QR does one thing only, so scanning it twice never undoes anything: a second entry scan just says
 * "already in". After leaving, the guest's page shows the entry QR again, for coming back.
 * A pass is "in" while its car is still parked, so it stays right even when the guard also uses − or recount.
 * Each QR also has its own 6-letter code the guard can type if the camera does not work.
 */

const REPEAT_MS = 30000;
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O or 1/I, easy to read out

const fail = actions.fail;

function newCode(eventId) {
  let code;
  do { code = Array.from(crypto.randomBytes(6), (b) => LETTERS[b % LETTERS.length]).join(''); }
  while (store.db.passes.some((p) => p.eventId === eventId && (p.code === code || p.outCode === code)));
  return code;
}

// Passes made before exit codes existed get one the first time they are looked at.
function ensureOutCode(p) {
  if (!p.outCode) p.outCode = newCode(p.eventId);
  return p;
}

function getPass(id) {
  const p = (store.db.passes || []).find((x) => x.id === id);
  if (!p) fail(404, 'This gate pass is not valid.');
  return p;
}

const carOf = (p) => (p.carId ? store.db.cars.find((c) => c.id === p.carId) || null : null);
const isIn = (p) => { const c = carOf(p); return !!(c && c.leftAt == null); };

function where(slotId) {
  const f = alloc.findSlot(store.db, slotId);
  if (!f) return { slotLabel: '', zoneName: '', directions: '' };
  return {
    slotLabel: f.slot.label,
    zoneName: f.zone.kind === 'driveway' ? f.slot.label : f.zone.name,
    directions: String(f.zone.directions || '').replace('{house}', f.slot.house)
  };
}

// What the guest's page needs to know about its own pass.
// show: which QR the guest should have on screen now: 'in' (entry) until they are parked, then 'out' (exit).
function view(p) {
  ensureOutCode(p);
  const c = carOf(p);
  const inside = !!(c && c.leftAt == null);
  return Object.assign(
    {
      pass: { id: p.id, code: p.code, outCode: p.outCode, eventId: p.eventId, vip: p.vip },
      state: inside ? 'in' : p.lastScan === 'out' ? 'out' : 'new', show: inside ? 'out' : 'in', eventId: p.eventId
    },
    inside ? { car: Object.assign({ id: c.id, slotId: c.slotId }, where(c.slotId)) } : {}
  );
}

function create(ev, { vip = false } = {}) {
  if (ev.status === 'cancelled' || ev.status === 'finished') fail(400, 'This event is not taking cars.');
  // The pass is added first, so the exit code is checked against its own entry code too.
  const p = { id: store.randomId('p'), code: newCode(ev.id), outCode: null, eventId: ev.id, vip: !!vip, carId: null, holdId: null, lastScan: null, lastScanAt: 0, createdAt: new Date().toISOString() };
  store.db.passes.push(p);
  return view(p);
}

function setVip(id, vip) {
  const p = getPass(id);
  p.vip = !!vip;
  return view(p);
}

// The guest's page tells the pass about a hold or a car, so the gate scan uses the same space.
function linkHold(id, holdId) { const p = (store.db.passes || []).find((x) => x.id === id); if (p) p.holdId = holdId; }
function linkCar(id, carId) { const p = (store.db.passes || []).find((x) => x.id === id); if (p) { p.carId = carId; p.holdId = null; } }

// The guard scanned a pass (QR or typed code).
//   direction 'in'   the entry QR: parks the car, or says "already in"
//   direction 'out'  the exit QR: frees the space, or says the car is not inside
//   no direction     a pass link from before entry and exit QRs: works out in or out by itself
function scan(p, direction = null) {
  ensureOutCode(p);
  const ev = actions.getEvent(p.eventId);
  if (ev.status === 'cancelled') fail(400, `${ev.title} was cancelled. Do not let the car in for it.`);
  if (ev.status === 'finished' && direction !== 'out') fail(400, `${ev.title} has already ended.`);
  const base = { event: { id: ev.id, title: ev.title, date: ev.date, house: ev.house, street: ev.street }, code: direction === 'out' ? p.outCode : p.code, vip: p.vip, direction };
  const inside = isIn(p);

  if (direction === 'in' && inside) {
    return Object.assign(base, { result: 'repeat', direction: 'in' }, where(carOf(p).slotId));
  }
  if (direction === 'out' && !inside) {
    return Object.assign(base, { result: 'notin' });
  }
  if (!direction && p.lastScanAt && Date.now() - p.lastScanAt < REPEAT_MS) {
    const c = carOf(p);
    return Object.assign(base, { result: 'repeat', direction: p.lastScan, seconds: Math.round((Date.now() - p.lastScanAt) / 1000) }, c ? where(c.slotId) : {});
  }

  if (inside) {
    const c = carOf(p);
    c.leftAt = ev.live.clock;
    p.lastScan = 'out';
    p.lastScanAt = Date.now();
    const w = where(c.slotId);
    actions.log(ev, `Gate: exit pass ${p.outCode} went out. ${w.slotLabel} is free again.`);
    return Object.assign(base, { result: 'out', code: p.outCode }, w);
  }

  const hold = p.holdId ? (store.db.holds || []).find((h) => h.id === p.holdId && h.expiresAt > Date.now()) : null;
  const car = actions.autoPark(ev, { vip: p.vip, source: 'gate', holdId: hold ? hold.id : null, quiet: true });
  if (!car) {
    actions.log(ev, `Gate: pass ${p.code} arrived but every zone is full. Held at the Persiaran Elmina layby.`, 'bad');
    fail(409, 'Every parking zone is full. Ask the driver to wait at the Persiaran Elmina layby.');
  }
  car.passId = p.id;
  p.carId = car.id;
  p.holdId = null;
  p.lastScan = 'in';
  p.lastScanAt = Date.now();
  const w = where(car.slotId);
  actions.log(ev, `Gate: entry pass ${p.code} came in${p.vip ? ' (elderly or OKU)' : ''}. Sent to ${w.slotLabel}.`);
  return Object.assign(base, { result: 'in', held: !!hold, code: p.code }, w);
}

// A typed code: the entry code records in, the exit code records out.
function scanCode(ev, code) {
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length !== 6) fail(400, 'A pass code has 6 letters and numbers, for example K7P2QX.');
  const p = (store.db.passes || []).find((x) => x.eventId === ev.id && (x.code === c || x.outCode === c));
  if (!p) fail(404, `No pass ${c} for ${ev.title}. Check the code, or the event.`);
  return scan(p, p.code === c ? 'in' : 'out');
}

module.exports = { create, getPass, view, setVip, linkHold, linkCar, scan, scanCode };

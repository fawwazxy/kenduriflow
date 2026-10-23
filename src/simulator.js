'use strict';
const store = require('./store');
const alloc = require('./allocate');
const actions = require('./actions');
const { SIM_TICK_MS } = require('./config');
const { fmtTime } = require('./util');

// "Play the event": fast-forwards the event in 5-minute steps using the predicted arrivals.
// Cars leave after their usual stay. Every step is pushed to all open screens.

const timers = new Map();
let notify = () => {};

function init(opts) { if (opts && opts.notify) notify = opts.notify; }

function isRunning(id) { return timers.has(id); }

function stop(ev) {
  const t = timers.get(ev.id);
  if (t) { clearInterval(t); timers.delete(ev.id); }
  if (ev.live) ev.live.running = false;
}

function start(ev) {
  if (ev.status === 'cancelled') actions.fail(400, 'This event has been cancelled.');
  if (timers.has(ev.id)) return ev;
  const pr = alloc.plan(store.db, ev).prediction;
  if (ev.live.finished || ev.live.clock >= pr.totalSteps * pr.step) actions.resetLive(ev);
  ev.live.running = true;
  ev.status = 'live';
  actions.log(ev, ev.live.clock === 0 ? 'Event started. The guard is counting cars at the entrance.' : 'Event resumed.', 'ok');
  timers.set(ev.id, setInterval(() => tick(ev.id), SIM_TICK_MS));
  return ev;
}

function pause(ev) {
  if (!timers.has(ev.id)) return ev;
  stop(ev);
  actions.log(ev, `Paused at ${fmtTime(ev.start + ev.live.clock)}.`);
  return ev;
}

function tick(id) {
  const db = store.db;
  const ev = db.events.find((e) => e.id === id);
  if (!ev || ev.status === 'cancelled') {
    clearInterval(timers.get(id));
    timers.delete(id);
    return;
  }
  try {
    const pr = alloc.plan(db, ev).prediction;
    const k = Math.round(ev.live.clock / pr.step);

    let left = 0;
    for (const c of db.cars) {
      if (c.eventId === ev.id && c.leftAt == null && ev.live.clock >= c.arrivedAt + pr.stayMin) { c.leftAt = ev.live.clock; left++; }
    }

    const arriving = pr.arrivals[k] || 0;
    const p = alloc.plan(db, ev);
    const occ = alloc.occupancy(db);
    let placed = 0;
    let waiting = 0;
    for (let i = 0; i < arriving; i++) {
      ev.live.simCount = (ev.live.simCount || 0) + 1;
      const vip = ev.vipSpaces > 0 && ev.live.simCount % 10 === 0;
      const car = actions.autoPark(ev, { vip, source: 'sim', p, occ, quiet: true });
      if (car) placed++; else waiting++;
    }
    if (placed) {
      const nx = alloc.nextSlot(db, ev, false, p, occ);
      actions.log(ev, `${placed} car${placed > 1 ? 's' : ''} arrived.${nx ? ` Next car goes to ${actions.slotLabel(nx.slotId)}.` : ' Every zone is now full.'}`);
    }
    if (waiting) actions.log(ev, `${waiting} car${waiting > 1 ? 's' : ''} could not be placed. Every zone is full.`, 'bad');
    if (!placed && !waiting && left >= 3) actions.log(ev, `${left} cars left. Closer spaces are free again.`, 'ok');

    const onsite = db.cars.filter((c) => c.eventId === ev.id && c.leftAt == null).length;
    ev.live.history.push({ clock: ev.live.clock, n: onsite });
    ev.live.clock += pr.step;

    if (k + 1 >= pr.totalSteps) {
      stop(ev);
      actions.finishEvent(ev);
    }
    store.save();
    notify(ev.id);
  } catch (err) {
    console.error('Simulation stopped because of an error:', err);
    stop(ev);
  }
}

function stopAll() { for (const id of [...timers.keys()]) { clearInterval(timers.get(id)); timers.delete(id); } }

module.exports = { init, start, pause, stop, stopAll, isRunning };

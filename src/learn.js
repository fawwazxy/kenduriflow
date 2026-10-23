'use strict';
const { EVENT_TYPES, LEARN_WEIGHT, LEARN_MIN_CARS, RSVP_MIN, RSVP_SOFTEN } = require('./config');

/**
 * Learning from real counts, and from guests' own replies.
 *
 * 1. Past events. When an event ends, the cars the guard and guests actually counted are saved.
 *    The next prediction for that event type blends the starting assumption with what was counted:
 *
 *      people per car = (starting value x LEARN_WEIGHT + sum of counted values) / (LEARN_WEIGHT + counted events)
 *
 *    Simulated events ("Play the event") are shown for comparison but never used for learning,
 *    because they only replay the prediction. Counts far from the prediction (under half or over
 *    double) are also left out: they usually mean the guard stopped counting part-way.
 *
 * 2. This event. Guests can answer "how many people, how many cars" from the invitation link.
 *    Once enough have replied, their people per car takes over gradually from step 1, and the
 *    guest number never drops below the people who have already replied.
 */

const round2 = (n) => Math.round(n * 100) / 100;
const clamp = (v) => Math.min(6, Math.max(1, v));

// Counted events of one type, leaving out one event so an event never tunes its own estimate.
function observations(db, type, excludeId = null) {
  return (db.learning || []).filter((o) => o.type === type && o.used && o.eventId !== excludeId);
}

function tuning(db, type, excludeId = null) {
  const t = EVENT_TYPES[type] || EVENT_TYPES.wedding;
  const obs = db ? observations(db, type, excludeId) : [];
  if (!obs.length) return { peoplePerCar: t.peoplePerCar, base: t.peoplePerCar, n: 0 };
  const sum = obs.reduce((a, o) => a + o.guests / o.cars, 0);
  const v = (t.peoplePerCar * LEARN_WEIGHT + sum) / (LEARN_WEIGHT + obs.length);
  return { peoplePerCar: round2(clamp(v)), base: t.peoplePerCar, n: obs.length };
}

function replies(db, eventId) {
  const list = eventId ? (db.rsvps || []).filter((r) => r.eventId === eventId) : [];
  return {
    n: list.length,
    people: list.reduce((a, r) => a + r.people, 0),
    cars: list.reduce((a, r) => a + r.cars, 0)
  };
}

// Everything the prediction needs beyond the event itself.
function estimate(db, ev) {
  const tu = tuning(db, ev.type, ev.id || null);
  const r = replies(db, ev.id);
  const out = Object.assign({}, tu, { learned: tu.peoplePerCar, guests: Number(ev.guests) || 0, rsvp: null });
  if (r.n) {
    out.rsvp = { n: r.n, people: r.people, cars: r.cars, peoplePerCar: r.cars ? round2(r.people / r.cars) : null, weight: 0 };
    if (r.people > out.guests) out.guests = r.people;
    if (r.n >= RSVP_MIN && r.cars > 0) {
      const w = r.n / (r.n + RSVP_SOFTEN);
      out.rsvp.weight = round2(w);
      out.peoplePerCar = round2(clamp(w * (r.people / r.cars) + (1 - w) * tu.peoplePerCar));
    }
  }
  return out;
}

// Saves what was counted at an event that has just ended. Returns the observation, or null if too few cars were counted.
function record(db, ev, prediction) {
  // Guest cars only: not cars in the emergency lane, and not spaces a guest found already taken.
  const cars = db.cars.filter((c) => c.eventId === ev.id && !c.blocking);
  const simulated = cars.some((c) => c.source === 'sim');
  const counted = cars.filter((c) => ['guard', 'guest', 'gate', 'recount', 'sim'].includes(c.source)).length;
  db.learning = (db.learning || []).filter((o) => o.eventId !== ev.id);
  if (counted < LEARN_MIN_CARS) return null;
  const ratio = counted / prediction.totalCars;
  const plausible = ratio >= 0.5 && ratio <= 2;
  const o = {
    eventId: ev.id, title: ev.title, type: ev.type, date: ev.date, guests: ev.guests,
    cars: counted, peak: ev.live.peak || 0,
    predictedCars: prediction.totalCars, predictedPeak: prediction.peak,
    peoplePerCar: round2(ev.guests / counted), simulated,
    used: !simulated && plausible,
    note: simulated ? 'Simulation' : plausible ? 'Used for learning' : 'Counts look incomplete',
    recordedAt: new Date().toISOString()
  };
  db.learning.push(o);
  return o;
}

function summary(db) {
  const types = Object.entries(EVENT_TYPES).map(([type, t]) => {
    const tu = tuning(db, type);
    return { type, label: t.short, base: tu.base, used: tu.peoplePerCar, n: tu.n };
  });
  const events = (db.learning || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((o) => Object.assign({}, o, { past: !db.events.some((e) => e.id === o.eventId) }));
  return { weight: LEARN_WEIGHT, types, events };
}

module.exports = { tuning, estimate, replies, record, summary, observations };

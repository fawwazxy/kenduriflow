'use strict';
const { EVENT_TYPES, STEP_MIN, BUFFER } = require('./config');

/**
 * Prediction model: how many cars, and how many at the same time.
 *
 * 1. Total cars      = guests / people per car (depends on event type)
 * 2. Arrivals        = spread across the event in 5-minute steps using a bell curve
 *                      centred on the usual busy time for that event type
 * 3. Cars at house   = cars that arrived within the last "stay" minutes
 * 4. Spaces to plan  = busiest moment + 10% buffer
 *
 * tune (optional, from learn.estimate) replaces the starting people-per-car with one learned from
 * real counts and guest replies, and may raise the guest number when more people have replied.
 */
function predict(ev, tune = null) {
  const t = EVENT_TYPES[ev.type] || EVENT_TYPES.wedding;
  const peoplePerCar = tune ? tune.peoplePerCar : t.peoplePerCar;
  const guests = Math.max(1, Math.round(Number(tune && tune.guests ? tune.guests : ev.guests) || 0));
  const duration = Math.max(30, Math.round(Number(ev.duration) || 0));
  const start = Number(ev.start) || 0;

  const totalCars = Math.ceil(guests / peoplePerCar);
  const steps = Math.max(1, Math.round(duration / STEP_MIN));
  const staySteps = Math.max(1, Math.round(t.stayMin / STEP_MIN));

  const weights = [];
  let sum = 0;
  for (let i = 0; i < steps; i++) {
    const x = (i + 0.5) / steps;
    const w = Math.exp(-Math.pow(x - t.peakAt, 2) / (2 * t.spread * t.spread));
    weights.push(w);
    sum += w;
  }

  // Round the running total so arrivals always add up to exactly totalCars.
  const arrivals = [];
  let cum = 0;
  let prev = 0;
  for (let i = 0; i < steps; i++) {
    cum += (weights[i] / sum) * totalCars;
    const r = Math.round(cum);
    arrivals.push(r - prev);
    prev = r;
  }

  const totalSteps = steps + staySteps;
  const onsite = new Array(totalSteps).fill(0);
  for (let i = 0; i < steps; i++) {
    for (let k = i; k < Math.min(totalSteps, i + staySteps); k++) onsite[k] += arrivals[i];
  }

  let peak = 0;
  let peakStep = 0;
  onsite.forEach((v, k) => { if (v > peak) { peak = v; peakStep = k; } });

  return {
    type: ev.type,
    peoplePerCar,
    basePeoplePerCar: t.peoplePerCar,
    learnedFrom: tune ? tune.n : 0,
    learnedPeoplePerCar: tune ? tune.learned : t.peoplePerCar,
    hostGuests: Math.round(Number(ev.guests) || 0),
    rsvp: tune ? tune.rsvp : null,
    stayMin: t.stayMin,
    reason: t.reason,
    step: STEP_MIN,
    steps,
    staySteps,
    totalSteps,
    guests,
    totalCars,
    arrivals,
    onsite,
    peak,
    peakTime: start + peakStep * STEP_MIN,
    planned: Math.ceil(peak * (1 + BUFFER))
  };
}

module.exports = { predict };

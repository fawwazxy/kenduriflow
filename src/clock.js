'use strict';
const { DEMO, TIME_ZONE } = require('./config');
const { nowIn, minutesSince } = require('./util');

// Each event has a clock: minutes since its start time.
// Demo: "Play the event" moves it in 5-minute steps.
// Real system: it is the real time in the township, so every car, report and log line has its true time.

function now() { return nowIn(TIME_ZONE); }

function sync(ev) {
  if (DEMO || !ev || !ev.live) return ev;
  ev.live.clock = minutesSince(ev.date, ev.start, now());
  return ev;
}

module.exports = { sync, now };

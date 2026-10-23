'use strict';

// Two ways to run:
//   demo         npm start (or npm run demo)   sample events; pick a role, no sign-in   -> data/demo.json
//   real system  npm run live                  real accounts and sign-in codes, real clock -> data/db.json
// Running server.js with neither flag (for example in Docker) is the real system.
const DEMO = !process.argv.includes('--live') && (process.argv.includes('--demo') || process.env.KF_MODE === 'demo');

// Central settings. Change numbers here to tune the model.
module.exports = {
  PORT: Number(process.env.PORT) || 3000,
  DEMO,
  MODE: DEMO ? 'demo' : 'live',
  DATA_FILE: DEMO ? 'demo.json' : 'db.json',

  // Event dates and times are local to the township.
  TIME_ZONE: process.env.TZ_TOWNSHIP || 'Asia/Kuala_Lumpur',

  // Behind an https proxy (Render, Railway, nginx): set TRUST_PROXY=1 so sign-in cookies are marked secure.
  TRUST_PROXY: process.env.TRUST_PROXY === '1',

  // A second, secure (https) address on the local network so guard phones allow the camera for QR scanning.
  // Off when running behind a real https host (TRUST_PROXY=1), or with HTTPS_PORT=0.
  HTTPS_PORT: Number(process.env.HTTPS_PORT) || 3443,
  LOCAL_HTTPS: process.env.TRUST_PROXY !== '1' && process.env.HTTPS_PORT !== '0',

  // Sign-in codes: 6 digits, valid for CODE_MIN minutes, at most CODE_TRIES wrong attempts.
  CODE_MIN: 5,
  CODE_TRIES: 5,

  // SMS for sign-in codes (Twilio). Without these, codes are printed in the server terminal and data/sms-outbox.log.
  SMS: {
    TWILIO_SID: process.env.TWILIO_ACCOUNT_SID || '',
    TWILIO_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
    TWILIO_FROM: process.env.TWILIO_FROM || ''
  },

  // The real system finishes an event by itself this long after its end time, and saves the counts.
  AUTO_FINISH_MIN: 120,

  // Daily copies of the data file kept in data/backups.
  BACKUP_DAYS: 14,

  // The prediction works in 5-minute steps.
  STEP_MIN: 5,

  // Extra spaces planned on top of the busiest moment (10%).
  BUFFER: 0.1,

  // Reward points a neighbour earns for each guest car parked in their driveway.
  POINTS_PER_CAR: 20,

  // Demo mode only: every sign-in code is DEMO_CODE, and the sign-in page lists demo accounts.
  DEMO_CODE: '1234',
  SESSION_DAYS: 30,

  // Learning: the starting assumption counts as this many events when blended with real counts.
  LEARN_WEIGHT: 4,
  // An event needs at least this many counted cars before it is used for learning.
  LEARN_MIN_CARS: 5,

  // A guest on the way can hold a space for this many minutes, so two guests are never sent to the same one.
  HOLD_MIN: 10,

  // Guest replies ("how many people, how many cars") start shaping the estimate after this many replies.
  RSVP_MIN: 5,
  // How fast replies take over from the learned estimate: weight = replies / (replies + RSVP_SOFTEN).
  RSVP_SOFTEN: 15,

  // How fast "Play the event" runs: one 5-minute step every 600 ms.
  SIM_TICK_MS: 600,

  // Surau car park is not offered during Friday prayers (minutes after midnight).
  FRIDAY_PRAYER: { start: 12 * 60 + 15, end: 14 * 60 + 30 },

  // Starting assumptions per event type. Real counts from events can be used to tune these.
  // peoplePerCar: average people in one car
  // stayMin: how long a car usually stays
  // peakAt: when arrivals are busiest, as a fraction of the event (0 = start, 1 = end)
  // spread: how spread out arrivals are (small = everyone comes at once)
  EVENT_TYPES: {
    wedding: {
      label: 'Majlis perkahwinan (wedding)', short: 'Wedding', shortMs: 'Majlis perkahwinan',
      peoplePerCar: 3.0, stayMin: 60, peakAt: 0.35, spread: 0.25,
      reason: 'families travel together and guests arrive in waves'
    },
    kenduri: {
      label: 'Kenduri doa selamat', short: 'Kenduri', shortMs: 'Kenduri',
      peoplePerCar: 2.8, stayMin: 75, peakAt: 0.25, spread: 0.18,
      reason: 'most guests arrive in the first hour for the doa'
    },
    tahlil: {
      label: 'Tahlil', short: 'Tahlil', shortMs: 'Tahlil',
      peoplePerCar: 1.6, stayMin: 60, peakAt: 0.06, spread: 0.07,
      reason: 'many come alone and almost everyone arrives together after Maghrib'
    },
    openhouse: {
      label: 'Rumah terbuka (open house)', short: 'Open house', shortMs: 'Rumah terbuka',
      peoplePerCar: 3.5, stayMin: 45, peakAt: 0.45, spread: 0.3,
      reason: 'families visit in small groups spread across the day'
    },
    aqiqah: {
      label: 'Aqiqah', short: 'Aqiqah', shortMs: 'Aqiqah',
      peoplePerCar: 2.8, stayMin: 60, peakAt: 0.3, spread: 0.2,
      reason: 'guests arrive early for the doa and the meal'
    },
    birthday: {
      label: 'Birthday party', short: 'Birthday', shortMs: 'Majlis hari jadi',
      peoplePerCar: 2.5, stayMin: 120, peakAt: 0.08, spread: 0.08,
      reason: 'most guests arrive at the start and stay to the end'
    }
  }
};

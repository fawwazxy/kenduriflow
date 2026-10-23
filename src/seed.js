'use strict';

// Demo data: one precinct (Jalan Elmina 3/2 and 3/3), its parking zones, and sample events.
// Street names, people and events are made up for the prototype.

const DB_VERSION = 6;
const S32 = 'Jalan Elmina 3/2';
const S33 = 'Jalan Elmina 3/3';

function kerbSlots(prefix, short, y) {
  return Array.from({ length: 26 }, (_, i) => ({
    id: `${prefix}-${String(i + 1).padStart(2, '0')}`,
    label: `${short}, bay ${i + 1}`,
    x: Math.round((84 + i * 20.3) * 10) / 10,
    y, w: 17, h: 17
  }));
}

function buildPrecinct() {
  const houses = [];
  const driveSlots = [];
  for (let i = 0; i < 12; i++) {
    const x = 90 + i * 43;
    const noA = 2 + i * 2;
    houses.push({ no: noA, street: S32, row: 'A', x, y: 92, w: 38, h: 56, porch: { x: x + 2, y: 150, w: 34, h: 32 }, door: { x: x + 19, y: 182 }, numY: 125 });
    driveSlots.push({ id: `D${noA}-1`, house: noA, street: S32, label: `Driveway of No. ${noA}`, x: x + 4, y: 154, w: 14, h: 25 });
    driveSlots.push({ id: `D${noA}-2`, house: noA, street: S32, label: `Driveway of No. ${noA}`, x: x + 20, y: 154, w: 14, h: 25 });

    const noB = 1 + i * 2;
    houses.push({ no: noB, street: S33, row: 'B', x, y: 374, w: 38, h: 46, porch: { x: x + 2, y: 346, w: 34, h: 26 }, door: { x: x + 19, y: 346 }, numY: 402 });
    driveSlots.push({ id: `D${noB}-1`, house: noB, street: S33, label: `Driveway of No. ${noB}`, x: x + 4, y: 349, w: 14, h: 20 });
    driveSlots.push({ id: `D${noB}-2`, house: noB, street: S33, label: `Driveway of No. ${noB}`, x: x + 20, y: 349, w: 14, h: 20 });
  }
  houses.sort((a, b) => a.no - b.no);

  const surauSlots = Array.from({ length: 12 }, (_, i) => ({
    id: `S-${String(i + 1).padStart(2, '0')}`, label: `Surau car park, bay ${i + 1}`,
    x: 666 + (i % 6) * 21, y: 117 + Math.floor(i / 6) * 36, w: 17, h: 30
  }));
  const mallSlots = Array.from({ length: 80 }, (_, i) => ({
    id: `P2-${String(i + 1).padStart(2, '0')}`, label: `Lakeside Mall P2, bay ${i + 1}`,
    x: Math.round((666 + (i % 8) * 15.6) * 10) / 10, y: Math.round((294 + Math.floor(i / 8) * 17.2) * 10) / 10, w: 12, h: 13
  }));

  const zones = [
    {
      id: 'kerb-32', kind: 'kerb', color: 'kerb', street: S32,
      name: `Street kerb, ${S32}`, short: 'Kerb 3/2',
      directions: `Turn into ${S32} from Jalan Elmina 3. Park on the park side only, so the house side stays clear for emergency vehicles.`,
      slots: kerbSlots('K32', 'Kerb 3/2', 212)
    },
    {
      id: 'kerb-33', kind: 'kerb', color: 'kerb', street: S33,
      name: `Street kerb, ${S33}`, short: 'Kerb 3/3',
      directions: `Turn into ${S33} from Jalan Elmina 3. Park on the park side only, so the house side stays clear for emergency vehicles.`,
      slots: kerbSlots('K33', 'Kerb 3/3', 299)
    },
    {
      id: 'drive', kind: 'driveway', color: 'drive',
      name: 'Shared driveways', short: 'Driveways',
      directions: 'Park in the driveway of No. {house}. The owner has shared it for this event.',
      slots: driveSlots
    },
    {
      id: 'surau', kind: 'lot', color: 'surau', closedFridayPrayer: true,
      name: 'Surau Al-Ikhlas car park', short: 'Surau',
      directions: 'Enter from Jalan Elmina 3/1 and park at Surau Al-Ikhlas.',
      exitY: 207, countLabel: { x: 727, y: 101 },
      slots: surauSlots
    },
    {
      id: 'mall', kind: 'lot', color: 'mall', shuttle: true,
      name: 'Lakeside Mall car park, level P2', short: 'Mall + shuttle',
      directions: 'Park at level P2 of Lakeside Mall. The shuttle buggy leaves from the main lobby.',
      stop: { x: 662, y: 268 }, countLabel: { x: 727, y: 486 },
      slots: mallSlots
    }
  ];

  const shapes = [
    { t: 'rect', c: 'land', x: 0, y: 0, w: 800, h: 520 },
    { t: 'rect', c: 'road', x: 0, y: 20, w: 800, h: 40 },
    { t: 'line', c: 'lane', x1: 0, y1: 40, x2: 800, y2: 40 },
    { t: 'rect', c: 'road', x: 40, y: 60, w: 36, h: 460 },
    { t: 'rect', c: 'road', x: 620, y: 60, w: 32, h: 460 },
    { t: 'rect', c: 'road', x: 76, y: 184, w: 544, h: 48 },
    { t: 'line', c: 'lane', x1: 80, y1: 209, x2: 616, y2: 209 },
    { t: 'rect', c: 'park', x: 76, y: 232, w: 544, h: 64 },
    { t: 'line', c: 'path', x1: 86, y1: 264, x2: 610, y2: 264 },
    { t: 'rect', c: 'road', x: 76, y: 296, w: 544, h: 48 },
    { t: 'line', c: 'lane', x1: 80, y1: 319, x2: 616, y2: 319 },
    { t: 'rect', c: 'building', x: 662, y: 72, w: 130, h: 34 },
    { t: 'rect', c: 'lot', x: 662, y: 112, w: 130, h: 80 },
    { t: 'rect', c: 'building', x: 662, y: 222, w: 130, h: 62 },
    { t: 'rect', c: 'lot', x: 662, y: 290, w: 130, h: 178 }
  ];
  [104, 170, 236, 302, 368, 434].forEach((x) => shapes.push({ t: 'tree', x, y: 248, r: 7 }));
  [137, 203, 269, 335, 401, 467, 533, 599].forEach((x) => shapes.push({ t: 'tree', x, y: 281, r: 7 }));
  [110, 170, 240, 300, 370, 430, 500, 560].forEach((x, j) => shapes.push({ t: 'tree', x, y: 462 + (j % 2) * 20, r: 8 }));

  const labels = [
    { x: 96, y: 45, text: 'Persiaran Elmina', on: 'road' },
    { x: 86, y: 201, text: S32, on: 'road' },
    { x: 612, y: 257, text: 'Taman linear', on: 'park', anchor: 'end' },
    { x: 86, y: 337, text: S33, on: 'road' },
    { x: 63, y: 508, text: 'Jalan Elmina 3', on: 'road', rotate: -90 },
    { x: 641, y: 508, text: 'Jalan Elmina 3/1', on: 'road', rotate: -90 },
    { x: 727, y: 87, text: 'Surau Al-Ikhlas', on: 'building', anchor: 'middle' },
    { x: 727, y: 246, text: 'Lakeside Mall', on: 'building', anchor: 'middle' },
    { x: 727, y: 264, text: 'Shuttle stop', on: 'building', anchor: 'middle', small: true }
  ];

  return {
    name: 'Elmina Precinct 3',
    township: 'City of Elmina (demo)',
    streets: [
      { name: S32, laneY: 188, walkY: 190, statusLabel: { x: 612, y: 201 } },
      { name: S33, laneY: 323, walkY: 340, statusLabel: { x: 612, y: 337 } }
    ],
    eastRoadX: 636,
    parkPathY: 264,
    map: { width: 800, height: 520, shapes, labels },
    houses,
    zones
  };
}

function ev(seq, data) {
  return Object.assign({
    id: `ev${seq}`,
    seq,
    status: 'planned',
    vipSpaces: 0,
    live: { clock: 0, running: false, finished: false, history: [], peak: 0 }
  }, data);
}

function buildEvents() {
  return [
    ev(1, { code: 'aisyah-hakim', title: 'Majlis Aisyah & Hakim', type: 'wedding', hostName: 'Rohana Ismail', house: 12, street: S32, date: '2026-10-31', start: 720, duration: 240, guests: 500, vipSpaces: 4, createdAt: '2026-10-12T12:15:00.000Z' }),
    ev(2, { code: 'aqiqah-nur-iman', title: 'Aqiqah Nur Iman', type: 'aqiqah', hostName: 'Faizal Hamdan', house: 20, street: S32, date: '2026-10-31', start: 840, duration: 180, guests: 120, vipSpaces: 2, createdAt: '2026-10-14T09:40:00.000Z' }),
    ev(3, { code: 'tahlil-no9', title: 'Tahlil arwah Haji Osman', type: 'tahlil', hostName: 'Salmah Osman', house: 9, street: S33, date: '2026-10-31', start: 1215, duration: 75, guests: 60, createdAt: '2026-10-15T13:05:00.000Z' }),
    ev(4, { code: 'doa-selamat-16', title: 'Kenduri doa selamat rumah baru', type: 'kenduri', hostName: 'Azlan Rahim', house: 16, street: S32, date: '2026-11-06', start: 1230, duration: 90, guests: 150, vipSpaces: 2, createdAt: '2026-10-16T02:30:00.000Z' }),
    ev(5, { code: 'birthday-adam', title: 'Hari jadi Adam ke-7', type: 'birthday', hostName: 'Lim Mei Ling', house: 3, street: S33, date: '2026-11-07', start: 960, duration: 180, guests: 40, createdAt: '2026-10-16T08:10:00.000Z' }),
    ev(6, { code: 'rumah-terbuka-5', title: 'Rumah terbuka keluarga Kavitha', type: 'openhouse', hostName: 'Kavitha Raman', house: 5, street: S33, date: '2026-11-08', start: 660, duration: 300, guests: 250, vipSpaces: 2, createdAt: '2026-10-16T11:45:00.000Z' }),
    ev(7, { code: 'walimah-22', title: 'Walimatul urus Farah & Danial', type: 'wedding', hostName: 'Zainab Ahmad', house: 22, street: S32, date: '2026-11-13', start: 720, duration: 240, guests: 350, vipSpaces: 3, createdAt: '2026-10-17T01:20:00.000Z' })
  ];
}

function buildShares() {
  const list = [
    ['ev1', 4, 2], ['ev1', 6, 2], ['ev1', 14, 2], ['ev1', 16, 1], ['ev1', 22, 2], ['ev1', 24, 2],
    ['ev2', 18, 2],
    ['ev4', 10, 2], ['ev4', 14, 2],
    ['ev6', 7, 2], ['ev6', 1, 1],
    ['ev7', 18, 2], ['ev7', 24, 2]
  ];
  return list.map(([eventId, house, cars], i) => ({ id: `sh${i + 1}`, eventId, house, cars, on: true, createdAt: '2026-10-16T12:00:00.000Z' }));
}

// Accounts. Residents host events and are neighbours; the guard runs the gate; the township team sees everything.
// Phone numbers are made up. In the prototype every sign-in code is DEMO_CODE (no SMS is sent).
function buildUsers() {
  const u = (id, name, role, phone, house = null, extra = {}) => Object.assign({ id, name, role, phone, house }, extra);
  return [
    u('u1', 'Rohana Ismail', 'resident', '60123456712', 12, { demo: 'Hosting the 500-guest wedding' }),
    u('u8', 'Siti Rahmah', 'resident', '60123456714', 14, { demo: 'Neighbour two doors from the wedding' }),
    u('u9', 'Razak Ali', 'guard', '60198765401', null, { post: 'Guardhouse, Elmina Precinct 3', demo: 'Guard at the entrance' }),
    u('u10', 'Nurul Huda', 'township', '60198765402', null, { post: 'Township team, City of Elmina', demo: 'Township management' }),
    u('u2', 'Faizal Hamdan', 'resident', '60123456720', 20),
    u('u3', 'Salmah Osman', 'resident', '60123456709', 9),
    u('u4', 'Azlan Rahim', 'resident', '60123456716', 16),
    u('u5', 'Lim Mei Ling', 'resident', '60123456703', 3),
    u('u6', 'Kavitha Raman', 'resident', '60123456705', 5),
    u('u7', 'Zainab Ahmad', 'resident', '60123456722', 22)
  ];
}

// Guest replies for the walimah at No. 22: 42 households, about 2.5 people per car,
// so the estimate rises above what the host's guest count alone suggests.
function buildRsvps() {
  const people = [4, 3, 5, 2, 4, 6, 3, 4, 2, 5, 3, 4];
  const cars = [2, 1, 2, 1, 2, 2, 1, 2, 1, 2, 1, 1];
  return Array.from({ length: 42 }, (_, i) => ({
    id: `rs${i + 1}`, eventId: 'ev7', people: people[i % 12], cars: cars[i % 12],
    at: `2026-10-${String(18 + (i % 4)).padStart(2, '0')}T${String(8 + (i % 12)).padStart(2, '0')}:00:00.000Z`
  }));
}

// Past events in the precinct where the guard counted every car. Sample data that shows learning at work.
// The three weddings average exactly 3.0 people per car, so the wedding estimate is confirmed, not moved.
function buildLearning() {
  const o = (id, title, type, date, guests, cars, peak, predictedCars, predictedPeak, used = true) => ({
    eventId: id, title, type, date, guests, cars, peak, predictedCars, predictedPeak,
    peoplePerCar: Math.round((guests / cars) * 100) / 100, simulated: false, used,
    note: used ? 'Used for learning' : 'Counts look incomplete', recordedAt: `${date}T15:00:00.000Z`
  });
  return [
    o('past1', 'Majlis Nadia & Irfan', 'wedding', '2026-05-16', 435, 150, 63, 145, 61),
    o('past2', 'Walimah Siti & Hafiz', 'wedding', '2026-06-27', 620, 200, 86, 207, 87),
    o('past3', 'Majlis Farid & Aina', 'wedding', '2026-08-08', 300, 100, 41, 100, 42),
    o('past4', 'Kenduri doa selamat No. 7', 'kenduri', '2026-07-11', 200, 80, 58, 72, 52),
    o('past5', 'Kenduri cukur jambul No. 18', 'kenduri', '2026-09-05', 156, 60, 44, 56, 41),
    o('past6', 'Tahlil arwah Pak Hassan', 'tahlil', '2026-06-04', 70, 50, 49, 44, 43),
    o('past7', 'Tahlil 40 hari No. 15', 'tahlil', '2026-08-19', 90, 60, 58, 57, 55),
    o('past8', 'Tahlil arwah Mak Esah', 'tahlil', '2026-09-23', 52, 40, 39, 33, 32),
    o('past9', 'Rumah terbuka Deepavali', 'openhouse', '2025-11-02', 380, 100, 24, 109, 25),
    o('past10', 'Majlis Hana & Zul', 'wedding', '2026-09-19', 400, 61, 30, 134, 57, false)
  ];
}

// Past events per month across the township. Sample numbers for the dashboard.
function buildHistory() {
  return {
    note: 'Sample data for the prototype',
    monthly: [
      { month: 'Nov 2025', events: 26 }, { month: 'Dec 2025', events: 43, note: 'School holidays' },
      { month: 'Jan 2026', events: 19 }, { month: 'Feb 2026', events: 22 },
      { month: 'Mar 2026', events: 40, note: 'Hari Raya' }, { month: 'Apr 2026', events: 33 },
      { month: 'May 2026', events: 25 }, { month: 'Jun 2026', events: 31 },
      { month: 'Jul 2026', events: 21 }, { month: 'Aug 2026', events: 20 },
      { month: 'Sep 2026', events: 24 }, { month: 'Oct 2026', events: 17, note: 'Month to date' }
    ],
    streets: [
      { street: S32, events: 14, avgPeak: 52, kerb: 26 },
      { street: 'Jalan Elmina 2/1', events: 11, avgPeak: 61, kerb: 30 },
      { street: 'Jalan Elmina 4/5', events: 9, avgPeak: 38, kerb: 22 },
      { street: S33, events: 8, avgPeak: 29, kerb: 26 },
      { street: 'Jalan Elmina 2/3', events: 6, avgPeak: 33, kerb: 28 },
      { street: 'Jalan Elmina 5/1', events: 4, avgPeak: 24, kerb: 24 }
    ],
    insights: [
      { title: `Visitor bays on ${S32}`, finding: '14 events in 6 months with an average peak of 52 cars. The kerb holds 26.', action: 'Add about 20 visitor bays along the edge of the linear park.' },
      { title: 'Book overflow for Hari Raya and December', finding: 'March and December had nearly twice the usual number of home events.', action: 'Reserve mall overflow and two shuttle buggies for those months in advance.' },
      { title: 'A hall for Precinct 4', finding: '9 events on Jalan Elmina 4/5, and no community hall within 400 m.', action: 'Plan a multipurpose hall with its own parking in the next phase.' }
    ]
  };
}

// The real system starts with the precinct layout and nothing else: no people, no events.
// The first township admin is created on the setup page; they add residents and guards.
function seedLive() {
  return {
    version: DB_VERSION,
    seq: 100,
    users: [],
    sessions: [],
    codes: [],
    precinct: buildPrecinct(),
    events: [],
    shares: [],
    cars: [],
    reports: [],
    logs: [],
    holds: [],
    rsvps: [],
    frontage: [],
    learning: [],
    history: null
  };
}

function seed() {
  return {
    version: DB_VERSION,
    seq: 100,
    users: buildUsers(),
    sessions: [],
    precinct: buildPrecinct(),
    events: buildEvents(),
    shares: buildShares(),
    cars: [],
    reports: [],
    logs: [],
    holds: [],
    rsvps: buildRsvps(),
    // No. 21 drives out for night shifts, so the kerb opposite their gate is kept clear.
    frontage: [{ house: 21, on: true, at: '2026-10-10T10:00:00.000Z' }],
    learning: buildLearning(),
    history: buildHistory()
  };
}

module.exports = { seed, seedLive, DB_VERSION };

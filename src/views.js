'use strict';
const alloc = require('./allocate');
const learn = require('./learn');
const clock = require('./clock');
const { EVENT_TYPES, POINTS_PER_CAR, MODE } = require('./config');
const { fmtTime, fmtDate, fmtDateMs, addDays } = require('./util');
const { ISSUES, LANE_ISSUE, neighbourCount } = require('./actions');

// Shapes the data each page needs. No business rules here.

const typeShort = (t) => (EVENT_TYPES[t] || EVENT_TYPES.wedding).short;

function publicEvent(ev) {
  return {
    id: ev.id, code: ev.code, title: ev.title, type: ev.type, typeShort: typeShort(ev.type),
    typeLabel: (EVENT_TYPES[ev.type] || EVENT_TYPES.wedding).label, hostName: ev.hostName,
    house: ev.house, street: ev.street, date: ev.date, start: ev.start, duration: ev.duration,
    end: ev.start + ev.duration, guests: ev.guests, vipSpaces: ev.vipSpaces, status: ev.status, createdAt: ev.createdAt
  };
}

function summary(db, ev, memo) {
  const p = alloc.plan(db, ev, memo);
  const lots = p.zones.filter((z) => z.shuttle);
  const onsite = db.cars.filter((c) => c.eventId === ev.id && c.leftAt == null).length;
  return Object.assign(publicEvent(ev), {
    running: !!ev.live.running,
    onsite,
    totalCars: p.prediction.totalCars,
    peak: p.prediction.peak,
    peakTime: p.prediction.peakTime,
    planned: p.prediction.planned,
    walkingCapacity: p.walkingCapacity,
    shuttleCars: lots.reduce((a, z) => a + z.planned, 0),
    shortfall: p.shortfall,
    clashes: p.clashes,
    surauClosed: p.surauClosed,
    sharedDriveways: (p.zones.find((z) => z.kind === 'driveway') || { houses: [] }).houses.length
  });
}

function describeNext(db, ev, p, occ, n, vip) {
  if (!n) return null;
  const z = p.zones.find((x) => x.id === n.zoneId);
  const f = alloc.findSlot(db, n.slotId);
  return {
    zoneId: z.id, slotId: n.slotId, kind: z.kind, color: z.color,
    zoneName: z.kind === 'driveway' ? f.slot.label : z.name,
    slotLabel: f.slot.label,
    walk: z.walk,
    directions: String(z.directions || '').replace('{house}', f.slot.house),
    freeInZone: alloc.freeIn(ev, p, z, occ, vip)
  };
}

// guest: the version for the invitation link, without neighbours' reports, the guard's log or who shared driveways.
function buildState(db, ev, { baseUrl, guest = false }) {
  const p = alloc.plan(db, ev);
  const occ = alloc.occupancy(db);
  const mine = db.cars.filter((c) => c.eventId === ev.id && c.leftAt == null);

  const zones = p.zones.map((z) => {
    const zdef = alloc.zoneById(db, z.id);
    const inUse = (z.kind === 'lot' ? zdef.slots.map((s) => s.id) : z.slots).filter((id) => occ.has(id)).length;
    return {
      id: z.id, kind: z.kind, color: z.color, name: z.name, short: z.short, street: z.street,
      walk: z.walk, capacity: z.capacity, slotsTotal: z.kind === 'lot' ? zdef.slots.length : z.slots.length,
      planned: z.planned, parked: mine.filter((c) => c.zoneId === z.id).length,
      free: alloc.freeIn(ev, p, z, occ, true), inUse, closed: z.closed, houses: z.houses || null
    };
  });

  const heldMap = new Map(p.held.map((h) => [h.slotId, h.by]));
  const vipSet = new Set(p.vipSlots);
  const plannedSet = new Set(p.zones.flatMap((z) => z.plannedSlots));
  const myDrive = new Set((p.zones.find((z) => z.kind === 'driveway') || { slots: [] }).slots);
  const closedZones = new Set(p.zones.filter((z) => z.closed).map((z) => z.id));
  const slots = {};
  for (const z of db.precinct.zones) {
    for (const s of z.slots) {
      const car = occ.get(s.id);
      let st = null;
      if (car && car.hold) st = car.eventId === ev.id ? ['hold'] : ['other'];
      else if (car) st = car.eventId === ev.id ? ['car', car.vip ? 1 : 0] : ['other'];
      else if (p.keptClear.has(s.id)) st = ['keep', p.keptClear.get(s.id)];
      else if (heldMap.has(s.id)) st = ['held', heldMap.get(s.id).house];
      else if (z.kind === 'driveway' && !myDrive.has(s.id)) st = null;
      else if (closedZones.has(z.id)) st = ['closed'];
      else if (vipSet.has(s.id)) st = ['vip'];
      else if (plannedSet.has(s.id)) st = ['planned'];
      else st = ['free'];
      if (st) slots[s.id] = st;
    }
  }

  const blocking = db.cars.filter((c) => c.leftAt == null && c.blocking).map((c) => {
    const e = db.events.find((x) => x.id === c.eventId);
    return { carId: c.id, street: c.street, house: e ? e.house : null, eventId: c.eventId };
  });
  // The emergency lane counts as blocked when the guard recorded a car there, or a neighbour reported one.
  const laneReports = db.reports.filter((r) => !r.resolvedAt && r.issue === LANE_ISSUE);
  const laneStreets = [...new Set([...blocking.map((b) => b.street), ...laneReports.map((r) => r.street)])];

  const nx = alloc.nextSlot(db, ev, false, p, occ);
  const nv = alloc.nextSlot(db, ev, true, p, occ);
  const freeTotal = p.zones.reduce((a, z) => a + alloc.freeIn(ev, p, z, occ, false), 0);
  const observation = (db.learning || []).find((o) => o.eventId === ev.id) || null;

  const dayEvents = db.events
    .filter((e) => e.date === ev.date && e.status !== 'cancelled')
    .sort((a, b) => a.start - b.start)
    .map((e) => ({ id: e.id, title: e.title, typeShort: typeShort(e.type), house: e.house, street: e.street, start: e.start, end: e.start + e.duration, status: e.status }));

  const reports = db.reports.filter((r) => r.eventId === ev.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const shares = db.shares.filter((s) => s.eventId === ev.id && s.on).sort((a, b) => a.house - b.house).map((s) => ({ house: s.house, cars: s.cars }));

  const out = {
    event: publicEvent(ev),
    prediction: p.prediction,
    plan: {
      zones, vipSlots: p.vipSlots, shortfall: p.shortfall, walkingCapacity: p.walkingCapacity, shuttle: p.shuttle,
      clashes: p.clashes, overlaps: p.overlaps, surauClosed: p.surauClosed, heldCount: p.held.length,
      keptClear: [...new Set(p.keptClear.values())]
    },
    live: {
      clock: ev.live.clock, time: ev.start + ev.live.clock, running: !!ev.live.running, finished: !!ev.live.finished,
      onsite: mine.filter((c) => !c.blocking).length, peak: ev.live.peak || 0, history: ev.live.history,
      arrived: db.cars.filter((c) => c.eventId === ev.id && !c.blocking).length,
      onTheWay: (db.holds || []).filter((h) => h.eventId === ev.id && h.expiresAt > Date.now()).length,
      freeTotal,
      next: describeNext(db, ev, p, occ, nx, false),
      nextVip: describeNext(db, ev, p, occ, nv, true),
      laneBlocked: blocking.filter((b) => b.street === ev.street).length,
      laneReports: laneReports.filter((r) => r.street === ev.street).length,
      logs: db.logs.filter((l) => l.eventId === ev.id).slice(-15).reverse()
    },
    observation,
    slots,
    blocking,
    laneStreets,
    dayEvents,
    reports,
    shares,
    neighboursNotified: neighbourCount(ev),
    pickup: { date: addDays(ev.date, 1), label: `${fmtDate(addDays(ev.date, 1))}, 8:00 am`, street: ev.street },
    guestUrl: `${baseUrl}/e/${ev.code}`,
    guestPath: `/e/${ev.code}`
  };
  if (guest) {
    out.reports = [];
    out.shares = [];
    out.live.logs = [];
    out.blocking = out.blocking.map((b) => ({ street: b.street, house: b.house }));
  }
  return out;
}

// The notice a neighbour gets about an event, in English and Bahasa Melayu.
function neighbourMessage(e, p, h) {
  const type = EVENT_TYPES[e.type] || EVENT_TYPES.wedding;
  const times = `${fmtTime(e.start)} to ${fmtTime(e.start + e.duration)}`;
  const timesMs = `${fmtTime(e.start)} hingga ${fmtTime(e.start + e.duration)}`;
  const n = p.prediction.planned;
  if (e.street === h.street) {
    return {
      en: `${type.short} at No. ${e.house} on ${fmtDate(e.date)}, ${times}. About ${n} cars are expected at the busiest time. ` +
        'Guests will park on the park side of the road, in shared driveways and at the overflow car parks. Your gate will stay clear.',
      ms: `${type.shortMs} di No. ${e.house} pada ${fmtDateMs(e.date)}, ${timesMs}. Kira-kira ${n} kereta dijangka pada waktu paling sibuk. ` +
        'Tetamu akan meletak kereta di sebelah taman, di laluan masuk yang dikongsi dan di tempat letak kereta limpahan. Pagar anda akan kekal kosong.'
    };
  }
  const kz = p.zones.find((z) => z.kind === 'kerb' && z.street === h.street);
  const onMine = kz ? kz.planned : 0;
  return {
    en: `${type.short} at No. ${e.house}, ${e.street} on ${fmtDate(e.date)}, ${times}. ` + (onMine > 0
      ? `Up to ${onMine} guest cars may park on the park side of ${h.street}. The house side stays clear.`
      : 'Guests are not expected to park on your street.'),
    ms: `${type.shortMs} di No. ${e.house}, ${e.street} pada ${fmtDateMs(e.date)}, ${timesMs}. ` + (onMine > 0
      ? `Sehingga ${onMine} kereta tetamu mungkin diletak di sebelah taman ${h.street}. Sebelah rumah kekal kosong.`
      : 'Tetamu tidak dijangka meletak kereta di jalan anda.')
  };
}

function houseFeed(db, no) {
  const h = alloc.houseByNo(db, no);
  if (!h) return null;
  const memo = new Map();
  const sorted = db.events.filter((e) => e.status !== 'cancelled').sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1));
  const events = sorted.filter((e) => e.house !== h.no).map((e) => {
    const p = alloc.plan(db, e, memo);
    const share = db.shares.find((s) => s.eventId === e.id && s.house === h.no) || null;
    const parkedNow = db.cars.filter((c) => c.leftAt == null && c.eventId === e.id && c.slotId && c.slotId.startsWith(`D${h.no}-`)).length;
    return Object.assign(summary(db, e, memo), {
      sameStreet: e.street === h.street,
      canShare: e.street === h.street && e.status !== 'finished',
      share: share ? { on: share.on, cars: share.cars } : null,
      parkedNow,
      message: neighbourMessage(e, p, h)
    });
  });
  const hosting = sorted.filter((e) => e.house === h.no).map((e) => summary(db, e, memo));
  const hosted = db.cars.filter((c) => c.slotId && c.slotId.startsWith(`D${h.no}-`)).length;
  const reports = db.reports.filter((r) => r.house === h.no).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((r) => {
    const e = db.events.find((x) => x.id === r.eventId);
    return Object.assign({}, r, { eventTitle: e ? e.title : '' });
  });
  const fr = (db.frontage || []).find((f) => f.house === h.no);
  return {
    house: { no: h.no, street: h.street, hasDriveway: true },
    frontage: { on: !!(fr && fr.on), bays: alloc.baysOpposite(db, h).length },
    events, hosting, carsHosted: hosted, points: hosted * POINTS_PER_CAR, pointsPerCar: POINTS_PER_CAR,
    reports, issues: ISSUES
  };
}

function adminOverview(db) {
  const memo = new Map();
  const active = db.events.filter((e) => e.status !== 'cancelled')
    .sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1));
  const list = active.map((e) => summary(db, e, memo));

  const pairs = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (a.street === b.street && a.date === b.date && a.start < b.start + b.duration && b.start < a.start + a.duration) {
        pairs.push({ date: a.date, street: a.street, a: alloc.brief(a), b: alloc.brief(b), from: Math.max(a.start, b.start), to: Math.min(a.start + a.duration, b.start + b.duration) });
      }
    }
  }

  const reports = db.reports.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((r) => {
    const e = db.events.find((x) => x.id === r.eventId);
    return Object.assign({}, r, { eventTitle: e ? e.title : '' });
  });

  const upcoming = list.filter((e) => e.status !== 'finished');
  return {
    precinct: { name: db.precinct.name, township: db.precinct.township, houses: db.precinct.houses.length },
    kpis: {
      upcoming: upcoming.length,
      liveNow: list.filter((e) => e.status === 'live').length,
      carsPlanned: upcoming.reduce((a, e) => a + e.planned, 0),
      clashes: pairs.length,
      drivewaysShared: db.shares.filter((s) => s.on && upcoming.some((e) => e.id === s.eventId)).length,
      openReports: db.reports.filter((r) => !r.resolvedAt).length,
      laneAlerts: new Set([
        ...db.cars.filter((c) => c.leftAt == null && c.blocking).map((c) => c.street),
        ...db.reports.filter((r) => !r.resolvedAt && r.issue === LANE_ISSUE).map((r) => r.street)
      ]).size
    },
    events: list,
    cancelled: db.events.filter((e) => e.status === 'cancelled').map(publicEvent),
    clashes: pairs,
    pickups: upcoming.map((e) => ({ date: addDays(e.date, 1), label: `${fmtDate(addDays(e.date, 1))}, 8:00 am`, street: e.street, reason: `After the ${e.typeShort.toLowerCase()} at No. ${e.house}` })),
    zones: db.precinct.zones.map((z) => ({ id: z.id, name: z.name, kind: z.kind, slots: z.slots.length })),
    reports,
    learning: learn.summary(db),
    history: db.history ? Object.assign({ sample: true }, db.history) : realHistory(db, memo)
  };
}

// Planning figures from the events actually registered (real system). The demo uses sample figures instead.
function realHistory(db, memo) {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const today = clock.now().date;
  const [y, m] = today.split('-').map(Number);
  const events = db.events.filter((e) => e.status !== 'cancelled' && e.date <= today);

  const monthly = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = d.toISOString().slice(0, 7);
    monthly.push({ month: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`, events: events.filter((e) => e.date.startsWith(key)).length, note: i === 0 ? 'Month to date' : '' });
  }

  const since = new Date(Date.UTC(y, m - 7, 1)).toISOString().slice(0, 10);
  const byStreet = new Map();
  for (const e of events.filter((x) => x.date >= since)) {
    const o = (db.learning || []).find((x) => x.eventId === e.id && !x.simulated);
    const peak = o ? o.peak : alloc.plan(db, e, memo).prediction.peak;
    const s = byStreet.get(e.street) || { street: e.street, events: 0, peaks: [] };
    s.events += 1;
    s.peaks.push(peak);
    byStreet.set(e.street, s);
  }
  const streets = [...byStreet.values()].map((s) => {
    const kerb = (db.precinct.zones.find((z) => z.kind === 'kerb' && z.street === s.street) || { slots: [] }).slots.length;
    return { street: s.street, events: s.events, avgPeak: Math.round(s.peaks.reduce((a, b) => a + b, 0) / s.peaks.length), kerb };
  }).sort((a, b) => b.events - a.events);

  // Suggestions appear once there is enough history to back them up.
  const insights = [];
  for (const s of streets) {
    if (s.events >= 3 && s.avgPeak > s.kerb) {
      insights.push({ title: `Visitor bays on ${s.street}`, finding: `${s.events} events in 6 months with an average peak of ${s.avgPeak} cars. The kerb holds ${s.kerb}.`, action: `Add about ${s.avgPeak - s.kerb} visitor bays near ${s.street}.` });
    }
  }
  const counts = monthly.slice(0, 11).map((x) => x.events);
  const avg = counts.reduce((a, b) => a + b, 0) / Math.max(1, counts.length);
  const busy = monthly.slice(0, 11).filter((x) => avg >= 2 && x.events >= avg * 1.5);
  if (busy.length) insights.push({ title: 'Book overflow early for busy months', finding: `${busy.map((x) => x.month).join(', ')} had at least 1.5 times the usual number of home events.`, action: 'Reserve the mall overflow and shuttle buggies for those months next year.' });

  return { sample: false, note: 'From events registered in KenduriFlow', monthly, streets, insights };
}

function meta(db, { baseUrl, lan }) {
  const types = {};
  for (const [k, t] of Object.entries(EVENT_TYPES)) types[k] = { label: t.label, short: t.short, peoplePerCar: t.peoplePerCar, stayMin: t.stayMin };
  return { types, precinct: db.precinct, baseUrl, lan, issues: ISSUES, pointsPerCar: POINTS_PER_CAR, mode: MODE, today: clock.now().date };
}

module.exports = { publicEvent, summary, buildState, houseFeed, adminOverview, meta };

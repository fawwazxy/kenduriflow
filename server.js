'use strict';
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const QRCode = require('qrcode');

const config = require('./src/config');
const store = require('./src/store');
const alloc = require('./src/allocate');
const actions = require('./src/actions');
const sim = require('./src/simulator');
const views = require('./src/views');
const auth = require('./src/auth');
const passes = require('./src/passes');
const localHttps = require('./src/https');
const sms = require('./src/sms');
const limit = require('./src/limit');
const clock = require('./src/clock');
const { lanAddresses } = require('./src/util');

store.load();

const app = express();
const server = http.createServer(app);
const io = new Server(server);
// Live updates go out on the normal address and, when it runs, the secure one the guard's camera uses.
const ios = [io];
let securePort = null;

// Every change is pushed to all open pages, so phones and laptops stay in sync.
function notify(eventId) { for (const s of ios) s.emit('update', { eventId: eventId || null, at: Date.now() }); }
sim.init({ notify });

function lan() { const a = lanAddresses()[0]; return a ? a.address : null; }
function baseUrl() { return `http://${lan() || 'localhost'}:${config.PORT}`; }

app.disable('x-powered-by');
if (config.TRUST_PROXY) app.set('trust proxy', 1);

// Security headers: no framing, no sniffing, and scripts only from this site.
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    // The camera is allowed for this site only: the guard scans gate passes with it.
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
      "connect-src 'self' ws: wss:; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
  });
  // "Always use https" only online behind a real https host. On the local secure address it would also
  // push the normal http address to https, which has no certificate on that port.
  if (req.secure && config.TRUST_PROXY) res.set('Strict-Transport-Security', 'max-age=31536000');
  next();
});

app.use(express.json({ limit: '100kb' }));

// Changes must come as JSON. Browsers cannot send JSON to another site's server without its permission,
// so another website cannot make a signed-in person's browser change anything here (CSRF).
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !req.is('application/json')) {
    return res.status(415).json({ error: 'Send changes as JSON.' });
  }
  next();
});

app.use(auth.attach);
app.get('/healthz', (req, res) => res.json({ ok: true, mode: config.MODE }));
// The service worker must always be fresh, or phones keep an old version of the app.
app.get('/sw.js', (req, res) => { res.set('Cache-Control', 'no-cache'); res.sendFile(path.join(__dirname, 'public', 'sw.js')); });
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

const page = (file) => (req, res) => res.sendFile(path.join(__dirname, 'public', file));
app.get('/host/:id', page('host-event.html'));
app.get('/guard/:id', page('guard.html'));
app.get('/e/:code', page('guest.html'));
// A guest's gate pass QR is a link to this page: scanned with the guard's camera app, it records the car in or out.
app.get('/g/:pid', page('gate.html'));

// Wraps a route: returns JSON, turns thrown errors into readable messages.
const route = (fn, { mutates = false } = {}) => async (req, res) => {
  try {
    const out = await fn(req, res);
    if (mutates) {
      store.save();
      notify(req.params.id || (out && out.eventId) || null);
    }
    if (!res.headersSent) res.json(out === undefined ? { ok: true } : out);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server. Check the terminal for details.' : err.message });
  }
};

const state = (ev, opts = {}) => views.buildState(store.db, ev, Object.assign({ baseUrl: baseUrl() }, opts));
const GATE = ['guard', 'township'];
// Guests use the app without an account, so their buttons are rate limited per device address.
const guestLimit = (req) => limit.hit(`guest:${req.ip}`, 60, 60000);
// In the real system, event details are for signed-in people. Guests only see their invitation page.
const needSignedInLive = (req) => { if (!config.DEMO) auth.need(req); };

// ---------- sign-in ----------
app.get('/api/me', route((req) => ({ user: auth.publicUser(req.user), mode: config.MODE, needsSetup: auth.needsSetup() })));
app.get('/api/auth/demo-accounts', route(() => auth.demoAccounts()));
app.post('/api/auth/start', route((req) => auth.requestCode((req.body || {}).phone, req.ip)));
app.post('/api/auth/verify', route((req, res) => {
  const user = auth.verify(req, res, (req.body || {}).phone, (req.body || {}).code);
  store.save();
  return { user };
}));
app.post('/api/auth/demo', route((req, res) => {
  const user = auth.demo(req, res, (req.body || {}).userId);
  store.save();
  return { user };
}));
app.post('/api/auth/logout', route((req, res) => { auth.endSession(req, res); store.save(); }));

// First run of the real system: create the first township admin with the key printed in the terminal.
app.post('/api/setup', route((req, res) => {
  const user = auth.setup(req, res, req.body || {});
  store.save();
  return { user };
}));

// ---------- people (township team) ----------
app.get('/api/people', route((req) => { auth.need(req, 'township'); return auth.listUsers(); }));
app.post('/api/people', route((req) => { auth.need(req, 'township'); return auth.publicUser(auth.addUser(req.body || {})); }, { mutates: true }));
app.post('/api/people/bulk', route((req) => { auth.need(req, 'township'); return auth.bulkAdd((req.body || {}).text); }, { mutates: true }));
app.post('/api/people/:uid/remove', route((req) => auth.removeUser(auth.need(req, 'township'), req.params.uid), { mutates: true }));

// ---------- general ----------
app.get('/api/meta', route(() => Object.assign(views.meta(store.db, { baseUrl: baseUrl(), lan: lanAddresses() }), {
  secureUrl: securePort ? `https://${lan() || 'localhost'}:${securePort}` : null
})));

// The QR reader for phones without a built-in one (iPhone, most browsers). Served from this site, so it works offline.
app.get('/vendor/jsQR.js', (req, res) => {
  res.set('Cache-Control', 'public, max-age=604800');
  res.sendFile(require.resolve('jsqr/dist/jsQR.js'));
});

app.get('/api/qr.svg', async (req, res) => {
  const p = String(req.query.path || '/');
  if (!p.startsWith('/') || p.length > 200) return res.status(400).send('Bad path');
  const svg = await QRCode.toString(baseUrl() + p, { type: 'svg', margin: 1, width: 200, color: { dark: '#1C2730', light: '#FFFFFF' } });
  res.type('image/svg+xml').send(svg);
});

// ---------- events ----------
app.get('/api/events', route((req) => {
  needSignedInLive(req);
  const memo = new Map();
  return store.db.events
    .slice()
    .sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1))
    .map((e) => views.summary(store.db, e, memo));
}));

// Prediction and parking plan without saving. Used while the host fills in the form.
app.post('/api/preview', route((req) => {
  const body = req.body || {};
  const data = actions.readEventInput(body, { id: body.id || null });
  const existing = body.id ? store.db.events.find((e) => e.id === body.id) : null;
  const ev = Object.assign({}, data, existing ? { id: existing.id, seq: existing.seq } : {});
  const p = alloc.plan(store.db, ev);
  return {
    prediction: p.prediction,
    plan: {
      zones: p.zones.map((z) => ({ id: z.id, kind: z.kind, color: z.color, name: z.name, short: z.short, capacity: z.capacity, planned: z.planned, closed: z.closed, walk: z.walk, shuttle: !!z.shuttle })),
      shortfall: p.shortfall, walkingCapacity: p.walkingCapacity, shuttle: p.shuttle, clashes: p.clashes, surauClosed: p.surauClosed
    }
  };
}));

// A resident registers events at their own house. The township team can register for any house.
function ownBody(req) {
  const body = Object.assign({}, req.body || {});
  if (req.user.role === 'resident') {
    body.house = req.user.house;
    if (!String(body.hostName || '').trim()) body.hostName = req.user.name;
  }
  return body;
}

app.post('/api/events', route((req) => {
  auth.need(req, 'resident', 'township');
  const ev = actions.createEvent(ownBody(req));
  store.save();
  notify(ev.id);
  return views.publicEvent(ev);
}));

app.get('/api/events/:id', route((req) => {
  needSignedInLive(req);
  const ev = actions.getEvent(req.params.id);
  return Object.assign(views.publicEvent(ev), { canManage: auth.canManage(req.user, ev) });
}));
app.get('/api/events/:id/state', route((req) => {
  needSignedInLive(req);
  const ev = actions.getEvent(req.params.id);
  return Object.assign(state(ev), { canManage: auth.canManage(req.user, ev) });
}));
app.get('/api/e/:code', route((req) => state(actions.getEventByCode(req.params.code), { guest: true })));

app.put('/api/events/:id', route((req) => {
  auth.needManage(req, actions.getEvent(req.params.id));
  return views.publicEvent(actions.updateEvent(req.params.id, ownBody(req)));
}, { mutates: true }));

app.post('/api/events/:id/cancel', route((req) => {
  const ev = actions.getEvent(req.params.id);
  auth.needManage(req, ev);
  sim.stop(ev);
  return views.publicEvent(actions.cancelEvent(ev.id));
}, { mutates: true }));

// ---------- live parking: guests (no sign-in, just the invitation link) ----------
app.post('/api/events/:id/cars', route((req) => {
  const ev = actions.getEvent(req.params.id);
  const b = req.body || {};
  const source = b.source === 'guest' ? 'guest' : 'guard';
  if (source === 'guard') auth.need(req, ...GATE); else guestLimit(req);
  const car = actions.autoPark(ev, {
    vip: !!b.vip, source,
    slotId: typeof b.slotId === 'string' ? b.slotId : null,
    holdId: typeof b.holdId === 'string' ? b.holdId : null
  });
  if (!car) actions.fail(409, 'Every parking zone is full right now. Please wait at the Persiaran Elmina layby.');
  if (source === 'guest' && typeof b.passId === 'string') { passes.linkCar(b.passId, car.id); car.passId = b.passId; }
  const f = alloc.findSlot(store.db, car.slotId);
  return { car, slotLabel: f ? f.slot.label : '', zoneName: f ? f.zone.name : '' };
}, { mutates: true }));

// ---------- gate passes: one QR per guest car, scanned in and out ----------
app.post('/api/events/:id/passes', route((req) => {
  guestLimit(req);
  return passes.create(actions.getEvent(req.params.id), { vip: !!(req.body && req.body.vip) });
}, { mutates: true }));
app.get('/api/passes/:pid', route((req) => passes.view(passes.getPass(req.params.pid))));
app.post('/api/passes/:pid', route((req) => { guestLimit(req); return passes.setVip(req.params.pid, req.body && req.body.vip); }, { mutates: true }));
app.post('/api/passes/:pid/scan', route((req) => {
  auth.need(req, ...GATE);
  const d = req.body && req.body.direction;
  const r = passes.scan(passes.getPass(req.params.pid), d === 'in' || d === 'out' ? d : null);
  return Object.assign(r, { eventId: r.event.id });
}, { mutates: true }));
app.post('/api/events/:id/passes/scan', route((req) => {
  auth.need(req, ...GATE);
  const r = passes.scanCode(actions.getEvent(req.params.id), req.body && req.body.code);
  return Object.assign(r, { eventId: r.event.id });
}, { mutates: true }));

// Guest: "Someone is already parked here". Marks the space full; the page then shows the next free space.
app.post('/api/events/:id/slots/:slotId/taken', route((req) => {
  guestLimit(req);
  actions.markTaken(actions.getEvent(req.params.id), req.params.slotId);
}, { mutates: true }));

// Guest on the way holds a space for a few minutes, so two guests are never sent to the same one.
app.post('/api/events/:id/holds', route((req) => {
  guestLimit(req);
  const r = actions.createHold(actions.getEvent(req.params.id), { vip: !!(req.body && req.body.vip) });
  if (req.body && typeof req.body.passId === 'string') passes.linkHold(req.body.passId, r.hold.id);
  return Object.assign(r, { eventId: req.params.id });
}, { mutates: true }));
app.get('/api/holds/:hid', route((req) => actions.getHold(req.params.hid)));
app.post('/api/holds/:hid/cancel', route((req) => { guestLimit(req); return actions.cancelHold(req.params.hid); }, { mutates: true }));
app.post('/api/holds/:hid/taken', route((req) => {
  guestLimit(req);
  const r = actions.holdTaken(req.params.hid);
  if (req.body && typeof req.body.passId === 'string') passes.linkHold(req.body.passId, r.hold.id);
  return Object.assign(r, { eventId: r.hold.eventId });
}, { mutates: true }));

// Guest reply from the invitation link: how many people, how many cars.
app.post('/api/events/:id/rsvp', route((req) => {
  guestLimit(req);
  return actions.saveRsvp(actions.getEvent(req.params.id), req.body || {});
}, { mutates: true }));

app.post('/api/cars/:carId/leave', route((req) => {
  guestLimit(req);
  const car = actions.leaveCar(req.params.carId);
  return { car, eventId: car.eventId };
}, { mutates: true }));

app.get('/api/cars/:carId', route((req) => {
  const car = store.db.cars.find((c) => c.id === req.params.carId);
  if (!car) actions.fail(404, 'Parking record not found.');
  const f = alloc.findSlot(store.db, car.slotId);
  return { car, slotLabel: f ? f.slot.label : '', zoneName: f ? f.zone.name : '' };
}));

// ---------- live parking: the gate (guard or township team) ----------
const gate = (fn) => route((req, res) => { auth.need(req, ...GATE); return fn(req, res); }, { mutates: true });

app.post('/api/events/:id/cars/leave', gate((req) => actions.leaveOne(actions.getEvent(req.params.id))));
app.post('/api/events/:id/zones/:zoneId/recount', gate((req) =>
  actions.recount(actions.getEvent(req.params.id), req.params.zoneId, req.body && req.body.count)));
app.post('/api/events/:id/zones/:zoneId/add', gate((req) => actions.guardAdd(actions.getEvent(req.params.id), req.params.zoneId)));
app.post('/api/events/:id/zones/:zoneId/remove', gate((req) => actions.guardRemove(actions.getEvent(req.params.id), req.params.zoneId)));
app.post('/api/events/:id/lane/block', gate((req) => actions.laneBlock(actions.getEvent(req.params.id))));
app.post('/api/events/:id/lane/clear', gate((req) => actions.laneClear(actions.getEvent(req.params.id))));
app.post('/api/events/:id/finish', gate((req) => {
  const ev = actions.getEvent(req.params.id);
  sim.stop(ev);
  const r = actions.finishEvent(ev);
  return { event: views.publicEvent(r.event), observation: r.observation };
}));
// "Play the event" and "Reset live counts" are for presenting the demo only.
const demoOnly = () => { if (!config.DEMO) actions.fail(403, 'This is only available in demo mode.'); };
app.post('/api/events/:id/sim/start', gate((req) => { demoOnly(); sim.start(actions.getEvent(req.params.id)); }));
app.post('/api/events/:id/sim/pause', gate((req) => { demoOnly(); sim.pause(actions.getEvent(req.params.id)); }));
app.post('/api/events/:id/sim/reset', gate((req) => {
  demoOnly();
  const ev = actions.getEvent(req.params.id);
  sim.stop(ev);
  actions.resetLive(ev);
}));
app.post('/api/reports/:rid/resolve', gate((req) => {
  const r = actions.resolveReport(req.params.rid);
  return { report: r, eventId: r.eventId };
}));

// ---------- residents as neighbours (always for their own house) ----------
app.get('/api/houses/:no', route((req) => {
  const u = auth.need(req, 'resident', 'township');
  const no = Number(req.params.no);
  if (u.role === 'resident' && u.house !== no) actions.fail(403, 'You can only see the feed for your own house.');
  const feed = views.houseFeed(store.db, no);
  if (!feed) actions.fail(404, 'House not found.');
  return feed;
}));

app.post('/api/shares', route((req) => {
  const u = auth.need(req, 'resident');
  const sh = actions.setShare(Object.assign({}, req.body || {}, { house: u.house }));
  return { share: sh, eventId: sh.eventId };
}, { mutates: true }));

app.post('/api/reports', route((req) => {
  const u = auth.need(req, 'resident');
  const r = actions.addReport(Object.assign({}, req.body || {}, { house: u.house }));
  return { report: r, eventId: r.eventId };
}, { mutates: true }));

// Neighbour: keep the kerb opposite my gate clear.
app.post('/api/frontage', route((req) => {
  const u = auth.need(req, 'resident');
  return actions.setFrontage({ house: u.house, on: !!(req.body && req.body.on) });
}, { mutates: true }));

// ---------- township team ----------
app.get('/api/admin/overview', route((req) => { auth.need(req, 'township'); return views.adminOverview(store.db); }));

app.post('/api/admin/reset', route((req) => {
  auth.need(req, 'township');
  sim.stopAll();
  store.reset();
}, { mutates: true }));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));

// Holds run out after a few minutes. Free those spaces and tell every open screen.
setInterval(() => {
  const ids = actions.pruneHolds();
  if (ids.length) { store.save(); ids.forEach((id) => notify(id)); }
}, 15000).unref();

// Real system: every 30 seconds, keep each event on real time.
//  - While an event is live, the number of cars is recorded every 5 minutes (the "counted cars" line on the chart).
//  - AUTO_FINISH_MIN after the end time, the event finishes by itself and its counts are saved for learning.
function liveTick() {
  const changed = new Set();
  for (const ev of store.db.events) {
    if (ev.status === 'cancelled' || ev.status === 'finished') continue;
    clock.sync(ev);
    const c = ev.live.clock;
    if (ev.status === 'live' && c >= 0) {
      const slot = Math.floor(c / config.STEP_MIN) * config.STEP_MIN;
      const last = ev.live.history[ev.live.history.length - 1];
      if (!last || last.clock < slot) {
        const n = store.db.cars.filter((x) => x.eventId === ev.id && x.leftAt == null && !x.blocking).length;
        ev.live.history.push({ clock: slot, n });
        changed.add(ev.id);
      }
    }
    if (c > ev.duration + config.AUTO_FINISH_MIN) {
      if (ev.status === 'live') {
        actions.finishEvent(ev);
        actions.log(ev, 'Finished automatically after the end time.');
      } else {
        ev.status = 'finished';
        ev.live.finished = true;
      }
      changed.add(ev.id);
    }
  }
  if (changed.size) { store.save(); changed.forEach((id) => notify(id)); }
}
if (!config.DEMO) { liveTick(); setInterval(liveTick, 30000).unref(); }

server.listen(config.PORT, '0.0.0.0', async () => {
  const addrs = lanAddresses();
  // The secure address for guard phones (camera). Not needed online behind a real https host.
  let secureProblem = '';
  if (config.LOCAL_HTTPS) {
    try {
      const secure = await localHttps.start(app, config.HTTPS_PORT, addrs.map((a) => a.address));
      ios.push(new Server(secure));
      securePort = config.HTTPS_PORT;
    } catch (err) {
      secureProblem = err.code === 'EADDRINUSE' ? `port ${config.HTTPS_PORT} is already in use` : err.message;
    }
  }
  console.log('');
  console.log('  KenduriFlow is running.');
  console.log('');
  console.log(`  On this computer:  http://localhost:${config.PORT}`);
  if (addrs.length) {
    console.log(`  On your phone:     http://${addrs[0].address}:${config.PORT}   (same Wi-Fi)`);
    addrs.slice(1).forEach((a) => console.log(`                     http://${a.address}:${config.PORT}   (${a.name})`));
  }
  if (securePort) {
    console.log('');
    console.log(`  Guard phones (QR camera):  https://${addrs.length ? addrs[0].address : 'localhost'}:${securePort}`);
    console.log('    The phone warns once that the connection is not private: tap Advanced, then Proceed / Visit this website.');
  } else if (secureProblem) {
    console.log('');
    console.log(`  The secure address for the guard's camera could not start (${secureProblem}). Guards can still type pass codes.`);
  }
  console.log('');
  if (config.DEMO) {
    console.log('  DEMO: sample events. No sign-in: open the address and choose Township team, Guard, Resident or Guest.');
    console.log('  Switch role any time from the button next to the logo.');
    console.log('  Data is saved in data/demo.json. "Reset demo data" on the Township page puts it back.');
    console.log('  For the real system with sign-in, run:  npm run live');
  } else {
    console.log(`  REAL SYSTEM. Data is saved in data/db.json, with daily copies in data/backups. Time zone: ${config.TIME_ZONE}.`);
    const key = auth.setupKeyForStartup();
    if (key) {
      console.log('');
      console.log('  First time: open /setup and create the first township admin.');
      console.log(`  Setup key:  ${key}`);
    }
    if (!sms.configured()) {
      console.log('');
      console.log('  SMS is not set up yet. Sign-in codes are printed here and saved in data/sms-outbox.log.');
      console.log('  To send real SMS, set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM (see README).');
    }
  }
  console.log('');
  console.log('  Press Ctrl+C to stop.');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${config.PORT} is already in use. Close the other terminal running KenduriFlow, or run with another port:`);
    console.error('    PowerShell:  $env:PORT=3001; npm start');
    console.error('    Command Prompt:  set PORT=3001 && npm start\n');
    process.exit(1);
  }
  throw err;
});

'use strict';
const crypto = require('crypto');
const store = require('./store');
const sms = require('./sms');
const limit = require('./limit');
const { DEMO, DEMO_CODE, SESSION_DAYS, CODE_MIN, CODE_TRIES } = require('./config');

/**
 * Sign-in by phone number and a one-time code.
 *
 * Roles:
 *   resident  hosts events at their own house, and is a neighbour for everyone else's
 *   guard     runs the entrance: counts cars, emergency lane, reports
 *   township  the township team: sees and manages everything, and adds the people
 *
 * Guests never sign in. The invitation link is all they need.
 *
 * Real system: a random 6-digit code goes by SMS, is stored only as a hash, expires after CODE_MIN
 * minutes and allows CODE_TRIES wrong attempts. Sessions are stored as hashes too.
 * Demo: the code is always DEMO_CODE and the sign-in page offers one-tap demo accounts.
 */

const COOKIE = 'kf_session';
const MAX_AGE = SESSION_DAYS * 24 * 3600;
const ROLES = ['resident', 'guard', 'township'];
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  throw e;
}

// "012-345 6712", "+60 12 345 6712" -> "60123456712"
function normalizePhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '6' + d;
  if (!d.startsWith('60')) d = '60' + d;
  return d;
}

function checkPhone(p) {
  const d = normalizePhone(p);
  if (!/^601\d{8,9}$/.test(d)) fail(400, 'Enter a Malaysian mobile number, for example 012-345 6712.');
  return d;
}

// "60123456712" -> "+60 12-345 6712"
function showPhone(d) {
  const m = /^60(\d{2})(\d{3})(\d{3,4})$/.exec(d || '');
  return m ? `+60 ${m[1]}-${m[2]} ${m[3]}` : d;
}

function publicUser(u) {
  if (!u) return null;
  const h = u.house ? store.db.precinct.houses.find((x) => x.no === u.house) : null;
  return {
    id: u.id, name: u.name, role: u.role, house: u.house, street: h ? h.street : null,
    post: u.post || null, phone: showPhone(u.phone)
  };
}

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

// Express middleware: req.user is the signed-in account, or null.
function attach(req, res, next) {
  const token = cookies(req)[COOKIE];
  const db = store.db;
  const hash = token ? sha(token) : null;
  const s = hash ? (db.sessions || []).find((x) => x.hash === hash && x.expiresAt > Date.now()) : null;
  req.user = s ? db.users.find((u) => u.id === s.userId && !u.disabled) || null : null;
  next();
}

function setCookie(req, res, value, maxAge) {
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${req.secure ? '; Secure' : ''}`);
}

function startSession(req, res, user) {
  const db = store.db;
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions = (db.sessions || []).filter((s) => s.expiresAt > Date.now());
  db.sessions.push({ hash: sha(token), userId: user.id, createdAt: Date.now(), expiresAt: Date.now() + MAX_AGE * 1000 });
  setCookie(req, res, token, MAX_AGE);
  user.lastSignIn = new Date().toISOString();
  return publicUser(user);
}

function endSession(req, res) {
  const token = cookies(req)[COOKIE];
  if (token) store.db.sessions = (store.db.sessions || []).filter((s) => s.hash !== sha(token));
  setCookie(req, res, '', 0);
}

const userByPhone = (d) => store.db.users.find((x) => x.phone === d && !x.disabled) || null;

// Step 1: the phone number. Sends a code if the number belongs to an account.
// The reply is the same either way, so the page cannot be used to find out who lives here.
async function requestCode(phone, ip) {
  const d = checkPhone(phone);
  limit.hit(`code-ip:${ip}`, 10, 10 * 60000);
  limit.hit(`code-phone:${d}`, 3, 10 * 60000);
  const u = userByPhone(d);
  if (DEMO) {
    if (!u) fail(404, 'No demo account uses that number. Try one of the demo accounts below.');
    return { phone: showPhone(d), digits: DEMO_CODE.length, demoCode: DEMO_CODE };
  }
  if (u) {
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const salt = crypto.randomBytes(8).toString('hex');
    const db = store.db;
    db.codes = db.codes.filter((c) => c.phone !== d && c.expiresAt > Date.now());
    db.codes.push({ phone: d, salt, hash: sha(salt + code), expiresAt: Date.now() + CODE_MIN * 60000, tries: 0 });
    await sms.send(d, `Your KenduriFlow sign-in code is ${code}. It expires in ${CODE_MIN} minutes. Never share it with anyone.`);
  }
  return { phone: showPhone(d), digits: 6, smsReady: sms.configured() };
}

// Step 2: the code.
function verify(req, res, phone, code) {
  const d = checkPhone(phone);
  limit.hit(`verify-ip:${req.ip}`, 20, 10 * 60000);
  const given = String(code || '').trim();
  if (DEMO) {
    const u = userByPhone(d);
    if (!u || given !== DEMO_CODE) fail(401, 'That code is not right. Check it and try again.');
    return startSession(req, res, u);
  }
  const db = store.db;
  const c = db.codes.find((x) => x.phone === d && x.expiresAt > Date.now());
  if (!c) fail(401, 'This code has expired or was never sent. Ask for a new code.');
  c.tries += 1;
  const ok = crypto.timingSafeEqual(Buffer.from(sha(c.salt + given)), Buffer.from(c.hash));
  if (!ok) {
    if (c.tries >= CODE_TRIES) { db.codes = db.codes.filter((x) => x !== c); fail(401, 'Too many wrong codes. Ask for a new code.'); }
    fail(401, `That code is not right. ${CODE_TRIES - c.tries} ${CODE_TRIES - c.tries === 1 ? 'try' : 'tries'} left.`);
  }
  db.codes = db.codes.filter((x) => x !== c);
  const u = userByPhone(d);
  if (!u) fail(401, 'This account is no longer active. Contact the township office.');
  return startSession(req, res, u);
}

// Demo only: one-tap sign-in to a demo account.
function demo(req, res, userId) {
  if (!DEMO) fail(404, 'Not found.');
  const u = store.db.users.find((x) => x.id === userId && x.demo);
  if (!u) fail(404, 'Demo account not found.');
  return startSession(req, res, u);
}

function demoAccounts() {
  if (!DEMO) return [];
  return store.db.users.filter((u) => u.demo).map((u) => Object.assign(publicUser(u), { demo: u.demo }));
}

// ---------- first run: the first township admin ----------

// Printed in the server terminal at start-up while the system has no township admin.
// Whoever runs the server can read it; someone who only found the web address cannot.
let setupKey = null;
const needsSetup = () => !DEMO && !store.db.users.some((u) => u.role === 'township' && !u.disabled);

function setupKeyForStartup() {
  if (!needsSetup()) return null;
  if (!setupKey) setupKey = crypto.randomBytes(4).toString('hex').toUpperCase();
  return setupKey;
}

function setup(req, res, { key, name, phone }) {
  if (!needsSetup()) fail(409, 'This system is already set up. Sign in instead.');
  limit.hit(`setup-ip:${req.ip}`, 10, 10 * 60000);
  if (!setupKey || String(key || '').trim().toUpperCase() !== setupKey) fail(401, 'That setup key is not right. It is printed in the server terminal.');
  const u = addUser({ name, phone, role: 'township', post: 'Township team' });
  setupKey = null;
  return startSession(req, res, u);
}

// ---------- people (township team) ----------

function cleanName(n) {
  const s = String(n || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (s.length < 2) fail(400, 'Enter the person\'s name.');
  return s;
}

function addUser({ name, phone, role, house, post }) {
  const db = store.db;
  if (!ROLES.includes(role)) fail(400, 'Choose resident, guard or township team.');
  const d = checkPhone(phone);
  if (db.users.some((u) => u.phone === d && !u.disabled)) fail(409, `${showPhone(d)} already has an account.`);
  let h = null;
  if (role === 'resident') {
    h = db.precinct.houses.find((x) => x.no === Number(house));
    if (!h) fail(400, 'Choose the resident\'s house.');
  }
  const u = {
    id: store.randomId('u'), name: cleanName(name), role, phone: d, house: h ? h.no : null,
    post: role === 'resident' ? null : String(post || (role === 'guard' ? 'Guardhouse' : 'Township team')).slice(0, 60),
    createdAt: new Date().toISOString()
  };
  db.users.push(u);
  return u;
}

// One person per line: "Name, phone, house number" (residents) or "Name, phone, guard".
function bulkAdd(text) {
  const added = [];
  const errors = [];
  String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 500).forEach((line, i) => {
    const [name, phone, third] = line.split(/[,\t;]/).map((x) => (x || '').trim());
    try {
      const role = /^guard$/i.test(third) ? 'guard' : /^township/i.test(third) ? 'township' : 'resident';
      added.push(publicUser(addUser({ name, phone, role, house: role === 'resident' ? Number(third) : null })));
    } catch (err) {
      errors.push(`Line ${i + 1} (${line.slice(0, 40)}): ${err.message}`);
    }
  });
  return { added, errors };
}

function removeUser(actor, id) {
  const db = store.db;
  const u = db.users.find((x) => x.id === id && !x.disabled);
  if (!u) fail(404, 'Person not found.');
  if (u.id === actor.id) fail(400, 'You cannot remove your own account.');
  // Accounts are switched off, not deleted, so past reports and events still show who they were.
  u.disabled = true;
  u.disabledAt = new Date().toISOString();
  db.sessions = db.sessions.filter((s) => s.userId !== u.id);
  return publicUser(u);
}

function listUsers() {
  return store.db.users.filter((u) => !u.disabled)
    .map((u) => Object.assign(publicUser(u), { lastSignIn: u.lastSignIn || null, createdAt: u.createdAt || null }))
    .sort((a, b) => (a.role === b.role ? (a.house || 0) - (b.house || 0) || a.name.localeCompare(b.name) : ROLES.indexOf(a.role) - ROLES.indexOf(b.role)));
}

// ---------- permissions ----------

function need(req, ...roles) {
  if (!req.user) fail(401, 'Please sign in first.');
  if (roles.length && !roles.includes(req.user.role)) fail(403, 'Your account cannot do this.');
  return req.user;
}

// A resident manages events at their own house. The township team manages all of them.
function canManage(user, ev) {
  return !!user && (user.role === 'township' || (user.role === 'resident' && user.house === ev.house));
}

function needManage(req, ev) {
  const u = need(req, 'resident', 'township');
  if (!canManage(u, ev)) fail(403, 'Only the host of this event or the township team can change it.');
  return u;
}

module.exports = {
  attach, need, needManage, canManage, requestCode, verify, demo, demoAccounts, endSession, publicUser, normalizePhone,
  needsSetup, setupKeyForStartup, setup, addUser, bulkAdd, removeUser, listUsers
};

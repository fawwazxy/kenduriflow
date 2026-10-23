'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DEMO, DATA_FILE, BACKUP_DAYS } = require('./config');
const { seed, seedLive, DB_VERSION } = require('./seed');

// Data is kept in memory and saved to one JSON file: data/db.json (real system) or data/demo.json (demo).
// Writes go to a temporary file first, then replace the old one, so a crash never leaves half a file.
// A copy is kept every day in data/backups.
const DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DIR, DATA_FILE);
const BACKUPS = path.join(DIR, 'backups');
const fresh = () => (DEMO ? seed() : seedLive());

let db = null;
let timer = null;

function load() {
  try {
    if (fs.existsSync(FILE)) {
      const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      if (data && data.version === DB_VERSION) db = data;
      else if (data && !DEMO) {
        // Never throw away real data: keep the old file next to the new one.
        fs.copyFileSync(FILE, FILE.replace(/\.json$/, `.v${data.version || 0}.json`));
        console.warn(`  data/${DATA_FILE} was saved by an older version. It was kept as a copy and a fresh one started.`);
      }
    }
  } catch (err) {
    console.warn(`Could not read data/${DATA_FILE}.`, err.message);
    if (!DEMO && fs.existsSync(FILE)) {
      // A damaged real data file is kept for recovery, never overwritten.
      fs.copyFileSync(FILE, `${FILE}.damaged-${Date.now()}`);
    }
  }
  if (!db) db = fresh();
  // Lists added after the first version of the data file.
  for (const k of ['learning', 'holds', 'rsvps', 'frontage', 'sessions', 'users', 'codes', 'passes']) if (!Array.isArray(db[k])) db[k] = [];
  // A server restart stops any running simulation.
  db.events.forEach((e) => { if (e.live) e.live.running = false; });
  saveNow();
  return db;
}

function backup() {
  if (DEMO || !fs.existsSync(FILE)) return;
  fs.mkdirSync(BACKUPS, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  const target = path.join(BACKUPS, `db-${day}.json`);
  if (!fs.existsSync(target)) fs.copyFileSync(FILE, target);
  const old = fs.readdirSync(BACKUPS).filter((f) => /^db-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse().slice(BACKUP_DAYS);
  old.forEach((f) => fs.unlinkSync(path.join(BACKUPS, f)));
}

function saveNow() {
  clearTimeout(timer);
  timer = null;
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
  fs.renameSync(tmp, FILE);
  try { backup(); } catch (err) { console.error('Backup failed:', err.message); }
}

// Writes are grouped so the file is not rewritten on every car during a simulation.
function save() {
  if (timer) return;
  timer = setTimeout(() => { timer = null; try { saveNow(); } catch (err) { console.error('Save failed:', err.message); } }, 300);
}

// Demo only: put the sample data back.
function reset() {
  if (!DEMO) throw Object.assign(new Error('Resetting is only possible in demo mode.'), { status: 403 });
  // Resetting the demo data keeps everyone signed in.
  const sessions = db ? db.sessions : [];
  db = fresh();
  db.passes = [];
  db.sessions = (sessions || []).filter((s) => db.users.some((u) => u.id === s.userId));
  saveNow();
  return db;
}

function nextId(prefix) {
  db.seq = (db.seq || 100) + 1;
  return `${prefix}${db.seq}`;
}

// Ids that guests hold in their phone (cars, holds, replies) cannot be guessed.
function randomId(prefix) {
  return `${prefix}_${crypto.randomBytes(12).toString('base64url')}`;
}

module.exports = {
  get db() { return db; },
  load, save, saveNow, reset, nextId, randomId, FILE
};

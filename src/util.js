'use strict';
const os = require('os');

function pad(n) { return String(n).padStart(2, '0'); }

// Minutes after midnight -> "1:40 pm"
function fmtTime(min) {
  min = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(min / 60);
  const m = min % 60;
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${pad(m)} ${h >= 12 ? 'pm' : 'am'}`;
}

// "13:40" -> 820
function parseTime(s) {
  if (typeof s === 'number' && Number.isFinite(s)) return Math.round(s);
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

function toHHMM(min) { return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`; }

function parseDate(d) {
  const [y, m, dd] = String(d).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, dd));
}

function isDate(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d || ''))) return false;
  const o = parseDate(d);
  return !Number.isNaN(o.getTime()) && o.toISOString().slice(0, 10) === d;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-10-31" -> "Sat 31 Oct"
function fmtDate(d) {
  const o = parseDate(d);
  return `${DAYS[o.getUTCDay()]} ${o.getUTCDate()} ${MONTHS[o.getUTCMonth()]}`;
}

const DAYS_MS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const MONTHS_MS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis'];

// "2026-10-31" -> "Sabtu 31 Okt"
function fmtDateMs(d) {
  const o = parseDate(d);
  return `${DAYS_MS[o.getUTCDay()]} ${o.getUTCDate()} ${MONTHS_MS[o.getUTCMonth()]}`;
}

function addDays(d, n) {
  const o = parseDate(d);
  o.setUTCDate(o.getUTCDate() + n);
  return o.toISOString().slice(0, 10);
}

function dayOfWeek(d) { return parseDate(d).getUTCDay(); }

function overlap(a1, a2, b1, b2) { return a1 < b2 && b1 < a2; }

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// The township's date and time right now, whatever time zone the server runs in.
// -> { date: '2026-10-31', min: 820 }
function nowIn(timeZone, at = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(at).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, min: Number(parts.hour) * 60 + Number(parts.minute) };
}

// Minutes from the start of an event until now (negative before it starts).
function minutesSince(date, startMin, now) {
  const days = Math.round((parseDate(now.date) - parseDate(date)) / 86400000);
  return days * 1440 + now.min - startMin;
}

// Finds the address other devices on the same Wi-Fi can use to reach this computer.
function lanAddresses() {
  const out = [];
  const nets = os.networkInterfaces();
  for (const [name, list] of Object.entries(nets)) {
    for (const n of list || []) {
      if ((n.family === 'IPv4' || n.family === 4) && !n.internal) out.push({ name, address: n.address });
    }
  }
  const score = (a) => {
    let s = 0;
    if (/wi-?fi|wlan|wireless/i.test(a.name)) s += 4;
    if (/ethernet|^eth|^en\d/i.test(a.name)) s += 2;
    if (/^192\.168\./.test(a.address)) s += 2;
    if (/^10\./.test(a.address)) s += 1;
    if (/vethernet|virtual|vmware|vbox|virtualbox|docker|wsl|hyper-v|bluetooth|tailscale|zerotier/i.test(a.name)) s -= 10;
    if (/^169\.254\./.test(a.address)) s -= 10;
    return s;
  };
  return out.sort((a, b) => score(b) - score(a));
}

module.exports = { pad, fmtTime, parseTime, toHHMM, parseDate, isDate, fmtDate, fmtDateMs, addDays, dayOfWeek, overlap, todayLocal, nowIn, minutesSince, lanAddresses };

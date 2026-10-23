// Shared helpers for every page.

// Line icons (24 x 24, drawn with the current text colour).
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.8c2 .7 3.2 2.5 3.5 5.2"/>',
  chart: '<path d="M4 20V11"/><path d="M10 20V5"/><path d="M16 20v-8"/><path d="M21 20H3"/>',
  car: '<path d="M4 16.5V12l2.2-5h11.6L20 12v4.5z"/><path d="M4 12h16"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/>',
  alert: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5"/><path d="M12 17.5v.01"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  walk: '<circle cx="13" cy="4.5" r="1.8"/><path d="m8.5 21 3-7.5 3 3V21"/><path d="M7 11.5 10 8l3.5 2.5 3.5 1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  oku: '<circle cx="11" cy="4.5" r="1.8"/><path d="M11 7.5V13h5l2.5 5.5"/><path d="M8.2 10.5a6 6 0 1 0 7.6 8.6"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  finish: '<path d="M5 21V4"/><path d="M5 4h14v9H5"/><path d="M9.5 4v9M14.5 4v9M5 8.5h14"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  bus: '<rect x="4" y="3.5" width="16" height="14" rx="2.5"/><path d="M4 10.5h16"/><path d="M7 21v-3.5M17 21v-3.5"/><circle cx="8" cy="14" r=".6"/><circle cx="16" cy="14" r=".6"/>',
  gate: '<path d="M3 21V8l9-5 9 5v13"/><path d="M7 21v-9h10v9"/><path d="M12 12v9"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>',
  download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
  logout: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.9 7.6-4.4M8.2 13.1l7.6 4.4"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>'
};

export function icon(name, cls = '') {
  return `<svg class="i${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

export const ZONE_COLORS = { kerb: '#2F6EBA', drive: '#C27C0E', surau: '#1F8A70', mall: '#8E4FB5' };
export const zoneColor = (c) => ZONE_COLORS[c] || '#6C7A85';

export const STATUS = {
  planned: ['Planned', 'info', 'Dirancang'],
  live: ['Live', 'live', 'Sedang berlangsung'],
  finished: ['Finished', 'ok', 'Tamat'],
  cancelled: ['Cancelled', 'bad', 'Dibatalkan']
};

export function statusBadge(status) {
  const [label, kind, ms] = STATUS[status] || [status, '', status];
  return `<span class="badge ${kind}">${t(label, ms)}</span>`;
}

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const byId = (id) => document.getElementById(id);
export const pad = (n) => String(n).padStart(2, '0');

// ---------- language: English or Bahasa Melayu (guest and neighbour pages) ----------
// Pages call enableLang(). Other pages always use English.
let I18N = false;
const LANG_KEY = 'kf-lang';

export function lang() {
  if (!I18N) return 'en';
  try { const l = localStorage.getItem(LANG_KEY); if (l === 'en' || l === 'ms') return l; } catch (e) { /* private mode */ }
  return /^(ms|id)/i.test(navigator.language || '') ? 'ms' : 'en';
}

// t('Park here', 'Letak kereta di sini')
export const t = (en, ms) => (lang() === 'ms' ? ms : en);

// The person's chosen language, on every page. Used for the tabs, which appear everywhere.
function prefLang() {
  try { const l = localStorage.getItem(LANG_KEY); if (l === 'en' || l === 'ms') return l; } catch (e) { /* private mode */ }
  return /^(ms|id)/i.test(navigator.language || '') ? 'ms' : 'en';
}
const tp = (en, ms) => (prefLang() === 'ms' ? ms : en);

// Elements with data-ms="..." swap between their English HTML and the Malay text.
function applyStatic() {
  document.documentElement.lang = lang();
  document.querySelectorAll('[data-ms]').forEach((el) => {
    if (el.dataset.en == null) el.dataset.en = el.innerHTML;
    el.innerHTML = lang() === 'ms' ? el.dataset.ms : el.dataset.en;
  });
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang())));
  const conn = byId('conn');
  if (conn && conn.classList.contains('on')) conn.textContent = t('Live updates on', 'Kemas kini langsung');
}

// Turns on the language switch: <span class="langsw" id="langSw"></span> in the top bar.
export function enableLang(onChange) {
  I18N = true;
  const sw = byId('langSw');
  if (sw) {
    sw.innerHTML = '<button type="button" data-lang="en" aria-label="English">EN</button><button type="button" data-lang="ms" aria-label="Bahasa Melayu">BM</button>';
    sw.addEventListener('click', (e) => {
      const b = e.target.closest('[data-lang]');
      if (!b) return;
      try { localStorage.setItem(LANG_KEY, b.dataset.lang); } catch (err) { /* private mode */ }
      applyStatic();
      if (chrome) drawChrome(chrome.me, chrome.navKey);
      labelRoleChip();
      if (onChange) onChange();
    });
  }
  applyStatic();
}

// Malay for the place names and directions the server sends in English.
const MS_RULES = [
  [/^Kerb (\S+), bay (\d+)$/, 'Tepi jalan $1, petak $2'],
  [/^Driveway of No\. (\d+)$/, 'Laluan masuk No. $1'],
  [/^Surau car park, bay (\d+)$/, 'Tempat letak surau, petak $1'],
  [/^Lakeside Mall P2, bay (\d+)$/, 'Lakeside Mall P2, petak $1'],
  [/^Street kerb, (.+)$/, 'Tepi jalan, $1'],
  [/^Shared driveways$/, 'Laluan masuk jiran'],
  [/^Surau Al-Ikhlas car park$/, 'Tempat letak kereta Surau Al-Ikhlas'],
  [/^Lakeside Mall car park, level P2$/, 'Tempat letak kereta Lakeside Mall, aras P2'],
  [/^1 min walk$/, '1 minit berjalan kaki'],
  [/^1 to 2 min walk$/, '1 hingga 2 minit berjalan kaki'],
  [/^(\d+) min walk through the linear park$/, '$1 minit berjalan kaki melalui taman linear'],
  [/^Shuttle every (\d+) min, (\d+) min ride$/, 'Bas ulang-alik setiap $1 minit, perjalanan $2 minit'],
  [/^Shuttle buggy to the house$/, 'Bas ulang-alik ke rumah'],
  [/^Turn into (.+) from Jalan Elmina 3\. Park on the park side only, so the house side stays clear for emergency vehicles\.$/,
    'Masuk ke $1 dari Jalan Elmina 3. Letak kereta di sebelah taman sahaja supaya sebelah rumah kekal kosong untuk kenderaan kecemasan.'],
  [/^Park in the driveway of No\. (\d+)\. The owner has shared it for this event\.$/,
    'Letak kereta di laluan masuk rumah No. $1. Pemiliknya telah berkongsi untuk majlis ini.'],
  [/^Enter from Jalan Elmina 3\/1 and park at Surau Al-Ikhlas\.$/, 'Masuk dari Jalan Elmina 3/1 dan letak kereta di Surau Al-Ikhlas.'],
  [/^Park at level P2 of Lakeside Mall\. The shuttle buggy leaves from the main lobby\.$/,
    'Letak kereta di aras P2 Lakeside Mall. Bas ulang-alik bertolak dari lobi utama.']
];

export function tx(s) {
  s = String(s == null ? '' : s);
  if (lang() !== 'ms') return s;
  for (const [re, out] of MS_RULES) if (re.test(s)) return s.replace(re, out);
  return s;
}

export function fmtTime(min) {
  min = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(min / 60);
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${pad(min % 60)} ${h >= 12 ? 'pm' : 'am'}`;
}

export function fmtHour(min) {
  const h = Math.floor(min / 60) % 24;
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12} ${h >= 12 ? 'pm' : 'am'}`;
}

export const toHHMM = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

function dateObj(d) { const [y, m, dd] = String(d).split('-').map(Number); return new Date(y, m - 1, dd); }

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_MS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const MONTHS_MS = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];

// "Sat 31 Oct" (or "Sab 31 Okt")
export function fmtDate(d) {
  const o = dateObj(d);
  if (lang() === 'ms') return `${DAYS_MS[o.getDay()].slice(0, 3)} ${o.getDate()} ${MONTHS_MS[o.getMonth()].slice(0, 3)}`;
  return `${DAYS[o.getDay()].slice(0, 3)} ${o.getDate()} ${MONTHS[o.getMonth()].slice(0, 3)}`;
}

// "Saturday 31 October 2026" (or "Sabtu 31 Oktober 2026")
export function fmtDateLong(d) {
  const o = dateObj(d);
  if (lang() === 'ms') return `${DAYS_MS[o.getDay()]} ${o.getDate()} ${MONTHS_MS[o.getMonth()]} ${o.getFullYear()}`;
  return `${DAYS[o.getDay()]} ${o.getDate()} ${MONTHS[o.getMonth()]} ${o.getFullYear()}`;
}

export function addDays(d, n) {
  const o = dateObj(d);
  o.setDate(o.getDate() + n);
  return `${o.getFullYear()}-${pad(o.getMonth() + 1)}-${pad(o.getDate())}`;
}

// ISO timestamp -> "12 Oct, 8:15 pm" in the viewer's time zone
export function fmtStamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}, ${fmtTime(d.getHours() * 60 + d.getMinutes())}`;
}

export function plural(n, word, many) { return `${n} ${n === 1 ? word : (many || word + 's')}`; }

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  // Changes are always sent as JSON: the server refuses anything else (protection against other sites).
  const sends = method !== 'GET';
  try {
    res = await fetch('/api' + path, {
      method,
      headers: sends ? { 'Content-Type': 'application/json' } : {},
      body: sends ? JSON.stringify(body === undefined ? {} : body) : undefined
    });
  } catch (err) {
    throw new Error('Cannot reach the KenduriFlow server. Check that it is still running in the terminal.');
  }
  let data = null;
  try { data = await res.json(); } catch (err) { /* no body */ }
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status}).`);
  return data;
}

let metaPromise = null;
export function getMeta() {
  // A failed request (no signal) is not kept, so the next call tries again.
  if (!metaPromise) metaPromise = api('/meta').catch((err) => { metaPromise = null; throw err; });
  return metaPromise;
}

export function toast(msg, kind = '') {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
  }
  t.className = `toast ${kind}`;
  t.textContent = msg;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.remove(), 3500);
}

// Live updates over Socket.IO. Calls onUpdate whenever anything changes on the server.
export function live(onUpdate) {
  const conn = byId('conn');
  const set = (on) => {
    if (!conn) return;
    conn.textContent = on ? t('Live updates on', 'Kemas kini langsung') : t('Offline', 'Luar talian');
    conn.className = `conn ${on ? 'on' : 'off'}`;
  };
  if (!window.io) { set(false); return null; }
  const socket = window.io();
  let timer = null;
  let first = true;
  socket.on('connect', () => {
    set(true);
    if (!first) onUpdate({});
    first = false;
  });
  socket.on('disconnect', () => set(false));
  socket.on('update', (msg) => {
    clearTimeout(timer);
    timer = setTimeout(() => onUpdate(msg || {}), 100);
  });
  return socket;
}

export function setNav(name) {
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === name));
}

// ---------- app shell: who is signed in, their tabs, and what they may open ----------

// { user, mode: 'live' | 'demo', needsSetup }
let sessionPromise = null;
export function getSession() {
  if (!sessionPromise) sessionPromise = api('/me').catch(() => ({ user: null, mode: 'live', needsSetup: false }));
  return sessionPromise;
}
export const getMe = () => getSession().then((s) => s.user);

export const ROLE_LABEL = {
  resident: ['Resident', 'Penduduk'],
  guard: ['Guard', 'Pengawal'],
  township: ['Township team', 'Pasukan perbandaran']
};
export const roleLabel = (role) => { const r = ROLE_LABEL[role]; return r ? t(r[0], r[1]) : role; };

// Where each role lands after signing in.
export function homeFor(user) {
  if (!user) return '/';
  return { resident: '/neighbour', guard: '/guard', township: '/admin' }[user.role] || '/';
}

// Tabs for each role: [key, address, icon, English, Malay].
const TABS = {
  resident: [['neighbour', '/neighbour', 'home', 'Home', 'Utama'], ['host', '/host', 'calendar', 'My events', 'Majlis saya'], ['account', '/account', 'user', 'Account', 'Akaun']],
  guard: [['guard', '/guard', 'shield', 'Gate', 'Pintu masuk'], ['account', '/account', 'user', 'Account', 'Akaun']],
  township: [['admin', '/admin', 'chart', 'Dashboard', 'Papan pemuka'], ['guard', '/guard', 'shield', 'Gate', 'Pintu masuk'], ['host', '/host', 'calendar', 'Events', 'Majlis'], ['people', '/people', 'users', 'People', 'Penduduk'], ['account', '/account', 'user', 'Account', 'Akaun']],
  none: [['home', '/', 'home', 'Home', 'Utama'], ['login', '/login', 'user', 'Sign in', 'Log masuk']]
};

export const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

let chrome = null;   // last drawn { me, navKey }, redrawn when the language changes

// ---------- demo: pick a role instead of signing in ----------

// The four ways to look at KenduriFlow. Each signed-in role uses one of the demo accounts.
export const DEMO_ROLES = [
  { role: 'township', userId: 'u10', icon: 'chart', en: 'Township team', ms: 'Pasukan perbandaran',
    who: 'Nurul Huda', desc: ['Every event, street clashes, neighbour reports, what the counts taught us, planning data.', 'Semua majlis, pertindihan jalan, laporan jiran, pembelajaran dan data perancangan.'] },
  { role: 'guard', userId: 'u9', icon: 'shield', en: 'Guard', ms: 'Pengawal',
    who: 'Razak Ali', desc: ['Count cars at the gate, scan guests\' entry and exit QR, emergency lane, reports.', 'Kira kereta di pintu masuk, imbas QR masuk dan keluar tetamu, lorong kecemasan, laporan.'] },
  { role: 'resident', userId: 'u1', icon: 'home', en: 'Resident', ms: 'Penduduk',
    who: 'Rohana Ismail, No. 12', desc: ['Plans her 500-guest wedding, shares the invitation, sees her street and reports a blocked gate.', 'Merancang majlis 500 tetamu, berkongsi jemputan, melihat jalannya dan melaporkan pagar dihalang.'] },
  { role: 'guest', icon: 'pin', en: 'Guest', ms: 'Tetamu',
    who: 'Wedding guest, no account', desc: ['Opens the invitation link: where to park, hold a space, entry and exit QR pass.', 'Buka pautan jemputan: tempat letak kereta, simpan tempat, pas QR masuk dan keluar.'] }
];
const ROLE_KEY = 'kf-demo-role';

// Becomes that role and opens its home screen.
export async function chooseRole(role) {
  const r = DEMO_ROLES.find((x) => x.role === role);
  if (!r) return;
  try { localStorage.setItem(ROLE_KEY, role); } catch (e) { /* private mode */ }
  if (role === 'guest') {
    // A guest has no account: sign out, then open the invitation link of the next event.
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    const events = await api('/events').catch(() => []);
    const ev = events.find((e) => e.status === 'live') || events.find((e) => e.status === 'planned') || events[0];
    location.href = ev ? `/e/${ev.code}` : '/';
    return;
  }
  const res = await api('/auth/demo', { method: 'POST', body: { userId: r.userId } });
  location.href = homeFor(res.user);
}

export function roleSheet() {
  const current = currentRole();
  const sh = openSheet({
    title: tp('View KenduriFlow as…', 'Lihat KenduriFlow sebagai…'),
    html: `<ul class="rows" style="box-shadow:none;border:1px solid var(--line)">${DEMO_ROLES.map((r) => `
      <li><button class="row" type="button" data-role="${r.role}"><span class="lead${r.role === 'guest' ? ' gold' : ''}">${icon(r.icon)}</span>
        <span class="body"><b>${esc(tp(r.en, r.ms))}</b><small>${esc(r.who)}</small></span>
        ${r.role === current ? `<span class="badge ok">${tp('Now', 'Sekarang')}</span>` : icon('chev', 'chev')}</button></li>`).join('')}</ul>`
  });
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-role]');
    if (b) { b.disabled = true; chooseRole(b.dataset.role); }
  });
}

function currentRole() {
  if (location.pathname.startsWith('/e/')) return 'guest';
  const me = chrome && chrome.me;
  if (me) return me.role;
  try { return localStorage.getItem(ROLE_KEY) || ''; } catch (e) { return ''; }
}

// In the demo, a "Switch role" button sits next to the logo on every screen.
export function markDemo(mode) {
  const inner = document.querySelector('.topbar .topbar-inner');
  if (mode !== 'demo' || !inner || inner.querySelector('.role-chip')) return;
  const after = inner.querySelector('.ab-title') || inner.querySelector('.logo');
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'role-chip';
  b.onclick = roleSheet;
  after.insertAdjacentElement('afterend', b);
  labelRoleChip();
}

function labelRoleChip() {
  const b = document.querySelector('.role-chip');
  if (!b) return;
  const r = DEMO_ROLES.find((x) => x.role === currentRole());
  b.innerHTML = `<span class="demo-tag">DEMO</span><span class="rc-name">${esc(r ? tp(r.en, r.ms) : tp('Choose role', 'Pilih peranan'))}</span>${icon('chev', 'rc-chev')}`;
  b.setAttribute('aria-label', tp('Switch role', 'Tukar peranan'));
}

function drawChrome(me, navKey) {
  chrome = { me, navKey };
  const nav = byId('nav');
  if (nav) {
    nav.innerHTML = TABS[me ? me.role : 'none'].map(([key, href, ic, en, ms]) =>
      `<a href="${href}" data-nav="${key}">${icon(ic)}<span>${esc(tp(en, ms))}</span></a>`).join('');
    setNav(navKey);
  }
  const av = byId('avatar');
  if (av) {
    av.hidden = false;
    if (me) {
      av.href = '/account';
      av.className = 'avatar';
      av.textContent = initials(me.name);
      av.title = `${me.name} · ${roleLabel(me.role)}`;
      av.setAttribute('aria-label', t('Your account', 'Akaun anda'));
    } else {
      av.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
      av.className = 'avatar signin';
      av.textContent = tp('Sign in', 'Log masuk');
    }
  }
}

// ---------- app bar: back arrow + title on phones ----------

// The small title in the bar appears once the page's big title scrolls out of view, like a phone app.
export function appBar({ title = '', back = '' } = {}) {
  const bar = document.querySelector('.topbar');
  const inner = bar && bar.querySelector('.topbar-inner');
  if (!inner) return;
  bar.classList.add('app');
  bar.classList.toggle('has-back', !!back);
  if (back && !inner.querySelector('.ab-back')) {
    inner.insertAdjacentHTML('afterbegin', `<a class="ab-back" href="${esc(back)}" aria-label="Back">${icon('back')}</a>`);
    // Go back in history when we came from inside the app, so scroll position is kept.
    inner.querySelector('.ab-back').addEventListener('click', (e) => {
      if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) { e.preventDefault(); history.back(); }
    });
  }
  let t = inner.querySelector('.ab-title');
  if (!t) {
    inner.querySelector('.logo').insertAdjacentHTML('afterend', '<span class="ab-title"></span>');
    t = inner.querySelector('.ab-title');
  }
  t.textContent = title;
  const big = document.querySelector('main h1');
  if (big && 'IntersectionObserver' in window && !bar.dataset.watching) {
    bar.dataset.watching = '1';
    new IntersectionObserver(([e]) => bar.classList.toggle('scrolled', !e.isIntersecting), { rootMargin: '-56px 0px 0px 0px' }).observe(big);
  }
}
export function setTitle(title) { const t = document.querySelector('.ab-title'); if (t) t.textContent = title; }

// ---------- segmented tabs: <div class="segtabs"><button data-tab="x"> + <section data-panel="x"> ----------
export function segTabs(root, { onChange } = {}) {
  const buttons = [...root.querySelectorAll('[data-tab]')];
  root.setAttribute('role', 'tablist');
  const show = (name, fromClick) => {
    if (!buttons.some((b) => b.dataset.tab === name)) name = buttons[0].dataset.tab;
    buttons.forEach((b) => { b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(b.dataset.tab === name)); });
    document.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== name; });
    if (fromClick) {
      history.replaceState(null, '', `#${name}`);
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    }
    if (onChange) onChange(name);
  };
  root.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) show(b.dataset.tab, true); });
  show(location.hash.slice(1));
  return { show, current: () => (buttons.find((b) => b.getAttribute('aria-selected') === 'true') || buttons[0]).dataset.tab };
}

// ---------- bottom sheet (dialog on wide screens) ----------
export function openSheet({ title = '', html = '', onClose } = {}) {
  const back = document.createElement('div');
  back.className = 'sheet-backdrop';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', title);
  sheet.innerHTML = `<div class="handle"></div><div class="sheet-head"><h2>${esc(title)}</h2><button class="sheet-close" type="button" aria-label="Close">${icon('x')}</button></div><div class="sheet-body">${html}</div>`;
  document.body.append(back, sheet);
  const prevFocus = document.activeElement;
  // Lay the sheet out off-screen first, then slide it in.
  void sheet.offsetHeight;
  back.classList.add('open');
  sheet.classList.add('open');
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    back.classList.remove('open');
    sheet.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => { back.remove(); sheet.remove(); if (prevFocus && prevFocus.focus) prevFocus.focus(); }, 260);
    if (onClose) onClose();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  back.addEventListener('click', close);
  sheet.querySelector('.sheet-close').addEventListener('click', close);
  // Swipe the sheet down to close it.
  let y0 = null;
  sheet.addEventListener('touchstart', (e) => { if (sheet.scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
  sheet.addEventListener('touchend', (e) => { if (y0 != null && e.changedTouches[0].clientY - y0 > 90) close(); y0 = null; }, { passive: true });
  setTimeout(() => { const f = sheet.querySelector('.sheet-body input, .sheet-body select, .sheet-body textarea, .sheet-body button'); if (f) f.focus({ preventScroll: true }); }, 280);
  return { el: sheet.querySelector('.sheet-body'), close };
}

// A short buzz on phones for important taps (counting cars, sending reports).
export function haptic(ms = 12) {
  try {
    // Browsers only allow a buzz after the person has touched the page.
    const touched = !navigator.userActivation || navigator.userActivation.hasBeenActive;
    if (navigator.vibrate && touched) navigator.vibrate(ms);
  } catch (e) { /* not supported */ }
}

// Grey placeholder blocks while a screen loads.
export const skeleton = (rows = 3, h = 64) => Array.from({ length: rows }, () => `<div class="skel" style="height:${h}px;margin-bottom:12px"></div>`).join('');

// Every signed-in page calls this first.
//   roles: who may use the page (empty = anyone, signed in or not)
//   nav:   which tab to highlight
//   title, back: the phone app bar (page title, and where the back arrow goes)
// Returns the signed-in user, or null when the page should not carry on.
export async function shell({ roles = [], nav = '', title = '', back = '' } = {}) {
  const session = await getSession();
  const me = session.user;
  // First run of the real system: nobody can do anything until the township admin is created.
  if (session.needsSetup && location.pathname !== '/setup') { location.replace('/setup'); return null; }
  drawChrome(me, nav);
  appBar({ title, back });
  markDemo(session.mode);
  if (!roles.length) return me || {};
  if (!me) {
    // Demo: no sign-in, just choose a role. Real system: sign in.
    location.replace(session.mode === 'demo' ? '/' : `/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    return null;
  }
  if (!roles.includes(me.role)) {
    const main = document.querySelector('main');
    const who = roles.map(roleLabel).join(t(' or ', ' atau '));
    if (main) {
      main.innerHTML = `<section class="card narrow" style="margin-top:24px">
        <p class="eyebrow">${t('Not for this account', 'Bukan untuk akaun ini')}</p>
        <h1 style="margin-bottom:8px">${t(`This screen is for the ${who.toLowerCase()}.`, `Skrin ini untuk ${who.toLowerCase()}.`)}</h1>
        <p class="muted">${t(`You are signed in as ${esc(me.name)} (${roleLabel(me.role).toLowerCase()}).`, `Anda log masuk sebagai ${esc(me.name)} (${roleLabel(me.role).toLowerCase()}).`)}</p>
        <div class="actions" style="margin-top:14px"><a class="btn" href="${homeFor(me)}">${t('Go to my home', 'Ke laman saya')}</a>
        ${session.mode === 'demo' ? `<button class="btn secondary" type="button" id="denySwitch">${t('Switch role', 'Tukar peranan')}</button>`
          : `<a class="btn secondary" href="/account">${t('Switch account', 'Tukar akaun')}</a>`}</div></section>`;
      const ds = byId('denySwitch');
      if (ds) ds.onclick = roleSheet;
    }
    return null;
  }
  return me;
}

// ---------- installable app ----------

// Works offline and opens like an app. Browsers only allow this on localhost or https.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}

let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  document.dispatchEvent(new Event('kf-installable'));
});
window.addEventListener('appinstalled', () => { installEvent = null; document.dispatchEvent(new Event('kf-installable')); });

export const canInstall = () => !!installEvent;
export const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export async function promptInstall() {
  if (!installEvent) return false;
  installEvent.prompt();
  const choice = await installEvent.userChoice;
  installEvent = null;
  return choice.outcome === 'accepted';
}

export async function copyText(text, btn) {
  const orig = btn.textContent;
  let ok = false;
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); ok = true; }
  } catch (err) { ok = false; }
  if (!ok) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    ta.remove();
  }
  btn.textContent = ok ? 'Copied' : 'Select and copy';
  setTimeout(() => { btn.textContent = orig; }, 1600);
}

// Two-step button for actions that cannot be undone.
export function confirmClick(btn, question, fn) {
  if (btn.dataset.armed === '1') {
    btn.dataset.armed = '';
    btn.classList.remove('confirm');
    btn.textContent = btn.dataset.label;
    fn();
    return;
  }
  btn.dataset.label = btn.textContent;
  btn.dataset.armed = '1';
  btn.classList.add('confirm');
  btn.textContent = question;
  setTimeout(() => {
    if (btn.dataset.armed === '1') {
      btn.dataset.armed = '';
      btn.classList.remove('confirm');
      btn.textContent = btn.dataset.label;
    }
  }, 4000);
}

export function showError(el, err) {
  el.hidden = false;
  el.textContent = err && err.message ? err.message : String(err);
}

export function eventWhen(e) {
  return `${fmtDate(e.date)}, ${fmtTime(e.start)} to ${fmtTime(e.end != null ? e.end : e.start + e.duration)}`;
}

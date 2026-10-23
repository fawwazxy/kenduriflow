import {
  api, getMeta, getSession, live, byId, esc, shell, setTitle, segTabs, openSheet, haptic, fmtTime, fmtDate, statusBadge,
  zoneColor, toast, confirmClick, plural, icon
} from './common.js';
import { drawMap, LEGEND_HTML } from './map.js';
import { scanResultHtml, passFrom, canScanInApp, startScanner } from './scan.js';

const id = decodeURIComponent(location.pathname.split('/')[2] || '');
const me = await shell({ roles: ['guard', 'township'], nav: 'guard', title: id ? 'Gate' : '', back: id ? '/guard' : '' });
if (!me) await new Promise(() => {});   // shell() has sent the person to sign in, or explained why they cannot use this page
const DEMO = (await getSession()).mode === 'demo';
let meta = null;
let S = null;
let events = [];
let busy = false;
let prevAlerts = null;   // { lane, reports } from the last render, to spot new alerts
// Scan a guest's gate pass: the same QR records the car in, and later out.
// Live camera inside the app where the phone allows it; otherwise the phone's camera app, or typing the code.
async function scanSheet() {
  const inApp = canScanInApp();
  const m = await getMeta();
  // On the plain Wi-Fi address the phone blocks the camera: offer the secure address for this same screen.
  const secureHere = m.secureUrl ? `${m.secureUrl}${location.pathname}#scan` : null;
  let cam = null;
  const sh = openSheet({
    title: 'Scan a guest pass',
    onClose: () => { if (cam) cam.stop(); },
    html: `${inApp ? `<div class="scanner" id="scanner"><video muted playsinline></video></div>
        <div class="actions" style="justify-content:center;margin-top:10px"><span class="small muted" id="camHint">Starting the camera…</span>
        <button class="btn secondary small" type="button" id="torchBtn" hidden>Torch</button></div>`
      : `<div class="alert info" style="margin:0 0 12px">${icon('qr')}<span>The phone only allows the camera on the <b>secure address</b>.${secureHere ? '' : ' Use the phone\'s camera app, or type the code below.'}</span></div>
        ${secureHere ? `<a class="btn block" href="${esc(secureHere)}" style="min-height:52px">${icon('qr')}Open the camera scanner</a>
        <p class="small muted" style="margin-top:8px">The first time, the phone warns that the connection is not private. Tap <b>Advanced</b>, then <b>Proceed</b> (Android) or <b>Show details → visit this website</b> (iPhone). Then sign in once on that address.</p>` : ''}`}
      <div id="scanOut" aria-live="assertive" style="margin-top:12px"></div>
      <form id="codeForm" novalidate style="margin-top:12px">
        <label class="label" for="passCode">Or type the code under the QR (green entry code = in, blue exit code = out)</label>
        <div class="code-entry" style="margin-top:6px"><input type="text" id="passCode" maxlength="7" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="K7P 2QX">
        <button class="btn" type="submit" style="flex:none">Record</button></div>
      </form>`
  });
  const out = sh.el.querySelector('#scanOut');
  const show = (r) => {
    out.innerHTML = scanResultHtml(r);
    haptic(r.result === 'in' ? [40, 60, 40] : r.result === 'out' ? 80 : r.result === 'error' ? [100, 50, 100] : 20);
    out.scrollIntoView({ block: 'nearest' });
  };
  const record = async (path, body) => {
    try { show(await api(path, { method: 'POST', body })); load(); } catch (err) { show({ result: 'error', message: err.message }); }
  };
  sh.el.querySelector('#codeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const inp = sh.el.querySelector('#passCode');
    await record(`/events/${id}/passes/scan`, { code: inp.value });
    inp.value = '';
  });
  if (inApp) {
    startScanner(sh.el.querySelector('video'), async (text) => {
      const pass = passFrom(text);
      if (!pass) { show({ result: 'error', message: 'That QR code is not a KenduriFlow gate pass.' }); return; }
      await record(`/passes/${encodeURIComponent(pass.pid)}/scan`, { direction: pass.direction });
    }).then((c) => {
      cam = c;
      const hint = sh.el.querySelector('#camHint');
      if (hint) hint.textContent = 'Point at the guest\'s QR code. It keeps scanning for the next car.';
      const tb = sh.el.querySelector('#torchBtn');
      if (c.torch && tb) {
        let on = false;
        tb.hidden = false;
        tb.onclick = () => { on = !on; c.torch(on).catch(() => {}); tb.textContent = on ? 'Torch off' : 'Torch'; };
      }
    }).catch((err) => {
      const sc = sh.el.querySelector('#scanner');
      const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      if (sc) sc.outerHTML = `<div class="alert warn" style="margin:0">${icon('alert')}<span>${denied
        ? 'Camera access was blocked. Allow the camera for this site in the browser settings, then open the scanner again.'
        : 'The camera could not start. Close other apps using the camera and try again, or type the code.'}</span></div>`;
      const hint = sh.el.querySelector('#camHint');
      if (hint) hint.remove();
    });
  }
}

// The guard walks past a zone and types the number of this event's cars they can see.
function recount(zoneId) {
  const z = S.plan.zones.find((x) => x.id === zoneId);
  if (!z) return;
  let n = z.parked;
  const sh = openSheet({
    title: `Recount ${z.short}`,
    html: `<p class="muted">How many cars from this event can you see in ${esc(z.name)}?</p>
      <div class="big-stepper"><button class="btn secondary" type="button" data-d="-1" aria-label="One fewer">−</button>
        <output id="rcOut">${n}</output><button class="btn secondary" type="button" data-d="1" aria-label="One more">+</button></div>
      <p class="small muted" style="text-align:center">The app shows ${z.parked} now.</p>
      <div class="actionbar" style="margin-top:14px"><button class="btn" type="button" id="rcSave">Save count</button></div>`
  });
  sh.el.addEventListener('click', async (e) => {
    const d = e.target.closest('[data-d]');
    if (d) { n = Math.max(0, Math.min(200, n + Number(d.dataset.d))); sh.el.querySelector('#rcOut').textContent = n; haptic(8); return; }
    if (e.target.closest('#rcSave')) { sh.close(); await act(`/events/${id}/zones/${zoneId}/recount`, 'Count updated.', { count: n }); }
  });
}

async function act(path, okMsg, body) {
  if (busy) return;
  busy = true;
  try {
    await api(path, { method: 'POST', body });
    if (okMsg) toast(okMsg);
    await load();
  } catch (err) {
    toast(err.message, 'bad');
  } finally {
    busy = false;
  }
}

// ---------- event picker ----------
async function loadPicker() {
  byId('pickView').hidden = false;
  const list = (await api('/events')).filter((e) => e.status !== 'cancelled');
  if (!list.length) { byId('pickList').innerHTML = '<section class="card"><p class="empty">No events registered.</p></section>'; return; }
  byId('pickList').innerHTML = `<div class="roles">${list.map((e) => `
    <a class="role${e.status === 'live' ? ' gold' : ''}" href="/guard/${e.id}">
      <span class="ic">${icon(e.status === 'live' ? 'car' : 'calendar')}</span>
      <span style="min-width:0"><h3>${esc(e.title)}</h3>
        <p>${fmtDate(e.date)}, ${fmtTime(e.start)} to ${fmtTime(e.end)} · No. ${e.house}, ${esc(e.street)}</p>
        <p style="margin-top:6px">${statusBadge(e.status)} <span class="badge">${e.planned} spaces</span>${e.clashes.length ? ' <span class="badge warn">Shared street</span>' : ''}</p></span>
    </a>`).join('')}</div>`;
}

// ---------- live view ----------
async function load() {
  try {
    [meta, S, events] = await Promise.all([getMeta(), api(`/events/${encodeURIComponent(id)}/state`), api('/events')]);
  } catch (err) {
    byId('main').innerHTML = `<section class="card"><h2>Event not found</h2><p class="muted">${esc(err.message)}</p><a class="btn" href="/guard">Choose an event</a></section>`;
    return;
  }
  byId('liveView').hidden = false;
  render();
}

// New lane blocks and new reports buzz the phone and flash, so the guard notices without watching the screen.
function alertIfNew(lane, reports) {
  const before = prevAlerts;
  prevAlerts = { lane, reports };
  if (!before) return;
  if (lane > before.lane) {
    if (navigator.vibrate) navigator.vibrate([300, 120, 300]);
    const el = document.querySelector('.lane.bad');
    if (el) el.classList.add('flash');
    toast('Emergency lane blocked. Ask the driver to move.', 'bad');
  } else if (reports > before.reports) {
    if (navigator.vibrate) navigator.vibrate(200);
    const el = document.querySelector('.report-row:not(.done)');
    if (el) el.classList.add('flash');
    toast('New report from a neighbour.', 'bad');
  }
}

function render() {
  const ev = S.event;
  const L = S.live;
  const cancelled = ev.status === 'cancelled';
  const ended = ev.status === 'finished';
  document.title = `Guard · ${ev.title}`;
  byId('gdTitle').textContent = ev.title;
  setTitle(ev.title);
  byId('gdSub').innerHTML = `
    <span class="chip">${icon('calendar')}${fmtDate(ev.date)}, ${fmtTime(ev.start)} to ${fmtTime(ev.end)}</span>
    <span class="chip">${icon('pin')}No. ${ev.house}, ${esc(ev.street)}</span>
    <span class="chip">${icon('users')}${ev.guests} guests</span>`;

  const sw = byId('gdSwitch');
  if (document.activeElement !== sw) {
    sw.innerHTML = events.filter((e) => e.status !== 'cancelled' || e.id === ev.id)
      .map((e) => `<option value="${e.id}"${e.id === ev.id ? ' selected' : ''}>${esc(fmtDate(e.date))} · ${esc(e.title)}</option>`).join('');
  }

  // Emergency lane: cars the guard recorded plus neighbours' reports of cars on the house side.
  const laneN = L.laneBlocked + L.laneReports;
  const why = [L.laneBlocked ? plural(L.laneBlocked, 'car') + ' recorded by the guard' : '', L.laneReports ? plural(L.laneReports, 'report') + ' from neighbours' : ''].filter(Boolean).join(', ');
  byId('gdLane').innerHTML = laneN
    ? `<div class="lane bad" role="alert">${icon('alert')}<span>Emergency lane blocked<small>${esc(why)}. Move the car to the next free space.</small></span>
        <button class="btn small" type="button" id="laneClear">${icon('check')}Lane clear</button></div>`
    : `<div class="lane ok">${icon('check')}<span>Emergency lane clear<small>Ambulances and fire engines can get through.</small></span>
        <button class="btn small" type="button" id="laneBlock"${cancelled || ended ? ' disabled' : ''}>Car in lane</button></div>`;
  const lb = byId('laneBlock');
  if (lb) lb.onclick = () => act(`/events/${id}/lane/block`);
  const lc = byId('laneClear');
  if (lc) lc.onclick = () => act(`/events/${id}/lane/clear`, 'Emergency lane marked clear.');

  byId('gdClock').textContent = fmtTime(L.time);
  byId('gdStatus').innerHTML = L.running ? '<span class="badge live">Playing</span>' : statusBadge(ev.status);
  byId('gdStats').innerHTML = `
    <div class="stat main"><div class="n">${L.onsite}</div><div class="l">here now</div><div class="s">busiest so far ${L.peak}</div></div>
    <div class="stat"><div class="n">${L.arrived}</div><div class="l">arrived</div><div class="s">of ${S.prediction.totalCars} expected</div></div>
    <div class="stat"><div class="n">${L.onTheWay}</div><div class="l">on the way</div><div class="s">spaces held</div></div>
    <div class="stat"><div class="n">${L.freeTotal}</div><div class="l">spaces free</div><div class="s">all zones</div></div>`;

  const n = L.next;
  byId('gdNext').innerHTML = n
    ? `<div class="park-card" style="--zc:${zoneColor(n.color)};box-shadow:none;border:1px solid var(--line);border-top-width:6px;border-top-color:${zoneColor(n.color)}">
        <span class="tag"><i class="dot" style="background:${zoneColor(n.color)}"></i>Send the next car to</span>
        <p class="zone-name">${esc(n.slotLabel)}</p><p class="zone-sub" style="margin:0">${n.zoneName !== n.slotLabel ? esc(n.zoneName) + ' · ' : ''}${n.freeInZone} free here</p></div>`
    : `<div class="park-card" style="--zc:var(--bad);box-shadow:none;border:1px solid var(--line);border-top:6px solid var(--bad)">
        <span class="tag" style="color:var(--bad)">${icon('alert')}Send the next car to</span>
        <p class="zone-name">Nowhere free</p><p class="zone-sub" style="margin:0">Hold cars at the Persiaran Elmina layby until someone leaves.</p></div>`;

  byId('addCar').disabled = cancelled || !n;
  byId('addVip').disabled = cancelled || !L.nextVip;
  byId('leaveCar').disabled = cancelled || !L.onsite;
  const play = byId('playBtn');
  play.innerHTML = L.running ? `${icon('pause')}Pause` : `${icon('play')}${ev.status === 'live' && L.clock > 0 ? 'Resume' : ended ? 'Play again' : 'Play the event'}`;
  play.disabled = cancelled;
  byId('finishBtn').disabled = cancelled || ended || (!L.arrived && !L.running);

  byId('gdZones').innerHTML = S.plan.zones.filter((z) => z.capacity > 0 || z.closed || z.parked).map((z) => {
    let sub;
    if (z.closed) sub = 'Closed during Friday prayers';
    else if (z.kind === 'lot') sub = `${z.inUse} of ${z.slotsTotal} in use by all events · ${z.free} free`;
    else sub = `${z.free} of ${z.slotsTotal} free for this event`;
    return `<div class="gz"><i class="dot" style="background:${zoneColor(z.color)}"></i>
      <span><b>${esc(z.short)}</b><br><span class="small muted">${sub}</span>${z.closed || cancelled ? '' : `<br><button class="btn link small" type="button" data-recount="${z.id}" style="min-height:28px;padding:0">Recount</button>`}</span>
      <span class="cnt">${z.parked}</span>
      <span class="ctl">
        <button class="btn secondary square" type="button" data-zone="${z.id}" data-op="remove" aria-label="A car left ${esc(z.short)}"${z.parked ? '' : ' disabled'}>−</button>
        <button class="btn secondary square" type="button" data-zone="${z.id}" data-op="add" aria-label="A car parked at ${esc(z.short)}"${z.closed || cancelled ? ' disabled' : ''}>+</button>
      </span></div>`;
  }).join('') + '<p class="small muted" style="margin-top:6px">The big number is cars from this event parked in each zone.</p>';

  const reports = S.reports;
  const open = reports.filter((r) => !r.resolvedAt);
  byId('repCount').hidden = !open.length;
  byId('repCount').textContent = open.length;
  byId('gdReportCount').innerHTML = open.length ? `<span class="badge bad">${open.length} open</span>` : '<span class="badge ok">All sorted</span>';
  byId('gdReports').innerHTML = reports.length ? reports.map((r) => `
    <div class="report-row${r.resolvedAt ? ' done' : ''}">
      <span><b>No. ${r.house}:</b> ${esc(r.issue)} <span class="small">(${fmtTime(ev.start + r.clock)})</span></span>
      ${r.resolvedAt ? '<span class="badge ok">Sorted</span>' : `<button class="btn secondary small" type="button" data-report="${r.id}">Mark as sorted</button>`}
    </div>`).join('') : '<p class="empty">No reports. Neighbours can report a blocked gate from their phone in one tap.</p>';

  byId('gdLog').innerHTML = L.logs.length ? L.logs.map((l) => `<li><time>${fmtTime(ev.start + l.clock)}</time><span class="${l.kind}">${esc(l.text)}</span></li>`).join('')
    : '<li class="empty">Nothing yet. Press Car arriving or Play the event.</li>';

  byId('gdTodayTitle').textContent = `Events on these streets, ${fmtDate(ev.date)}`;
  byId('gdToday').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Time</th><th>Event</th><th>Address</th></tr></thead><tbody>${S.dayEvents.map((e) => `
    <tr${e.id === ev.id ? ' class="highlight"' : ''}><td class="nowrap">${fmtTime(e.start)} to ${fmtTime(e.end)}</td><td>${e.id === ev.id ? esc(e.title) : `<a href="/guard/${e.id}">${esc(e.title)}</a>`}</td><td class="nowrap">No. ${e.house}, ${esc(e.street)}</td></tr>`).join('')}</tbody></table></div>`;

  drawMap(byId('gdMap'), meta.precinct, S, { routeSlot: n ? n.slotId : null, label: `Map of parking for ${S.event.title}` });
  byId('gdLegend').innerHTML = LEGEND_HTML;

  alertIfNew(laneN, open.length);
}

if (id) {
  // "Play the event" and "Reset live counts" are for presenting the demo. The real system runs on real time.
  if (!DEMO) {
    byId('playBtn').hidden = true;
    byId('resetBtn').hidden = true;
    byId('controlsNote').textContent = 'End the event when the last guests have gone. It frees every space and saves your counts, so the next estimate for this type of event improves. If you forget, it ends by itself two hours after the end time.';
    setInterval(() => { if (!busy) load(); }, 60000);   // keep the clock on the screen current
  }
  segTabs(byId('tabs'));
  byId('scanBtn').onclick = scanSheet;
  byId('scanFab').onclick = scanSheet;
  byId('scanFab').hidden = false;
  // Opened from the "Open the camera scanner" link: go straight to the camera.
  if (location.hash === '#scan') { history.replaceState(null, '', location.pathname); setTimeout(scanSheet, 300); }
  byId('addCar').onclick = () => { haptic(20); act(`/events/${id}/cars`, null, {}); };
  byId('addVip').onclick = () => { haptic(20); act(`/events/${id}/cars`, null, { vip: true }); };
  byId('leaveCar').onclick = () => { haptic(20); act(`/events/${id}/cars/leave`); };
  byId('playBtn').onclick = () => act(`/events/${id}/sim/${S && S.live.running ? 'pause' : 'start'}`);
  byId('finishBtn').onclick = (e) => confirmClick(e.currentTarget, 'Click again to end the event', () => act(`/events/${id}/finish`, 'Event ended. Counts saved for learning.'));
  byId('resetBtn').onclick = (e) => confirmClick(e.currentTarget, 'Click again to reset', () => act(`/events/${id}/sim/reset`, 'Live counts reset.'));
  byId('gdSwitch').onchange = (e) => { location.href = `/guard/${e.target.value}`; };
  byId('gdZones').addEventListener('click', (e) => {
    const b = e.target.closest('[data-zone]');
    if (b) { haptic(); act(`/events/${id}/zones/${b.dataset.zone}/${b.dataset.op}`); return; }
    const rc = e.target.closest('[data-recount]');
    if (rc) recount(rc.dataset.recount);
  });
  byId('gdReports').addEventListener('click', (e) => {
    const b = e.target.closest('[data-report]');
    if (b) act(`/reports/${b.dataset.report}/resolve`, 'Report marked as sorted.');
  });
  load();
  live(() => { if (!busy) load(); });
} else {
  loadPicker().catch((err) => { byId('pickList').innerHTML = `<p class="empty">${esc(err.message)}</p>`; });
  live(() => loadPicker().catch(() => {}));
}

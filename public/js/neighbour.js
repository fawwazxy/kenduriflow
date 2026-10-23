import {
  api, getMeta, live, byId, esc, shell, fmtTime, fmtDate, fmtStamp, statusBadge, toast, plural, icon, enableLang, t, lang,
  openSheet, haptic
} from './common.js';

enableLang(() => { if (F) render(); });
const me = await shell({ roles: ['resident'], nav: 'neighbour' });
if (!me) await new Promise(() => {});   // shell() has sent the person to sign in, or explained why they cannot use this page

const SEEN = (no) => `kf-seen-${no}`;
let F = null;
let feed = [];
const house = me.house;   // a resident always sees their own street
let seenBefore = '';   // newest event this house had seen before this visit (ISO time)
let sending = false;

// Reports: [issue sent to the guard, English label, Malay label, icon]. The first one has its own big button.
const ISSUES = [
  ['A car is blocking my driveway', 'My gate is blocked', 'Pagar saya dihalang', 'gate'],
  ['Cars are parked on the house side of the road', 'Cars in the emergency lane', 'Kereta di lorong kecemasan', 'alert'],
  ['A car is parked on the grass verge', 'Car on the grass verge', 'Kereta di atas rumput tepi jalan', 'car'],
  ['Guests are crowding the road outside my gate', 'Crowd outside my gate', 'Orang ramai di luar pagar saya', 'users']
];
const issueText = (issue) => { const q = ISSUES.find((x) => x[0] === issue); return q ? t(issue, q[2]) : issue; };
const n = (count, en, enMany, ms) => `${count} ${t(count === 1 ? en : enMany, ms)}`;

function readLS(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function writeLS(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return t('Good morning', 'Selamat pagi');
  if (h < 14) return t('Good afternoon', 'Selamat tengah hari');
  if (h < 19) return t('Good afternoon', 'Selamat petang');
  return t('Good evening', 'Selamat malam');
}

async function load() {
  F = await api(`/houses/${house}`);
  render();
}

function daysUntil(d) {
  const [y, m, dd] = d.split('-').map(Number);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, dd) - today) / 86400000);
}

function when(e) {
  if (e.status === 'live') return statusBadge('live');
  const d = daysUntil(e.date);
  if (d === 0) return `<span class="badge warn">${t('Today', 'Hari ini')}</span>`;
  if (d === 1) return `<span class="badge warn">${t('Tomorrow', 'Esok')}</span>`;
  if (d > 1 && d <= 14) return `<span class="badge">${t(`In ${d} days`, `Dalam ${d} hari`)}</span>`;
  return '';
}

// The event a report most likely concerns: one happening now, then the next on this street, then the next anywhere.
function likelyEvent() {
  return feed.find((e) => e.status === 'live' && e.sameStreet) || feed.find((e) => e.status === 'live') ||
    feed.find((e) => e.sameStreet) || feed[0] || null;
}

function render() {
  feed = F.events.filter((e) => e.status !== 'finished');
  const fresh = feed.filter((e) => seenBefore && e.createdAt > seenBefore);
  const newest = F.events.reduce((a, e) => (e.createdAt > a ? e.createdAt : a), seenBefore);
  if (newest) writeLS(SEEN(house), newest);

  byId('hello').textContent = greeting();
  byId('who').textContent = me.name.split(' ')[0];
  byId('houseName').textContent = `No. ${me.house}, ${me.street}`;

  byId('notice').innerHTML = fresh.length
    ? `<div class="notice">${icon('bell')}<span>${t(`${plural(fresh.length, 'new event')} near you since your last visit.`, `${fresh.length} majlis baharu berhampiran anda sejak lawatan terakhir.`)}</span></div>`
    : '';

  const target = likelyEvent();
  byId('qaGate').disabled = !target;
  byId('qaReport').disabled = !target;
  byId('qaGateSub').textContent = target ? t(`One tap tells the guard · ${target.title}`, `Satu sentuhan kepada pengawal · ${target.title}`) : t('No event near you right now', 'Tiada majlis berhampiran sekarang');

  const fr = F.frontage;
  byId('qaFrontSub').textContent = fr.on ? t(`On · ${fr.bays} bays kept clear`, `Aktif · ${fr.bays} petak kosong`) : t('Off · tap to turn on', 'Tidak aktif · tekan untuk aktifkan');
  byId('qaFront').style.outline = fr.on ? '2px solid var(--brand)' : '';

  byId('points').textContent = F.points.toLocaleString('en-GB');
  byId('pointsNote').textContent = t(`${plural(F.carsHosted, 'guest car')} so far`, `${F.carsHosted} kereta tetamu setakat ini`);

  byId('feed').innerHTML = feed.length ? feed.map((e) => {
    let share = '';
    if (e.canShare) {
      const on = !!(e.share && e.share.on);
      const cars = e.share ? e.share.cars : 2;
      share = `<div class="sharebox">
        <label class="switch"><input type="checkbox" data-share="${e.id}"${on ? ' checked' : ''} aria-label="${t('Share my driveway for', 'Kongsi laluan masuk saya untuk')} ${esc(e.title)}"><span></span></label>
        <span><b>${on ? t('Sharing your driveway', 'Laluan masuk anda dikongsi') : t('Share your driveway', 'Kongsi laluan masuk anda')}</b><br><span class="small muted">${on
          ? t(`Guests are sent to No. ${house}. ${F.pointsPerCar} points per car.`, `Tetamu dihantar ke No. ${house}. ${F.pointsPerCar} mata setiap kereta.`)
          : t(`Going out that day? Earn ${F.pointsPerCar} points per guest car.`, `Keluar pada hari itu? Dapat ${F.pointsPerCar} mata bagi setiap kereta tetamu.`)}</span></span>
        <select data-cars="${e.id}" aria-label="${t('How many cars', 'Berapa kereta')}">${[1, 2].map((c) => `<option value="${c}"${c === cars ? ' selected' : ''}>${n(c, 'car', 'cars', 'kereta')}</option>`).join('')}</select>
        ${e.parkedNow ? `<span class="badge ok">${n(e.parkedNow, 'guest car parked now', 'guest cars parked now', 'kereta tetamu diletak sekarang')}</span>` : ''}
      </div>`;
    }
    const isNew = seenBefore && e.createdAt > seenBefore;
    return `<li>
      <div class="top"><span class="title">${esc(e.title)}</span><span>${isNew ? `<span class="badge new">${t('New', 'Baharu')}</span> ` : ''}${when(e)}</span></div>
      <div class="chips" style="margin:0">
        <span class="chip">${icon('calendar')}${fmtDate(e.date)}, ${fmtTime(e.start)} ${t('to', 'hingga')} ${fmtTime(e.end)}</span>
        <span class="chip">${icon('pin')}No. ${e.house}${e.sameStreet ? t(', your street', ', jalan anda') : `, ${esc(e.street)}`}</span>
      </div>
      <p style="margin:0">${esc(lang() === 'ms' ? e.message.ms : e.message.en)}</p>
      ${share}
    </li>`;
  }).join('') : `<li class="empty" style="text-align:center;padding:16px 0">${t('No upcoming events near your house. You will see them here as soon as a neighbour registers one.', 'Tiada majlis akan datang berhampiran rumah anda. Ia akan dipaparkan di sini sebaik sahaja jiran mendaftarkannya.')}</li>`;

  byId('myReports').innerHTML = F.reports.length ? F.reports.map((r) => `<li><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
      <span style="font-weight:600">${esc(issueText(r.issue))}</span>${r.resolvedAt ? `<span class="badge ok">${t('Sorted by guard', 'Diselesaikan pengawal')}</span>` : `<span class="badge warn">${t('Sent to guard', 'Dihantar kepada pengawal')}</span>`}</div>
      <span class="small muted">${esc(r.eventTitle)} · ${esc(fmtStamp(r.createdAt))}</span></li>`).join('') : `<li class="empty">${t('None.', 'Tiada.')}</li>`;
}

async function sendReport(eventId, issue) {
  if (sending) return false;
  sending = true;
  try {
    await api('/reports', { method: 'POST', body: { eventId, house, issue } });
    haptic(30);
    toast(t('Sent to the guard on duty.', 'Dihantar kepada pengawal bertugas.'));
    await load();
    return true;
  } catch (err) {
    toast(err.message, 'bad');
    return false;
  } finally {
    sending = false;
  }
}

// One tap: "My gate is blocked" goes straight to the guard for the event most likely causing it.
byId('qaGate').onclick = () => { const e = likelyEvent(); if (e) sendReport(e.id, ISSUES[0][0]); };

// Any other problem: choose it in a sheet (one more tap).
byId('qaReport').onclick = () => {
  const def = likelyEvent();
  const sh = openSheet({
    title: t('What is happening?', 'Apa yang berlaku?'),
    html: `${feed.length > 1 ? `<div class="field"><label for="rEvent">${t('About', 'Berkenaan')}</label><select id="rEvent">${feed.map((e) => `<option value="${e.id}"${def && e.id === def.id ? ' selected' : ''}>${e.status === 'live' ? t('Now: ', 'Sekarang: ') : `${esc(fmtDate(e.date))}: `}${esc(e.title)} (No. ${e.house})</option>`).join('')}</select></div>` : ''}
      <div class="quick">${ISSUES.map(([issue, en, ms, ic], i) => `<button class="btn${i === 0 ? ' primary' : ''}" type="button" data-issue="${esc(issue)}">${icon(ic)}${esc(t(en, ms))}</button>`).join('')}</div>
      <p class="small muted" style="margin-top:10px">${t('The guard on duty sees it instantly. No need to knock on the host\'s door.', 'Pengawal bertugas nampak serta-merta. Tak perlu ketuk pintu tuan rumah.')}</p>`
  });
  sh.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-issue]');
    if (!b) return;
    const sel = sh.el.querySelector('#rEvent');
    if (await sendReport(sel ? sel.value : def.id, b.dataset.issue)) sh.close();
  });
};

// Keep the kerb opposite my gate clear: a switch in a sheet that explains what it does.
byId('qaFront').onclick = () => {
  const fr = F.frontage;
  const sh = openSheet({
    title: t('Keep my gate clear', 'Kosongkan depan pagar saya'),
    html: `<p>${t(`Guests will never be sent to the ${fr.bays} kerb bays opposite your driveway, so you can always drive out. Useful if you work shifts, or have someone at home who may need a car quickly.`,
      `Tetamu tidak akan dihantar ke ${fr.bays} petak bertentangan laluan masuk anda, supaya anda sentiasa boleh keluar. Berguna jika anda bekerja syif, atau ada ahli keluarga yang mungkin perlu kereta dengan segera.`)}</p>
      <label class="toggle-row" for="frontSw" style="background:var(--brand-soft)"><span>${t('Keep it clear for every event', 'Kosongkan untuk setiap majlis')}</span>
        <span class="switch"><input type="checkbox" id="frontSw"${fr.on ? ' checked' : ''}><span></span></span></label>`
  });
  sh.el.querySelector('#frontSw').addEventListener('change', async (e) => {
    try {
      const r = await api('/frontage', { method: 'POST', body: { on: e.target.checked } });
      haptic();
      toast(r.on ? t(`Done. The ${r.bays} bays opposite your gate stay clear for every event.`, `Selesai. ${r.bays} petak bertentangan pagar anda kekal kosong untuk setiap majlis.`)
        : t('Turned off. Those bays can be used for guests again.', 'Dimatikan. Petak itu boleh digunakan tetamu semula.'));
      await load();
    } catch (err) {
      toast(err.message, 'bad');
    }
  });
};

async function saveShare(eventId) {
  const on = document.querySelector(`[data-share="${eventId}"]`).checked;
  const cars = Number(document.querySelector(`[data-cars="${eventId}"]`).value);
  try {
    await api('/shares', { method: 'POST', body: { eventId, house, cars, on } });
    haptic();
    toast(on ? t(`Driveway shared. Guests can now be sent to No. ${house}.`, `Laluan masuk dikongsi. Tetamu boleh dihantar ke No. ${house}.`)
      : t('Driveway sharing turned off.', 'Perkongsian laluan masuk dimatikan.'));
  } catch (err) {
    toast(err.message, 'bad');
  }
  await load();
}

byId('feed').addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.share) saveShare(el.dataset.share);
  else if (el.dataset.cars) {
    const sw = document.querySelector(`[data-share="${el.dataset.cars}"]`);
    if (sw && sw.checked) saveShare(el.dataset.cars);
  }
});

seenBefore = readLS(SEEN(house)) || '';
getMeta().then(load).catch((err) => { byId('feed').innerHTML = `<li class="empty">${esc(err.message)}</li>`; });
live(() => load().catch(() => {}));

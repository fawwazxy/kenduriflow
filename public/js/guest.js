import { api, getMeta, live, byId, esc, fmtTime, fmtDateLong, zoneColor, toast, icon, enableLang, t, tx, markDemo } from './common.js';
import { drawMap } from './map.js';

const code = decodeURIComponent(location.pathname.split('/')[2] || '');
let meta = null;
let S = null;
let myCar = null;      // { car, slotLabel, zoneName } when this phone has parked
let myHold = null;     // { hold, slotLabel, zoneName, directions, color, deadline } while a space is held
let vip = false;
let rsvp = null;       // { id, people, cars } this phone's reply
let draft = { people: 2, cars: 1 };
let editingRsvp = false;
let tick = null;
let myPass = null;     // { pass: { id, code, vip }, state: 'new' | 'in' | 'out', car? } this phone's gate pass

const carKey = () => `kf-car-${S.event.id}`;
const holdKey = () => `kf-hold-${S.event.id}`;
const rsvpKey = () => `kf-rsvp-${S.event.id}`;
const passKey = () => `kf-pass-${S.event.id}`;

// Every guest phone gets one gate pass for the event: the guard scans it in, and scans it out.
async function loadPass() {
  const open = S.event.status !== 'cancelled' && S.event.status !== 'finished';
  const saved = read(passKey());
  if (saved) {
    try { myPass = await api(`/passes/${encodeURIComponent(saved)}`); return; } catch (e) { store(passKey(), null); }
  }
  myPass = null;
  if (!open) return;
  try {
    myPass = await api(`/events/${S.event.id}/passes`, { method: 'POST', body: { vip } });
    store(passKey(), myPass.pass.id);
  } catch (e) { myPass = null; }
}

function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

let offlineSince = null;   // time of the last good update, when the connection has dropped
const lastKey = `kf-last-${code}`;

async function load() {
  try {
    [meta, S] = await Promise.all([getMeta(), api(`/e/${encodeURIComponent(code)}`)]);
    offlineSince = null;
    markDemo(meta.mode);
    store(lastKey, JSON.stringify({ meta, S, at: Date.now() }));
  } catch (err) {
    // Weak signal at the street: keep showing the last plan we had.
    let saved = null;
    try { saved = JSON.parse(read(lastKey) || 'null'); } catch (e) { saved = null; }
    if (saved && /reach the KenduriFlow server/.test(err.message)) {
      ({ meta, S } = saved);
      offlineSince = saved.at;
      render();
      return;
    }
    byId('main').innerHTML = `<section class="card" style="margin-top:16px"><h1>${t('Link not found', 'Pautan tidak dijumpai')}</h1><p class="muted">${esc(err.message)} ${t('Ask the host to send the link again.', 'Minta tuan rumah hantar pautan sekali lagi.')}</p></section>`;
    return;
  }
  await loadPass();
  const savedCar = read(carKey());
  myCar = null;
  if (myPass && myPass.state === 'in') {
    // The guard scanned this pass in: the car is parked.
    myCar = { car: { id: myPass.car.id, slotId: myPass.car.slotId }, slotLabel: myPass.car.slotLabel, zoneName: myPass.car.zoneName };
    store(carKey(), myPass.car.id);
    store(holdKey(), null);
  } else if (savedCar) {
    try {
      const r = await api(`/cars/${encodeURIComponent(savedCar)}`);
      if (r.car.leftAt == null) myCar = r; else store(carKey(), null);
    } catch (e) { store(carKey(), null); }
  }
  if (myPass && !myCar) vip = vip || myPass.pass.vip;
  const savedHold = read(holdKey());
  myHold = null;
  if (savedHold && !myCar) {
    try {
      const h = await api(`/holds/${encodeURIComponent(savedHold)}`);
      myHold = Object.assign(h, { deadline: Date.now() + h.secondsLeft * 1000 });
    } catch (e) { store(holdKey(), null); }
  }
  try { rsvp = JSON.parse(read(rsvpKey()) || 'null'); } catch (e) { rsvp = null; }
  if (rsvp && !editingRsvp) draft = { people: rsvp.people, cars: rsvp.cars };
  render();
}

function left(secs) {
  const m = Math.floor(secs / 60);
  return `${m}:${String(secs % 60).padStart(2, '0')}`;
}

function startCountdown() {
  clearInterval(tick);
  if (!myHold) return;
  const update = () => {
    const secs = Math.max(0, Math.round((myHold.deadline - Date.now()) / 1000));
    const el = byId('holdLeft');
    if (el) {
      el.textContent = t(`${left(secs)} left`, `${left(secs)} lagi`);
      el.parentElement.classList.toggle('low', secs < 120);
    }
    if (secs <= 0) {
      clearInterval(tick);
      store(holdKey(), null);
      toast(t('Your hold ran out. Here is the next free space.', 'Masa simpanan tamat. Ini tempat kosong seterusnya.'), 'bad');
      load();
    }
  };
  update();
  tick = setInterval(update, 1000);
}

function render() {
  const ev = S.event;
  const L = S.live;
  document.title = `${ev.title} · ${t('Where to park', 'Tempat letak kereta')}`;
  byId('gTitle').textContent = ev.title;
  byId('gWhen').innerHTML = `
    <span class="chip">${icon('calendar')}${esc(fmtDateLong(ev.date))}</span>
    <span class="chip">${icon('clock')}${fmtTime(ev.start)} ${t('to', 'hingga')} ${fmtTime(ev.end)}</span>
    <span class="chip">${icon('pin')}No. ${ev.house}, ${esc(ev.street)}</span>`;

  const open = ev.status !== 'finished' && ev.status !== 'cancelled';
  const mins = offlineSince ? Math.max(1, Math.round((Date.now() - offlineSince) / 60000)) : 0;
  const offline = offlineSince ? `<div class="alert warn strong" style="margin:0 0 16px">${icon('alert')}<span>${t(
    `No signal. Showing the plan from ${mins} min ago. It updates when you are back online.`,
    `Tiada isyarat. Menunjukkan pelan ${mins} minit lalu. Ia dikemas kini apabila anda kembali dalam talian.`)}</span></div>` : '';
  byId('gLane').innerHTML = offline + ((L.laneBlocked || L.laneReports) && open
    ? `<div class="alert bad big strong" style="margin:0 0 16px">${icon('alert')}<span>${t(
      `The emergency lane on ${esc(ev.street)} is blocked. Never stop on the house side of the road. The guard is clearing it.`,
      `Lorong kecemasan di ${esc(ev.street)} tersekat. Jangan berhenti di sebelah rumah. Pengawal sedang menguruskannya.`)}</span></div>`
    : '');

  const box = byId('parkBox');
  let routeSlot = null;
  clearInterval(tick);

  if (ev.status === 'cancelled') {
    box.innerHTML = `<div class="card"><h2>${t('This event has been cancelled', 'Majlis ini telah dibatalkan')}</h2><p class="muted">${t('Please contact the host for details.', 'Sila hubungi tuan rumah untuk maklumat lanjut.')}</p></div>`;
  } else if (ev.status === 'finished') {
    box.innerHTML = `<div class="card"><h2>${t('This event has ended', 'Majlis ini telah tamat')}</h2><p class="muted">${t('Thank you for coming, and for parking considerately.', 'Terima kasih kerana hadir dan meletak kereta dengan bertimbang rasa.')}</p></div>`;
  } else if (myCar) {
    routeSlot = myCar.car.slotId;
    box.innerHTML = `
      <div class="park-card" style="--zc:var(--ok)">
        <span class="tag" style="color:var(--ok)">${icon('check')}${t('You are parked at', 'Kereta anda di')}</span>
        <p class="zone-name">${esc(tx(myCar.slotLabel))}</p>
        ${myCar.zoneName && myCar.zoneName !== myCar.slotLabel ? `<p class="zone-sub">${esc(tx(myCar.zoneName))}</p>` : ''}
        <p class="muted">${t('The map shows your walk to the house. When you leave, tap the button so your space goes to another guest.', 'Peta menunjukkan laluan jalan kaki ke rumah. Apabila pulang, tekan butang supaya tempat anda boleh digunakan tetamu lain.')}</p>
        <div class="guest-actions"><button class="btn secondary block" type="button" id="leaveBtn">${t("I'm leaving", 'Saya hendak pulang')}</button></div>
      </div>`;
    byId('leaveBtn').onclick = leave;
  } else if (myHold) {
    routeSlot = myHold.hold.slotId;
    const col = zoneColor(myHold.color);
    box.innerHTML = `
      <div class="park-card" style="--zc:${col}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="tag" style="color:var(--brand)">${icon('check')}${t('Held for you', 'Disimpan untuk anda')}</span>
          <span class="countdown">${icon('clock')}<span id="holdLeft"></span></span>
        </div>
        <p class="zone-name">${esc(tx(myHold.slotLabel))}</p>
        ${myHold.zoneName !== myHold.slotLabel ? `<p class="zone-sub">${esc(tx(myHold.zoneName))}</p>` : ''}
        <p>${esc(tx(myHold.directions))}</p>
        <p class="small muted">${t('No other guest will be sent here while you are on your way.', 'Tiada tetamu lain akan dihantar ke sini semasa anda dalam perjalanan.')}</p>
        <div class="guest-actions">
          <button class="btn block" type="button" id="parkBtn" style="min-height:54px;font-size:16px">${icon('check')}${t("I've parked here", 'Saya sudah letak kereta di sini')}</button>
          <button class="btn secondary block" type="button" id="takenBtn">${t('Someone is already parked here', 'Sudah ada kereta di sini')}</button>
          <button class="btn link" type="button" id="cancelHold">${t('Cancel my hold', 'Batalkan simpanan')}</button>
        </div>
      </div>`;
    byId('parkBtn').onclick = (e) => park(e, { holdId: myHold.hold.id });
    byId('takenBtn').onclick = holdTaken;
    byId('cancelHold').onclick = cancelHold;
    startCountdown();
  } else {
    const n = vip ? L.nextVip : L.next;
    if (!n) {
      box.innerHTML = `<div class="park-card" style="--zc:var(--bad)">
        <span class="tag" style="color:var(--bad)">${icon('alert')}${t('No free space right now', 'Tiada tempat kosong sekarang')}</span>
        <p class="zone-name">${t('Please wait at the Persiaran Elmina layby', 'Sila tunggu di lay-by Persiaran Elmina')}</p>
        <p class="muted">${t('The guard will wave you in when a space frees up. This page updates by itself.', 'Pengawal akan memanggil anda masuk apabila ada tempat kosong. Halaman ini dikemas kini sendiri.')}</p></div>`;
    } else {
      routeSlot = n.slotId;
      const col = zoneColor(n.color);
      const shuttle = /shuttle/i.test(n.walk);
      box.innerHTML = `
        <div class="park-card" style="--zc:${col}">
          <span class="tag"><i class="dot" style="background:${col}"></i>${t('Park here', 'Letak kereta di sini')}</span>
          <p class="zone-name">${esc(tx(n.slotLabel))}</p>
          <p class="zone-sub">${n.zoneName !== n.slotLabel ? esc(tx(n.zoneName)) : t("Shared by your host's neighbour", 'Dikongsi oleh jiran tuan rumah')}</p>
          <div class="facts">
            <span class="chip"><span><b>${n.freeInZone}</b> ${t('left here', 'kosong di sini')}</span></span>
            <span class="chip"><span><b>${L.freeTotal}</b> ${t('left in total', 'kosong semuanya')}</span></span>
            <span class="chip">${icon(shuttle ? 'bus' : 'walk')}${esc(tx(n.walk))}</span>
          </div>
          <p>${esc(tx(n.directions))}</p>
          <label class="toggle-row" for="vipBox"><span>${t('I am bringing an elderly or OKU guest', 'Saya membawa warga emas atau OKU')}</span>
            <span class="switch"><input type="checkbox" id="vipBox"${vip ? ' checked' : ''}><span></span></span></label>
          <div class="guest-actions">
            <button class="btn block" type="button" id="holdBtn" style="min-height:54px;font-size:16px">${icon('clock')}${t("I'm on my way: hold it for 10 min", 'Saya dalam perjalanan: simpan 10 minit')}</button>
            <button class="btn secondary block" type="button" id="parkBtn">${icon('check')}${t("I've parked here", 'Saya sudah letak kereta di sini')}</button>
            <button class="btn link" type="button" id="takenBtn">${t('Someone is already parked here', 'Sudah ada kereta di sini')}</button>
          </div>
        </div>`;
      byId('vipBox').onchange = (e) => { vip = e.target.checked; render(); if (myPass) api(`/passes/${myPass.pass.id}`, { method: 'POST', body: { vip } }).catch(() => {}); };
      byId('holdBtn').onclick = hold;
      byId('parkBtn').onclick = (e) => park(e, { slotId: n.slotId });
      byId('takenBtn').onclick = (e) => taken(e, n.slotId);
    }
  }
  if (open) box.insertAdjacentHTML('beforeend', `<p class="live-note">${t('Updates by itself as spaces fill up', 'Dikemas kini sendiri apabila tempat dipenuhi')}</p>`);

  renderPass();
  renderRsvp();
  const mapBox = byId('gMap');
  drawMap(mapBox, meta.precinct, S, { routeSlot, label: t('Map with the walking route from your parking space to the house', 'Peta laluan jalan kaki dari tempat letak kereta ke rumah') });
  centreMap(mapBox, routeSlot);
}

// The gate passes: an ENTRY QR from the moment the guest opens the invitation,
// then an EXIT QR once the guard has scanned them in. After leaving, the entry QR comes back for a return visit.
function renderPass() {
  const box = byId('passBox');
  const open = S.event.status !== 'cancelled' && S.event.status !== 'finished';
  if (!myPass || !open) { box.innerHTML = ''; return; }
  const exit = myPass.show === 'out';
  const code = exit ? myPass.pass.outCode : myPass.pass.code;
  const path = `/g/${myPass.pass.id}?d=${exit ? 'out' : 'in'}`;
  box.innerHTML = `<section class="card pass-card ${exit ? 'out' : 'in'}" style="margin-top:16px">
    <div class="pass-band">${exit ? icon('logout') : icon('car')}<span><b>${exit ? t('EXIT PASS · OUT', 'PAS KELUAR · OUT') : t('ENTRY PASS · IN', 'PAS MASUK · IN')}</b>
      <small>${exit ? t('Show this to the guard when you leave', 'Tunjukkan kepada pengawal apabila pulang') : t('Show this to the guard when you arrive', 'Tunjukkan kepada pengawal apabila tiba')}</small></span></div>
    <div class="pass-qr"><img src="/api/qr.svg?path=${encodeURIComponent(path)}" alt="${exit ? t('Exit QR code', 'Kod QR keluar') : t('Entry QR code', 'Kod QR masuk')}"></div>
    <p class="pass-code" aria-label="${t('Pass code', 'Kod pas')}">${esc(code.slice(0, 3))} ${esc(code.slice(3))}</p>
    <p class="small muted" style="text-align:center;margin:0">${exit
      ? t('Your space is freed for the next guest when this is scanned.', 'Tempat anda dikosongkan untuk tetamu lain apabila kod ini diimbas.')
      : t('Turn your screen brightness up. No camera? The guard can type the code.', 'Naikkan kecerahan skrin. Tiada kamera? Pengawal boleh taip kod ini.')}</p>
  </section>`;
}

// Before the event: "how many people, how many cars". Replies sharpen the host's parking estimate.
function renderRsvp() {
  const box = byId('rsvpBox');
  const ev = S.event;
  if (ev.status !== 'planned' || myCar) { box.innerHTML = ''; return; }
  if (rsvp && !editingRsvp) {
    box.innerHTML = `<div class="card" style="margin-top:16px">
      <div class="alert ok" style="margin:0">${icon('check')}<span>${t(
        `Thank you. You told the host: ${rsvp.people} ${rsvp.people === 1 ? 'person' : 'people'} in ${rsvp.cars} ${rsvp.cars === 1 ? 'car' : 'cars'}.`,
        `Terima kasih. Anda memberitahu tuan rumah: ${rsvp.people} orang dalam ${rsvp.cars} kereta.`)}</span></div>
      <button class="btn link" type="button" id="rsvpEdit" style="margin-top:4px">${t('Change my answer', 'Ubah jawapan')}</button></div>`;
    byId('rsvpEdit').onclick = () => { editingRsvp = true; renderRsvp(); };
    return;
  }
  const carOpts = [0, 1, 2, 3].map((c) => `<label><input type="radio" name="rsvpCars" value="${c}"${c === draft.cars ? ' checked' : ''}><span>${c === 0 ? t('No car', 'Tiada') : c}</span></label>`).join('');
  box.innerHTML = `<div class="card" style="margin-top:16px">
    <div class="card-head" style="margin-bottom:6px"><h2>${t('Coming? Help the host plan parking', 'Akan hadir? Bantu tuan rumah merancang parkir')}</h2></div>
    <p class="intro">${t('Two quick answers. They make the parking plan more accurate for everyone.', 'Dua jawapan ringkas. Ia menjadikan pelan parkir lebih tepat untuk semua.')}</p>
    <div class="ask"><span>${t('People coming, including you', 'Orang yang hadir, termasuk anda')}</span>
      <span class="stepper"><button class="btn secondary" type="button" data-step="-1" aria-label="${t('Fewer', 'Kurang')}">−</button><output id="rsvpPeople">${draft.people}</output><button class="btn secondary" type="button" data-step="1" aria-label="${t('More', 'Lagi')}">+</button></span></div>
    <div class="ask"><span>${t('Cars you are coming in', 'Bilangan kereta')}</span><span class="seg">${carOpts}</span></div>
    <button class="btn block" type="button" id="rsvpSend" style="margin-top:10px">${t('Send to the host', 'Hantar kepada tuan rumah')}</button>
  </div>`;
  box.querySelectorAll('[data-step]').forEach((b) => {
    b.onclick = () => { draft.people = Math.min(20, Math.max(1, draft.people + Number(b.dataset.step))); byId('rsvpPeople').textContent = draft.people; };
  });
  box.querySelectorAll('[name=rsvpCars]').forEach((r) => { r.onchange = () => { draft.cars = Number(r.value); }; });
  byId('rsvpSend').onclick = sendRsvp;
}

async function sendRsvp(e) {
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    const r = await api(`/events/${S.event.id}/rsvp`, { method: 'POST', body: { id: rsvp ? rsvp.id : undefined, people: draft.people, cars: draft.cars } });
    rsvp = { id: r.id, people: r.people, cars: r.cars };
    store(rsvpKey(), JSON.stringify(rsvp));
    editingRsvp = false;
    toast(t('Thank you. The host has your answer.', 'Terima kasih. Jawapan anda telah dihantar.'));
    renderRsvp();
  } catch (err) {
    toast(err.message, 'bad');
    btn.disabled = false;
  }
}

// On a phone the map is wider than the screen. Scroll it so the parking space and the house are in view.
function centreMap(box, slotId) {
  if (box.scrollWidth <= box.clientWidth) return;
  const host = meta.precinct.houses.find((h) => h.no === S.event.house);
  let x = host ? host.door.x : 400;
  if (slotId) {
    for (const z of meta.precinct.zones) {
      const s = z.slots.find((q) => q.id === slotId);
      if (s && z.kind === 'lot') x = (x + s.x) / 2 + 60;
    }
  }
  box.scrollLeft = (x / meta.precinct.map.width) * box.scrollWidth - box.clientWidth / 2;
}

async function withButton(e, fn) {
  const btn = e.currentTarget;
  btn.disabled = true;
  try { await fn(); } catch (err) { toast(err.message, 'bad'); btn.disabled = false; }
}

// Hold the suggested space for 10 minutes while the guest drives over.
function hold(e) {
  return withButton(e, async () => {
    const r = await api(`/events/${S.event.id}/holds`, { method: 'POST', body: { vip, passId: myPass ? myPass.pass.id : undefined } });
    store(holdKey(), r.hold.id);
    toast(t(`${tx(r.slotLabel)} is held for you for 10 minutes.`, `${tx(r.slotLabel)} disimpan untuk anda selama 10 minit.`));
    await load();
  });
}

function park(e, body) {
  return withButton(e, async () => {
    const r = await api(`/events/${S.event.id}/cars`, { method: 'POST', body: Object.assign({ source: 'guest', vip, passId: myPass ? myPass.pass.id : undefined }, body) });
    store(carKey(), r.car.id);
    store(holdKey(), null);
    toast(t(`Saved. You are parked at ${r.slotLabel}.`, `Disimpan. Kereta anda di ${tx(r.slotLabel)}.`));
    await load();
  });
}

// The suggested space already has a car in it (someone parked without the link). Mark it and show the next one.
function taken(e, slotId) {
  return withButton(e, async () => {
    await api(`/events/${S.event.id}/slots/${encodeURIComponent(slotId)}/taken`, { method: 'POST' });
    toast(t('Thanks. That space is marked as full. Here is the next one.', 'Terima kasih. Tempat itu ditanda penuh. Ini tempat seterusnya.'));
    await load();
  });
}

// The held space has a car in it: mark it full and hold the next one straight away.
function holdTaken(e) {
  return withButton(e, async () => {
    const r = await api(`/holds/${encodeURIComponent(myHold.hold.id)}/taken`, { method: 'POST', body: { passId: myPass ? myPass.pass.id : undefined } });
    store(holdKey(), r.hold.id);
    toast(t(`Marked as full. ${r.slotLabel} is now held for you.`, `Ditanda penuh. ${tx(r.slotLabel)} kini disimpan untuk anda.`));
    await load();
  });
}

function cancelHold(e) {
  return withButton(e, async () => {
    await api(`/holds/${encodeURIComponent(myHold.hold.id)}/cancel`, { method: 'POST' });
    store(holdKey(), null);
    await load();
  });
}

function leave(e) {
  return withButton(e, async () => {
    await api(`/cars/${myCar.car.id}/leave`, { method: 'POST' });
    store(carKey(), null);
    myCar = null;
    toast(t('Thank you. Your space is free for the next guest.', 'Terima kasih. Tempat anda kini kosong untuk tetamu lain.'));
    await load();
  });
}

enableLang(() => { if (S) render(); });
load();
live(() => load());
window.addEventListener('online', () => load());

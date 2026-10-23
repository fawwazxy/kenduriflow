import {
  api, getMeta, live, byId, esc, shell, setTitle, segTabs, openSheet, fmtTime, fmtDate, fmtStamp, addDays, statusBadge,
  zoneColor, confirmClick, copyText, toast, plural, icon, haptic
} from './common.js';
import { drawMap, LEGEND_HTML } from './map.js';
import { drawCarsChart } from './chart.js';

const me0 = await shell({ roles: ['resident', 'guard', 'township'], nav: 'host', title: 'Event', back: '/host' });
if (!me0) await new Promise(() => {});   // shell() has sent the person to sign in, or explained why they cannot use this page
const me = me0;
const gateRole = me.role === 'guard' || me.role === 'township';
if (me.role === 'guard') document.querySelector('.ab-back').href = '/guard';
const id = decodeURIComponent(location.pathname.split('/')[2] || '');
let meta = null;
let S = null;
let shareDone = false;
let welcomed = false;
let tabs = null;

async function load() {
  try {
    [meta, S] = await Promise.all([getMeta(), api(`/events/${encodeURIComponent(id)}/state`)]);
  } catch (err) {
    byId('main').innerHTML = `<section class="card" style="margin-top:16px"><h2>Event not found</h2><p class="muted">${esc(err.message)}</p><a class="btn" href="/host">Back to events</a></section>`;
    byId('actionbar').hidden = true;
    return;
  }
  render();
}

const inviteText = () => {
  const ev = S.event;
  return `Assalamualaikum! You are invited to ${ev.title}, ${fmtDate(ev.date)}, ${fmtTime(ev.start)} to ${fmtTime(ev.end)} at No. ${ev.house}, ${ev.street}.\n\n` +
    `Please open this link now to tell us how many cars you are bringing. On the day it shows exactly where to park, and your QR pass for the guardhouse (entry when you arrive, exit when you leave):\n${S.guestUrl}\n\n(Pautan ini juga dalam Bahasa Melayu.)`;
};

// The phone's own share menu (WhatsApp, Telegram, SMS…) when there is one; otherwise our share sheet.
async function share() {
  haptic();
  const text = inviteText();
  if (navigator.share) {
    try { await navigator.share({ title: S.event.title, text }); return; } catch (err) { if (err && err.name === 'AbortError') return; }
  }
  const sh = openSheet({
    title: 'Share the invitation',
    html: `<ul class="rows" style="box-shadow:none;border:1px solid var(--line)">
      <li><a class="row" href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener"><span class="lead" style="background:#DCF8C6;color:#128C7E">${icon('share')}</span><span class="body"><b>WhatsApp</b><small>Send the message with the link</small></span>${icon('chev', 'chev')}</a></li>
      <li><button class="row" type="button" data-copy="msg"><span class="lead grey">${icon('copy')}</span><span class="body"><b>Copy message</b><small>Paste into any chat or invitation card</small></span></button></li>
      <li><button class="row" type="button" data-copy="link"><span class="lead grey">${icon('link')}</span><span class="body"><b>Copy link only</b><small>${esc(S.guestUrl)}</small></span></button></li>
    </ul>
    <div class="qr" style="justify-content:center;margin-top:16px"><img src="/api/qr.svg?path=${encodeURIComponent(S.guestPath)}" alt="QR code for the guest page"></div>
    <p class="small muted" style="text-align:center">Guests can also scan this QR code from a printed card.</p>`
  });
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    const label = b.querySelector('b');
    copyText(b.dataset.copy === 'msg' ? text : S.guestUrl, label);
  });
}

function more() {
  const ev = S.event;
  const sh = openSheet({
    title: ev.title,
    html: `<ul class="rows" style="box-shadow:none;border:1px solid var(--line)">
      <li><a class="row" href="${S.guestPath}" target="_blank" rel="noopener"><span class="lead">${icon('pin')}</span><span class="body"><b>Open the guest page</b><small>What your guests see</small></span>${icon('chev', 'chev')}</a></li>
      ${gateRole ? `<li><a class="row" href="/guard/${ev.id}"><span class="lead">${icon('shield')}</span><span class="body"><b>Guard view</b><small>Count cars at the entrance</small></span>${icon('chev', 'chev')}</a></li>` : ''}
      ${S.canManage && ev.status !== 'cancelled' ? `<li><a class="row" href="/plan?edit=${ev.id}"><span class="lead">${icon('edit')}</span><span class="body"><b>Edit details</b><small>Date, time, guests</small></span>${icon('chev', 'chev')}</a></li>
      <li><button class="row danger" type="button" id="cancelEv"><span class="lead red">${icon('x')}</span><span class="body"><b>Cancel event</b><small>Guests and neighbours are told</small></span></button></li>` : ''}
    </ul>`
  });
  const cb = sh.el.querySelector('#cancelEv');
  if (cb) {
    cb.onclick = () => confirmClick(cb.querySelector('b'), 'Tap again to cancel the event', async () => {
      try { await api(`/events/${ev.id}/cancel`, { method: 'POST' }); sh.close(); toast('Event cancelled. Guests and neighbours were told.'); load(); } catch (err) { toast(err.message, 'bad'); }
    });
  }
}

function render() {
  const ev = S.event;
  const p = S.prediction;
  const L = S.live;
  const cancelled = ev.status === 'cancelled';
  document.title = `${ev.title} · KenduriFlow`;
  setTitle(ev.title);
  byId('evTitle').textContent = ev.title;
  byId('evStatus').innerHTML = statusBadge(ev.status);
  byId('evSub').innerHTML = `
    <span class="chip">${icon('calendar')}${fmtDate(ev.date)}, ${fmtTime(ev.start)} to ${fmtTime(ev.end)}</span>
    <span class="chip">${icon('pin')}No. ${ev.house}, ${esc(ev.street)}</span>
    <span class="chip">${icon('users')}${ev.guests} guests</span>
    <span class="chip">${esc(ev.typeShort)}${ev.hostName ? ` · ${esc(ev.hostName)}` : ''}</span>`;

  // Bottom bar: the one thing you most likely want to do here.
  const bar = byId('actionbar');
  bar.hidden = cancelled && !gateRole;
  bar.innerHTML = me.role === 'guard'
    ? `<a class="btn" href="/guard/${ev.id}">${icon('shield')}Open guard view</a><button class="btn secondary" type="button" id="moreBtn" style="flex:0 0 56px" aria-label="More">⋯</button>`
    : `<button class="btn" type="button" id="shareBtn"${cancelled ? ' disabled' : ''}>${icon('share')}Share invitation</button><button class="btn secondary" type="button" id="moreBtn" style="flex:0 0 56px" aria-label="More">⋯</button>`;
  if (byId('shareBtn')) byId('shareBtn').onclick = share;
  byId('moreBtn').onclick = more;

  const alerts = [];
  if (cancelled) alerts.push(`<div class="alert bad" style="margin:0 0 16px">${icon('x')}<span>This event was cancelled. The guest link now tells guests it is cancelled.</span></div>`);
  if (!cancelled && S.plan.shortfall > 0) alerts.push(`<div class="alert bad big strong" style="margin:0 0 16px">${icon('alert')}<span>Not enough space for ${plural(S.plan.shortfall, 'car')} at the busiest time. Ask the township team for another overflow car park, shorten the event, or ask guests to share rides.</span></div>`);
  if (S.plan.clashes.length) alerts.push(`<div class="alert warn" style="margin:0 0 16px">${icon('alert')}<span>${S.plan.clashes.map((c) => `"${esc(c.title)}" at No. ${c.house} is on the same street from ${fmtTime(c.start)} to ${fmtTime(c.end)}.`).join(' ')} The kerb is shared: each host gets the spaces nearest their house.</span></div>`);
  if (ev.status === 'live') alerts.push(`<div class="alert info strong" style="margin:0 0 16px">${icon('car')}<span>Live now: ${plural(L.onsite, 'car')} here, ${L.freeTotal} spaces free. See the Live tab.</span></div>`);
  byId('evAlerts').innerHTML = alerts.join('');

  const learned = p.learnedFrom ? ` · tuned by ${plural(p.learnedFrom, 'counted event')}` : '';
  byId('evStats').innerHTML = `
    <div class="stats">
      <div class="stat"><div class="n">${p.totalCars}</div><div class="l">cars in total</div><div class="s">${p.guests} ÷ ${p.peoplePerCar.toFixed(1)} per car${learned}</div></div>
      <div class="stat main"><div class="n">${p.peak}</div><div class="l">at the same time</div><div class="s">around ${fmtTime(p.peakTime)}</div></div>
      <div class="stat"><div class="n">${p.planned}</div><div class="l">spaces planned</div><div class="s">busiest + 10%</div></div>
    </div>`;
  const o = S.observation;
  byId('evResult').innerHTML = o ? `<div class="alert ${o.used ? 'ok' : 'info'}" style="margin:0 0 12px">${icon('trend')}<span>
      <b>${o.cars} cars counted</b> against ${o.predictedCars} predicted, busiest ${o.peak} against ${o.predictedPeak}.
      ${o.used ? `Saved: the next ${esc(ev.typeShort.toLowerCase())} estimate uses it.` : o.simulated ? 'This was a simulation, so it is not used for learning.' : 'The counts look incomplete, so they are not used for learning.'}</span></div>` : '';
  drawCarsChart(byId('evChart'), {
    prediction: p, start: ev.start, duration: ev.duration, history: L.history, clock: L.clock,
    showNow: ev.status === 'live', capacity: S.plan.walkingCapacity
  });
  byId('evHow').innerHTML = `
    <li><b>People per car.</b> For a ${esc(ev.typeShort.toLowerCase())} we start from ${p.basePeoplePerCar.toFixed(1)} people per car, because ${esc(p.reason)}.${p.learnedFrom ? ` Real counts from ${plural(p.learnedFrom, 'past event')} in the precinct give ${p.learnedPeoplePerCar.toFixed(2)}.` : ''}</li>
    <li><b>Your guests' replies.</b> Guests can answer "how many people, how many cars" from their link. After 5 replies their answers gradually take over.${p.rsvp ? ` So far: ${plural(p.rsvp.n, 'reply', 'replies')}.` : ''}</li>
    <li><b>Arrival pattern.</b> Guests are spread across the event in ${p.step}-minute steps, following the usual pattern for this type of event.</li>
    <li><b>How long cars stay.</b> About ${p.stayMin} minutes.</li>
    <li><b>Plan for the busiest moment.</b> We plan for ${p.peak} cars at once, not all ${p.totalCars}, plus a 10% buffer.</li>
    <li><b>It learns.</b> When the event ends, the real counts tune the next estimate for this type of event.</li>`;

  const openReports = S.reports.filter((r) => !r.resolvedAt).length;
  byId('repCount').hidden = !openReports;
  byId('repCount').textContent = openReports;

  renderPlan();
  renderShare();
  renderNeighbours();
  renderTimeline();
  if (!tabs || tabs.current() === 'live') renderMap();

  // Straight after registering: offer to share the link.
  if (!welcomed && new URLSearchParams(location.search).has('new')) {
    welcomed = true;
    history.replaceState(null, '', location.pathname);
    const sh = openSheet({
      title: 'Your majlis is registered 🎉',
      html: `<p>Your neighbours and the guardhouse have been told. Now send your guests the link: before the day they tell you how many cars are coming, and on the day it shows each of them where to park.</p>
        <div class="actionbar" style="margin-top:14px"><button class="btn" type="button" id="welcomeShare">${icon('share')}Share invitation</button></div>`
    });
    sh.el.querySelector('#welcomeShare').onclick = () => { sh.close(); setTimeout(share, 280); };
  }
}

function renderPlan() {
  const plan = S.plan;
  const zones = plan.zones;
  const used = zones.filter((z) => z.planned > 0);
  const bar = used.map((z) => `<span style="flex:${z.planned};background:${zoneColor(z.color)}" title="${esc(z.short)}: ${z.planned}"></span>`).join('') +
    (plan.shortfall > 0 ? `<span style="flex:${plan.shortfall};background:repeating-linear-gradient(45deg,#B42318 0 3px,#fff 3px 6px)"></span>` : '');
  const rows = zones.filter((z) => z.capacity > 0 || z.closed).map((z) => {
    let sub = z.closed ? 'Closed during Friday prayers' : esc(z.walk);
    if (z.kind === 'driveway' && z.houses && z.houses.length) sub = `${z.houses.map((h) => `No. ${h.house}`).join(', ')}. ${sub}`;
    if (z.kind === 'kerb' && z.street === S.event.street && S.plan.vipSlots.length) sub += `. ${S.plan.vipSlots.length} nearest spaces kept for elderly or OKU guests`;
    return `<div class="zone"><i class="dot" style="background:${zoneColor(z.color)}"></i><span class="zn">${esc(z.name)}</span><span class="zc">${z.planned} <small>of ${z.capacity}</small></span><span class="zs">${sub}</span></div>`;
  }).join('');
  const notes = [];
  if (plan.surauClosed) notes.push(`<div class="alert warn">${icon('clock')}<span>The event overlaps Friday prayers, so the surau car park is not used.</span></div>`);
  if (plan.shortfall > 0) notes.push(`<div class="alert bad">${icon('alert')}<span>Short by ${plural(plan.shortfall, 'space')}.</span></div>`);
  else if (plan.shuttle) notes.push(`<div class="alert info">${icon('bus')}<span>${zones.find((z) => z.kind === 'lot' && z.id === 'mall').planned} cars go to the mall car park. ${plan.shuttle.buggies} shuttle ${plan.shuttle.buggies > 1 ? 'buggies run' : 'buggy runs'} every ${plan.shuttle.every} minutes, about ${plan.shuttle.riders} guests in total.</span></div>`);
  else notes.push(`<div class="alert ok">${icon('check')}<span>Every car fits within a short walk of the house. No shuttle needed.</span></div>`);
  byId('evPlan').innerHTML = `<div class="zbar">${bar}</div>${rows}${notes.join('')}`;
}

function renderShare() {
  const p = S.prediction;
  const r = p.rsvp;
  const withoutReplies = Math.ceil(p.hostGuests / p.learnedPeoplePerCar);
  const replies = `<section class="card" id="evReplies">
    <div class="card-head"><h2>Replies from guests</h2><span class="badge ${r && r.n ? 'ok' : ''}">${r ? plural(r.n, 'household') : 'None yet'}</span></div>
    ${r && r.n ? `<div class="stats" style="margin-bottom:10px">
        <div class="stat"><div class="n">${r.people}</div><div class="l">people</div></div>
        <div class="stat"><div class="n">${r.cars}</div><div class="l">cars</div></div>
        <div class="stat"><div class="n">${r.peoplePerCar ? r.peoplePerCar.toFixed(1) : '–'}</div><div class="l">per car</div></div></div>
      <p class="small muted">${r.weight > 0 ? `The estimate now uses ${p.peoplePerCar.toFixed(2)} people per car: <b>${p.totalCars} cars</b>, against ${withoutReplies} from your guest count alone.` : 'Replies start shaping the estimate after 5 households.'}
      ${r.people > p.hostGuests ? ` Replies already count ${r.people} people, more than your estimate of ${p.hostGuests}.` : ''}</p>`
    : '<p class="muted" style="margin:0">When guests open the link before the day, they tell you how many people and cars are coming. Their answers sharpen the parking plan.</p>'}
  </section>`;
  if (!shareDone) {
    byId('evShare').innerHTML = `<section class="card">
        <h2>Invitation link</h2>
        <p class="intro">One link for the WhatsApp group or the digital invitation card. No app or account needed. English and Bahasa Melayu.</p>
        <div class="linkbox"><input type="text" readonly value="${esc(S.guestUrl)}" aria-label="Guest link"><button class="btn secondary" type="button" id="copyLink">${icon('copy')}Copy</button></div>
        <div class="qr"><img src="/api/qr.svg?path=${encodeURIComponent(S.guestPath)}" alt="QR code for the guest page"><p>Print this QR code on the invitation card, or scan it to try the guest page.</p></div>
      </section>
      <section class="card"><h2>Message for WhatsApp</h2><div class="msg" id="waMsg"></div></section>
      <div id="evRepliesBox"></div>`;
    byId('waMsg').textContent = inviteText();
    byId('copyLink').onclick = (e) => copyText(S.guestUrl, e.currentTarget);
    shareDone = true;
  }
  byId('evRepliesBox').innerHTML = replies;
}

function renderNeighbours() {
  const ev = S.event;
  const shares = S.shares;
  const open = S.reports.filter((r) => !r.resolvedAt);
  byId('evNeighbours').innerHTML = `
    <p>${S.neighboursNotified} households in the precinct and the guardhouse were told on ${esc(fmtStamp(ev.createdAt))}.</p>
    <p class="label" style="margin-top:12px">Driveways shared for this event</p>
    ${shares.length ? `<p>${shares.map((s) => `No. ${s.house} (${plural(s.cars, 'car')})`).join(', ')}</p>` : '<p class="empty">None yet. Neighbours on your street can share theirs from the app.</p>'}
    <p class="label" style="margin-top:12px">Reports from neighbours</p>
    ${open.length ? open.map((r) => `<div class="report-row"><span><b>No. ${r.house}:</b> ${esc(r.issue)}</span><span class="small">${fmtTime(ev.start + r.clock)}</span></div>`).join('') : '<p class="empty">No open reports.</p>'}`;
}

function renderTimeline() {
  const ev = S.event;
  const L = S.live;
  const liveBadge = ev.status === 'live' ? '<span class="badge live">Now</span>' : ev.status === 'finished' ? '<span class="badge ok">Done</span>' : '<span class="badge">Event day</span>';
  const items = [
    [fmtStamp(ev.createdAt), 'Neighbours and guardhouse told', `${S.neighboursNotified} households get the date, time and expected cars.`, '<span class="badge ok">Done</span>'],
    [`${fmtDate(addDays(ev.date, -1))}, 9:00 pm`, 'Reminder', 'Neighbours on the street see a reminder and an offer to share their driveway.', '<span class="badge info">Scheduled</span>'],
    [`${fmtDate(ev.date)}, ${fmtTime(ev.start - 120)}`, 'Guards briefed', `The guard view lists every event on these streets that day${S.plan.clashes.length ? ', including the clash' : ''}.`, '<span class="badge info">Scheduled</span>'],
    [`${fmtTime(ev.start)} to ${fmtTime(ev.end)}`, 'Guests guided to free spaces', ev.status === 'live' ? `Live now: ${L.onsite} cars here.` : 'Each guest holds the closest free space on the way. Guards count cars at the entrance.', liveBadge],
    [S.pickup.label, 'Extra rubbish pickup', `Booked with the township contractor for ${esc(S.pickup.street)}.`, '<span class="badge ok">Booked</span>'],
    [fmtDate(S.pickup.date), 'Learn from the counts', S.observation ? `${S.observation.cars} cars counted against ${S.observation.predictedCars} predicted.` : 'When the event ends, the real counts tune the next estimate.', S.observation ? '<span class="badge ok">Saved</span>' : '<span class="badge info">After the event</span>']
  ];
  byId('evTimeline').innerHTML = items.map(([when, what, text, badge]) =>
    `<li><span class="when">${when}</span><div class="what"><b>${what}</b><p>${text}</p></div>${badge}</li>`).join('');
}

function renderMap() {
  if (!S) return;
  const ev = S.event;
  const L = S.live;
  drawMap(byId('evMap'), meta.precinct, S, { label: `Map of ${ev.street} and nearby parking for ${ev.title}` });
  byId('evLegend').innerHTML = LEGEND_HTML;
  byId('evLive').textContent = L.running ? `Live · ${fmtTime(L.time)} · ${L.onsite} cars here`
    : ev.status === 'live' ? `${fmtTime(L.time)} · ${L.onsite} cars here`
      : ev.status === 'finished' ? 'Event finished' : 'The plan before the event';
  byId('evMeters').innerHTML = S.plan.zones.filter((z) => z.capacity > 0 || z.closed).map((z) => {
    const total = z.slotsTotal || 1;
    const pct = Math.min(100, (z.inUse / total) * 100);
    const state = z.closed ? '<span class="badge">Closed</span>' : z.free === 0 ? '<span class="badge bad">Full</span>' : z.parked ? `<span class="badge ok">${z.free} free</span>` : `<span class="badge">${z.free} free</span>`;
    return `<div class="meter"><span class="mn"><i class="dot" style="background:${zoneColor(z.color)}"></i>${esc(z.short)}</span><span class="small muted">${z.parked} parked</span>${state}<span class="bar"><i style="width:${pct}%;background:${zoneColor(z.color)}"></i></span></div>`;
  }).join('');
}

// The map is drawn when its tab is open (it is the heaviest part of the page).
tabs = segTabs(byId('tabs'), { onChange: (name) => { if (name === 'live') renderMap(); } });
load();
live(() => load());

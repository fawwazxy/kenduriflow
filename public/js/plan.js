import { api, getMeta, byId, esc, shell, setTitle, toHHMM, fmtTime, fmtDateLong, zoneColor, showError, icon, plural, haptic } from './common.js';
import { drawCarsChart } from './chart.js';

// Plan a majlis in four short steps: what, when, how many guests, then the parking plan.
const editId = new URLSearchParams(location.search).get('edit');
const me = await shell({ roles: ['resident', 'township'], nav: 'host', title: editId ? 'Edit event' : 'Plan a majlis', back: editId ? `/host/${editId}` : '/host' });
if (!me) await new Promise(() => {});   // shell() has sent the person to sign in, or explained why they cannot use this page
const resident = me.role === 'resident';
const meta = await getMeta();

const EMOJI = { wedding: '💍', kenduri: '🍛', tahlil: '🤲', aqiqah: '👶', openhouse: '🏡', birthday: '🎂' };
const DURATIONS = [[60, '1 hour'], [90, '1½ hours'], [120, '2 hours'], [180, '3 hours'], [240, '4 hours'], [300, '5 hours'], [360, '6 hours']];
const F = (id) => byId(id);
const STEPS = 4;
let step = 1;
let duration = 240;
let vip = 2;

function nextSaturday() {
  const [y, m, d] = meta.today.split('-').map(Number);
  const o = new Date(y, m - 1, d);
  o.setDate(o.getDate() + 7 + ((6 - o.getDay() + 7) % 7));
  return `${o.getFullYear()}-${String(o.getMonth() + 1).padStart(2, '0')}-${String(o.getDate()).padStart(2, '0')}`;
}

const type = () => (document.querySelector('[name=type]:checked') || {}).value || 'wedding';
// The slider goes to 1,500; the + button can go past it, so the exact number is kept separately.
const guests = () => Number(F('guests').dataset.exact || F('guests').value);

function readForm() {
  return {
    id: editId || undefined,
    hostName: F('hostName').value,
    title: F('title').value,
    type: type(),
    house: resident ? me.house : Number(F('house').value),
    date: F('date').value,
    start: F('start').value,
    duration,
    guests: guests(),
    vipSpaces: vip
  };
}

// ---------- the four steps ----------

function drawTypes(selected) {
  F('types').innerHTML = Object.entries(meta.types).map(([k, t]) => `
    <label class="tile"><input type="radio" name="type" value="${k}"${k === selected ? ' checked' : ''}>
      <span class="emoji" aria-hidden="true">${EMOJI[k] || '🎉'}</span><b>${esc(t.short)}</b><small>${t.peoplePerCar.toFixed(1)} people per car</small></label>`).join('');
}

function drawDurations() {
  F('durations').innerHTML = DURATIONS.map(([v, l]) => `<button class="chip-btn" type="button" data-dur="${v}" aria-pressed="${v === duration}">${l}</button>`).join('');
}

function setGuests(n) {
  n = Math.min(3000, Math.max(10, Math.round(n / 10) * 10));
  F('guests').value = Math.min(1500, n);
  F('guestsOut').textContent = n;
  F('guests').dataset.exact = n;
  const ppc = meta.types[type()].peoplePerCar;
  F('guestHint').textContent = `About ${Math.ceil(n / ppc)} cars in total for a ${meta.types[type()].short.toLowerCase()}.`;
}

function show(n) {
  step = n;
  document.querySelectorAll('.wizard-step').forEach((s) => { s.hidden = Number(s.dataset.step) !== n; });
  document.querySelectorAll('#dots i').forEach((d, i) => d.classList.toggle('on', i < n));
  F('stepOf').textContent = `Step ${n} of ${STEPS}`;
  F('backBtn').textContent = n === 1 ? 'Cancel' : 'Back';
  F('nextBtn').innerHTML = n < STEPS ? 'Next' : `${icon('check')}${editId ? 'Save changes' : 'Register event'}`;
  F('formError').hidden = true;
  window.scrollTo({ top: 0 });
  if (n === 4) renderPlan();
}

// Checks each step before moving on. Steps 2 and 4 ask the server, which knows about clashes and dates.
async function check(n) {
  const body = readForm();
  if (n === 1) {
    if (!body.title.trim()) throw new Error('Give your event a name, for example "Majlis Aisyah & Hakim".');
  }
  if (n >= 2) {
    if (!body.date) throw new Error('Choose the date.');
    if (!body.start) throw new Error('Choose the start time.');
    await api('/preview', { method: 'POST', body: Object.assign({}, body, { guests: guests() }) });
  }
}

async function renderPlan() {
  const body = readForm();
  body.guests = Number(F('guests').dataset.exact || guests());
  F('summary').innerHTML = [
    [1, EMOJI[body.type] || '🎉', esc(body.title), esc(meta.types[body.type].label)],
    [2, '📅', esc(fmtDateLong(body.date)), `${fmtTime(Number(body.start.split(':')[0]) * 60 + Number(body.start.split(':')[1]))}, ${DURATIONS.find((d) => d[0] === duration)[1]}`],
    [3, '👥', plural(body.guests, 'guest'), vip ? `${plural(vip, 'space')} kept for elderly or OKU guests` : 'No spaces kept for elderly or OKU guests']
  ].map(([s, e, t, sub]) => `<li><button class="row" type="button" data-go="${s}"><span class="lead grey" style="font-size:18px">${e}</span>
    <span class="body"><b>${t}</b><small>${sub}</small></span><span class="trail">Change${icon('chev', 'chev')}</span></button></li>`).join('');
  try {
    const r = await api('/preview', { method: 'POST', body });
    drawPreview(r, body);
  } catch (err) {
    F('preview').innerHTML = `<div class="alert warn" style="margin:0">${icon('alert')}<span>${esc(err.message)}</span></div>`;
  }
}

function drawPreview(r, body) {
  const p = r.prediction;
  const plan = r.plan;
  const used = plan.zones.filter((z) => z.planned > 0);
  const bar = used.map((z) => `<span style="flex:${z.planned};background:${zoneColor(z.color)}" title="${esc(z.short)}: ${z.planned}"></span>`).join('') +
    (plan.shortfall > 0 ? `<span style="flex:${plan.shortfall};background:repeating-linear-gradient(45deg,#B42318 0 3px,#fff 3px 6px)"></span>` : '');
  const rows = plan.zones.filter((z) => z.capacity > 0 || z.closed || z.kind === 'driveway').map((z) => {
    let sub = z.closed ? 'Closed during Friday prayers' : esc(z.walk);
    if (z.kind === 'driveway' && z.capacity === 0) sub = 'After you register, neighbours on your street can offer their driveways.';
    return `<div class="zone"><i class="dot" style="background:${zoneColor(z.color)}"></i><span class="zn">${esc(z.name)}</span><span class="zc">${z.planned} <small>of ${z.capacity}</small></span><span class="zs">${sub}</span></div>`;
  }).join('');
  const notes = [];
  if (plan.shortfall > 0) notes.push(`<div class="alert bad big strong">${icon('alert')}<span>Not enough space for ${plan.shortfall} cars. Try a shorter event, fewer guests, or ask guests to share rides.</span></div>`);
  if (plan.clashes.length) notes.push(`<div class="alert warn">${icon('alert')}<span>${plan.clashes.map((c) => `"${esc(c.title)}" at No. ${c.house} is on the same street from ${fmtTime(c.start)} to ${fmtTime(c.end)}.`).join(' ')} The kerb is shared by distance: each host gets the spaces nearest their house.</span></div>`);
  if (plan.surauClosed) notes.push(`<div class="alert warn">${icon('clock')}<span>Your event overlaps Friday prayers, so the surau car park is not used.</span></div>`);
  if (plan.shortfall <= 0) {
    const lot = plan.zones.find((z) => z.shuttle || z.id === 'mall');
    if (plan.shuttle) notes.push(`<div class="alert info">${icon('bus')}<span>${lot ? lot.planned : 'Some'} cars go to the mall car park. ${plan.shuttle.buggies} shuttle ${plan.shuttle.buggies > 1 ? 'buggies run' : 'buggy runs'} every ${plan.shuttle.every} minutes.</span></div>`);
    else notes.push(`<div class="alert ok">${icon('check')}<span>Every car fits within a short walk of your house.</span></div>`);
  }
  F('preview').innerHTML = `
    ${plan.shortfall > 0 ? notes.shift() : ''}
    <div class="stats">
      <div class="stat"><div class="n">${p.totalCars}</div><div class="l">cars in total</div><div class="s">${p.guests} ÷ ${p.peoplePerCar.toFixed(1)} per car</div></div>
      <div class="stat main"><div class="n">${p.peak}</div><div class="l">at the same time</div><div class="s">around ${fmtTime(p.peakTime)}</div></div>
      <div class="stat"><div class="n">${p.planned}</div><div class="l">spaces planned</div><div class="s">busiest + 10%</div></div>
    </div>
    <section class="card"><div id="planChart"></div>
      <h3 style="margin-top:14px">Where the cars will go</h3><div class="zbar">${bar}</div>${rows}${notes.join('')}</section>`;
  const start = Number(body.start.split(':')[0]) * 60 + Number(body.start.split(':')[1]);
  drawCarsChart(byId('planChart'), { prediction: p, start, duration: body.duration, capacity: plan.walkingCapacity });
}

// ---------- start ----------

const streets = [...new Set(meta.precinct.houses.map((h) => h.street))];
F('house').innerHTML = streets.map((s) => `<optgroup label="${esc(s)}">${meta.precinct.houses.filter((h) => h.street === s).map((h) => `<option value="${h.no}">No. ${h.no}, ${esc(h.street)}</option>`).join('')}</optgroup>`).join('');
F('houseField').hidden = resident;
F('hostField').hidden = resident;
F('hostName').value = resident ? me.name : '';
F('date').min = meta.today;
drawTypes('wedding');
drawDurations();
F('date').value = nextSaturday();
F('start').value = '12:00';
setGuests(300);

if (editId) {
  const ev = await api(`/events/${editId}`);
  document.title = `Edit ${ev.title} · KenduriFlow`;
  F('wTitle').textContent = 'What are you hosting?';
  drawTypes(ev.type);
  F('title').value = ev.title;
  F('hostName').value = ev.hostName || '';
  F('house').value = ev.house;
  F('date').value = ev.date;
  F('start').value = toHHMM(ev.start);
  duration = ev.duration;
  if (!DURATIONS.some((d) => d[0] === duration)) DURATIONS.push([duration, `${duration} minutes`]);
  drawDurations();
  setGuests(ev.guests);
  vip = ev.vipSpaces;
  F('vipOut').textContent = vip;
  setTitle(`Edit ${ev.title}`);
  if (!ev.canManage) {
    showError(F('formError'), new Error('Only the host of this event or the township team can change it.'));
    F('nextBtn').disabled = true;
  }
}
show(1);

// ---------- controls ----------

F('types').addEventListener('change', () => { setGuests(Number(F('guests').dataset.exact)); haptic(); });
F('durations').addEventListener('click', (e) => {
  const b = e.target.closest('[data-dur]');
  if (!b) return;
  duration = Number(b.dataset.dur);
  drawDurations();
});
F('guests').addEventListener('input', (e) => setGuests(Number(e.target.value)));
document.querySelectorAll('[data-guests]').forEach((b) => { b.onclick = () => { setGuests(Number(F('guests').dataset.exact) + Number(b.dataset.guests)); haptic(8); }; });
document.querySelectorAll('[data-vip]').forEach((b) => { b.onclick = () => { vip = Math.min(10, Math.max(0, vip + Number(b.dataset.vip))); F('vipOut').textContent = vip; }; });
F('summary').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) show(Number(b.dataset.go)); });

F('backBtn').onclick = () => {
  if (step > 1) show(step - 1);
  else location.href = editId ? `/host/${editId}` : '/host';
};

F('nextBtn').onclick = async () => {
  const btn = F('nextBtn');
  btn.disabled = true;
  try {
    if (step < STEPS) {
      await check(step);
      show(step + 1);
    } else {
      const body = readForm();
      body.guests = Number(F('guests').dataset.exact || guests());
      const ev = editId ? await api(`/events/${editId}`, { method: 'PUT', body }) : await api('/events', { method: 'POST', body });
      haptic(30);
      location.href = `/host/${ev.id}${editId ? '' : '?new=1'}`;
      return;
    }
  } catch (err) {
    showError(F('formError'), err);
    F('formError').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  btn.disabled = false;
};

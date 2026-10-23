import { api, getMeta, live, byId, esc, shell, segTabs, fmtTime, statusBadge, icon, plural } from './common.js';

const me = await shell({ roles: ['resident', 'township'], nav: 'host' });
if (!me) await new Promise(() => {});   // shell() has sent the person to sign in, or explained why they cannot use this page
const resident = me.role === 'resident';

if (!resident) {
  byId('pageTitle').textContent = 'Events';
  byId('pageSub').textContent = 'Every majlis registered in the precinct. Open one to see its plan, or register one for a resident.';
  byId('fab').lastChild.textContent = 'New event';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function card(e) {
  const [y, m, d] = e.date.split('-').map(Number);
  const day = DAYS[new Date(y, m - 1, d).getDay()];
  return `<a class="ev-card ${e.status}" href="/host/${e.id}">
    <div class="top">
      <div style="display:flex;gap:12px;min-width:0">
        <span class="date-chip"><small>${MONTHS[m - 1]}</small><b>${d}</b><small>${day}</small></span>
        <div style="min-width:0"><h3>${esc(e.title)}</h3>
          <div class="meta">${fmtTime(e.start)} to ${fmtTime(e.end)} · No. ${e.house}${resident ? '' : `, ${esc(e.street)}`}</div>
          <div class="meta">${esc(e.typeShort)} · ${plural(e.guests, 'guest')}</div></div>
      </div>
      ${statusBadge(e.status)}
    </div>
    <div class="nums">
      <span><b>${e.totalCars}</b>cars</span><span><b>${e.peak}</b>at once</span><span><b>${e.planned}</b>spaces</span>
      ${e.shortfall > 0 ? `<span style="color:var(--bad)"><b style="color:var(--bad)">${e.shortfall}</b>short</span>` : ''}
      ${e.status === 'live' ? `<span><b>${e.onsite}</b>here now</span>` : ''}
    </div>
  </a>`;
}

function empty(kind) {
  if (kind === 'past') return '<p class="empty" style="text-align:center;padding:30px 0">No past events yet.</p>';
  return `<section class="card" style="text-align:center;padding:30px 20px">
    <div style="font-size:42px;line-height:1">🎉</div>
    <h2 style="margin:10px 0 6px">${resident ? 'Planning a majlis?' : 'No events yet'}</h2>
    <p class="muted">${resident ? 'Tell us the date and how many guests. You get a parking plan and one link for your WhatsApp group in under a minute.' : 'Events registered by residents show up here.'}</p>
    <a class="btn" href="/plan" style="margin-top:12px">${icon('plus')}${resident ? 'Plan my majlis' : 'Register an event'}</a></section>`;
}

async function load() {
  const [meta, list] = await Promise.all([getMeta(), api('/events')]);
  const mine = list.filter((e) => e.status !== 'cancelled' && (!resident || e.house === me.house));
  const up = mine.filter((e) => e.status !== 'finished' && e.date >= meta.today || e.status === 'live');
  const past = mine.filter((e) => !up.includes(e)).reverse();
  byId('upcoming').innerHTML = up.length ? up.map(card).join('') : empty('upcoming');
  byId('past').innerHTML = past.length ? past.map(card).join('') : empty('past');
}

segTabs(byId('tabs'));
load().catch((err) => { byId('upcoming').innerHTML = `<p class="empty">${esc(err.message)}</p>`; });
live(() => load().catch(() => {}));

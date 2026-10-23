import { segTabs, api, live, byId, esc, shell, fmtTime, fmtDate, fmtStamp, statusBadge, confirmClick, toast } from './common.js';
import { drawBars } from './chart.js';

const me = await shell({ roles: ['township'], nav: 'admin' });
if (!me) await new Promise(() => {});   // shell() has sent the person to sign in, or explained why they cannot use this page
let chartsDone = false;
segTabs(byId('tabs'));

async function load() {
  const d = await api('/admin/overview');
  byId('precinctName').textContent = `${d.precinct.name}, ${d.precinct.township} · ${d.precinct.houses} houses`;

  const k = d.kpis;
  byId('kpis').innerHTML = `
    <div class="stat"><div class="n">${k.upcoming}</div><div class="l">Upcoming events</div><div class="s">${k.liveNow ? `${k.liveNow} live now` : 'none live now'}</div></div>
    <div class="stat"><div class="n">${k.carsPlanned}</div><div class="l">Spaces planned</div><div class="s">across upcoming events</div></div>
    <div class="stat"><div class="n">${k.clashes}</div><div class="l">Street clashes</div><div class="s">two events, one street</div></div>
    <div class="stat${k.openReports ? ' main' : ''}"><div class="n">${k.openReports}</div><div class="l">Open reports</div><div class="s">${k.drivewaysShared} driveways shared</div></div>
    <div class="stat${k.laneAlerts ? ' alarm' : ''}"><div class="n">${k.laneAlerts}</div><div class="l">Lane alerts</div><div class="s">${k.laneAlerts ? 'emergency lane blocked' : 'every lane clear'}</div></div>`;

  const L = d.learning;
  byId('learnNote').textContent = `Starting value counts as ${L.weight} events`;
  byId('learnTypes').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Event type</th><th class="num">Start</th><th class="num">Counted</th><th class="num">Now using</th></tr></thead><tbody>
    ${L.types.map((t) => `<tr><td>${esc(t.label)}</td><td class="num">${t.base.toFixed(1)}</td><td class="num">${t.n}</td>
      <td class="num"><b>${t.used.toFixed(2)}</b>${t.n && t.used !== t.base ? ` <span class="${t.used < t.base ? 'delta-up' : 'delta-down'}">${t.used < t.base ? '▼' : '▲'}</span>` : t.n ? ' <span class="small muted">confirmed</span>' : ''}</td></tr>`).join('')}
    </tbody></table></div><p class="small muted" style="margin-top:6px">People per car. Fewer people per car means more cars to plan for.</p>`;
  byId('learnEvents').innerHTML = L.events.length ? `<ul class="list">${L.events.map((o) => `<li>
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">${o.past ? `<b>${esc(o.title)}</b>` : `<a href="/host/${o.eventId}" style="font-weight:650;text-decoration:none">${esc(o.title)}</a>`}
        <span class="badge ${o.used ? 'ok' : o.simulated ? '' : 'warn'}">${esc(o.note)}</span></div>
      <span class="small muted">${fmtDate(o.date)} · ${o.cars} cars counted vs ${o.predictedCars} predicted · busiest ${o.peak} vs ${o.predictedPeak} · ${o.peoplePerCar.toFixed(2)} people per car</span></li>`).join('')}</ul>`
    : '<p class="empty">No events ended yet. When a guard presses "End event and save counts", the result appears here.</p>';

  const upcoming = d.events.filter((e) => e.status !== 'finished');
  const finished = d.events.filter((e) => e.status === 'finished');
  const row = (e) => {
    const flags = [];
    if (e.clashes.length) flags.push('<span class="badge warn">Shared street</span>');
    if (e.surauClosed) flags.push('<span class="badge">Friday prayers</span>');
    if (e.shortfall > 0) flags.push(`<span class="badge bad">Short ${e.shortfall}</span>`);
    return `<tr>
      <td class="nowrap">${fmtDate(e.date)}<br><span class="small muted">${fmtTime(e.start)} to ${fmtTime(e.end)}</span></td>
      <td><a href="/host/${e.id}">${esc(e.title)}</a><br><span class="small muted">${esc(e.typeShort)}${e.hostName ? ` · ${esc(e.hostName)}` : ''}</span></td>
      <td class="nowrap">No. ${e.house}<br><span class="small muted">${esc(e.street)}</span></td>
      <td class="num">${e.guests}</td>
      <td class="num">${e.planned}</td>
      <td class="num">${e.planned - e.shuttleCars - Math.max(0, e.shortfall)}</td>
      <td class="num">${e.shuttleCars}</td>
      <td>${statusBadge(e.status)} ${flags.join(' ')}</td>
      <td><a class="btn secondary small" href="/guard/${e.id}">Guard</a></td></tr>`;
  };
  byId('events').innerHTML = upcoming.length ? `<div class="table-wrap"><table>
    <thead><tr><th>When</th><th>Event</th><th>Address</th><th class="num">Guests</th><th class="num">Cars at busiest</th><th class="num">Walking distance</th><th class="num">Mall + shuttle</th><th>Status</th><th></th></tr></thead>
    <tbody>${upcoming.map(row).join('')}</tbody></table></div>
    ${finished.length ? `<p class="small muted" style="margin-top:10px">Finished: ${finished.map((e) => `<a href="/host/${e.id}">${esc(e.title)}</a>`).join(', ')}</p>` : ''}`
    : '<p class="empty">No upcoming events.</p>';

  byId('clashes').innerHTML = d.clashes.length ? `<ul class="list">${d.clashes.map((c) => `<li>
      <b>${esc(c.street)}, ${fmtDate(c.date)}, ${fmtTime(c.from)} to ${fmtTime(c.to)}</b><br>
      <span class="small"><a href="/host/${c.a.id}">${esc(c.a.title)}</a> (No. ${c.a.house}) and <a href="/host/${c.b.id}">${esc(c.b.title)}</a> (No. ${c.b.house})</span><br>
      <span class="small muted">Kerb spaces are split by distance to each house. Shared car parks go to the event registered first.</span></li>`).join('')}</ul>`
    : '<p class="empty">No two events share a street at the same time.</p>';

  byId('pickups').innerHTML = d.pickups.length ? `<div class="table-wrap"><table><thead><tr><th>Pickup</th><th>Street</th><th>Reason</th></tr></thead><tbody>
    ${d.pickups.map((p) => `<tr><td class="nowrap">${esc(p.label)}</td><td class="nowrap">${esc(p.street)}</td><td>${esc(p.reason)}</td></tr>`).join('')}</tbody></table></div>`
    : '<p class="empty">None booked.</p>';

  // Sample figures (demo) are drawn once. Real figures change as events happen, so they are redrawn.
  if (!chartsDone) {
    const h = d.history;
    document.querySelectorAll('.sample').forEach((el) => { el.hidden = !h.sample; });
    byId('resetAll').hidden = !h.sample;
    drawBars(byId('monthly'), h.monthly.map((m, i) => ({ label: m.month, short: m.month.slice(0, 3), value: m.events, note: m.note, faded: i === h.monthly.length - 1 })), { label: 'events' });
    byId('monthlyTable').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Month</th><th class="num">Events</th><th>Note</th></tr></thead><tbody>${h.monthly.map((m) => `<tr><td>${esc(m.month)}</td><td class="num">${m.events}</td><td class="muted">${esc(m.note || '')}</td></tr>`).join('')}</tbody></table></div>`;
    const max = Math.max(1, ...h.streets.map((s) => s.events));
    byId('streets').innerHTML = h.streets.length ? h.streets.map((s) => `<div class="hbar" title="${esc(s.street)}: ${s.events} events, average busiest ${s.avgPeak} cars, kerb holds ${s.kerb}"><span>${esc(s.street)}</span><span class="t"><i style="width:${(s.events / max) * 100}%"></i></span><span class="num">${s.events}</span></div>`).join('') +
      '<p class="small muted" style="margin-top:10px">Number of home events per street. Hover a row for the average busiest time and kerb size.</p>'
      : '<p class="empty">No events in the last 6 months yet.</p>';
    byId('insights').innerHTML = h.insights.length
      ? h.insights.map((i) => `<div class="insight"><h3>${esc(i.title)}</h3><p>${esc(i.finding)}</p><p class="do">${esc(i.action)}</p></div>`).join('')
      : '<p class="empty">Suggestions appear here once there are a few months of events to learn from.</p>';
    chartsDone = h.sample;
  }

  const openN = d.reports.filter((r) => !r.resolvedAt).length;
  byId('repCount').hidden = !openN;
  byId('repCount').textContent = openN;
  byId('reportCount').innerHTML = openN ? `<span class="badge bad">${openN} open</span>` : d.reports.length ? '<span class="badge ok">All sorted</span>' : '';
  byId('reports').innerHTML = d.reports.length ? `<ul class="list">${d.reports.map((r) => `<li>
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><span><b>No. ${r.house}:</b> ${esc(r.issue)}</span>${r.resolvedAt ? '<span class="badge ok">Sorted</span>' : '<span class="badge warn">Open</span>'}</div>
      <span class="small muted">${esc(r.eventTitle)} · ${esc(fmtStamp(r.createdAt))}</span></li>`).join('')}</ul>`
    : '<p class="empty">No reports yet.</p>';

  byId('cancelledCard').hidden = !d.cancelled.length;
  byId('cancelled').innerHTML = d.cancelled.map((e) => `<p class="small">${fmtDate(e.date)} · <a href="/host/${e.id}">${esc(e.title)}</a> · No. ${e.house}, ${esc(e.street)}</p>`).join('');
}

byId('resetAll').onclick = (e) => confirmClick(e.currentTarget, 'Click again to reset everything', async () => {
  try {
    await api('/admin/reset', { method: 'POST' });
    try { Object.keys(localStorage).filter((k) => k.startsWith('kf-car-')).forEach((k) => localStorage.removeItem(k)); } catch (err) { /* ignore */ }
    toast('Demo data restored.');
    load();
  } catch (err) {
    toast(err.message, 'bad');
  }
});

load().catch((err) => { byId('events').innerHTML = `<p class="empty">${esc(err.message)}</p>`; });
live(() => load().catch(() => {}));

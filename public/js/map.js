// Draws the precinct map as SVG from the server's map data and live slot states.
import { zoneColor, esc } from './common.js';

const C = {
  land: '#E9EEEA', road: '#CDD4D8', park: '#D2E6D4', path: '#EEF6EF', tree: '#9CC6A4',
  lot: '#DCE2DF', building: '#F7F9F8', line: '#B9C3BC', house: '#FFFFFF', porch: '#EEF2EF',
  hostFill: '#FFF3D1', hostLine: '#D49A1A', text: '#4B5963', slotLine: '#A9B4BC',
  other: '#7D8A93', bad: '#C6352A', ok: '#1B7344', ink: '#1C2730', tag: '#E3A21A', tagText: '#2E1F00'
};

const STATE_TEXT = {
  car: 'parked (this event)', other: 'parked (another event)', held: 'kept for another event',
  hold: 'held for a guest on the way', keep: 'kept clear for a neighbour\'s gate',
  vip: 'kept for elderly or OKU guests', planned: 'planned for this event', closed: 'closed', free: 'free'
};

function slotRect(s, st, col) {
  const a = `x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="2.5"`;
  let body;
  switch (st[0]) {
    case 'car': body = `fill="${col}"`; break;
    case 'other': body = `fill="${C.other}"`; break;
    case 'held': body = 'fill="url(#kf-hatch)" stroke="#9AA6AF"'; break;
    case 'hold': body = `fill="${col}" fill-opacity=".35" stroke="${col}" stroke-width="1.6"`; break;
    case 'keep': body = 'fill="#FBEDEB" stroke="#D9837A" stroke-width="1.2" stroke-dasharray="2 2"'; break;
    case 'vip': body = `fill="#fff" stroke="${col}" stroke-width="1.6" stroke-dasharray="3 2"`; break;
    case 'planned': body = `fill="#fff" stroke="${col}" stroke-width="1.6"`; break;
    case 'closed': body = `fill="#fff" stroke="${C.slotLine}" opacity=".45"`; break;
    default: body = `fill="#fff" stroke="${C.slotLine}"`;
  }
  let title = `${s.label}: ${STATE_TEXT[st[0]] || st[0]}`;
  if ((st[0] === 'held' || st[0] === 'keep') && st[1]) title += ` at No. ${st[1]}`;
  if (st[0] === 'car' && st[1]) title += ', elderly or OKU';
  return `<rect ${a} ${body}><title>${esc(title)}</title></rect>`;
}

function label(l) {
  const halo = { road: C.road, park: C.park, building: C.building }[l.on] || C.land;
  const anchor = l.anchor || 'start';
  const tr = l.rotate ? ` transform="translate(${l.x} ${l.y}) rotate(${l.rotate})"` : ` x="${l.x}" y="${l.y}"`;
  return `<text${tr} text-anchor="${anchor}" font-size="${l.small ? 11.5 : 12.5}" font-weight="${l.small ? 400 : 600}" fill="${C.text}" stroke="${halo}" stroke-width="4" stroke-linejoin="round" paint-order="stroke">${esc(l.text)}</text>`;
}

function routePoints(precinct, state, slotId) {
  const ev = state.event;
  const host = precinct.houses.find((h) => h.no === ev.house);
  if (!host) return null;
  let zone = null;
  let slot = null;
  for (const z of precinct.zones) {
    const s = z.slots.find((x) => x.id === slotId);
    if (s) { zone = z; slot = s; break; }
  }
  if (!slot) return null;
  const street = precinct.streets.find((s) => s.name === host.street);
  const walkY = street ? street.walkY : host.door.y;
  const parkY = precinct.parkPathY;
  const ex = precinct.eastRoadX;
  const door = host.door;
  const c = { x: slot.x + slot.w / 2, y: slot.y + slot.h / 2 };
  const slotStreet = zone.kind === 'driveway' ? slot.street : zone.street;
  if (zone.kind !== 'lot' && slotStreet === host.street) {
    return { from: c, pts: [c, { x: c.x, y: walkY }, { x: door.x, y: walkY }, door] };
  }
  if (zone.kind !== 'lot') {
    return { from: c, pts: [c, { x: c.x, y: parkY }, { x: door.x, y: parkY }, { x: door.x, y: walkY }, door] };
  }
  if (zone.stop) {
    const s0 = zone.stop;
    return { from: c, pts: [s0, { x: ex, y: s0.y }, { x: ex, y: parkY }, { x: door.x, y: parkY }, { x: door.x, y: walkY }, door], stop: s0 };
  }
  const y0 = zone.exitY || c.y;
  return { from: c, pts: [c, { x: c.x, y: y0 }, { x: ex, y: y0 }, { x: ex, y: parkY }, { x: door.x, y: parkY }, { x: door.x, y: walkY }, door] };
}

function tags(precinct, state) {
  const rows = { A: [], B: [] };
  for (const e of state.dayEvents || []) {
    const h = precinct.houses.find((x) => x.no === e.house);
    if (!h) continue;
    const mine = e.id === state.event.id;
    const text = `No. ${e.house} · ${e.typeShort}`;
    const w = Math.round(text.length * 7.4 + 20);
    rows[h.row].push({ cx: h.door.x, w, text, mine });
  }
  const out = [];
  for (const [row, list] of Object.entries(rows)) {
    const y = row === 'A' ? 64 : 425;
    list.sort((a, b) => a.cx - b.cx);
    let right = 78;
    for (const t of list) {
      let x = Math.max(t.cx - t.w / 2, right + 4);
      x = Math.min(x, 616 - t.w);
      right = x + t.w;
      out.push(`<rect x="${x}" y="${y}" width="${t.w}" height="22" rx="11" fill="${t.mine ? C.tag : '#fff'}" stroke="${t.mine ? C.tag : C.line}"/>` +
        `<text x="${x + t.w / 2}" y="${y + 15}" text-anchor="middle" font-size="12" font-weight="${t.mine ? 700 : 600}" fill="${t.mine ? C.tagText : C.text}">${esc(t.text)}</text>`);
    }
  }
  return out.join('');
}

export function drawMap(container, precinct, state, opts = {}) {
  const { width, height, shapes, labels } = precinct.map;
  const ev = state ? state.event : null;
  const o = [];
  o.push(`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(opts.label || 'Map of the precinct showing parking spaces')}">`);
  o.push('<defs><pattern id="kf-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#fff"/><line x1="0" y1="0" x2="0" y2="5" stroke="#9AA6AF" stroke-width="1.6"/></pattern></defs>');

  for (const s of shapes) {
    if (s.t === 'rect') {
      const extra = s.c === 'building' ? ` stroke="${C.line}" rx="4"` : s.c === 'lot' ? ' rx="4"' : '';
      o.push(`<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${C[s.c] || '#ccc'}"${extra}/>`);
    } else if (s.t === 'line') {
      if (s.c === 'lane') o.push(`<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="#fff" stroke-width="1.5" stroke-dasharray="8 7"/>`);
      else o.push(`<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${C.path}" stroke-width="5" stroke-linecap="round"/>`);
    } else if (s.t === 'tree') {
      o.push(`<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="${C.tree}"/>`);
    }
  }

  // Emergency lane: tint the house side red when a car is blocking it or a neighbour reported one.
  const blocked = state ? (state.blocking || []) : [];
  const laneStreets = state ? (state.laneStreets || blocked.map((b) => b.street)) : [];
  for (const st of precinct.streets) {
    if (laneStreets.includes(st.name)) o.push(`<rect x="76" y="${st.laneY - 4}" width="544" height="24" fill="#F6D3CF"/>`);
  }

  const hostNo = ev ? ev.house : null;
  for (const h of precinct.houses) {
    const isHost = h.no === hostNo;
    o.push(`<rect x="${h.porch.x}" y="${h.porch.y}" width="${h.porch.w}" height="${h.porch.h}" rx="2" fill="${C.porch}"/>`);
    o.push(`<rect x="${h.x}" y="${h.y}" width="${h.w}" height="${h.h}" rx="3" fill="${isHost ? C.hostFill : C.house}" stroke="${isHost ? C.hostLine : C.line}" stroke-width="${isHost ? 2 : 1}"><title>No. ${h.no}, ${esc(h.street)}</title></rect>`);
    o.push(`<text x="${h.x + h.w / 2}" y="${h.numY}" text-anchor="middle" font-size="12" fill="${C.text}">${h.no}</text>`);
  }

  const slots = state ? state.slots : null;
  for (const z of precinct.zones) {
    const col = zoneColor(z.color);
    for (const s of z.slots) {
      const st = slots ? slots[s.id] : (z.kind === 'driveway' ? null : ['free']);
      if (st) o.push(slotRect(s, st, col));
    }
  }

  // Cars blocking the emergency lane
  const perHouse = {};
  for (const b of blocked) {
    const st = precinct.streets.find((s) => s.name === b.street);
    const h = precinct.houses.find((x) => x.no === b.house);
    if (!st || !h) continue;
    const k = `${b.street}-${b.house}`;
    const j = perHouse[k] = (perHouse[k] || 0) + 1;
    if (j > 10) continue;
    const startX = Math.min(Math.max(h.door.x - 100, 80), 598 - 9 * 20);
    const x = startX + (j - 1) * 20;
    o.push(`<rect x="${x}" y="${st.laneY}" width="17" height="17" rx="2.5" fill="${C.bad}"><title>Car blocking the emergency lane</title></rect>`);
  }

  // Lot counts
  if (state) {
    for (const z of precinct.zones.filter((x) => x.countLabel)) {
      const pz = state.plan.zones.find((x) => x.id === z.id);
      let text = `${z.slots.length} bays`;
      if (pz) text = pz.closed ? 'Closed for Friday prayers' : `${pz.inUse} of ${pz.slotsTotal} in use`;
      const halo = z.id === 'surau' ? C.building : C.land;
      o.push(`<text x="${z.countLabel.x}" y="${z.countLabel.y}" text-anchor="middle" font-size="11.5" fill="${C.text}" stroke="${halo}" stroke-width="3" paint-order="stroke">${esc(text)}</text>`);
    }
  }

  // Walking route for the guest
  if (state && opts.routeSlot) {
    const r = routePoints(precinct, state, opts.routeSlot);
    if (r) {
      const d = r.pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      o.push(`<path class="route" d="${d}" fill="none" stroke="${C.ink}" stroke-width="2.5" stroke-dasharray="6 5" stroke-linecap="round" stroke-linejoin="round"/>`);
      o.push(`<circle cx="${r.from.x}" cy="${r.from.y}" r="5" fill="#fff" stroke="${C.ink}" stroke-width="2.5"/>`);
      const end = r.pts[r.pts.length - 1];
      o.push(`<circle cx="${end.x}" cy="${end.y}" r="5" fill="${C.ink}"/>`);
    }
  }

  for (const l of labels) o.push(label(l));

  if (ev) {
    const st = precinct.streets.find((s) => s.name === ev.street);
    if (st) {
      const n = blocked.filter((b) => b.street === st.name).length;
      const bad = laneStreets.includes(st.name);
      const text = n ? `Lane blocked: ${n} car${n > 1 ? 's' : ''}` : bad ? 'Lane blocked: reported' : 'Emergency lane clear';
      o.push(`<text x="${st.statusLabel.x}" y="${st.statusLabel.y}" text-anchor="end" font-size="12.5" font-weight="700" fill="${bad ? C.bad : C.ok}" stroke="${bad ? '#F6D3CF' : C.road}" stroke-width="4" stroke-linejoin="round" paint-order="stroke">${text}</text>`);
    }
    o.push(tags(precinct, state));
  }

  o.push('</svg>');
  container.innerHTML = o.join('');
}

export const LEGEND_HTML = `
  <span><i class="lg" style="background:#2F6EBA"></i>Street kerb</span>
  <span><i class="lg" style="background:#C27C0E"></i>Shared driveway</span>
  <span><i class="lg" style="background:#1F8A70"></i>Surau car park</span>
  <span><i class="lg" style="background:#8E4FB5"></i>Mall + shuttle</span>
  <span><i class="lg planned"></i>Planned space</span>
  <span><i class="lg vip"></i>Elderly / OKU</span>
  <span><i class="lg held"></i>Kept for another event</span>
  <span><i class="lg" style="background:rgba(47,110,186,.35);border:1.5px solid #2F6EBA"></i>Held for a guest on the way</span>
  <span><i class="lg" style="background:#FBEDEB;border:1.2px dashed #D9837A"></i>Kept clear for a gate</span>
  <span><i class="lg other"></i>Another event's car</span>`;

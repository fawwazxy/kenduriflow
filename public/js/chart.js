// Small SVG charts: predicted cars over time, and a bar chart for the township page.
import { fmtTime, fmtHour, esc } from './common.js';

const INK = '#1C2730';
const MUTED = '#6C7A85';
const GRID = '#E6EAED';
const BRAND = '#0E6B50';
const LIVE = '#D9822B';

// Round axis: a whole-number step (1, 2, 5, 10, 20, 25, 50 ...) and a top that is a multiple of it.
function niceScale(max, count = 4) {
  if (max <= 0) return { step: 5, top: 20, count: 4 };
  const raw = max / count;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  const step = Math.max(1, (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p);
  const n = Math.ceil(max / step);
  return { step, top: n * step, count: n };
}

export function drawCarsChart(container, { prediction, start, duration, history = [], clock = null, showNow = false, capacity = null }) {
  const W = 640, H = 240, ml = 42, mr = 14, mt = 24, mb = 30;
  const pw = W - ml - mr, ph = H - mt - mb;
  const step = prediction.step;
  const N = prediction.totalSteps;
  const t0 = start;
  const t1 = start + N * step;
  let mx = Math.max(prediction.peak, capacity || 0, 10);
  history.forEach((h) => { mx = Math.max(mx, h.n); });
  const sc = niceScale(mx * 1.12);
  const yMax = sc.top;
  const X = (m) => ml + ((m - t0) / (t1 - t0)) * pw;
  const Y = (v) => mt + ph - (v / yMax) * ph;

  const o = [`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Predicted cars at the house over time. Busiest moment ${prediction.peak} cars at ${fmtTime(prediction.peakTime)}.">`];
  o.push(`<rect x="${X(t0)}" y="${mt}" width="${X(start + duration) - X(t0)}" height="${ph}" fill="#F3F6F8"/>`);
  o.push(`<text x="${X(t0) + 6}" y="${mt - 8}" font-size="11.5" fill="${MUTED}">During the event</text>`);
  for (let g = 0; g <= sc.count; g++) {
    const v = sc.step * g;
    const y = Y(v);
    o.push(`<line x1="${ml}" x2="${W - mr}" y1="${y}" y2="${y}" stroke="${GRID}"/>`);
    o.push(`<text x="${ml - 8}" y="${y + 4}" text-anchor="end" font-size="11.5" fill="${MUTED}">${Math.round(v)}</text>`);
  }
  for (let m = Math.ceil(t0 / 60) * 60; m <= t1; m += 60) {
    o.push(`<text x="${X(m)}" y="${H - 9}" text-anchor="middle" font-size="11.5" fill="${MUTED}">${fmtHour(m)}</text>`);
  }

  const pts = prediction.onsite.map((v, k) => [X(t0 + k * step), Y(v)]);
  pts.push([X(t1), Y(0)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  o.push(`<path d="M${X(t0)} ${Y(0)} ${line.replace(/^M/, 'L')} Z" fill="${BRAND}" opacity=".12"/>`);
  o.push(`<path d="${line}" fill="none" stroke="${BRAND}" stroke-width="2" stroke-linejoin="round"/>`);

  if (capacity != null) {
    const cy = Y(capacity);
    o.push(`<line x1="${ml}" x2="${W - mr}" y1="${cy}" y2="${cy}" stroke="${MUTED}" stroke-width="1.5" stroke-dasharray="5 4"/>`);
    o.push(`<text x="${W - mr}" y="${cy - 6}" text-anchor="end" font-size="12" font-weight="600" fill="${MUTED}" stroke="#fff" stroke-width="4" paint-order="stroke">Within walking distance: ${capacity}</text>`);
  }

  if (history.length) {
    const hl = history.map((h, i) => `${i ? 'L' : 'M'}${X(t0 + h.clock).toFixed(1)} ${Y(h.n).toFixed(1)}`).join(' ');
    o.push(`<path d="${hl}" fill="none" stroke="${LIVE}" stroke-width="2.5" stroke-linejoin="round"/>`);
  }
  if (showNow && clock != null) {
    const nx = X(t0 + clock);
    o.push(`<line x1="${nx}" x2="${nx}" y1="${mt}" y2="${mt + ph}" stroke="${LIVE}" stroke-width="1.5"/>`);
  }

  const px = X(prediction.peakTime);
  const py = Y(prediction.peak);
  const lx = Math.min(Math.max(px, ml + 80), W - mr - 80);
  o.push(`<circle cx="${px}" cy="${py}" r="4.5" fill="${BRAND}" stroke="#fff" stroke-width="2"/>`);
  o.push(`<text x="${lx}" y="${py - 11}" text-anchor="middle" font-size="12" font-weight="600" fill="${INK}" stroke="#fff" stroke-width="4" paint-order="stroke">Busiest: ${prediction.peak} cars at ${fmtTime(prediction.peakTime)}</text>`);

  o.push(`<line class="x-hair" x1="0" x2="0" y1="${mt}" y2="${mt + ph}" stroke="${MUTED}" opacity="0"/>`);
  o.push(`<circle class="x-dot" r="4.5" fill="${BRAND}" stroke="#fff" stroke-width="2" opacity="0"/>`);
  o.push(`<rect class="x-hit" x="${ml}" y="${mt}" width="${pw}" height="${ph}" fill="transparent"/>`);
  o.push('</svg>');

  container.innerHTML = `<div class="chart">${o.join('')}<div class="tip" hidden></div></div>
    <div class="chart-key"><span><i style="background:${BRAND}"></i>Predicted cars at the house</span>${history.length ? `<span><i style="background:${LIVE}"></i>Counted cars</span>` : ''}${capacity != null ? '<span><i class="dash"></i>Spaces within walking distance</span>' : ''}</div>`;

  const box = container.querySelector('.chart');
  const svg = box.querySelector('svg');
  const hit = svg.querySelector('.x-hit');
  const hair = svg.querySelector('.x-hair');
  const dot = svg.querySelector('.x-dot');
  const tip = box.querySelector('.tip');
  const histBy = new Map(history.map((h) => [h.clock, h.n]));
  const show = (e) => {
    const r = svg.getBoundingClientRect();
    const br = box.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const k = Math.max(0, Math.min(N - 1, Math.round(((sx - ml) / pw) * N)));
    const x = X(t0 + k * step);
    const v = prediction.onsite[k];
    const y = Y(v);
    hair.setAttribute('x1', x); hair.setAttribute('x2', x); hair.setAttribute('opacity', 1);
    dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('opacity', 1);
    const counted = histBy.get(k * step);
    tip.textContent = `${fmtTime(t0 + k * step)}: ${v} cars expected${counted != null ? `, ${counted} counted` : ''}`;
    tip.style.left = `${(x / W) * r.width + r.left - br.left + box.scrollLeft}px`;
    tip.style.top = `${(y / H) * r.height + r.top - br.top - 10}px`;
    tip.hidden = false;
  };
  hit.addEventListener('pointermove', show);
  hit.addEventListener('pointerdown', show);
  hit.addEventListener('pointerleave', () => { tip.hidden = true; hair.setAttribute('opacity', 0); dot.setAttribute('opacity', 0); });
}

export function drawBars(container, rows, { label = 'events' } = {}) {
  const W = 640, H = 220, ml = 34, mr = 8, mt = 24, mb = 28;
  const pw = W - ml - mr, ph = H - mt - mb;
  const sc = niceScale(Math.max(...rows.map((r) => r.value)) * 1.15, 5);
  const yMax = sc.top;
  const pitch = pw / rows.length;
  const bw = Math.min(30, pitch - 10);
  const Y = (v) => mt + ph - (v / yMax) * ph;
  const o = [`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)} per month">`];
  for (let g = 0; g <= sc.count; g++) {
    const v = sc.step * g;
    o.push(`<line x1="${ml}" x2="${W - mr}" y1="${Y(v)}" y2="${Y(v)}" stroke="${GRID}"/><text x="${ml - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="11.5" fill="${MUTED}">${Math.round(v)}</text>`);
  }
  rows.forEach((r, i) => {
    const cx = ml + pitch * (i + 0.5);
    const x = cx - bw / 2;
    const y = Y(r.value);
    const h = mt + ph - y;
    const rr = Math.min(4, h);
    o.push(`<path d="M${x} ${mt + ph} V${y + rr} Q${x} ${y} ${x + rr} ${y} H${x + bw - rr} Q${x + bw} ${y} ${x + bw} ${y + rr} V${mt + ph} Z" fill="${BRAND}" opacity="${r.faded ? 0.5 : 1}"/>`);
    o.push(`<text x="${cx}" y="${H - 9}" text-anchor="middle" font-size="11.5" fill="${MUTED}">${esc(r.short)}</text>`);
    if (r.note && !r.faded) o.push(`<text x="${cx}" y="${y - 7}" text-anchor="middle" font-size="11.5" font-weight="600" fill="${INK}">${esc(r.note)}</text>`);
    o.push(`<rect x="${ml + pitch * i}" y="${mt}" width="${pitch}" height="${ph}" fill="transparent" data-tip="${esc(`${r.label}: ${r.value} ${label}${r.note ? ` (${r.note})` : ''}`)}"/>`);
  });
  o.push('</svg>');
  container.innerHTML = `<div class="chart">${o.join('')}<div class="tip" hidden></div></div>`;
  const box = container.querySelector('.chart');
  const tip = box.querySelector('.tip');
  box.addEventListener('pointermove', (e) => {
    const t = e.target.closest('[data-tip]');
    if (!t) { tip.hidden = true; return; }
    const br = box.getBoundingClientRect();
    tip.textContent = t.getAttribute('data-tip');
    tip.style.left = `${e.clientX - br.left + box.scrollLeft}px`;
    tip.style.top = `${e.clientY - br.top - 12}px`;
    tip.hidden = false;
  });
  box.addEventListener('pointerleave', () => { tip.hidden = true; });
}

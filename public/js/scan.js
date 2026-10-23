// Gate pass scanning, shared by the guard screen and the page the camera app opens.
import { esc, fmtDate } from './common.js';

// The big coloured result the guard reads at a glance: green IN, blue OUT, gold already scanned, red problem.
export function scanResultHtml(r) {
  if (r.result === 'error') {
    return `<div class="scan-result error" role="alert"><div class="big">STOP</div><p style="font-size:17px;font-weight:600;margin-top:12px">${esc(r.message)}</p></div>`;
  }
  const ev = r.event ? `<p>${esc(r.event.title)} · No. ${r.event.house}${r.event.date ? ` · ${esc(fmtDate(r.event.date))}` : ''}</p>` : '';
  const code = r.code ? `<span class="tagline">Pass ${esc(r.code)}${r.vip ? ' · elderly / OKU' : ''}</span>` : '';
  if (r.result === 'in') {
    return `<div class="scan-result in" role="status"><div class="big">IN ✓</div>
      <p style="font-weight:700;margin-top:4px">Send the car to</p>
      <div class="bay">${esc(r.slotLabel)}</div><p>${esc(r.directions)}</p>${ev}${code}
      ${r.held ? '<p style="font-weight:600">The space the guest held on the way.</p>' : ''}</div>`;
  }
  if (r.result === 'out') {
    return `<div class="scan-result out" role="status"><div class="big">OUT ✓</div>
      <div class="bay">${esc(r.slotLabel)} is free</div>${ev}${code}<p>Thank the guest for coming.</p></div>`;
  }
  if (r.result === 'notin') {
    return `<div class="scan-result repeat" role="status"><div class="big">NOT INSIDE</div>
      <div class="bay" style="font-size:20px">Nothing to free</div>${ev}${code}
      <p>This car is not recorded as parked (maybe it was never scanned in). Let it go.</p></div>`;
  }
  // Already in: the entry pass was scanned again. Old single passes also say how long ago.
  return `<div class="scan-result repeat" role="status"><div class="big">ALREADY ${r.direction === 'out' ? 'OUT' : 'IN'}</div>
    ${r.seconds != null ? `<div class="bay" style="font-size:20px">Scanned ${r.seconds} seconds ago</div>` : ''}
    <p>Nothing changed. ${r.direction === 'in' && r.slotLabel ? `The car's space is ${esc(r.slotLabel)}.` : ''} ${r.seconds != null ? 'To record it the other way, wait 30 seconds and scan again.' : 'When leaving, the guest shows their blue exit pass.'}</p>${code}</div>`;
}

// Reads a scanned QR code (a link like http://…/g/p_abc123?d=in). Returns { pid, direction } or null.
export function passFrom(text) {
  const s = String(text || '');
  const m = /\/g\/(p_[A-Za-z0-9_-]+)/.exec(s);
  if (!m) return null;
  const d = /[?&]d=(in|out)\b/.exec(s);
  return { pid: m[1], direction: d ? d[1] : null };
}

// ---------- the camera scanner built into the guard app ----------
// Phones only allow the camera on a secure (https) address. The QR reading itself uses the phone's built-in
// reader when it has one (Android Chrome), and jsQR otherwise (iPhone, other browsers).

export const canScanInApp = () => window.isSecureContext && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

let jsQRPromise = null;
function loadJsQR() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  if (!jsQRPromise) {
    jsQRPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = '/vendor/jsQR.js';
      s.onload = () => resolve(window.jsQR);
      s.onerror = () => { jsQRPromise = null; reject(new Error('The QR reader could not load.')); };
      document.head.appendChild(s);
    });
  }
  return jsQRPromise;
}

// Returns a function that reads a QR code from a video frame (or an image), or null when none is found.
async function makeReader() {
  if ('BarcodeDetector' in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.includes('qr_code')) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        return async (source) => { const c = await detector.detect(source); return c.length ? c[0].rawValue : null; };
      }
    } catch (e) { /* fall back to jsQR */ }
  }
  const jsQR = await loadJsQR();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return async (source) => {
    const w0 = source.videoWidth || source.naturalWidth || source.width;
    const h0 = source.videoHeight || source.naturalHeight || source.height;
    if (!w0 || !h0) return null;
    const scale = Math.min(1, 720 / Math.max(w0, h0));   // smaller frames read faster
    canvas.width = Math.round(w0 * scale);
    canvas.height = Math.round(h0 * scale);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
    return code ? code.data : null;
  };
}

// Reads one QR code from an image (used by the self-check and the "photo" fallback).
export async function readImage(source) { return (await makeReader())(source); }

// Starts the back camera and calls onCode(text) for each QR it sees.
// The same code is ignored for a few seconds, so holding a pass in front of the camera records it once.
// Returns { stop(), torch(on) | null }.
export async function startScanner(video, onCode) {
  const read = await makeReader();
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false
  });
  video.srcObject = stream;
  video.setAttribute('playsinline', '');
  video.muted = true;
  await video.play();
  const track = stream.getVideoTracks()[0];
  let stopped = false;
  let busy = false;
  let last = { text: '', at: 0 };
  const loop = async () => {
    if (stopped) return;
    if (!busy && video.readyState >= 2) {
      try {
        const text = await read(video);
        if (text && !(text === last.text && Date.now() - last.at < 4000)) {
          busy = true;
          last = { text, at: Date.now() };
          await onCode(text);
          busy = false;
        } else if (text) {
          last.at = Date.now();   // still in front of the camera
        }
      } catch (e) { busy = false; }
    }
    setTimeout(loop, 160);
  };
  loop();
  let torch = null;
  try {
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    if (caps.torch) torch = (on) => track.applyConstraints({ advanced: [{ torch: !!on }] });
  } catch (e) { /* no torch */ }
  return { stop: () => { stopped = true; stream.getTracks().forEach((t) => t.stop()); }, torch };
}

import { api, byId, esc, getSession, markDemo, haptic, icon } from './common.js';
import { scanResultHtml } from './scan.js';

// Opened when the guard scans a guest's gate pass with the phone's own camera app.
// Signed in as a guard: the car is recorded in (or out) straight away. Anyone else: an explanation.
const pid = decodeURIComponent(location.pathname.split('/')[2] || '');
const session = await getSession();
markDemo(session.mode);
const me = session.user;

if (!me || (me.role !== 'guard' && me.role !== 'township')) {
  byId('result').innerHTML = `<section class="card" style="text-align:center">
    <div style="font-size:44px;line-height:1">🎟️</div>
    <h1 style="margin:10px 0 6px">KenduriFlow gate pass</h1>
    <p class="muted">Guests: show your green entry pass to the guard when you arrive. After that your invitation page shows a blue exit pass for when you leave.</p>
    <p class="muted">Guards: sign in on this phone first, then scan the pass again.</p>
    ${me ? '' : `<a class="btn" href="/login?next=${encodeURIComponent(location.pathname)}">Guard sign-in</a>`}</section>`;
  byId('after').innerHTML = '';
} else {
  try {
    // ?d=in on the entry QR, ?d=out on the exit QR.
    const direction = new URLSearchParams(location.search).get('d');
    const r = await api(`/passes/${encodeURIComponent(pid)}/scan`, { method: 'POST', body: { direction } });
    byId('result').innerHTML = scanResultHtml(r);
    haptic(r.result === 'in' ? [40, 60, 40] : r.result === 'out' ? 80 : 20);
    byId('after').innerHTML = `<div class="actionbar"><a class="btn" href="/guard/${esc(r.event.id)}">${icon('shield')}Back to the gate</a></div>
      <p class="small muted" style="text-align:center;margin-top:12px">Scan the next pass with your camera. Green entry passes record cars in, blue exit passes record them out.</p>`;
  } catch (err) {
    byId('result').innerHTML = scanResultHtml({ result: 'error', message: err.message });
    haptic([100, 50, 100]);
    byId('after').innerHTML = `<div class="actionbar"><a class="btn secondary" href="/guard">${icon('shield')}Back to the gate</a></div>`;
  }
}

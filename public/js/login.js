import { api, byId, esc, enableLang, t, showError, homeFor, initials, roleLabel, getSession, markDemo } from './common.js';

let phone = '';
let digits = 6;

// Only follow "next" to a page on this site.
function nextUrl(user) {
  const n = new URLSearchParams(location.search).get('next') || '';
  return n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/login') ? n : homeFor(user);
}

function done(user) { location.replace(nextUrl(user)); }

async function loadDemo() {
  const list = await api('/auth/demo-accounts');
  // The real system has no demo accounts.
  byId('demoOr').hidden = !list.length;
  byId('demoAccounts').innerHTML = list.map((u) => `
    <button class="account-btn" type="button" data-user="${esc(u.id)}">
      <span class="avatar">${esc(initials(u.name))}</span>
      <span><b>${esc(u.name)}</b><small>${esc(u.demo)}${u.house ? ` · No. ${u.house}` : ''}</small></span>
      <span class="badge info">${esc(roleLabel(u.role))}</span>
    </button>`).join('');
}

byId('demoAccounts').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-user]');
  if (!b) return;
  b.disabled = true;
  try { done((await api('/auth/demo', { method: 'POST', body: { userId: b.dataset.user } })).user); } catch (err) { b.disabled = false; alert(err.message); }
});

byId('phoneForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = byId('phoneErr');
  err.hidden = true;
  const btn = byId('sendBtn');
  btn.disabled = true;
  try {
    phone = byId('phone').value;
    const r = await api('/auth/start', { method: 'POST', body: { phone } });
    digits = r.digits || 6;
    byId('code').maxLength = digits;
    byId('codeLabel').textContent = t(`${digits}-digit code`, `Kod ${digits} digit`);
    if (r.demoCode) {
      byId('codeSent').innerHTML = t(`We sent a code to <b>${esc(r.phone)}</b>.`, `Kod telah dihantar ke <b>${esc(r.phone)}</b>.`);
      byId('demoNote').textContent = t(`Demo: no SMS is sent. The code is ${r.demoCode}.`, `Demo: tiada SMS dihantar. Kodnya ialah ${r.demoCode}.`);
      byId('demoNote').hidden = false;
    } else {
      byId('codeSent').innerHTML = t(`If <b>${esc(r.phone)}</b> is registered, we have sent it a ${digits}-digit code by SMS. It works for 5 minutes.`,
        `Jika <b>${esc(r.phone)}</b> berdaftar, kod ${digits} digit telah dihantar melalui SMS. Ia sah selama 5 minit.`);
      byId('demoNote').textContent = t('SMS is not set up on this server yet. The code is in the server terminal and data/sms-outbox.log.',
        'SMS belum disediakan pada pelayan ini. Kod ada di terminal pelayan dan data/sms-outbox.log.');
      byId('demoNote').hidden = !!r.smsReady;
    }
    byId('phoneForm').hidden = true;
    byId('codeForm').hidden = false;
    byId('code').value = '';
    byId('code').focus();
  } catch (ex) {
    showError(err, ex);
  } finally {
    btn.disabled = false;
  }
});

byId('codeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = byId('codeErr');
  err.hidden = true;
  const btn = byId('verifyBtn');
  btn.disabled = true;
  try {
    done((await api('/auth/verify', { method: 'POST', body: { phone, code: byId('code').value } })).user);
  } catch (ex) {
    showError(err, ex);
    btn.disabled = false;
  }
});

// Sign in as soon as the last digit is typed.
byId('code').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, digits);
  if (e.target.value.length === digits) byId('codeForm').requestSubmit();
});

byId('otherNumber').onclick = () => { byId('codeForm').hidden = true; byId('phoneForm').hidden = false; byId('phone').focus(); };

enableLang(() => loadDemo().catch(() => {}));
// Already signed in: carry on, unless the person came here to switch account. First run: set up instead.
getSession().then((s) => {
  if (s.needsSetup) { location.replace('/setup'); return; }
  // The demo has no sign-in: people choose a role on the home screen.
  if (s.mode === 'demo') { location.replace('/'); return; }
  markDemo(s.mode);
  if (s.user && !new URLSearchParams(location.search).has('switch')) done(s.user);
});
loadDemo().catch((err) => { byId('demoAccounts').innerHTML = `<p class="empty">${esc(err.message)}</p>`; });

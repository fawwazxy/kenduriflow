import { getMeta, getSession, byId, esc, homeFor, enableLang, t, openSheet, markDemo, icon, DEMO_ROLES, chooseRole } from './common.js';

const session = await getSession();

// On a laptop: a QR code to open the same address on a phone (same Wi-Fi).
async function phoneSheet() {
  const meta = await getMeta();
  const port = new URL(meta.baseUrl).port;
  const others = meta.lan.slice(1).map((a) => `http://${a.address}:${port}`);
  openSheet({
    title: t('Open on your phone', 'Buka di telefon anda'),
    html: `<div class="qr" style="margin:0"><img src="/api/qr.svg?path=/" alt="QR code for this address">
      <div><p class="label">${t('Address', 'Alamat')}</p><p style="font-family:Consolas,monospace;font-size:15px;overflow-wrap:anywhere">${esc(meta.baseUrl)}</p>
      ${others.length ? `<p class="small muted">${t('Or', 'Atau')}: ${others.map(esc).join(', ')}</p>` : ''}</div></div>
      <p class="small muted" style="margin-top:12px">${t('Your phone must be on the same Wi-Fi as this computer.', 'Telefon anda mesti menggunakan Wi-Fi yang sama dengan komputer ini.')}</p>
      ${meta.secureUrl ? `<p class="small muted">${t('Guard phones that scan QR passes use', 'Telefon pengawal yang mengimbas pas QR guna')} <b>${esc(meta.secureUrl)}</b></p>` : ''}`
  });
}

if (session.mode === 'demo') {
  // Demo: no sign-in. Choose who you are; switch any time from the top bar.
  const render = () => {
    byId('roleCards').innerHTML = DEMO_ROLES.map((r) => `
      <button class="role-card" type="button" data-role="${r.role}">
        <span class="rc-icon${r.role === 'guest' ? ' gold' : ''}">${icon(r.icon)}</span>
        <span class="rc-body"><b>${esc(t(r.en, r.ms))}</b><small class="rc-who">${esc(r.who)}</small><small>${esc(t(r.desc[0], r.desc[1]))}</small></span>
        ${icon('chev', 'chev')}
      </button>`).join('');
  };
  enableLang(render);
  markDemo(session.mode);
  render();
  byId('chooser').hidden = false;
  document.body.style.background = 'var(--brand-ink)';
  byId('roleCards').addEventListener('click', (e) => {
    const b = e.target.closest('[data-role]');
    if (!b) return;
    b.disabled = true;
    b.classList.add('busy');
    chooseRole(b.dataset.role).catch(() => { b.disabled = false; b.classList.remove('busy'); });
  });
  byId('phoneBtn2').onclick = phoneSheet;
} else if (session.needsSetup) {
  location.replace('/setup');
} else if (session.user) {
  // Real system, signed in: an app opens on your own screen, not on a welcome page.
  location.replace(homeFor(session.user));
} else {
  enableLang();
  byId('main').hidden = false;

  byId('guestBtn').onclick = () => openSheet({
    title: t('Coming as a guest?', 'Datang sebagai tetamu?'),
    html: `<p>${t('Open the link the host sent you in WhatsApp or on the invitation card. It shows where to park, gives you your entry and exit QR pass, and works without an account.',
      'Buka pautan yang dihantar oleh tuan rumah melalui WhatsApp atau kad jemputan. Ia menunjukkan tempat letak kereta, memberi pas QR masuk dan keluar, dan tidak perlu akaun.')}</p>
      <p class="muted">${t('No link? Ask the host to send it again.', 'Tiada pautan? Minta tuan rumah hantar semula.')}</p>`
  });
  byId('phoneBtn').onclick = phoneSheet;
}

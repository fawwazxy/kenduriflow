import {
  api, getMeta, byId, esc, enableLang, t, lang, live, shell, homeFor, initials, roleLabel, icon, openSheet,
  canInstall, isInstalled, isIOS, promptInstall, toast, roleSheet
} from './common.js';

enableLang(() => { if (me) render(); });
const me = await shell({ roles: ['resident', 'guard', 'township'], nav: 'account' });
if (!me) await new Promise(() => {});   // shell() has sent the person to sign in, or explained why they cannot use this page

function render() {
  byId('profile').innerHTML = `<span class="avatar-lg">${esc(initials(me.name))}</span>
    <div style="min-width:0;flex:1"><h2 style="font-size:21px;margin:0">${esc(me.name)}</h2>
      <p style="margin:4px 0 6px"><span class="badge info">${esc(roleLabel(me.role))}</span></p>
      <p class="small muted" style="margin:0">${me.house ? `No. ${me.house}, ${esc(me.street)}` : esc(me.post || '')} · ${esc(me.phone)}</p></div>
    <a class="btn secondary small" href="${homeFor(me)}">${t('Home', 'Utama')}</a>`;
  byId('langNow').innerHTML = `${lang() === 'ms' ? 'Bahasa Melayu' : 'English'}${icon('chev', 'chev')}`;
  byId('installSub').textContent = isInstalled() ? t('Installed on this device', 'Telah dipasang pada peranti ini')
    : t('Open it from your home screen, full screen', 'Buka dari skrin utama, skrin penuh');
}

byId('rowLang').onclick = () => {
  const sh = openSheet({
    title: t('Language', 'Bahasa'),
    html: `<ul class="rows" style="box-shadow:none;border:1px solid var(--line)">${[['en', 'English'], ['ms', 'Bahasa Melayu']].map(([v, l]) =>
      `<li><button class="row" type="button" data-l="${v}"><span class="body"><b>${l}</b></span>${lang() === v ? icon('check') : ''}</button></li>`).join('')}</ul>`
  });
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-l]');
    if (!b) return;
    const sw = document.querySelector(`#langSw [data-lang="${b.dataset.l}"]`);
    if (sw) sw.click();
    sh.close();
  });
};

byId('rowInstall').onclick = () => {
  let html;
  if (isInstalled()) html = `<div class="alert ok" style="margin:0">${icon('check')}<span>${t('KenduriFlow is installed on this device.', 'KenduriFlow telah dipasang pada peranti ini.')}</span></div>`;
  else if (canInstall()) html = `<p>${t('Open KenduriFlow from your home screen, full screen, like any other app.', 'Buka KenduriFlow dari skrin utama, skrin penuh, seperti aplikasi lain.')}</p><button class="btn block" type="button" id="installBtn">${icon('download')}${t('Install KenduriFlow', 'Pasang KenduriFlow')}</button>`;
  else if (isIOS()) {
    html = `<ol style="padding-left:20px;display:flex;flex-direction:column;gap:8px">
      <li>${t('Tap the <b>Share</b> button at the bottom of Safari.', 'Tekan butang <b>Kongsi</b> di bawah Safari.')}</li>
      <li>${t('Choose <b>Add to Home Screen</b>.', 'Pilih <b>Tambah ke Skrin Utama</b>.')}</li>
      <li>${t('Tap <b>Add</b>. KenduriFlow opens full screen from its icon.', 'Tekan <b>Tambah</b>. KenduriFlow dibuka skrin penuh dari ikonnya.')}</li></ol>`;
  } else {
    html = `<ol style="padding-left:20px;display:flex;flex-direction:column;gap:8px">
      <li>${t('Open the browser menu <b>⋮</b>.', 'Buka menu pelayar <b>⋮</b>.')}</li>
      <li>${t('Choose <b>Install app</b> or <b>Add to Home screen</b>.', 'Pilih <b>Pasang aplikasi</b> atau <b>Tambah ke skrin utama</b>.')}</li></ol>
      <p class="small muted">${t('Full install with offline support needs a secure (https) address.', 'Pemasangan penuh dengan sokongan luar talian memerlukan alamat selamat (https).')}</p>`;
  }
  const sh = openSheet({ title: t('Install the app', 'Pasang aplikasi'), html });
  const b = sh.el.querySelector('#installBtn');
  if (b) b.onclick = async () => { if (await promptInstall()) toast(t('Installed. Find KenduriFlow on your home screen.', 'Dipasang. Cari KenduriFlow di skrin utama anda.')); sh.close(); render(); };
};

byId('rowPhone').onclick = async () => {
  const meta = await getMeta();
  openSheet({
    title: t('Open on another phone', 'Buka di telefon lain'),
    html: `<div class="qr" style="justify-content:center;margin:0"><img src="/api/qr.svg?path=/" alt="QR code"></div>
      <p style="text-align:center;font-family:Consolas,monospace;overflow-wrap:anywhere;margin-top:10px">${esc(meta.baseUrl)}</p>
      <p class="small muted" style="text-align:center">${t('The phone must be on the same Wi-Fi as this server.', 'Telefon mesti menggunakan Wi-Fi yang sama dengan pelayan ini.')}</p>`
  });
};

byId('rowSwitch').onclick = roleSheet;

byId('signOut').onclick = () => {
  const sh = openSheet({
    title: t('Sign out?', 'Log keluar?'),
    html: `<p>${t('You can sign in again any time with your mobile number.', 'Anda boleh log masuk semula bila-bila masa dengan nombor telefon anda.')}</p>
      <div class="actionbar"><button class="btn secondary" type="button" id="soNo">${t('Stay signed in', 'Kekal log masuk')}</button><button class="btn solid-bad" type="button" id="soYes">${t('Sign out', 'Log keluar')}</button></div>`
  });
  sh.el.querySelector('#soNo').onclick = sh.close;
  sh.el.querySelector('#soYes').onclick = async () => { await api('/auth/logout', { method: 'POST' }); location.href = '/'; };
};

render();
api('/auth/demo-accounts').then((l) => { byId('demoCard').hidden = !l.length; }).catch(() => {});
live(() => {});
document.addEventListener('kf-installable', render);

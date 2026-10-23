import { api, byId, showError, getSession } from './common.js';

// Already set up: nothing to do here.
getSession().then((s) => { if (!s.needsSetup) location.replace(s.user ? '/admin' : '/login'); });

byId('setupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = byId('err');
  err.hidden = true;
  const btn = byId('go');
  btn.disabled = true;
  try {
    await api('/setup', { method: 'POST', body: { key: byId('key').value, name: byId('name').value, phone: byId('phone').value } });
    location.replace('/people?welcome=1');
  } catch (ex) {
    showError(err, ex);
    btn.disabled = false;
  }
});

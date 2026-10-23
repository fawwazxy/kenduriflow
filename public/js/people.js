import { api, getMeta, live, byId, esc, shell, segTabs, openSheet, toast, showError, confirmClick, initials, roleLabel, fmtStamp, plural, icon, haptic } from './common.js';

const me = await shell({ roles: ['township'], nav: 'people' });
if (!me) await new Promise(() => {});   // shell() has sent the person to sign in, or explained why they cannot use this page
const meta = await getMeta();
let list = [];
let tabs = null;

if (new URLSearchParams(location.search).has('welcome')) {
  byId('welcome').innerHTML = `<div class="alert ok big" style="margin:0 0 16px">${icon('check')}<span><b>KenduriFlow is set up.</b>
    Add the residents of the precinct and the guards next. Each person then signs in with their own number.</span></div>`;
}

const houseOptions = () => {
  const streets = [...new Set(meta.precinct.houses.map((h) => h.street))];
  return streets.map((s) => `<optgroup label="${esc(s)}">${meta.precinct.houses.filter((h) => h.street === s)
    .map((h) => `<option value="${h.no}">No. ${h.no}, ${esc(h.street)}</option>`).join('')}</optgroup>`).join('');
};

function render() {
  const role = tabs ? tabs.current() : 'resident';
  const n = (r) => list.filter((u) => u.role === r).length;
  byId('count').textContent = `${plural(n('resident'), 'resident')} · ${plural(n('guard'), 'guard')} · ${n('township')} township team`;
  const shown = list.filter((u) => u.role === role);
  byId('people').innerHTML = shown.length ? shown.map((u) => `<li><div class="row" style="cursor:default">
      <span class="avatar" style="width:40px;height:40px;flex:none">${esc(initials(u.name))}</span>
      <span class="body"><b>${esc(u.name)}${u.id === me.id ? ' (you)' : ''}</b>
        <small>${u.house ? `No. ${u.house}, ${esc(u.street)}` : esc(u.post || '')} · ${esc(u.phone)}</small>
        <small>${u.lastSignIn ? `Last signed in ${esc(fmtStamp(u.lastSignIn))}` : 'Not signed in yet'}</small></span>
      ${u.id === me.id ? '' : `<button class="btn ghost small" type="button" data-remove="${esc(u.id)}" aria-label="Remove ${esc(u.name)}">Remove</button>`}
    </div></li>`).join('') : `<li><div class="row" style="cursor:default"><span class="body"><small>No ${roleLabel(role).toLowerCase()} accounts yet. Tap Add person.</small></span></div></li>`;
}

async function load() {
  list = await api('/people');
  render();
}

function addSheet() {
  const role0 = tabs ? tabs.current() : 'resident';
  const sh = openSheet({
    title: 'Add a person',
    html: `<form id="addForm" novalidate>
      <div class="field"><label for="pName">Name</label><input type="text" id="pName" maxlength="60" autocomplete="off"></div>
      <div class="field"><label for="pPhone">Mobile number</label><div class="phone-field"><span>+60</span><input type="tel" id="pPhone" inputmode="tel" placeholder="12-345 6712"></div></div>
      <div class="field"><span class="label">Role</span><div class="seg" id="pRole">
        ${['resident', 'guard', 'township'].map((r) => `<label><input type="radio" name="role" value="${r}"${r === role0 ? ' checked' : ''}><span>${roleLabel(r)}</span></label>`).join('')}
      </div></div>
      <div class="field" id="houseField"${role0 === 'resident' ? '' : ' hidden'}><label for="pHouse">House</label><select id="pHouse">${houseOptions()}</select></div>
      <div class="field" id="postField"${role0 === 'resident' ? ' hidden' : ''}><label for="pPost">Post</label><input type="text" id="pPost" maxlength="60" placeholder="e.g. Guardhouse, Precinct 3"></div>
      <div class="form-error" id="addErr" role="alert" hidden></div>
      <button class="btn block" type="submit" id="addBtn">Add person</button>
      <p class="small muted" style="margin-top:10px">They sign in with this number and a code sent to it by SMS.</p></form>`
  });
  const el = sh.el;
  const role = () => el.querySelector('[name=role]:checked').value;
  el.querySelector('#pRole').addEventListener('change', () => {
    el.querySelector('#houseField').hidden = role() !== 'resident';
    el.querySelector('#postField').hidden = role() === 'resident';
  });
  el.querySelector('#addForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = el.querySelector('#addErr');
    err.hidden = true;
    const btn = el.querySelector('#addBtn');
    btn.disabled = true;
    try {
      const u = await api('/people', { method: 'POST', body: { name: el.querySelector('#pName').value, phone: el.querySelector('#pPhone').value, role: role(), house: Number(el.querySelector('#pHouse').value), post: el.querySelector('#pPost').value } });
      haptic(20);
      toast(`${u.name} added. They can sign in with ${u.phone}.`);
      sh.close();
      if (tabs) tabs.show(u.role, true);
      await load();
    } catch (ex) {
      showError(err, ex);
      btn.disabled = false;
    }
  });
}

function bulkSheet() {
  const sh = openSheet({
    title: 'Add many people',
    html: `<p class="muted">One person per line: name, mobile number, house number. For a guard, write <b>guard</b> instead of the house number.</p>
      <textarea id="bulk" rows="7" style="height:auto;padding:10px 12px;font-family:Consolas,'Courier New',monospace;font-size:14px" placeholder="Rohana Ismail, 012-345 6712, 12&#10;Siti Rahmah, 012-345 6714, 14&#10;Razak Ali, 019-876 5401, guard"></textarea>
      <div class="form-error" id="bulkErr" role="alert" hidden style="margin-top:10px;white-space:pre-line"></div>
      <button class="btn block" type="button" id="bulkBtn" style="margin-top:10px">Add everyone</button>`
  });
  sh.el.querySelector('#bulkBtn').onclick = async () => {
    const err = sh.el.querySelector('#bulkErr');
    err.hidden = true;
    try {
      const r = await api('/people/bulk', { method: 'POST', body: { text: sh.el.querySelector('#bulk').value } });
      toast(`${plural(r.added.length, 'person', 'people')} added.`);
      await load();
      if (r.errors.length) showError(err, new Error(`Not added:\n${r.errors.join('\n')}`));
      else sh.close();
    } catch (ex) {
      showError(err, ex);
    }
  };
}

byId('fab').onclick = addSheet;
byId('bulkOpen').onclick = bulkSheet;
byId('people').addEventListener('click', (e) => {
  const b = e.target.closest('[data-remove]');
  if (!b) return;
  confirmClick(b, 'Tap again', async () => {
    try { const u = await api(`/people/${encodeURIComponent(b.dataset.remove)}/remove`, { method: 'POST' }); toast(`${u.name} can no longer sign in.`); await load(); } catch (err) { toast(err.message, 'bad'); }
  });
});

tabs = segTabs(byId('tabs'), { onChange: () => { if (list.length) render(); } });
load().catch((err) => { byId('people').innerHTML = `<li class="empty" style="padding:16px">${esc(err.message)}</li>`; });
live(() => load().catch(() => {}));

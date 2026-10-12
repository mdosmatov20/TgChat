(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (v) => (v ? new Date(v).toLocaleString() : '—');
  const fmtSize = (b) => (b > 1073741824 ? (b / 1073741824).toFixed(2) + ' GB' : b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.ceil(b / 1024) + ' KB');
  const REFRESH_MS = 100; // live: har 0.1 soniyada yangilanadi

  let token = sessionStorage.getItem('dc_admin') || '';
  let tab = 'stats';
  let timer = null, busy = false, built = null;
  let users = [], groups = [], seen = new Set(), onlyOnline = false;

  async function call(path, body) {
    const r = await fetch('/api/admin/' + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 && token) { showLogin(); throw new Error(d.error || 'Kirish kerak'); }
    if (!r.ok) throw new Error(d.error || 'Xato');
    return d;
  }

  function showLogin() {
    stopLive();
    token = ''; sessionStorage.removeItem('dc_admin'); built = null;
    $('#app').hidden = true; $('#login').hidden = false;
  }
  function showApp() {
    $('#login').hidden = true; $('#app').hidden = false;
    built = null; refresh(); startLive();
  }

  async function login() {
    $('#loginErr').textContent = '';
    try {
      const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('#pw').value }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Xato');
      token = d.token; sessionStorage.setItem('dc_admin', token); $('#pw').value = '';
      showApp();
    } catch (e) { $('#loginErr').textContent = e.message; }
  }

  function setMsg(t) { $('#msg').textContent = t || ''; }
  function setLive(ok) {
    const l = $('#live'); if (!l) return;
    l.classList.toggle('off', !ok);
    $('#liveTxt').textContent = ok ? 'LIVE · ' + new Date().toLocaleTimeString() : 'aloqa yo\'q';
  }

  function startLive() { stopLive(); timer = setInterval(() => { if (!document.hidden) refresh(); }, REFRESH_MS); }
  function stopLive() { if (timer) clearInterval(timer); timer = null; }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && token) refresh(); });

  /* ---------- Chizish ---------- */
  function drawStats(s) {
    const cards = [
      ['online', 'Hozir onlayn', s.online], ['users', 'Foydalanuvchilar', s.users], ['calls', 'Faol qo\'ng\'iroqlar', s.live.calls],
      ['vc', 'Faol videochatlar', s.live.videochats + ' (' + s.live.videochatUsers + ' kishi)'], ['groups', 'Guruhlar', s.groups], ['messages', 'Xabarlar', s.messages],
      ['n24', 'Yangi (24 soat)', s.new24h], ['n7', 'Yangi (7 kun)', s.new7d], ['mf', 'Media fayllar', s.media.files], ['ms', 'Media hajmi', fmtSize(s.media.bytes)],
    ];
    if (built !== 'stats') {
      $('#view').innerHTML = '<div class="grid">' + cards.map((c) => '<div class="stat"><b id="st-' + c[0] + '"></b><span>' + esc(c[1]) + '</span></div>').join('') + '</div>';
      built = 'stats';
    }
    cards.forEach((c) => { const el = $('#st-' + c[0]); const v = String(c[2]); if (el && el.textContent !== v) { el.textContent = v; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } });
  }

  function drawUsers() {
    if (built !== 'users') {
      $('#view').innerHTML = '<div class="bar"><input id="q" placeholder="Qidirish: ism, nik, pochta"><label class="chk"><input type="checkbox" id="onl"> faqat onlayn</label><span class="mut" id="cnt"></span></div><div class="wrap"><table><thead><tr><th>Ism</th><th>Nik</th><th>Pochta</th><th>Ro\'yxatdan o\'tgan</th><th>Oxirgi faollik</th><th>Guruh</th><th></th></tr></thead><tbody id="rows"></tbody></table></div>';
      $('#q').oninput = drawUsers; $('#onl').onchange = (e) => { onlyOnline = e.target.checked; drawUsers(); };
      built = 'users';
    }
    const q = $('#q').value.trim().toLowerCase();
    const list = users.filter((u) => (!onlyOnline || u.online) && (!q || [u.name, u.nick, u.email].some((x) => String(x || '').toLowerCase().includes(q))));
    $('#cnt').textContent = list.length + ' / ' + users.length + ' ta · onlayn: ' + users.filter((u) => u.online).length;
    $('#rows').innerHTML = list.map((u) =>
      '<tr' + (u._new ? ' class="new"' : '') + '><td><span class="dot' + (u.online ? ' on' : '') + '"></span>' + esc(u.name) + '</td><td>@' + esc(u.nick) + '</td><td>' + esc(u.email) + '</td><td>' + esc(fmtDate(u.createdAt)) + '</td><td>' + (u.online ? '<span class="onl">onlayn</span>' : esc(fmtDate(u.lastSeen))) + '</td><td>' + u.groups + '</td>' +
      '<td class="act"><button class="btn ghost sm" data-a="pw" data-id="' + esc(u.id) + '" data-n="' + esc(u.name) + '">Yangi parol</button><button class="btn ghost sm" data-a="logout" data-id="' + esc(u.id) + '">Sessiyani yopish</button><button class="btn red sm" data-a="del" data-id="' + esc(u.id) + '" data-n="' + esc(u.name) + '">O\'chirish</button></td></tr>').join('');
  }

  function drawGroups() {
    if (built !== 'groups') {
      $('#view').innerHTML = '<div class="bar"><span class="mut" id="cnt"></span></div><div class="wrap"><table><thead><tr><th>Nom</th><th>ID</th><th>Turi</th><th>A\'zolar</th><th>Xabarlar</th><th>Egasi</th><th>Yaratilgan</th><th></th></tr></thead><tbody id="rows"></tbody></table></div>';
      built = 'groups';
    }
    $('#cnt').textContent = groups.length + ' ta';
    $('#rows').innerHTML = groups.map((g) => '<tr><td>' + esc(g.name) + '</td><td>@' + esc(g.gid) + '</td><td>' + esc(g.kind) + '</td><td>' + g.members + '</td><td>' + g.messages + '</td><td>' + esc(g.owner) + '</td><td>' + esc(fmtDate(g.createdAt)) + '</td><td class="act"><button class="btn red sm" data-a="gdel" data-id="' + esc(g.id) + '" data-n="' + esc(g.name) + '">O\'chirish</button></td></tr>').join('');
  }

  async function refresh() {
    if (busy || !token) return;
    busy = true;
    try {
      if (tab === 'stats') drawStats(await call('stats'));
      else if (tab === 'users') {
        const first = !seen.size;
        users = (await call('users')).users;
        users.forEach((u) => { u._new = !first && !seen.has(u.id); });
        users.forEach((u) => seen.add(u.id));
        drawUsers();
      } else { groups = (await call('groups')).groups; drawGroups(); }
      setMsg(''); setLive(true);
    } catch (e) {
      if (token) { setMsg(e.message); setLive(false); }
    } finally { busy = false; }
  }

  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-tab],[data-a]');
    if (!t) return;
    if (t.dataset.tab) {
      tab = t.dataset.tab; built = null; seen = new Set();
      document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b === t));
      return refresh();
    }
    const { a, id, n } = t.dataset;
    try {
      if (a === 'del') {
        if (!confirm('"' + n + '" akkauntini butunlay o\'chirasizmi? Yozishmalari ham o\'chadi.')) return;
        await call('users/delete', { id });
      } else if (a === 'pw') {
        const pw = prompt('"' + n + '" uchun yangi parol (kamida 6 belgi):');
        if (!pw) return;
        await call('users/password', { id, password: pw }); setMsg('Parol o\'zgartirildi, foydalanuvchi qayta kirishi kerak'); return;
      } else if (a === 'logout') {
        await call('users/logout', { id }); setMsg('Sessiyalar yopildi'); return;
      } else if (a === 'gdel') {
        if (!confirm('"' + n + '" guruhini butunlay o\'chirasizmi?')) return;
        await call('groups/delete', { id });
      }
      refresh();
    } catch (err) { setMsg(err.message); }
  });

  $('#loginBtn').onclick = login;
  $('#pw').onkeydown = (e) => { if (e.key === 'Enter') login(); };
  $('#logoutBtn').onclick = async () => { try { await call('logout', {}); } catch (_) {} showLogin(); };

  if (token) showApp(); else showLogin();
})();

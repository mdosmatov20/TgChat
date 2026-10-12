(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const root = document.documentElement;
  const svg = (p) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  const IC = {
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
    back: svg('<path d="M19 12H5M12 19l-7-7 7-7"/>'),
    dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4 21.5 12.6a.75.75 0 0 0 0-1.38L3.4 3.4a.75.75 0 0 0-1.05.9L4.3 10.5a.75.75 0 0 0 .62.55L12.5 12l-7.58.95a.75.75 0 0 0-.62.55L2.35 19.5a.75.75 0 0 0 1.05.9z"/></svg>',
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    check: svg('<path d="M20 6L9 17l-5-5"/>'),
    dl: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'),
    mic: svg('<path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z"/><path d="M19 11a7 7 0 0 1-14 0M12 18v4"/>'),
    clip: svg('<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>'),
  };
  $('#gear').innerHTML = IC.gear; $('#back').innerHTML = IC.back; $('#dots').innerHTML = IC.dots;
  $('#send').innerHTML = IC.send; $('#attach').innerHTML = IC.clip; $('#mic').innerHTML = IC.mic; $('#fab').innerHTML = IC.plus;

  /* ---------- Состояние ---------- */
  let me = null, chats = [], cur = null, chatData = null, es = null;
  let maxMb = 2048, uploading = null, editing = null, menuMsg = null, renderedHtml = [], prevReqs = null, dynKind = null, busy = false, again = false, scrollNext = false, renderedKey = null;
  let selectMode = false, selected = new Set();

  const lbtn = $('#langBtn'), lmenu = $('#langMenu'), lopts = $$('.opt', lmenu), btn = $('#themeBtn'), menu = $('#menu'), opts = $$('.opt', menu), overlay = $('#overlay'),
    nav = $('nav'), loginBtn = $('#login'), signupBtn = $('#signup'), logoutBtn = $('#logout'),
    dynEl = $('#dyn'), modals = { login: $('#loginModal'), signup: $('#signupModal') };

  /* ---------- Утилиты ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hue = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h % 360; };
  const ini = (s) => { const w = String(s).trim().split(/\s+/); return ((w[0] || '?')[0] + ((w[1] || '')[0] || '')).toUpperCase(); };
  function av(a, title, cls) {
    const c = 'av ' + (cls || '');
    if (a && a.kind === 's') return '<span class="' + c + ' av-saved"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3.5A2.5 2.5 0 0 1 8.5 1h7A2.5 2.5 0 0 1 18 3.5v17.2a1 1 0 0 1-1.6.8L12 17.5l-4.4 4a1 1 0 0 1-1.6-.8V3.5z"/></svg></span>';
    if (a && a.v) return '<span class="' + c + '"><img src="/api/avatar/' + a.kind + '/' + esc(a.id) + '?v=' + a.v + '" alt=""></span>';
    return '<span class="' + c + '" style="background:hsl(' + hue(title) + ',55%,48%)">' + esc(ini(title)) + '</span>';
  }
  const t = I18N.t;
  const p2 = (n) => (n < 10 ? '0' : '') + n;
  const hm = (ts) => { const d = new Date(ts); return p2(d.getHours()) + ':' + p2(d.getMinutes()); };
  const same = (a, b) => a.toDateString() === b.toDateString();
  function dayLabel(ts) {
    const d = new Date(ts), n = new Date();
    if (same(d, n)) return t('today');
    if (same(d, new Date(n.getTime() - 864e5))) return t('yesterday');
    return I18N.fmtDate(d);
  }
  const listTime = (ts) => (!ts ? '' : same(new Date(ts), new Date()) ? hm(ts) : I18N.fmtDate(new Date(ts), true));
  // «в сети» / «был(а) в сети …»
  function seenText(u) {
    if (u.online) return t('online');
    if (!u.seen) return t('seen_never');
    const diff = Date.now() - u.seen, d = new Date(u.seen);
    if (diff < 60000) return t('seen_now');
    if (diff < 3600000) return t('seen_min', { n: Math.floor(diff / 60000) });
    if (same(d, new Date())) return t('seen_today', { time: hm(u.seen) });
    if (same(d, new Date(Date.now() - 864e5))) return t('seen_yday', { time: hm(u.seen) });
    return t('seen_date', { date: I18N.fmtDate(d) });
  }
  const stHtml = (u) => '<span class="' + (u.online ? 'on' : '') + '">' + esc(seenText(u)) + '</span>';
  const mediaLabel = (k) => (k === 'voice' ? '🎤 ' + t('vm_voice') : (k === 'video' ? '🎬 ' : k === 'image' ? '🖼 ' : k === 'file' ? '📎 ' : '🎵 ') + t(k === 'image' ? 'photo' : k));
  const sysText = (m) => (m.sys && m.k ? t('s.' + m.k, { name: m.n }) : m.text);
  const whoText = (l) => (l.whoK === 'me' ? t('you') : l.whoK === 'del' ? t('deleted') : l.who);
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }
  /* ---------- Сессия вкладки ----------
     Токен лежит в sessionStorage (у каждой вкладки свой), поэтому в двух вкладках
     можно войти в два разных аккаунта. «Запомнить меня» дополнительно кладёт токен
     в localStorage: его подхватит новая вкладка, но только если других вкладок нет. */
  const SKEY = 'amy_sid', RKEY = 'amy_remember';
  let token = null;
  try { token = sessionStorage.getItem(SKEY); } catch (e) {}
  function storeToken(t, remember) {
    token = t;
    try { sessionStorage.setItem(SKEY, t); if (remember) localStorage.setItem(RKEY, t); } catch (e) {}
  }
  function dropToken() {
    try {
      if (localStorage.getItem(RKEY) === token) localStorage.removeItem(RKEY);
      sessionStorage.removeItem(SKEY);
    } catch (e) {}
    token = null;
  }
  const chan = window.BroadcastChannel ? new BroadcastChannel('darkchat') : null;
  if (chan) chan.onmessage = (e) => { if (e.data === 'hello' && token) chan.postMessage('alive'); };

  function api(url, body) {
    const opt = { credentials: 'same-origin', headers: {} };
    opt.headers['X-Session'] = token || ''; // всегда: так сервер знает, что вкладка работает по токену, а не по cookie
    if (body) { opt.method = 'POST'; opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    return fetch(url, opt).then((r) => r.json().catch(() => ({})).then((d) => {
      if (!r.ok) { const e = new Error(d.error || ''); e.fromServer = true; e.status = r.status; e.code = d.code; e.params = d.params; throw e; }
      return d;
    }));
  }
  const netMsg = (e) => (e.fromServer ? (e.code && I18N.has('err.' + e.code) ? t('err.' + e.code, e.params) : e.message || t('err.server_error')) : t('err.net'));

  /* ---------- Тема ---------- */
  const setMenu = (o) => { menu.classList.toggle('open', o); btn.setAttribute('aria-expanded', o); };
  function setTheme(t) {
    if (t === 'dark') root.setAttribute('data-theme', 'dark'); else root.removeAttribute('data-theme');
    opts.forEach((b) => b.setAttribute('aria-checked', b.dataset.theme === t));
  }
  const setLangMenu = (o) => { lmenu.classList.toggle('open', o); lbtn.setAttribute('aria-expanded', o); };
  btn.addEventListener('click', (e) => { e.stopPropagation(); setLangMenu(false); setMenu(!menu.classList.contains('open')); });
  lbtn.addEventListener('click', (e) => { e.stopPropagation(); setMenu(false); setLangMenu(!lmenu.classList.contains('open')); });
  const markLang = () => lopts.forEach((b) => b.setAttribute('aria-checked', b.dataset.lang === I18N.lang));
  lopts.forEach((b) => b.addEventListener('click', () => { I18N.set(b.dataset.lang); setLangMenu(false); }));
  markLang();
  opts.forEach((b) => b.addEventListener('click', () => { setTheme(b.dataset.theme); setMenu(false); }));
  const closePops = () => { $('#fabMenu').classList.remove('open'); $('#dotsMenu').classList.remove('open'); closeMsgMenu(); };
  document.addEventListener('click', (e) => { if (!menu.contains(e.target)) setMenu(false); if (!lmenu.contains(e.target)) setLangMenu(false); closePops(); });

  /* ---------- Окна ---------- */
  function showModal(el) {
    $$('.modal', overlay).forEach((m) => m.classList.toggle('active', m === el));
    overlay.classList.add('open');
  }
  function closeModal() { overlay.classList.remove('open'); dynKind = null; }
  function dyn(html, kind) { dynKind = kind || null; dynEl.innerHTML = html; showModal(dynEl); setTimeout(() => { const i = $('input[type=text]', dynEl); if (i) i.focus(); }, 120); return dynEl; }
  overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setMenu(false); setLangMenu(false); closePops(); closeModal(); } });
  document.querySelectorAll('.modal form').forEach((f) => f.addEventListener('submit', (e) => e.preventDefault()));
  function openModal(name) {
    setMenu(false); setLangMenu(false); $$('.form-error').forEach((p) => { p.textContent = ''; });
    showModal(modals[name]);
    setTimeout(() => { const i = $('input', modals[name]); if (i) i.focus(); }, 120);
  }
  loginBtn.addEventListener('click', () => openModal('login'));
  signupBtn.addEventListener('click', () => openModal('signup'));

  const head = (title) => '<div class="mh"><button class="icon-btn" type="button" data-close aria-label="' + esc(t('back')) + '">' + IC.back + '</button><h3>' + esc(title) + '</h3></div>';
  const field = (id, label, val, extra) => '<div class="field"><input id="' + id + '" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder=" " value="' + esc(val || '') + '" ' + (extra || '') + '><label for="' + id + '">' + esc(label) + '</label></div>';
  const fail = (m, msg) => { $('.form-error', m).textContent = msg; };
  function prefixInput(el, p) {
    el.addEventListener('input', () => { el.value = p + el.value.replace(/@/g, '').toLowerCase().replace(/[^a-z0-9_]/g, ''); });
    el.addEventListener('focus', () => { if (!el.value) el.value = p; });
    el.addEventListener('blur', () => { if (el.value === p) el.value = ''; });
  }
  function bindEnter(m, fn) { $$('input[type=text]', m).forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fn(); } })); }
  function act(m, b, fn) {
    b.disabled = true; $('.form-error', m).textContent = '';
    return fn().catch((e) => fail(m, netMsg(e))).then(() => { b.disabled = false; });
  }
  function pickImage(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onerror = () => rej(new Error(t('err.read')));
      r.onload = () => {
        const img = new Image();
        img.onerror = () => rej(new Error(t('err.notimg')));
        img.onload = () => {
          const s = Math.min(img.width, img.height), c = document.createElement('canvas');
          c.width = c.height = 192;
          c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 192, 192);
          res(c.toDataURL('image/jpeg', 0.85));
        };
        img.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }
  const avatarPicker = (preview) => '<div class="pick"><span id="pv"></span><div class="col"><button class="link-btn" type="button" id="pickBtn">' + esc(t('set_icon')) + '</button><button class="link-btn" type="button" id="rmBtn">' + esc(t('remove_icon')) + '</button></div><input type="file" id="file" accept="image/*" hidden></div>';
  function wirePicker(m, current, getTitle, onChange) {
    let value; // undefined — без изменений, null — убрать, строка — новая
    const show = () => { $('#pv', m).innerHTML = value ? '<span class="av xl"><img src="' + value + '" alt=""></span>' : av(value === null ? null : current, getTitle(), 'xl'); };
    show();
    $('#pickBtn', m).addEventListener('click', () => $('#file', m).click());
    $('#rmBtn', m).addEventListener('click', () => { value = null; show(); onChange(value); });
    $('#file', m).addEventListener('change', (e) => {
      const f = e.target.files[0]; if (!f) return;
      pickImage(f).then((d) => { value = d; show(); onChange(value); }).catch((er) => fail(m, er.message));
    });
    return () => value;
  }

  function openAddContact() {
    const m = dyn(head(t('add_contact')) + '<p class="sub left">' + esc(t('contact_nick_prompt')) + '</p>' + field('c-nick', t('contact_nick'), '', 'maxlength="33"') +
      '<p class="form-error"></p><div class="actions"><button class="link-btn" type="button" id="c-go">' + esc(t('find_user')) + '</button></div>');
    const inp = $('#c-nick', m); prefixInput(inp, '@');
    const go = () => {
      const v = inp.value.replace(/^@+/, '').trim();
      if (!v) return fail(m, t('enter_nick'));
      act(m, $('#c-go', m), () => api('/api/contacts/add', { nick: v }).then((d) => { closeModal(); openChat(d.key); }));
    };
    $('#c-go', m).addEventListener('click', go); bindEnter(m, go);
  }

  function openCreateGroup() {
    const hints = { public: t('hint_public'), private: t('hint_private') };
    let kind = 'public';
    const m = dyn(head(t('new_group')) + field('g-name', t('group_name'), '', 'maxlength="64"') + field('g-id', t('group_id'), '', 'maxlength="34"') +
      field('g-desc', t('group_desc'), '', 'maxlength="200"') +
      '<div class="seg"><button type="button" data-k="public" class="on">' + esc(t('public')) + '</button><button type="button" data-k="private">' + esc(t('private')) + '</button></div>' +
      '<p class="hint" id="g-hint">' + hints.public + '</p><p class="form-error"></p><div class="actions"><button class="link-btn" type="button" id="g-go">' + esc(t('create')) + '</button></div>');
    prefixInput($('#g-id', m), '@@');
    $$('.seg button', m).forEach((b) => b.addEventListener('click', () => {
      kind = b.dataset.k; $$('.seg button', m).forEach((x) => x.classList.toggle('on', x === b)); $('#g-hint', m).textContent = hints[kind];
    }));
    const go = () => act(m, $('#g-go', m), () => api('/api/groups/create', { name: $('#g-name', m).value, gid: $('#g-id', m).value, kind, desc: $('#g-desc', m).value }).then((d) => { closeModal(); openChat(d.key); }));
    $('#g-go', m).addEventListener('click', go); bindEnter(m, go);
  }

  function openJoin() {
    const m = dyn(head(t('join_group')) + '<p class="sub left">' + esc(t('enter_group_id')) + '</p>' + field('j-id', t('group_id'), '', 'maxlength="34"') +
      '<p class="form-error"></p><p class="form-ok"></p><div class="actions"><button class="link-btn" type="button" id="j-go">' + esc(t('join')) + '</button></div>');
    const inp = $('#j-id', m); prefixInput(inp, '@@');
    const go = () => {
      const v = inp.value.replace(/^@+/, '').trim();
      if (!v) return fail(m, t('enter_group_id'));
      $('.form-ok', m).textContent = '';
      act(m, $('#j-go', m), () => api('/api/groups/join', { gid: v }).then((d) => {
        if (d.status === 'requested') $('.form-ok', m).textContent = t('request_sent');
        else { closeModal(); openChat(d.key); }
      }));
    };
    $('#j-go', m).addEventListener('click', go); bindEnter(m, go);
  }

  function openProfile() {
    const m = dyn(head(t('settings')) + avatarPicker() + field('p-name', t('name'), me.name, 'maxlength="40"') + field('p-nick', t('nick'), '@' + me.nick, 'maxlength="33"') +
      field('p-bio', t('bio'), me.bio || '', 'maxlength="200"') +
      '<div class="field"><input id="p-bd" type="date" value="' + esc(me.birthday || '') + '" placeholder=" "><label for="p-bd">' + esc(t('birthday')) + '</label></div>' +
      '<p class="form-error"></p><div class="actions"><button class="link-btn" type="button" id="p-save">' + esc(t('save_changes')) + '</button></div>');
    prefixInput($('#p-nick', m), '@');
    const getAv = wirePicker(m, { kind: 'u', id: me.id, v: me.av }, () => $('#p-name', m).value || me.name, () => {});
    const go = () => act(m, $('#p-save', m), () => api('/api/profile', { name: $('#p-name', m).value, nick: $('#p-nick', m).value, avatar: getAv(), bio: $('#p-bio', m).value, birthday: $('#p-bd', m).value || null })
      .then((d) => { me = d.user; closeModal(); refresh(); }));
    $('#p-save', m).addEventListener('click', go); bindEnter(m, go);
  }

  function openGroupSettings() {
    const info = chatData && chatData.info; if (!info || info.type !== 'g') return;
    const cand = info.members.filter((u) => u.role === 'member');
    const m = dyn(head(t('group_settings')) + avatarPicker() + field('gs-name', t('group_name'), info.name, 'maxlength="64"') + field('gs-id', t('group_id'), '@@' + info.gid, 'maxlength="34"') +
      field('gs-desc', t('group_desc'), info.desc || '', 'maxlength="200"') +
      '<div class="sec">' + esc(t('add_admin')) + '</div><select class="sel" id="gs-admin"><option value="">' + esc(t('not_selected')) + '</option>' +
      cand.map((u) => '<option value="' + esc(u.id) + '">' + esc(u.name) + ' (@' + esc(u.nick) + ')</option>').join('') + '</select><p class="hint"></p>' +
      '<p class="form-error"></p><div class="actions"><button class="link-btn" type="button" id="gs-save">' + esc(t('save')) + '</button></div>');
    prefixInput($('#gs-id', m), '@@');
    const getAv = wirePicker(m, { kind: 'g', id: info.id, v: info.av }, () => $('#gs-name', m).value || info.name, () => {});
    const go = () => act(m, $('#gs-save', m), () => api('/api/groups/update', { group: info.id, name: $('#gs-name', m).value, gid: $('#gs-id', m).value, desc: $('#gs-desc', m).value, avatar: getAv(), addAdmin: $('#gs-admin', m).value || undefined })
      .then(() => { closeModal(); refresh(); }));
    $('#gs-save', m).addEventListener('click', go); bindEnter(m, go);
  }

  /* ---------- Участники группы ---------- */
  const memRow = (u, acts, role) => '<div class="mem" data-u="' + esc(u.id) + '">' + av({ kind: 'u', id: u.id, v: u.av }, u.name, 'sm') +
    '<div class="txt"><div class="ttl">' + esc(u.name) + (role === 'owner' ? '<span class="role">' + esc(t('role_owner')) + '</span>' : role === 'admin' ? '<span class="role">' + esc(t('role_admin')) + '</span>' : '') +
    (u.id === me.id ? '<span class="role">' + esc(t('role_you')) + '</span>' : '') + '</div><div class="meta">@' + esc(u.nick) + (u.id !== me.id ? ' · ' + stHtml(u) : '') + '</div></div><div class="acts">' +
    acts.map((a) => '<button type="button" data-a="' + a[0] + '"' + (a[2] ? ' class="danger"' : '') + '>' + a[1] + '</button>').join('') + '</div></div>';
  function openMembers() { dyn('', 'members'); renderMembers(); }
  function renderMembers() {
    const info = chatData && chatData.info;
    if (dynKind !== 'members' || !info || info.type !== 'g') return;
    const admin = info.role !== 'member', owner = info.role === 'owner', top = dynEl.scrollTop;
    let h = head(info.name) + '<div class="sec">' + esc(t('members')) + ': ' + info.members.length + '</div>';
    info.members.forEach((u) => {
      const a = [];
      if (u.id !== me.id) {
        a.push(['dm', t('a_dm')]);
        if (!u.contact) a.push(['addc', t('a_addc')]);
        if (admin && u.role !== 'owner' && (u.role === 'member' || owner)) {
          a.push(u.role === 'member' ? ['admin', t('a_admin')] : ['unadmin', t('a_unadmin')]);
          a.push(['kick', t('a_kick'), 1], ['ban', t('a_ban'), 1]);
        }
      }
      h += memRow(u, a, u.role);
    });
    if (admin && info.requests.length) h += '<div class="sec">' + esc(t('requests')) + ': ' + info.requests.length + '</div>' + info.requests.map((u) => memRow(u, [['accept', t('a_accept')], ['decline', t('a_decline'), 1]])).join('');
    if (admin && info.banned.length) h += '<div class="sec">' + esc(t('banned')) + ': ' + info.banned.length + '</div>' + info.banned.map((u) => memRow(u, [['unban', t('a_unban')]])).join('');
    dynEl.innerHTML = h; dynEl.scrollTop = top;
  }
  $('#reqbar').addEventListener('click', (e) => {
    const b = e.target.closest('.acts button'), info = chatData && chatData.info;
    if (!b || !info || info.type !== 'g') return;
    b.disabled = true;
    api('/api/groups/member', { group: info.id, userId: b.closest('.mem').dataset.u, action: b.dataset.a })
      .then(() => refresh()).catch((er) => { b.disabled = false; toast(netMsg(er)); });
  });
  dynEl.addEventListener('click', (e) => {
    const info = chatData && chatData.info;
    const b = e.target.closest('.acts button');
    if (b && info) {
      const uid = b.closest('.mem').dataset.u, a = b.dataset.a;
      if (a === 'dm') { closeModal(); openChat('u:' + uid); return; }
      if ((a === 'ban' || a === 'kick') && !confirm(a === 'ban' ? t('c_ban') : t('c_kick'))) return;
      const p = a === 'addc' ? api('/api/contacts/add', { userId: uid }) : api('/api/groups/member', { group: info.id, userId: uid, action: a });
      p.then(() => refresh()).catch((er) => toast(netMsg(er)));
      return;
    }
    const mem = e.target.closest('.mem');
    if (mem && info && info.type === 'g' && !e.target.closest('.acts')) {
      const u = info.members.find((x) => x.id === mem.dataset.u);
      if (u) showUserProfile(u, u.contact);
    }
  });

  /* ---------- Список чатов и переписка ---------- */
  function itemHtml(c) {
    const l = c.last, prev = c.reqs ? '<b>' + esc(t('requests')) + ': ' + c.reqs + '</b>' : l ? (whoText(l) ? esc(whoText(l)) + ': ' : '') + esc(l.media ? mediaLabel(l.media): sysText(l)) : esc(c.sub || '');
    const title = c.type === 's' ? t('saved') : c.title;
    return '<button class="item' + (c.key === cur ? ' on' : '') + '" type="button" data-key="' + esc(c.key) + '" data-type="' + esc(c.type || '') + '">' + av(c.avatar, title) +
      '<span class="txt"><span class="row"><span class="ttl">' + esc(title) + '</span><span class="tm2">' + (l ? listTime(l.ts) : '') + '</span></span>' +
      '<span class="row"><span class="meta">' + prev + '</span>' + (c.reqs ? '<span class="badge req" title="' + esc(t('requests')) + '">' + c.reqs + '</span>' : '') + (c.unread ? '<span class="badge">' + (c.unread > 99 ? '99+' : c.unread) + '</span>' : '') + '</span></span></button>';
  }
  function renderList() {
    const q = $('#search').value.trim().toLowerCase();
    const items = chats.filter((c) => !q || c.title.toLowerCase().includes(q) || c.sub.toLowerCase().includes(q));
    $('#list').innerHTML = items.length ? items.map(itemHtml).join('') : '<div class="nolist">' + (q ? t('no_results') : t('no_chats')) + '</div>';
  }
  $('#search').addEventListener('input', renderList);
  $('#list').addEventListener('click', (e) => { const b = e.target.closest('.item'); if (b) openChat(b.dataset.key); });

  function fmtSize(n) {
    const u = t('units').split('|');
    let i = 0, v = Number(n) || 0;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return (i === 0 || v >= 100 ? Math.round(v) : v.toFixed(1)) + ' ' + u[i];
  }
  function mediaHtml(md) {
    const src = '/api/media/' + esc(md.id) + '?sid=' + encodeURIComponent(token || '');
    if (md.kind === 'file') return '<a class="file" href="' + src + '" download="' + esc(md.name) + '"><span class="fi">' + IC.dl + '</span><span class="fx"><span class="fnm" title="' + esc(md.name) + '">' + esc(md.name) + '</span><span class="fsz">' + esc(fmtSize(md.size)) + '</span></span></a>';
    if (md.kind === 'image') return '<a href="' + src + '" target="_blank" rel="noopener"><img src="' + src + '" alt="' + esc(md.name) + '" loading="lazy"></a>';
    if (md.kind === 'video') {
      return '<div class="vplayer" data-src="' + src + '">' +
        '<video playsinline preload="metadata" src="' + src + '"></video>' +
        '<div class="vp-overlay"><button type="button" class="vp-bigplay" aria-label="Play"><span class="vp-icon-play"></span></button></div>' +
        '<div class="vp-bar">' +
        '<button type="button" class="vp-btn vp-back" aria-label="-10s" title="-10s"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="12" y="15.5" text-anchor="middle" font-size="7" font-weight="700" fill="currentColor">10</text></svg></button>' +
        '<button type="button" class="vp-btn vp-play" aria-label="Play"><span class="vp-anim-icon" data-state="play"></span></button>' +
        '<button type="button" class="vp-btn vp-fwd" aria-label="+10s" title="+10s"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/><text x="12" y="15.5" text-anchor="middle" font-size="7" font-weight="700" fill="currentColor">10</text></svg></button>' +
        '<span class="vp-time">0:00</span>' +
        '<div class="vp-seek"><div class="vp-seek-fill"></div></div>' +
        '<span class="vp-dur">0:00</span>' +
        '<button type="button" class="vp-btn vp-mute" aria-label="Mute"><svg class="i-vol" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.3-3.9v7.8A4.5 4.5 0 0 0 16.5 12z"/><path d="M14 3.2v2.1a7 7 0 0 1 0 13.4v2.1A9 9 0 0 0 14 3.2z"/></svg><svg class="i-mut" viewBox="0 0 24 24" fill="currentColor" hidden><path d="M16.5 12a4.5 4.5 0 0 0-2.3-3.9v2.2l2.3 2.3V12zm2.5 5.3V12a7 7 0 0 0-2.1-5l1.5-1.5A9 9 0 0 1 21 12v.3l-2 2zM4.3 3L3 4.3 7.7 9H3v6h4l5 5v-6.7l4.3 4.3 1.3-1.3L4.3 3zM12 4L9.9 6.1 12 8.2V4z"/></svg></button>' +
        '<div class="vp-more-wrap"><button type="button" class="vp-btn vp-more" aria-label="More" aria-haspopup="true">⋯</button>' +
        '<div class="vp-menu" role="menu" hidden>' +
        '<div class="vp-menu-title">Скорость</div>' +
        [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => '<button type="button" role="menuitem" class="vp-speed" data-rate="' + r + '">' + (r === 1 ? 'Обычная' : r + '×') + '</button>').join('') +
        '</div></div>' +
        '<button type="button" class="vp-btn vp-dl" aria-label="Download" title="Скачать"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg></button>' +
        '<button type="button" class="vp-btn vp-expand" aria-label="Expand"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg></button>' +
        '</div></div>';
    }
    if (md.kind === 'audio' && md.voice) return voiceHtml(md, src);
    return '<audio controls preload="metadata" src="' + src + '"></audio><div class="fn" title="' + esc(md.name) + '">' + esc(md.name) + '</div>';
  }
  function voiceBars(id) {
    let h = 7; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const out = [];
    for (let i = 0; i < 34; i++) { h = (h * 1664525 + 1013904223) >>> 0; out.push(24 + (h >>> 24) % 76); }
    return out;
  }
  function voiceHtml(md, src) {
    const dur = Math.max(0, Number(md.dur) || 0);
    return '<div class="voice" data-dur="' + dur + '"><button type="button" class="vo-play" aria-label="' + esc(t('vm_play')) + '">' +
      '<svg class="i-play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><svg class="i-pause" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg></button>' +
      '<div class="vo-body"><div class="vo-bars">' + voiceBars(md.id).map((x) => '<i style="height:' + x + '%"></i>').join('') + '</div>' +
      '<div class="vo-meta"><span class="vo-time">' + fmtMediaTime(dur) + '</span><button type="button" class="vo-speed" title="' + esc(t('v_speed') || '') + '">1×</button></div></div>' +
      '<audio preload="metadata" src="' + src + '"></audio></div>';
  }
  function fmtMediaTime(s) {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }
  function bindPlayerUI(wrap, v) {
    const overlay = $('.vp-overlay', wrap);
    const playBtn = $('.vp-play', wrap), big = $('.vp-bigplay', wrap), muteBtn = $('.vp-mute', wrap);
    const backBtn = $('.vp-back', wrap), fwdBtn = $('.vp-fwd', wrap);
    const seek = $('.vp-seek', wrap), fill = $('.vp-seek-fill', wrap);
    const tEl = $('.vp-time', wrap), dEl = $('.vp-dur', wrap);
    const moreBtn = $('.vp-more', wrap), menu = $('.vp-menu', wrap);
    const animIcon = playBtn && $('.vp-anim-icon', playBtn);
    const iVol = muteBtn && $('.i-vol', muteBtn), iMut = muteBtn && $('.i-mut', muteBtn);
    const syncPlay = () => {
      const p = !v.paused;
      if (animIcon) {
        animIcon.dataset.state = p ? 'pause' : 'play';
        animIcon.classList.remove('pulse');
        void animIcon.offsetWidth;
        animIcon.classList.add('pulse');
      }
      if (playBtn) playBtn.setAttribute('aria-label', p ? 'Pause' : 'Play');
      if (overlay) overlay.classList.toggle('hide', p);
      if (big) {
        const ic = $('.vp-icon-play', big);
        if (ic) ic.classList.toggle('is-pause', p);
      }
    };
    const syncMute = () => {
      if (!iVol || !iMut) return;
      iVol.hidden = v.muted || v.volume === 0;
      iMut.hidden = !iVol.hidden;
    };
    const syncSeek = () => {
      const r = v.duration ? (v.currentTime / v.duration) : 0;
      if (fill) fill.style.width = (r * 100) + '%';
      if (tEl) tEl.textContent = fmtMediaTime(v.currentTime);
      if (dEl && isFinite(v.duration)) dEl.textContent = fmtMediaTime(v.duration);
    };
    const syncSpeed = () => {
      if (!menu) return;
      $$('.vp-speed', menu).forEach((b) => b.classList.toggle('on', Number(b.dataset.rate) === v.playbackRate));
    };
    const toggle = () => { if (v.paused) v.play().catch(() => {}); else v.pause(); };
    const skip = (sec) => {
      if (!isFinite(v.duration)) return;
      v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + sec));
      syncSeek();
    };
    if (playBtn) playBtn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
    if (big) big.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
    if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) toggle(); });
    v.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
    if (backBtn) backBtn.addEventListener('click', (e) => { e.stopPropagation(); skip(-10); });
    if (fwdBtn) fwdBtn.addEventListener('click', (e) => { e.stopPropagation(); skip(10); });
    if (muteBtn) muteBtn.addEventListener('click', (e) => { e.stopPropagation(); v.muted = !v.muted; syncMute(); });
    const dlBtn = $('.vp-dl', wrap);
    if (dlBtn) dlBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      let href = wrap.dataset.src || v.currentSrc || v.src;
      if (!href) return;
      href += (href.includes('?') ? '&' : '?') + 'download=1';
      const a = document.createElement('a');
      a.href = href;
      a.download = '';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
    if (moreBtn && menu) {
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = menu.hidden;
        menu.hidden = !open;
        moreBtn.classList.toggle('on', open);
        if (open) syncSpeed();
      });
      menu.addEventListener('click', (e) => {
        const b = e.target.closest('.vp-speed');
        if (!b) return;
        e.stopPropagation();
        v.playbackRate = Number(b.dataset.rate) || 1;
        syncSpeed();
        menu.hidden = true;
        moreBtn.classList.remove('on');
      });
      document.addEventListener('click', (e) => {
        if (!menu.hidden && !wrap.contains(e.target)) {
          menu.hidden = true;
          moreBtn.classList.remove('on');
        }
      });
    }
    if (seek) {
      const seekTo = (e) => {
        const r = seek.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        if (v.duration) v.currentTime = x * v.duration;
      };
      let drag = false;
      seek.addEventListener('click', (e) => { e.stopPropagation(); seekTo(e); });
      seek.addEventListener('pointerdown', (e) => { drag = true; seek.setPointerCapture(e.pointerId); seekTo(e); e.stopPropagation(); });
      seek.addEventListener('pointermove', (e) => { if (drag) seekTo(e); });
      seek.addEventListener('pointerup', () => { drag = false; });
    }
    v.addEventListener('play', syncPlay);
    v.addEventListener('pause', syncPlay);
    v.addEventListener('ended', () => { v.pause(); syncPlay(); });
    v.addEventListener('timeupdate', syncSeek);
    v.addEventListener('loadedmetadata', syncSeek);
    v.addEventListener('volumechange', syncMute);
    v.addEventListener('ratechange', syncSpeed);
    syncPlay(); syncMute(); syncSeek(); syncSpeed();
    return { toggle, syncSeek };
  }
  function openVideoLightbox(src, fromVideo) {
    let box = $('#vLightbox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'vLightbox';
      box.className = 'v-lightbox';
      box.innerHTML = '<button type="button" class="vl-close" aria-label="Close">×</button>' +
        '<div class="vl-stage"><video playsinline preload="metadata"></video>' +
        '<div class="vp-overlay"><button type="button" class="vp-bigplay" aria-label="Play"><span class="vp-icon-play"></span></button></div></div>' +
        '<div class="vp-bar vl-bar">' +
        '<button type="button" class="vp-btn vp-back" aria-label="-10s" title="-10s"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg></button>' +
        '<button type="button" class="vp-btn vp-play" aria-label="Play"><span class="vp-anim-icon" data-state="play"></span></button>' +
        '<button type="button" class="vp-btn vp-fwd" aria-label="+10s" title="+10s"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/></svg></button>' +
        '<span class="vp-time">0:00</span><div class="vp-seek"><div class="vp-seek-fill"></div></div><span class="vp-dur">0:00</span>' +
        '<button type="button" class="vp-btn vp-mute" aria-label="Mute"><svg class="i-vol" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.3-3.9v7.8A4.5 4.5 0 0 0 16.5 12z"/><path d="M14 3.2v2.1a7 7 0 0 1 0 13.4v2.1A9 9 0 0 0 14 3.2z"/></svg><svg class="i-mut" viewBox="0 0 24 24" fill="currentColor" hidden><path d="M16.5 12a4.5 4.5 0 0 0-2.3-3.9v2.2l2.3 2.3V12zm2.5 5.3V12a7 7 0 0 0-2.1-5l1.5-1.5A9 9 0 0 1 21 12v.3l-2 2zM4.3 3L3 4.3 7.7 9H3v6h4l5 5v-6.7l4.3 4.3 1.3-1.3L4.3 3zM12 4L9.9 6.1 12 8.2V4z"/></svg></button>' +
        '<div class="vp-more-wrap"><button type="button" class="vp-btn vp-more" aria-label="More" aria-haspopup="true">⋯</button>' +
        '<div class="vp-menu" role="menu" hidden><div class="vp-menu-title">Скорость</div>' +
        [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => '<button type="button" role="menuitem" class="vp-speed" data-rate="' + r + '">' + (r === 1 ? 'Обычная' : r + '×') + '</button>').join('') +
        '</div></div>' +
        '<button type="button" class="vp-btn vp-dl" aria-label="Download" title="Скачать"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg></button></div>';
      document.body.appendChild(box);
      box._wired = false;
    }
    const v = $('video', box);
    const close = () => {
      v.pause();
      box.classList.remove('open');
      v.removeAttribute('src');
      v.load();
    };
    $('.vl-close', box).onclick = close;
    box.onclick = (e) => { if (e.target === box) close(); };
    const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
    if (!box._wired) {
      bindPlayerUI(box, v);
      box._wired = true;
    }
    const t0 = fromVideo ? fromVideo.currentTime : 0;
    const wasPlaying = fromVideo && !fromVideo.paused;
    if (fromVideo) fromVideo.pause();
    v.src = src;
    v.currentTime = t0;
    box.classList.add('open');
    if (wasPlaying || !fromVideo) v.play().catch(() => {});
  }
  function wireVideoPlayers(root) {
    (root || document).querySelectorAll('.vplayer:not([data-wired])').forEach((wrap) => {
      wrap.dataset.wired = '1';
      const v = $('video', wrap);
      bindPlayerUI(wrap, v);
      const exp = $('.vp-expand', wrap);
      if (exp) exp.addEventListener('click', (e) => {
        e.stopPropagation();
        openVideoLightbox(wrap.dataset.src || v.currentSrc, v);
      });
      // double-click / long press style: expand on expand btn only; big play stays play
    });
  }
  function renderChat() {
    const forced = scrollNext; scrollNext = false;
    $('#empty').hidden = !!cur; $('#chatIn').hidden = !cur;
    if (!cur) { $('#app').classList.remove('chat-open'); renderedKey = null; return; }
    const c = chats.find((x) => x.key === cur), d = chatData && chatData.key === cur ? chatData : null, info = d && d.info;
    let title = c ? c.title : '', sub = c ? c.sub : '', a = c ? c.avatar : null;
    if (info && info.type === 'u') { title = info.user.name; sub = '@' + info.user.nick; a = { kind: 'u', id: info.user.id, v: info.user.av }; }
    if (info && info.type === 'g') { title = info.name; sub = I18N.members(info.members.length) + ' · @@' + info.gid; a = { kind: 'g', id: info.id, v: info.av }; }
    if (info && info.type === 's') { title = t('saved'); sub = ''; a = { kind: 's', id: me.id, v: 0 }; }
    let subHtml = esc(sub);
    if (info && info.type === 'u') subHtml = stHtml(info.user) + ' · @' + esc(info.user.nick);
    else if (!info && c && c.type === 'u') subHtml = stHtml(c) + ' · ' + esc(c.sub);
    else if (info && info.type === 's') subHtml = '';
    $('#who').innerHTML = av(a, title, 'sm') + '<div><div class="ttl">' + esc(title) + '</div><div class="meta">' + subHtml + '</div></div>';
    $('#who').classList.toggle('click', !!info && (info.type === 'g' || info.type === 'u'));

    // Group video chat button (bubble icon)
    const vcb = $('#videoChatBtn');
    if (vcb) {
      const showVc = !!(info && info.type === 'g');
      vcb.hidden = !showVc;
      vcb.onclick = showVc ? () => joinGroupCall(info) : null;
      vcb.classList.toggle('live', showVc && gcActive(info.id));
    }

    // Alohida «Ekran» tugmasi: ekranni darrov ulashadi (1:1 — qo'ng'iroq, guruh — videochat orqali)
    const ssb = $('#screenShareBtn');
    if (ssb) {
      const can = canShareScreen() && !!info && ((info.type === 'u' && !info.blocked && !!info.user && info.user.id !== me.id) || info.type === 'g');
      ssb.hidden = !can;
      ssb.title = t('call_screen'); ssb.setAttribute('aria-label', t('call_screen'));
      ssb.onclick = can ? () => shareScreenFrom(info) : null;
    }

    gcUpdateBar();

    const items = [];
    if (info && info.type === 'u') {
      items.push(['call', t('call')]);
      if (!info.contact) items.push(['addc', t('add_to_contacts')]);
      items.push(info.blocked ? ['unblock', t('unblock')] : ['block', t('block'), 1]);
    }
    if (info && info.type === 'g') {
      items.push(['videocall', t('call_video_full') || 'Видеочат']);
      if (info.role !== 'member') items.push(['gset', t('settings')]);
      items.push(['leave', t('leave_group'), 1]);
    }
    $('#dotsMenu').innerHTML = items.map((i) => '<button type="button" data-a="' + i[0] + '"' + (i[2] ? ' class="danger"' : '') + '>' + i[1] + '</button>').join('');
    $('#dots').hidden = !items.length;

    const blocked = !!info && info.type === 'u' && info.blocked, ta = $('#text');
    ta.disabled = blocked; syncAttach(blocked); ta.placeholder = blocked ? t('you_blocked') : t('message');

    const rb = $('#reqbar'), reqs = info && info.type === 'g' ? info.requests : [];
    rb.hidden = !reqs.length;
    rb.innerHTML = reqs.length ? '<div class="rt">' + esc(t('requests')) + ': ' + reqs.length + '</div>' +
      reqs.map((u) => memRow(u, [['accept', t('a_accept')], ['decline', t('a_decline'), 1]])).join('') : '';

    const box = $('#msgs');
    if (!d) { box.innerHTML = ''; renderedKey = null; return; }
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 80, prevTop = box.scrollTop;
    const parts = [];
    let lastDay = '';
    d.messages.forEach((m) => {
      let html = '';
      const dl = dayLabel(m.ts);
      if (dl !== lastDay) { html += '<div class="day">' + dl + '</div>'; lastDay = dl; }
      if (m.sys) { parts.push(html + '<div class="sys">' + esc(sysText(m)) + '</div>'); return; }
      const mine = m.from === me.id, nm = m.del ? t('deleted') : m.name;
      const more = '<button class="mm" type="button" aria-haspopup="true" aria-label="' + esc(t('msg_menu')) + '">' + IC.dots + '</button>';
      const avHtml = (!mine && m.from && info && (info.type === 'g' || info.type === 's')) ? '<span class="mav" data-uid="' + esc(m.from) + '">' + av({ kind: 'u', id: m.from, v: m.av || 0 }, nm, 'xs') + '</span>' : '';
      const pinBadge = m.pinned ? '<span class="pinb" title="' + esc(t('pin')) + '">📌</span>' : '';
      html += '<div class="m ' + (mine ? 'mine' : 'their') + (m.pinned ? ' pinned' : '') + (selected.has(m.id) ? ' sel' : '') + '" data-id="' + esc(m.id) + '">' +
        (selectMode ? '<label class="msel"><input type="checkbox" ' + (selected.has(m.id) ? 'checked' : '') + ' data-id="' + esc(m.id) + '"></label>' : '') +
        avHtml + (mine ? more : '') + '<div class="b' + (m.media ? ' media' : '') + '">' +
        (!mine && info && info.type === 'g' ? '<div class="sn" style="color:hsl(' + hue(nm) + ',60%,55%)" data-uid="' + esc(m.from || '') + '">' + esc(nm) + '</div>' : '') +
        pinBadge + (m.media ? mediaHtml(m.media) : '<span class="t">' + esc(m.text) + '</span>') +
        '<span class="tm">' + (m.edited ? '<i class="ed">' + esc(t('edited')) + '</i>' : '') + hm(m.ts) + '</span></div>' + (mine ? '' : more) + '</div>';
      parts.push(html);
    });
    // Если изменились только новые сообщения в конце, старые не трогаем: иначе воспроизведение сбросится
    const keep = renderedKey === cur && renderedHtml.length <= parts.length && renderedHtml.every((h, i) => h === parts[i]);
    if (!keep) box.innerHTML = parts.join('');
    else if (parts.length > renderedHtml.length) box.insertAdjacentHTML('beforeend', parts.slice(renderedHtml.length).join(''));
    const changed = !keep || parts.length !== renderedHtml.length;
    renderedHtml = parts;
    if (changed) box.scrollTop = forced || near || renderedKey !== cur ? box.scrollHeight : prevTop;
    renderedKey = cur;
    wireVideoPlayers(box);
    renderMembers();
  }

  function renderAll() {
    const has = !!me && chats.length > 0;
    $('#home').hidden = has; $('#greeting').hidden = !!me; $('#homeActions').hidden = !me || has;
    $('#app').hidden = !has; $('#gear').hidden = !(me && me.hasContacts);
    if (has) renderList();
    renderChat();
  }

  function loadChat() {
    const key = cur;
    return api('/api/chat?key=' + encodeURIComponent(key)).then((d) => { if (cur === key) chatData = d; }).catch((e) => {
      if (e.status === 404 && cur === key) { cur = null; chatData = null; if (dynKind === 'members') closeModal(); } else if (e.status !== 404) throw e;
    });
  }
  // Всплывающее сообщение, когда в вашу группу пришла новая заявка
  function notifyRequests() {
    const now = {};
    chats.forEach((c) => { if (c.reqs) now[c.key] = c.reqs; });
    if (prevReqs) for (const k of Object.keys(now)) if (now[k] > (prevReqs[k] || 0)) {
      const c = chats.find((x) => x.key === k); toast(t('new_req', { title: c.title }));
    }
    prevReqs = now;
  }
  function refresh(forceScroll) {
    if (!me) return Promise.resolve();
    if (forceScroll) scrollNext = true;
    if (busy) { again = true; return Promise.resolve(); }
    busy = true;
    return (cur ? loadChat() : Promise.resolve()).then(() => api('/api/state')).then((s) => { me = s.me; chats = s.chats; maxMb = s.maxMb || maxMb; notifyRequests(); renderAll(); })
      .catch((e) => { if (e.status === 401) { dropToken(); setAuthed(null); } })
      .then(() => { busy = false; if (again) { again = false; refresh(); } });
  }
  function openChat(key) {
    cancelEdit(); if (selectMode) exitSelect(); cur = key; chatData = null; $('#app').classList.add('chat-open'); $('#app').hidden = false;
    renderList(); renderChat(); refresh(true);
    setTimeout(() => { if (!$('#text').disabled && window.innerWidth > 760) $('#text').focus(); }, 50);
  }
  $('#back').addEventListener('click', () => { cancelEdit(); cur = null; chatData = null; renderAll(); });

  /* ---------- Меню чата, отправка ---------- */
  $('#dots').addEventListener('click', (e) => { e.stopPropagation(); $('#fabMenu').classList.remove('open'); $('#dotsMenu').classList.toggle('open'); });
  $('#fab').addEventListener('click', (e) => { e.stopPropagation(); $('#dotsMenu').classList.remove('open'); $('#fabMenu').classList.toggle('open'); });
  $('#dotsMenu').addEventListener('click', (e) => {
    const b = e.target.closest('button'), info = chatData && chatData.info; if (!b || !info) return;
    const a = b.dataset.a, fin = (p) => p.then(() => refresh()).catch((er) => toast(netMsg(er)));
    if (a === 'addc') fin(api('/api/contacts/add', { userId: info.user.id }));
    else if (a === 'block' || a === 'unblock') fin(api('/api/block', { userId: info.user.id, block: a === 'block' }));
    else if (a === 'members') openMembers();
    else if (a === 'gset') openGroupSettings();
    else if (a === 'leave' && confirm(t('c_leave'))) fin(api('/api/groups/leave', { group: info.id }));
    else if (a === 'call') { closePops(); openCallUI(info.user, 'out'); }
    else if (a === 'videocall') { closePops(); joinGroupCall(info); }
  });
  $('#who').addEventListener('click', () => {
    if (!$('#who').classList.contains('click') || !chatData) return;
    const info = chatData.info;
    if (info.type === 'g') openMembers();
    else if (info.type === 'u') showUserProfile(info.user, info.contact);
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    ({ contact: openAddContact, newgroup: openCreateGroup, joingroup: openJoin })[b.dataset.act]();
  });
  $('#gear').addEventListener('click', openProfile);

  const ta = $('#text');
  const autosize = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; syncSendMic(); };
  function syncSendMic() { const has = !!ta.value.trim() || !!editing; $('#send').hidden = !has; $('#mic').hidden = has; }
  syncSendMic();
  function send() {
    const v = ta.value.trim(); if (!v || !cur || ta.disabled) return;
    if (editing) return saveEdit(v);
    ta.value = ''; autosize();
    api('/api/send', { chat: cur, text: v }).then(() => refresh(true)).catch((e) => { toast(netMsg(e)); ta.value = v; });
  }
  ta.addEventListener('input', autosize);
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
    else if (e.key === 'Escape' && editing) { e.stopPropagation(); cancelEdit(); }
  });

  /* ---------- Действия с сообщением: изменить / удалить ---------- */
  function canDelete(m, info) {
    if (!m.from || !info) return false;
    // Личный чат и Избранное — любой участник может удалить любое сообщение
    if (info.type === 'u' || info.type === 's') return true;
    // В группе — только админ или владелец
    if (info.role === 'member') return false;
    const s = info.members.find((u) => u.id === m.from), role = s ? s.role : 'member';
    // Владелец может всё; админ — только сообщения обычных участников
    if (info.role === 'owner') return true;
    return role === 'member';
  }
  function syncAttach(blocked) {
    if (blocked === undefined) { const i = chatData && chatData.info; blocked = !!i && i.type === 'u' && i.blocked; }
    $('#attach').disabled = blocked || !!uploading || !!editing; $('#mic').disabled = blocked || !!uploading;
  }
  function closeMsgMenu() {
    const el = $('#msgMenu'); if (el) el.classList.remove('open');
    $$('.mm.on').forEach((b) => b.classList.remove('on')); menuMsg = null;
  }
  function openMsgMenu(btn, m) {
    closePops(); menuMsg = m.id; btn.classList.add('on');
    const el = $('#msgMenu'), items = [], info = chatData && chatData.info;
    if (m.from === me.id && !m.media) items.push(['edit', t('edit')]);
    items.push(['fwd', t('forward')]);
    items.push(['save', t('save_fav')]);
    const canPin = !info || info.type === 's' || info.type === 'u' || (info.type === 'g' && info.role !== 'member');
    if (canPin) items.push([m.pinned ? 'unpin' : 'pin', m.pinned ? t('unpin') : t('pin')]);
    items.push(['sel', t('select')]);
    if (canDelete(m, info)) items.push(['del', t('del'), 1]);
    el.innerHTML = items.map((i) => '<button type="button" role="menuitem" data-a="' + i[0] + '"' + (i[2] ? ' class="danger"' : '') + '>' + esc(i[1]) + '</button>').join('');
    const r = btn.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight, mine = m.from === me.id;
    let x = mine ? r.right - w : r.left, y = r.bottom + 4;
    x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
    if (y + h > window.innerHeight - 8) y = Math.max(8, r.top - h - 4);
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.classList.add('open');
  }
  $('#msgs').addEventListener('click', (e) => {
    if (selectMode) {
      const cb = e.target.closest('.msel input');
      if (cb) {
        if (cb.checked) selected.add(cb.dataset.id); else selected.delete(cb.dataset.id);
        const cnt = $('#selCnt'); if (cnt) cnt.textContent = t('selected', { n: selected.size });
        const row = cb.closest('.m'); if (row) row.classList.toggle('sel', cb.checked);
        return;
      }
    }
    const b = e.target.closest('.mm');
    if (b) {
      e.stopPropagation();
      const id = b.closest('.m').dataset.id, m = chatData && chatData.messages.find((x) => x.id === id);
      if (!m) return;
      if (menuMsg === id) return closeMsgMenu();
      openMsgMenu(b, m);
      return;
    }
    const uidEl = e.target.closest('[data-uid]');
    if (uidEl && uidEl.dataset.uid) {
      const uid = uidEl.dataset.uid;
      let u = null;
      if (chatData && chatData.info && chatData.info.type === 'g') u = chatData.info.members.find((x) => x.id === uid) || null;
      else if (chatData && chatData.info && chatData.info.type === 'u' && chatData.info.user.id === uid) u = chatData.info.user;
      if (u) showUserProfile(u, !!u.contact);
    }
  });
  $('#msgMenu').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !menuMsg) return;
    const id = menuMsg, m = chatData && chatData.messages.find((x) => x.id === id), a = b.dataset.a;
    closeMsgMenu();
    if (!m) return;
    if (a === 'edit') startEdit(m);
    else if (a === 'del' && confirm(t(m.media ? 'c_del_file' : 'c_del_msg'))) {
      if (editing && editing.id === id) cancelEdit();
      api('/api/message/delete', { chat: cur, id }).then(() => refresh()).catch((er) => { toast(netMsg(er)); refresh(); });
    } else if (a === 'pin' || a === 'unpin') {
      api('/api/message/pin', { chat: cur, id: a === 'pin' ? id : null, unpin: a === 'unpin' }).then(() => { toast(t(a === 'pin' ? 'pin_msg' : 'unpin_msg')); refresh(); }).catch((er) => toast(netMsg(er)));
    } else if (a === 'fwd') {
      showForwardPicker([id]);
    } else if (a === 'save') {
      api('/api/message/save', { chat: cur, id }).then(() => toast(t('save_ok'))).catch((er) => toast(netMsg(er)));
    } else if (a === 'sel') {
      selectMode = true; selected = new Set([id]); renderChat(); showSelBar();
    }
  });
  function startEdit(m) {
    editing = { id: m.id, text: m.text };
    ta.value = m.text; autosize(); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    $('#editTxt').textContent = m.text.length > 80 ? m.text.slice(0, 80) + '…' : m.text;
    $('#editbar').hidden = false; $('#send').innerHTML = IC.check; $('#send').setAttribute('aria-label', t('save_edit'));
    syncAttach();
  }
  function cancelEdit() {
    if (!editing) return;
    editing = null; ta.value = ''; autosize();
    $('#editbar').hidden = true; $('#send').innerHTML = IC.send; $('#send').setAttribute('aria-label', t('send'));
    syncAttach();
  }
  function showSelBar() {
    let bar = $('#selbar');
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'selbar'; bar.className = 'selbar';
      bar.innerHTML = '<span id="selCnt"></span><div class="selacts"><button type="button" id="selFwd">' + esc(t('fwd_selected')) + '</button><button type="button" class="danger" id="selDel">' + esc(t('del_selected')) + '</button><button type="button" id="selCancel">' + esc(t('cancel')) + '</button></div>';
      $('#chatIn').appendChild(bar);
      $('#selFwd').addEventListener('click', () => { if (selected.size) showForwardPicker([...selected]); });
      $('#selDel').addEventListener('click', () => {
        if (!selected.size || !confirm(t('c_del_sel'))) return;
        api('/api/message/delete', { chat: cur, ids: [...selected] }).then(() => { exitSelect(); refresh(); }).catch((er) => { toast(netMsg(er)); refresh(); });
      });
      $('#selCancel').addEventListener('click', exitSelect);
    }
    bar.hidden = false;
    $('#selCnt').textContent = t('selected', { n: selected.size });
    $('#composer').hidden = true; $('#editbar').hidden = true;
  }
  function exitSelect() {
    selectMode = false; selected = new Set();
    const bar = $('#selbar'); if (bar) bar.hidden = true;
    $('#composer').hidden = false;
    renderChat();
  }
  function showForwardPicker(ids) {
    const list = chats.filter((c) => c.key !== cur).map((c) =>
      '<button type="button" class="fwd-item" data-k="' + esc(c.key) + '">' + av(c.avatar, c.title, 'xs') + '<span>' + esc(c.title) + '</span></button>').join('');
    const m = dyn(head(t('choose_chat')) + '<div class="fwd-list">' + list + '</div>');
    m.addEventListener('click', (e) => {
      const b = e.target.closest('.fwd-item'); if (!b) return;
      closeModal();
      api('/api/message/forward', { from: cur, to: b.dataset.k, ids }).then((r) => { toast(t('fwd_ok', { n: r.count })); exitSelect(); }).catch((er) => toast(netMsg(er)));
    });
  }
  function ageFromBd(bd) {
    if (!bd) return null;
    const d = new Date(bd + 'T00:00:00'), now = new Date();
    let a = now.getFullYear() - d.getFullYear();
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--;
    return a >= 0 ? a : null;
  }
  function showUserProfile(u, isContact) {
    const age = ageFromBd(u.birthday);
    const bdStr = u.birthday ? I18N.fmtDate(new Date(u.birthday + 'T00:00:00')) + (age != null ? ' (' + t('years', { n: age }) + ')' : '') : '';
    const rows = [];
    if (u.bio) rows.push('<div class="prow"><div class="plbl">' + esc(t('bio')) + '</div><div class="pval">' + esc(u.bio) + '</div></div>');
    rows.push('<div class="prow"><div class="plbl">' + esc(t('username')) + '</div><div class="pval">@' + esc(u.nick) + '</div></div>');
    if (bdStr) rows.push('<div class="prow"><div class="plbl">' + esc(t('birthday')) + '</div><div class="pval">' + esc(bdStr) + '</div></div>');
    const isSelf = me && u.id === me.id;
    const callBtns = isSelf ? '' :
      '<div class="p-call-btns">' +
        '<button type="button" class="p-call-btn" id="p-call-audio" title="' + esc(t('call')) + '">' +
          '<span class="p-call-ico"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V21a1 1 0 0 1-1 1A17 17 0 0 1 3 5a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .57 3.6 1 1 0 0 1-.25 1L6.6 10.8z"/></svg></span>' +
          '<span>' + esc(t('call')) + '</span></button>' +
        '<button type="button" class="p-call-btn" id="p-call-video" title="' + esc(t('call_video_full') || t('call_video')) + '">' +
          '<span class="p-call-ico"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/></svg></span>' +
          '<span>' + esc(t('call_video_full') || 'Видео') + '</span></button>' +
      '</div>';
    const html = '<div class="profile-view">' +
      '<div class="phead">' + av({ kind: 'u', id: u.id, v: u.av }, u.name, 'lg') +
      '<div class="pname">' + esc(u.name) + '</div>' +
      '<div class="pstatus">' + stHtml(u) + '</div>' + callBtns + '</div>' +
      '<div class="prows">' + rows.join('') + '</div>' +
      (isSelf ? '' : '<div class="pacts"><button type="button" class="link-btn" id="p-edit-local">' + esc(t('edit_contact')) + '</button></div>') +
      '</div>';
    const m = dyn(html, 'profile');
    const editBtn = $('#p-edit-local', m);
    if (editBtn) editBtn.addEventListener('click', () => showLocalEdit(u));
    const ba = $('#p-call-audio', m), bv = $('#p-call-video', m);
    if (ba) ba.addEventListener('click', () => { closeModal(); openCallUI(u, 'out'); /* audio: video off by default in UI */ });
    if (bv) bv.addEventListener('click', () => {
      closeModal();
      // open pre-call with video already on, then user can call
      showCallScreen(u, 'out', { video: true });
    });
  }
  function showLocalEdit(u) {
    const curName = u.name;
    const m = dyn(head(t('edit_contact')) + avatarPicker() + field('lc-name', t('local_name'), curName, 'maxlength="40"') +
      '<p class="hint">' + esc(t('local_hint')) + '</p><p class="form-error"></p>' +
      '<div class="actions"><button class="link-btn" type="button" id="lc-save">' + esc(t('save')) + '</button>' +
      '<button class="link-btn" type="button" id="lc-clear">' + esc(t('clear_override')) + '</button></div>');
    const getAv = wirePicker(m, { kind: 'u', id: u.id, v: u.av }, () => $('#lc-name', m).value || u.name, () => {});
    $('#lc-save', m).addEventListener('click', () => {
      act(m, $('#lc-save', m), () => api('/api/contact/override', { userId: u.id, name: $('#lc-name', m).value, avatar: getAv() })
        .then((r) => { closeModal(); refresh(); toast(t('save_changes')); }));
    });
    $('#lc-clear', m).addEventListener('click', () => {
      act(m, $('#lc-clear', m), () => api('/api/contact/override', { userId: u.id, clear: true })
        .then(() => { closeModal(); refresh(); }));
    });
  }
  function saveEdit(v) {
    const ed = editing;
    if (v === ed.text) return cancelEdit();
    $('#send').disabled = true;
    api('/api/message/edit', { chat: cur, id: ed.id, text: v })
      .then(() => { if (editing === ed) cancelEdit(); refresh(); })
      .catch((e) => { toast(netMsg(e)); if (e.status === 404 && editing === ed) cancelEdit(); })
      .then(() => { $('#send').disabled = false; });
  }
  $('#editCancel').addEventListener('click', cancelEdit);
  window.addEventListener('resize', closeMsgMenu);
  $('#send').addEventListener('click', send);
  let stick = true;
  $('#msgs').addEventListener('scroll', (e) => { closeMsgMenu(); const b = e.target; stick = b.scrollHeight - b.scrollTop - b.clientHeight < 80; });
  $('#msgs').addEventListener('load', (e) => { if (stick && e.target.tagName === 'IMG') e.currentTarget.scrollTop = e.currentTarget.scrollHeight; }, true);

  /* ---------- Загрузка файлов (любых, до maxMb) ---------- */
  const EXT = {
    mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', heic: 'image/heic', heif: 'image/heif',
    mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska',
    avi: 'video/x-msvideo', wmv: 'video/x-ms-wmv', flv: 'video/x-flv', '3gp': 'video/3gpp', '3g2': 'video/3gpp2',
    mpeg: 'video/mpeg', mpg: 'video/mpeg', ts: 'video/mp2t', mts: 'video/mp2t', m2ts: 'video/mp2t', ogv: 'video/ogg'
  };
  const fileInput = $('#mediaFile'), upbar = $('#upbar');
  function upload(file, extra) {
    extra = extra || {};
    if (!file || !(extra.key || cur) || uploading) return;
    const type = file.type || EXT[(file.name.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';
    if (!file.size) return toast(t('err.empty'));
    if (file.size > maxMb * 1048576) return toast(t('err.media_big', { mb: maxMb }));
    const key = extra.key || cur, xhr = new XMLHttpRequest();
    uploading = xhr; syncAttach(); upbar.hidden = false; $('#upTxt').textContent = t('uploading', { p: 0 });
    const end = () => { uploading = null; upbar.hidden = true; syncAttach(); fileInput.value = ''; };
    xhr.open('POST', '/api/upload?chat=' + encodeURIComponent(key) + '&name=' + encodeURIComponent(file.name) + (extra.voice ? '&voice=1&dur=' + Math.round(extra.dur || 0) : ''));
    xhr.setRequestHeader('X-Session', token || ''); xhr.setRequestHeader('Content-Type', type);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) $('#upTxt').textContent = t('uploading', { p: Math.round(e.loaded / e.total * 100) }); };
    xhr.onload = () => {
      end();
      if (xhr.status === 200) return refresh(true);
      let d = {}; try { d = JSON.parse(xhr.responseText); } catch (e) {}
      toast(netMsg({ fromServer: true, code: d.code, params: d.params, message: d.error }));
    };
    xhr.onerror = () => { end(); toast(t('err.upload')); };
    xhr.onabort = () => end();
    xhr.send(file);
  }
  $('#attach').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => upload(fileInput.files[0]));
  $('#upCancel').addEventListener('click', () => { if (uploading) uploading.abort(); });


  /* ---------- Голосовые сообщения: удерживайте кнопку — идёт запись, отпустили — отправилось ---------- */
  const mic = $('#mic'), recUi = $('#recUi'), composerEl = $('#composer');
  const VM_MAX = 300, VM_MIN = 0.7, VM_CANCEL_PX = 90;
  let rec = null;
  const pickMime = () => {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
    return ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
  };
  function micErr(e) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) return window.isSecureContext === false ? t('call_need_https') : t('call_unsupported');
    const n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return t('vm_denied');
    if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError') return t('call_no_device');
    if (n === 'NotReadableError' || n === 'TrackStartError' || n === 'AbortError') return t('call_device_busy');
    return t('call_media_err');
  }
  function recUiOff() {
    composerEl.classList.remove('recording', 'armed'); mic.classList.remove('hold');
    $('#recHint').style.transform = ''; $('#recTime').textContent = '0:00';
  }
  function recTick() {
    if (!rec || rec.state !== 'recording') return;
    const sec = (Date.now() - rec.t0) / 1000;
    $('#recTime').textContent = fmtMediaTime(sec);
    if (sec >= VM_MAX) recStop(false); // предел длины: отправляем то, что записано
  }
  async function recStart(e) {
    if (rec || mic.disabled || !cur) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) return toast(micErr());
    const r = rec = { holding: true, state: 'starting', startX: e && e.clientX != null ? e.clientX : 0, armed: false, chunks: [], key: cur };
    mic.classList.add('hold');
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (err) { if (rec === r) { rec = null; recUiOff(); } toast(micErr(err)); return; }
    if (rec !== r) { stream.getTracks().forEach((tr) => tr.stop()); return; }
    if (!r.holding) { stream.getTracks().forEach((tr) => tr.stop()); rec = null; recUiOff(); toast(t('vm_hold')); return; } // отпустили, пока шёл запрос разрешения
    let mr;
    const mime = pickMime();
    try { mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); }
    catch (err) { stream.getTracks().forEach((tr) => tr.stop()); rec = null; recUiOff(); toast(micErr(err)); return; }
    r.stream = stream; r.mr = mr; r.mime = mr.mimeType || mime || 'audio/webm';
    mr.ondataavailable = (ev) => { if (ev.data && ev.data.size) r.chunks.push(ev.data); };
    mr.onstop = () => recFinish(r);
    mr.start(250);
    r.state = 'recording'; r.t0 = Date.now();
    composerEl.classList.add('recording'); $('#recHint').textContent = t('vm_slide');
    r.timer = setInterval(recTick, 200); recTick();
    try { if (navigator.vibrate) navigator.vibrate(15); } catch (_) {}
  }
  function recStop(cancel) {
    const r = rec; if (!r) return;
    r.holding = false;
    if (r.state === 'starting') { if (cancel) { rec = null; recUiOff(); } return; }
    if (r.state !== 'recording') return;
    r.state = 'stopping'; r.cancel = !!cancel; r.dur = (Date.now() - r.t0) / 1000;
    clearInterval(r.timer);
    try { r.mr.stop(); } catch (_) { recFinish(r); }
  }
  function recFinish(r) {
    if (r.done) return; r.done = true;
    r.stream.getTracks().forEach((tr) => tr.stop());
    if (rec === r) rec = null;
    recUiOff();
    if (r.cancel) return;
    if (r.dur < VM_MIN) return toast(t('vm_hold'));
    const blob = new Blob(r.chunks, { type: r.mime });
    if (!blob.size) return;
    const ext = /mp4|aac/.test(r.mime) ? 'm4a' : /ogg/.test(r.mime) ? 'ogg' : 'webm';
    const d = new Date(), p2 = (n) => String(n).padStart(2, '0');
    const name = 'voice-' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + p2(d.getHours()) + p2(d.getMinutes()) + p2(d.getSeconds()) + '.' + ext;
    upload(new File([blob], name, { type: r.mime }), { voice: true, dur: r.dur, key: r.key });
  }
  mic.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    try { mic.setPointerCapture(e.pointerId); } catch (_) {}
    recStart(e);
  });
  mic.addEventListener('pointermove', (e) => {
    if (!rec) return;
    const dx = rec.startX - e.clientX;
    rec.armed = dx > VM_CANCEL_PX;
    composerEl.classList.toggle('armed', rec.armed);
    $('#recHint').textContent = t(rec.armed ? 'vm_release' : 'vm_slide');
    $('#recHint').style.transform = dx > 0 ? 'translateX(' + (-Math.min(dx, 140)) + 'px)' : '';
  });
  mic.addEventListener('pointerup', () => { if (rec) recStop(rec.armed); });
  mic.addEventListener('pointercancel', () => recStop(true));
  mic.addEventListener('lostpointercapture', () => { if (rec && rec.holding) recStop(true); });
  mic.addEventListener('contextmenu', (e) => e.preventDefault());
  mic.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); recStart(); } });
  mic.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); recStop(false); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && rec) recStop(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && rec) recStop(true); });

  // Плеер голосового сообщения (делегирование: сообщения перерисовываются, а воспроизведение не прерывается)
  const msgsEl = $('#msgs');
  const voiceOf = (el) => el && el.closest ? el.closest('.voice') : null;
  const voiceDur = (v, a) => (a && isFinite(a.duration) && a.duration > 0 ? a.duration : Number(v.dataset.dur) || 0);
  function voiceDraw(v, a) {
    const dur = voiceDur(v, a), cur = a.currentTime || 0, bars = $$('.vo-bars i', v);
    const on = dur ? Math.round(cur / dur * bars.length) : 0;
    bars.forEach((b, i) => b.classList.toggle('on', i < on));
    $('.vo-time', v).textContent = fmtMediaTime(a.paused && !cur ? dur : cur);
  }
  msgsEl.addEventListener('click', (e) => {
    const v = voiceOf(e.target); if (!v) return;
    const a = $('audio', v);
    if (e.target.closest('.vo-play')) { a.paused ? a.play().catch((err) => { if (err && err.name === 'AbortError') return; toast(t('vm_play_err')); }) : a.pause(); }
    else if (e.target.closest('.vo-speed')) {
      const rates = [1, 1.5, 2], n = rates[(rates.indexOf(a.playbackRate) + 1) % rates.length];
      a.playbackRate = n; e.target.closest('.vo-speed').textContent = n + '×';
    } else if (e.target.closest('.vo-bars')) {
      const r = e.target.closest('.vo-bars').getBoundingClientRect(), dur = voiceDur(v, a);
      if (dur) { a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur; voiceDraw(v, a); }
    }
  });
  msgsEl.addEventListener('play', (e) => {
    const a = e.target; if (!a || a.tagName !== 'AUDIO' || !voiceOf(a)) return;
    voiceOf(a).classList.add('playing');
    $$('audio, video').forEach((o) => { if (o !== a) o.pause(); }); // одновременно играет что-то одно
  }, true);
  msgsEl.addEventListener('pause', (e) => { const v = voiceOf(e.target); if (v && e.target.tagName === 'AUDIO') { v.classList.remove('playing'); voiceDraw(v, e.target); } }, true);
  msgsEl.addEventListener('ended', (e) => {
    const v = voiceOf(e.target); if (!v || e.target.tagName !== 'AUDIO') return;
    v.classList.remove('playing'); e.target.currentTime = 0; voiceDraw(v, e.target);
  }, true);
  msgsEl.addEventListener('timeupdate', (e) => {
    const a = e.target, v = voiceOf(a); if (!v || a.tagName !== 'AUDIO') return;
    if (a._fix) { if (isFinite(a.duration)) { a._fix = false; a.currentTime = 0; } return; }
    voiceDraw(v, a);
  }, true);
  // у записей из Chrome в заголовке нет длительности: заставляем браузер её посчитать
  msgsEl.addEventListener('loadedmetadata', (e) => {
    const a = e.target; if (a.tagName !== 'AUDIO' || !voiceOf(a)) return;
    if (a.duration === Infinity) { a._fix = true; a.currentTime = 1e101; } else voiceDraw(voiceOf(a), a);
  }, true);

  /* ---------- Звонки (WebRTC) ---------- */
  let callState = null; // { id, role, peer, video, pc, localStream, remoteStream }
  let iceServers = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  function loadIce() { api('/api/ice').then((d) => { if (d && Array.isArray(d.iceServers) && d.iceServers.length) iceServers = d.iceServers; }).catch(() => {}); }

  /* Камера и микрофон доступны только на защищённом адресе (https:// или localhost).
     По http://192.168.x.x на телефоне navigator.mediaDevices просто не существует. */
  const hasMedia = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.RTCPeerConnection);
  function mediaErrMsg(e) {
    if (e && e.fromServer) return netMsg(e);
    if (!hasMedia()) return window.isSecureContext === false ? t('call_need_https') : t('call_unsupported');
    const n = e && e.name;
    if (n === 'NotFoundError' || n === 'OverconstrainedError' || n === 'DevicesNotFoundError') return t('call_no_device');
    if (n === 'NotReadableError' || n === 'TrackStartError' || n === 'AbortError') return t('call_device_busy');
    return t('call_media_err') + (n ? ' (' + n + ')' : '');
  }
  const canShareScreen = () => !!(window.ScreenShare && window.ScreenShare.supported()); // логика — в screenshare.js

  function ensureCallOverlay() {
    let el = $('#callOverlay');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'callOverlay';
    el.className = 'call-overlay';
    el.hidden = true;
    el.innerHTML =
      '<div class="call-screen" id="callBox">' +
        '<div class="call-avatar" id="callAv"></div>' +
        '<div class="call-name" id="callName"></div>' +
        '<div class="call-hint" id="callHint"></div>' +
        '<div class="call-videos" id="callVideos" hidden>' +
          '<video id="callRemote" autoplay playsinline></video>' +
          '<video id="callRemoteCam" autoplay playsinline hidden></video>' +
          '<div class="call-ph" id="callRemotePh"></div>' +
          '<video id="callLocal" autoplay playsinline muted hidden></video>' +
        '</div>' +
        '<div class="call-actions" id="callActions"></div>' +
      '</div>';
    document.body.appendChild(el);
    return el;
  }

  /* Что именно собеседник сейчас передаёт, сообщаем отдельным сигналом: на принимающей стороне
     отличить экран от камеры по самому треку нельзя (у удалённого трека нет displaySurface). */
  function callSignal(sig) {
    if (!callState || !callState.id) return Promise.resolve();
    return api('/api/call/signal', { callId: callState.id, signal: sig }).catch(() => {});
  }
  const trackLive = (tr) => !!tr && tr.readyState === 'live';
  function getCameraTrack() {
    if (!callState) return null;
    return callState.camTrack || (callState.localStream && callState.localStream.getVideoTracks()[0]) || null;
  }
  function sendMeta() {
    if (!callState) return Promise.resolve();
    const cam = getCameraTrack();
    return callSignal({ type: 'meta',
      camStream: callState.localStream ? callState.localStream.id : null,
      screenStream: callState.screenStream ? callState.screenStream.id : null,
      cam: trackLive(cam) && cam.enabled, screen: trackLive(callState.screenTrack) });
  }

  async function renegotiate() {
    if (!callState || !callState.pc || !callState.id) return;
    const pc = callState.pc;
    if (pc.signalingState !== 'stable') { callState.needNeg = true; return; } // повторим, когда придёт ответ
    try {
      callState.making = true;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await api('/api/call/signal', { callId: callState.id, signal: { type: 'offer', sdp: pc.localDescription } });
    } catch (e) {
      console.warn('renegotiate', e);
    } finally {
      if (callState) callState.making = false;
    }
  }
  async function flushIce() {
    if (!callState || !callState.pc) return;
    const q = callState.pendingIce || []; callState.pendingIce = [];
    for (const c of q) { try { await callState.pc.addIceCandidate(c); } catch (_) {} }
  }

  // Моё превью (справа снизу): камера, а если её нет или она выключена — экран
  function updateLocalPreview() {
    const local = $('#callLocal');
    if (!local) return;
    const cam = getCameraTrack();
    let tr = null;
    if (trackLive(cam) && cam.enabled) tr = cam;
    else if (callState && trackLive(callState.screenTrack)) tr = callState.screenTrack;
    if (tr) {
      if (local._tr !== tr) { local.srcObject = new MediaStream([tr]); local._tr = tr; }
      local.hidden = false;
      local.play && local.play().catch(() => {});
    } else { local.srcObject = null; local._tr = null; local.hidden = true; }
  }

  // Картинка собеседника: если идёт и экран, и камера — экран на весь фон, камера уменьшается в левый нижний угол
  function layoutRemoteVideos() {
    const main = $('#callRemote'), camEl = $('#callRemoteCam'), box = $('#callVideos');
    if (!main || !camEl || !callState) return;
    const meta = callState.meta || {}, rs = callState.rstreams || {}, ids = Object.keys(rs);
    const live = (st, kind) => (st ? st.getTracks().filter((tr) => tr.kind === kind && tr.readyState === 'live') : []);
    let camS = meta.camStream ? rs[meta.camStream] : null;
    const scrS = meta.screenStream ? rs[meta.screenStream] : null;
    if (!meta.camStream) camS = rs[ids.find((id) => id !== meta.screenStream)]; // метаданных ещё нет — считаем потоком камеры
    const screenT = meta.screen ? live(scrS, 'video')[0] : null;
    const camT = meta.cam === false ? null : live(camS, 'video')[0];
    const audio = live(camS, 'audio');
    const mainVid = screenT || camT || null, pip = screenT && camT ? camT : null;
    const key = (arr) => arr.filter(Boolean).map((x) => x.id).join('+');

    const mk = key([mainVid, ...audio]);
    if (callState.mainKey !== mk) {
      callState.mainKey = mk;
      main.srcObject = mk ? new MediaStream([mainVid, ...audio].filter(Boolean)) : null;
      main.play && main.play().catch(() => {});
    }
    const pk = key([pip]);
    if (callState.pipKey !== pk) {
      callState.pipKey = pk;
      camEl.srcObject = pip ? new MediaStream([pip]) : null;
      if (pip) camEl.play && camEl.play().catch(() => {});
    }
    camEl.hidden = !pip;
    box.classList.toggle('novid', !mainVid);
  }

  async function toggleMic() {
    const track = callState && callState.localStream && callState.localStream.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled; // только микрофон: больше ничего не затрагивается
    setCallBtn($('#callMuteMic'), 'mic', track.enabled);
  }

  async function toggleCam() {
    if (!callState || !callState.pc) return;
    const btn = $('#callMuteCam');
    try {
      let cam = getCameraTrack();
      if (trackLive(cam)) {
        cam.enabled = !cam.enabled; // только камера: включить / выключить
      } else {
        // в звонке без видео камеры ещё нет — берём её один раз и добавляем в соединение
        if (!hasMedia()) throw new Error('no-media');
        const vs = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
        cam = vs.getVideoTracks()[0];
        if (!cam) throw new Error('no video track');
        if (!callState.localStream) callState.localStream = new MediaStream();
        callState.localStream.addTrack(cam);
        callState.camTrack = cam;
        await sendMeta();
        callState.pc.addTrack(cam, callState.localStream);
        await renegotiate();
      }
      callState.video = cam.enabled;
      setCallBtn(btn, 'cam', cam.enabled);
      updateLocalPreview();
      sendMeta();
    } catch (e) {
      console.warn('toggle cam', e);
      toast(mediaErrMsg(e));
    }
  }

  async function stopScreenShare() {
    if (!callState || !callState.screenTrack) return;
    const track = callState.screenTrack, sender = callState.screenSender;
    try { track.stop(); } catch (_) {}
    callState.screenTrack = null; callState.screenStream = null; callState.screenSender = null;
    const btn = $('#callShare');
    if (btn) btn.classList.remove('on');
    await sendMeta(); // собеседник сразу вернёт камеру на весь экран
    if (sender && callState.pc) {
      try { callState.pc.removeTrack(sender); await renegotiate(); } catch (e) { console.warn('stop screen', e); }
    }
    updateLocalPreview();
    const hint = $('#callHint');
    if (hint) hint.textContent = t('call_active');
  }

  async function toggleScreenShare() {
    if (!callState || !callState.pc) return;
    const btn = $('#callShare');
    try {
      if (callState.screenTrack) { await stopScreenShare(); return; }
      const { stream, track } = await ScreenShare.start({ cursor: 'always', onEnded: () => { stopScreenShare(); } });
      callState.screenTrack = track; callState.screenStream = stream;
      await sendMeta(); // сначала сообщаем, что новый поток — это экран
      // экран идёт отдельным потоком, камера и микрофон не трогаются
      callState.screenSender = callState.pc.addTrack(track, stream);
      await renegotiate();
      updateLocalPreview();
      if (btn) btn.classList.add('on');
      const hint = $('#callHint');
      if (hint) hint.textContent = t('call_screen_on');
    } catch (e) {
      console.warn('screen share', e);
      if (e && e.name !== 'NotAllowedError') toast(t('call_screen_err'));
    }
  }

  // Кнопки микрофона и камеры: «on» — включено; в выключенном виде значок перечёркнут и красный
  const CALL_ICO = {
    mic: '<path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z"/><path d="M19 11a7 7 0 0 1-14 0M12 18v4"/>',
    cam: '<path d="M23 7l-7 5 7 5z"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
  };
  function setCallBtn(btn, kind, on) {
    if (!btn) return;
    btn.classList.add('tg'); btn.classList.toggle('on', !!on); btn.setAttribute('aria-pressed', !!on);
    const sv = $('svg', btn);
    if (sv) {
      sv.setAttribute('fill', 'none'); sv.setAttribute('stroke', 'currentColor'); sv.setAttribute('stroke-width', '2');
      sv.setAttribute('stroke-linecap', 'round'); sv.setAttribute('stroke-linejoin', 'round');
      sv.innerHTML = CALL_ICO[kind] + (on ? '' : '<path d="M3 3l18 18"/>');
    }
  }

  function showCallScreen(peer, mode, opts) {
    // mode: 'out' | 'in' | 'active'
    const el = ensureCallOverlay();
    el.hidden = false;
    const elScreen = $('#callBox');
    if (elScreen && mode !== 'active') elScreen.classList.remove('call-active');
    $('#callAv').innerHTML = av({ kind: 'u', id: peer.id, v: peer.av || 0 }, peer.name, 'lg');
    $('#callName').textContent = peer.name || ('@' + peer.nick);
    const videos = $('#callVideos');
    const hint = $('#callHint');
    const acts = $('#callActions');
    videos.hidden = mode !== 'active';
    if (mode === 'out') {
      hint.textContent = t('call_hint_video');
      const vidOn = !!(opts && opts.video);
      acts.innerHTML =
        '<button type="button" class="call-btn blue' + (vidOn ? ' on' : '') + '" id="callToggleVid" title="' + esc(t('call_video')) + '">' +
          '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/></svg>' +
          '<span>' + esc(t('call_video')) + '</span></button>' +
        '<button type="button" class="call-btn gray" id="callCancel" title="' + esc(t('call_cancel')) + '">' +
          '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.3 5.71L12 12.01l-6.3-6.3-1.4 1.42 6.29 6.29-6.3 6.3 1.42 1.4 6.29-6.29 6.3 6.3 1.4-1.42-6.29-6.29 6.3-6.3z"/></svg>' +
          '<span>' + esc(t('call_cancel')) + '</span></button>' +
        '<button type="button" class="call-btn blue" id="callStart" title="' + esc(t('call_do')) + '">' +
          '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V21a1 1 0 0 1-1 1A17 17 0 0 1 3 5a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .57 3.6 1 1 0 0 1-.25 1L6.6 10.8z"/></svg>' +
          '<span>' + esc(t('call_do')) + '</span></button>';
      let wantVideo = vidOn;
      $('#callToggleVid').onclick = () => {
        wantVideo = !wantVideo;
        $('#callToggleVid').classList.toggle('on', wantVideo);
      };
      $('#callCancel').onclick = () => closeCallUI(true);
      $('#callStart').onclick = () => startOutgoingCall(peer, wantVideo);
    } else if (mode === 'in') {
      hint.textContent = (opts && opts.video) ? t('call_incoming_video') : t('call_incoming_audio');
      acts.innerHTML =
        '<button type="button" class="call-btn green" id="callAccept" title="' + esc(t('call_accept')) + '">' +
          '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V21a1 1 0 0 1-1 1A17 17 0 0 1 3 5a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .57 3.6 1 1 0 0 1-.25 1L6.6 10.8z"/></svg>' +
          '<span>' + esc(t('call_accept')) + '</span></button>' +
        '<button type="button" class="call-btn red call-btn-img" id="callReject" title="' + esc(t('call_reject')) + '">' +
          '<img src="/call-end.png" alt="" width="56" height="56">' +
          '<span>' + esc(t('call_reject')) + '</span></button>';
      $('#callAccept').onclick = () => acceptIncomingCall(!!(opts && opts.video));
      $('#callReject').onclick = () => rejectIncomingCall();
    } else {
      // active call — modern video chat controls
      const elScreen = $('#callBox');
      if (elScreen) elScreen.classList.add('call-active');
      $('#callRemotePh').innerHTML = av({ kind: 'u', id: peer.id, v: peer.av || 0 }, peer.name, 'lg') + '<div>' + esc(peer.name || ('@' + peer.nick)) + '</div>';
      hint.textContent = callState && callState.screenTrack ? t('call_screen_on') : t('call_active');
      const micOn = !(callState && callState.localStream && callState.localStream.getAudioTracks()[0] && !callState.localStream.getAudioTracks()[0].enabled);
      const camOn = !!(callState && callState.video);
      const scrOn = !!(callState && callState.screenTrack);
      acts.innerHTML =
        '<button type="button" class="call-btn gray' + (micOn ? ' on' : '') + '" id="callMuteMic" title="' + esc(t('call_mic')) + '">' +
          '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>' +
          '<span>' + esc(t('call_mic')) + '</span></button>' +
        '<button type="button" class="call-btn gray' + (camOn ? ' on' : '') + '" id="callMuteCam" title="' + esc(t('call_cam')) + '">' +
          '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/></svg>' +
          '<span>' + esc(t('call_cam')) + '</span></button>' +
        (canShareScreen() ? '<button type="button" class="call-btn gray call-btn-img' + (scrOn ? ' on' : '') + '" id="callShare" title="' + esc(t('call_screen')) + '">' +
          '<img src="/screen-share.png" alt="" width="56" height="56">' +
          '<span>' + esc(t('call_screen')) + '</span></button>' : '') +
        '<button type="button" class="call-btn red call-btn-img" id="callHang" title="' + esc(t('call_end')) + '">' +
          '<img src="/call-end.png" alt="" width="56" height="56">' +
          '<span>' + esc(t('call_end')) + '</span></button>';
      setCallBtn($('#callMuteMic'), 'mic', micOn); setCallBtn($('#callMuteCam'), 'cam', camOn);
      $('#callHang').onclick = () => endCall();
      const micBtn = $('#callMuteMic');
      if (micBtn) micBtn.onclick = () => toggleMic();
      const camBtn = $('#callMuteCam');
      if (camBtn) camBtn.onclick = () => toggleCam();
      const scrBtn = $('#callShare');
      if (scrBtn) scrBtn.onclick = () => toggleScreenShare();
    }
  }

  function openCallUI(peer, mode) {
    if (callState && callState.id) return toast(t('call_busy'));
    showCallScreen(peer, mode || 'out', { video: false });
  }

  function closeCallUI(sendEnd) {
    const el = $('#callOverlay');
    if (el) el.hidden = true;
    const sc = $('#callBox');
    if (sc) sc.classList.remove('call-active');
    cleanupMedia();
    if (sendEnd && callState && callState.id) {
      api('/api/call/end', { callId: callState.id }).catch(() => {});
    }
    callState = null;
  }

  function cleanupMedia() {
    if (callState) {
      if (callState.screenTrack) {
        try { callState.screenTrack.stop(); } catch (_) {}
        callState.screenTrack = null;
      }
      if (callState.pc) { try { callState.pc.close(); } catch (_) {} callState.pc = null; }
      if (callState.localStream) {
        callState.localStream.getTracks().forEach((tr) => tr.stop());
        callState.localStream = null;
      }
      if (callState.screenStream) callState.screenStream.getTracks().forEach((tr) => { try { tr.stop(); } catch (_) {} });
      callState.screenStream = null; callState.screenSender = null;
      callState.remoteStream = null; callState.rstreams = {}; callState.meta = null; callState.mainKey = ''; callState.pipKey = '';
      callState.camTrack = null;
    }
    const lr = $('#callLocal'), rr = $('#callRemote'), rc = $('#callRemoteCam');
    if (lr) { lr.srcObject = null; lr._tr = null; lr.hidden = true; }
    if (rr) rr.srcObject = null;
    if (rc) { rc.srcObject = null; rc.hidden = true; }
  }

  async function getMedia(video) {
    if (!hasMedia()) throw new Error('no-media');
    const md = navigator.mediaDevices;
    try {
      return await md.getUserMedia({ audio: true, video: video ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false });
    } catch (e) {
      // камера недоступна — не бросаем звонок, продолжаем только с микрофоном
      if (video && e && ['NotFoundError', 'NotReadableError', 'OverconstrainedError', 'AbortError', 'TrackStartError'].includes(e.name)) {
        toast(t('call_no_camera_audio'));
        return await md.getUserMedia({ audio: true, video: false });
      }
      throw e;
    }
  }

  function makePC(callId) {
    const pc = new RTCPeerConnection({ iceServers });
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        api('/api/call/signal', { callId, signal: { type: 'ice', candidate: e.candidate } }).catch(() => {});
      }
    };
    pc.ontrack = (e) => {
      if (!callState || !e.track) return;
      const st = e.streams && e.streams[0];
      if (!st) return;
      callState.rstreams = callState.rstreams || {};
      callState.rstreams[st.id] = st;
      const again = () => layoutRemoteVideos();
      ['ended', 'mute', 'unmute'].forEach((n) => e.track.addEventListener(n, again));
      st.addEventListener('removetrack', again);
      if (!callState.meta) callSignal({ type: 'meta-req' }); // метаданных нет — просим собеседника прислать
      layoutRemoteVideos();
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') { toast(t('call_conn_failed')); try { pc.restartIce(); } catch (_) {} }
    };
    return pc;
  }

  // Alohida tugma: avval ekran tanlanadi (bosish hodisasi ichida), keyin qo'ng'iroq / videochat boshlanadi
  async function shareScreenFrom(info) {
    if (!info) return;
    const sameGroup = info.type === 'g' && gc && gc.group.id === info.id;
    if ((gc && !sameGroup) || (callState && callState.id)) return toast(t('call_busy'));
    let cap;
    try { cap = await ScreenShare.start(); }
    catch (e) { if (e && e.name !== 'NotAllowedError' && e.name !== 'AbortError') toast(t('call_screen_err')); return; }
    if (info.type === 'g') return joinGroupCall(info, cap);
    return startOutgoingCall(info.user, false, cap);
  }

  async function startOutgoingCall(peer, video, cap) {
    try {
      const stream = await getMedia(video);
      const res = await api('/api/call/start', { to: peer.id, video: !!video });
      const callId = res.call.id;
      const pc = makePC(callId);
      stream.getTracks().forEach((tr) => pc.addTrack(tr, stream));
      const camTrack = stream.getVideoTracks()[0] || null;
      callState = { id: callId, role: 'caller', peer, video: !!video, pc, localStream: stream, camTrack, screenTrack: null, screenStream: null, rstreams: {}, meta: null, pendingIce: [] };
      if (cap) { // ekran qo'ng'iroq boshidanoq alohida oqim sifatida ketadi
        callState.screenTrack = cap.track; callState.screenStream = cap.stream;
        cap.track.onended = () => { stopScreenShare(); };
        callState.screenSender = pc.addTrack(cap.track, cap.stream);
      }
      updateLocalPreview();
      showCallScreen(peer, 'active');
      $('#callHint').textContent = t('call_ringing');
      await sendMeta();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await api('/api/call/signal', { callId, signal: { type: 'offer', sdp: pc.localDescription } });
    } catch (e) {
      if (cap) ScreenShare.stop(cap.stream);
      toast(mediaErrMsg(e));
      closeCallUI(true);
    }
  }

  async function acceptIncomingCall(video) {
    if (!callState || !callState.id) return;
    try {
      const stream = await getMedia(video || callState.video);
      await api('/api/call/accept', { callId: callState.id, video: !!(video || callState.video) });
      const pc = makePC(callState.id);
      stream.getTracks().forEach((tr) => pc.addTrack(tr, stream));
      const camTrack = stream.getVideoTracks()[0] || null;
      callState.pc = pc;
      callState.localStream = stream;
      callState.camTrack = camTrack;
      callState.screenTrack = null; callState.screenStream = null;
      callState.rstreams = {}; callState.pendingIce = callState.pendingIce || [];
      callState.role = 'callee';
      callState.video = !!(video || callState.video);
      updateLocalPreview();
      showCallScreen(callState.peer, 'active');
      // if we already got offer, answer it
      await sendMeta();
      if (callState.pendingOffer) {
        await pc.setRemoteDescription(callState.pendingOffer);
        await flushIce();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await api('/api/call/signal', { callId: callState.id, signal: { type: 'answer', sdp: pc.localDescription } });
        callState.pendingOffer = null;
      }
    } catch (e) {
      toast(mediaErrMsg(e));
      rejectIncomingCall();
    }
  }

  function rejectIncomingCall() {
    if (callState && callState.id) api('/api/call/reject', { callId: callState.id }).catch(() => {});
    closeCallUI(false);
  }

  function endCall() {
    if (callState && callState.id) api('/api/call/end', { callId: callState.id }).catch(() => {});
    closeCallUI(false);
  }

  async function handleCallEvent(ev) {
    if (!ev || ev.type !== 'call') return;
    const action = ev.action;
    const c = ev.call;
    if (action === 'incoming') {
      if (callState) return; // busy
      const peer = ev.fromUser || { id: c.from, name: '…', nick: '', av: 0 };
      callState = { id: c.id, role: 'callee', peer, video: !!c.video, pc: null, localStream: null, pendingOffer: null, pendingIce: [], rstreams: {}, meta: null };
      showCallScreen(peer, 'in', { video: !!c.video });
      try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2OnJ6go6WFODg+S1thc4GMlJyin5yYlpOQi4Z/eXNtaGJeWVRQTktIR0VEQUA+PTs5ODc2NTQz').play().catch(() => {}); } catch (_) {}
    } else if (action === 'accepted') {
      if (callState && callState.id === c.id) {
        $('#callHint').textContent = t('call_active');
      }
    } else if (action === 'rejected' || action === 'ended') {
      if (callState && callState.id === c.id) {
        toast(action === 'rejected' ? t('call_rejected') : t('call_ended'));
        closeCallUI(false);
      }
    } else if (action === 'signal' && ev.signal) {
      if (!callState || callState.id !== c.id) return;
      const sig = ev.signal;
      try {
        if (sig.type === 'meta') { callState.meta = sig; layoutRemoteVideos(); return; }
        if (sig.type === 'meta-req') { sendMeta(); return; }
        if (sig.type === 'offer') {
          const pc = callState.pc;
          if (!pc) { callState.pendingOffer = sig.sdp; return; }
          // одновременные предложения: уступает вызываемый, звонящий свое оставляет
          if ((callState.making || pc.signalingState !== 'stable') && callState.role === 'caller') return;
          await pc.setRemoteDescription(sig.sdp);
          await flushIce();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await api('/api/call/signal', { callId: c.id, signal: { type: 'answer', sdp: pc.localDescription } });
          if (callState.needNeg) { callState.needNeg = false; renegotiate(); }
        } else if (sig.type === 'answer' && callState.pc) {
          await callState.pc.setRemoteDescription(sig.sdp);
          await flushIce();
          $('#callHint').textContent = callState.screenTrack ? t('call_screen_on') : t('call_active');
          if (callState.needNeg) { callState.needNeg = false; renegotiate(); }
        } else if (sig.type === 'ice' && sig.candidate) {
          if (callState.pc && callState.pc.remoteDescription) await callState.pc.addIceCandidate(sig.candidate);
          else (callState.pendingIce = callState.pendingIce || []).push(sig.candidate);
        }
      } catch (err) {
        console.warn('call signal', err);
      }
    }
  }


  /* ---------- Групповой видеочат (WebRTC: каждый с каждым) ---------- */
  let gc = null;          // активный видеочат: { group, local, camTrack, peers, users, ... }
  const gcRooms = {};     // groupId -> [users] — кто сейчас в видеочате группы
  const gcActive = (gid) => !!(gcRooms[gid] && gcRooms[gid].length);

  const GC_ICO = {
    mic: '<path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z"/><path d="M19 11a7 7 0 0 1-14 0M12 18v4"/>',
    cam: '<path d="M23 7l-7 5 7 5z"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
    off: '<path d="M3 3l18 18"/>',
  };
  function gcIcon(kind, on) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + GC_ICO[kind] + (on ? '' : GC_ICO.off) + '</svg>';
  }

  function gcEnsureOverlay() {
    let el = $('#gcOverlay');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'gcOverlay'; el.className = 'gc-overlay'; el.hidden = true;
    el.innerHTML =
      '<div class="gc-top"><div class="gc-title" id="gcTitle"></div><div class="gc-sub" id="gcSub"></div></div>' +
      '<div class="gc-grid" id="gcGrid" data-n="1"></div>' +
      '<div class="gc-bar">' +
        '<button type="button" class="gc-btn" id="gcMic"></button>' +
        '<button type="button" class="gc-btn" id="gcCam"></button>' +
        (canShareScreen() ? '<button type="button" class="gc-btn" id="gcScreen"></button>' : '') +
        '<button type="button" class="gc-btn gc-leave" id="gcLeave"><img src="/call-end.png" alt=""></button>' +
      '</div>';
    document.body.appendChild(el);
    $('#gcMic', el).onclick = gcToggleMic;
    $('#gcCam', el).onclick = gcToggleCam;
    if ($('#gcScreen', el)) $('#gcScreen', el).onclick = gcToggleScreen;
    $('#gcLeave', el).onclick = () => gcLeave(true);
    // если браузер не дал автоматически воспроизвести звук — любое касание запустит
    el.addEventListener('click', () => $$('video', el).forEach((v) => { if (v.paused && v.srcObject) v.play().catch(() => {}); }));
    return el;
  }

  const gcLive = (tr) => !!tr && tr.readyState === 'live';
  function gcCamOn() { return gcLive(gc && gc.camTrack) && gc.camTrack.enabled; }
  function gcMicOn() { const a = gc && gc.local && gc.local.getAudioTracks()[0]; return !!a && a.enabled; }

  function gcSyncButtons() {
    if (!gc) return;
    const mic = $('#gcMic'), cam = $('#gcCam'), mo = gcMicOn(), co = gcCamOn();
    mic.innerHTML = gcIcon('mic', mo); mic.classList.toggle('off', !mo); mic.title = t('call_mic');
    cam.innerHTML = gcIcon('cam', co); cam.classList.toggle('off', !co); cam.title = t('call_cam');
    $('#gcLeave').title = t('gc_leave');
    const sc = $('#gcScreen');
    if (sc) {
      sc.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>' + (gc.screenTrack ? '<path d="M9 11l3-3 3 3M12 8v6"/>' : '') + '</svg>';
      sc.classList.toggle('active', !!gc.screenTrack); sc.title = t('call_screen');
    }
  }

  function gcTile(key, muted) {
    const grid = $('#gcGrid');
    let tile = $('[data-key="' + key + '"]', grid);
    if (tile) return tile;
    tile = document.createElement('div');
    tile.className = 'gc-tile'; tile.dataset.key = key;
    tile.innerHTML = '<video autoplay playsinline' + (muted ? ' muted' : '') + '></video><div class="gc-ph"></div><div class="gc-name"></div>';
    grid.appendChild(tile);
    return tile;
  }
  function gcSetStream(tile, stream) {
    const vid = $('video', tile);
    if (vid.srcObject !== (stream || null)) { vid.srcObject = stream || null; if (stream) vid.play().catch(() => {}); }
  }

  // Какие потоки собеседника — камера, а какой — экран (по метаданным, которые он присылает отдельно)
  function gcPeerStreams(uid) {
    const peer = gc.peers.get(uid), meta = (peer && peer.meta) || {};
    let cam = null, scr = null;
    if (peer) for (const id in peer.streams) {
      const st = peer.streams[id];
      if (meta.screen && id === meta.screen) scr = st;
      else if (!peer.screenIds.has(id) && !cam) cam = st;
    }
    return { cam, scr };
  }

  function gcRenderTile(uid) {
    if (!gc) return;
    const mine = uid === me.id;
    const user = mine ? me : (gc.users.get(uid) || { id: uid, name: '…', nick: '', av: 0 });
    const peer = gc.peers.get(uid);
    const meta = mine ? { cam: gcCamOn(), mic: gcMicOn() } : (peer ? peer.meta : {});
    const sm = mine ? { cam: gc.local, scr: gc.screenStream } : gcPeerStreams(uid);
    const nm = mine ? t('gc_you') : (user.name || '@' + user.nick);

    // плитка камеры
    const tile = gcTile(uid, mine);
    gcSetStream(tile, sm.cam);
    const vtrack = sm.cam && sm.cam.getVideoTracks().find((x) => gcLive(x));
    const showVideo = mine ? gcCamOn() : !!vtrack && meta.cam !== false;
    tile.classList.toggle('novid', !showVideo);
    tile.classList.toggle('mirror', mine);
    $('.gc-ph', tile).innerHTML = av({ kind: 'u', id: user.id, v: user.av || 0 }, user.name || '?', 'xl');
    const connecting = !mine && !sm.cam;
    $('.gc-name', tile).innerHTML = '<span>' + esc(nm) + '</span>' +
      (meta.mic === false ? '<i class="gc-muted">' + gcIcon('mic', false) + '</i>' : '') +
      (connecting ? '<i class="gc-wait"></i>' : '');

    // плитка демонстрации экрана
    const skey = uid + ':s', has = !!sm.scr && sm.scr.getVideoTracks().length > 0;
    const old = $('[data-key="' + skey + '"]', $('#gcGrid'));
    if (has) {
      const st = gcTile(skey, true);
      st.classList.add('screen');
      gcSetStream(st, sm.scr);
      $('.gc-name', st).innerHTML = '<span>' + esc(nm + ' · ' + t('call_screen')) + '</span>';
    } else if (old) old.remove();
  }

  function gcLayout() {
    if (!gc) return;
    const grid = $('#gcGrid');
    const ids = [me.id, ...[...gc.users.keys()].filter((id) => id !== me.id)];
    $$('.gc-tile', grid).forEach((el) => { if (!ids.includes(el.dataset.key.split(':')[0])) el.remove(); });
    ids.forEach((id) => gcRenderTile(id));
    // экраны — первыми, затем камеры (я — первый среди камер)
    const keys = [...ids.map((id) => id + ':s').filter((k) => $('[data-key="' + k + '"]', grid)), ...ids];
    keys.forEach((k) => grid.appendChild($('[data-key="' + k + '"]', grid)));
    grid.dataset.n = String(Math.min(keys.length, 9));
    grid.classList.toggle('has-screen', keys.length > ids.length);
    $('#gcSub').textContent = ids.length > 1 ? t('gc_count', { n: ids.length }) : t('gc_alone');
  }

  function gcSignal(to, sig) {
    if (!gc) return Promise.resolve();
    return api('/api/gcall/signal', { group: gc.group.id, to, signal: sig }).catch(() => {});
  }
  function gcSendMeta(uid) {
    if (!gc) return Promise.resolve();
    const meta = { cam: gcCamOn(), mic: gcMicOn(), screen: gc.screenStream ? gc.screenStream.id : null };
    if (uid) return gcSignal(uid, { meta });
    return Promise.all([...gc.peers.keys()].map((id) => gcSignal(id, { meta })));
  }

  function gcMakePeer(uid) {
    const pc = new RTCPeerConnection({ iceServers });
    const peer = { uid, pc, polite: String(me.id) < String(uid), making: false, ignore: false, streams: {}, screenIds: new Set(), screenSender: null, pendingIce: [], meta: (gc.pendingMeta && gc.pendingMeta[uid]) || {}, queue: Promise.resolve() };
    if (peer.meta.screen) peer.screenIds.add(peer.meta.screen);
    gc.peers.set(uid, peer);
    if (gc.local) gc.local.getTracks().forEach((tr) => pc.addTrack(tr, gc.local));
    if (gc.screenTrack) { try { peer.screenSender = pc.addTrack(gc.screenTrack, gc.screenStream); } catch (_) {} }
    pc.onicecandidate = (e) => { if (e.candidate) gcSignal(uid, { candidate: e.candidate }); };
    pc.onnegotiationneeded = async () => {
      try {
        peer.making = true;
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);
        await gcSignal(uid, { description: pc.localDescription });
      } catch (err) { console.warn('gc negotiation', err); }
      finally { peer.making = false; }
    };
    pc.ontrack = (e) => {
      if (!gc) return;
      const st = e.streams && e.streams[0];
      if (!st) return;
      peer.streams[st.id] = st;
      const again = () => gcRenderTile(uid);
      ['mute', 'unmute', 'ended'].forEach((n) => e.track.addEventListener(n, again));
      st.addEventListener('removetrack', again);
      gcRenderTile(uid);
    };
    pc.onconnectionstatechange = () => {
      if (!gc) return;
      if (pc.connectionState === 'connected') { gcSendMeta(uid); gcRenderTile(uid); }
      else if (pc.connectionState === 'failed') { toast(t('call_conn_failed')); try { pc.restartIce(); } catch (_) {} }
    };
    return peer;
  }

  function gcRemovePeer(uid) {
    if (!gc) return;
    const p = gc.peers.get(uid);
    if (p) { try { p.pc.close(); } catch (_) {} gc.peers.delete(uid); }
    gc.users.delete(uid);
    gcLayout();
  }

  async function gcHandleSignal(from, sig) {
    if (!gc) return;
    if (sig && sig.meta) {
      const p = gc.peers.get(from);
      if (p) { p.meta = sig.meta; if (sig.meta.screen) p.screenIds.add(sig.meta.screen); gcRenderTile(from); }
      else (gc.pendingMeta = gc.pendingMeta || {})[from] = sig.meta;
      return;
    }
    const peer = gc.peers.get(from) || gcMakePeer(from);
    const pc = peer.pc;
    try {
      if (sig.description) {
        const d = sig.description;
        const collision = d.type === 'offer' && (peer.making || pc.signalingState !== 'stable');
        peer.ignore = !peer.polite && collision; // «невежливая» сторона не уступает
        if (peer.ignore) return;
        await pc.setRemoteDescription(d);
        const q = peer.pendingIce; peer.pendingIce = [];
        for (const c of q) { try { await pc.addIceCandidate(c); } catch (_) {} }
        if (d.type === 'offer') {
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          await gcSignal(from, { description: pc.localDescription });
        }
      } else if (sig.candidate) {
        if (pc.remoteDescription) { try { await pc.addIceCandidate(sig.candidate); } catch (err) { if (!peer.ignore) console.warn('gc ice', err); } }
        else peer.pendingIce.push(sig.candidate);
      }
    } catch (err) { console.warn('gc signal', err); }
  }
  // сигналы от одного собеседника обрабатываем строго по очереди
  function gcQueue(from, sig) {
    if (!gc) return;
    const peer = gc.peers.get(from) || (sig && sig.meta ? null : gcMakePeer(from));
    if (!peer) return gcHandleSignal(from, sig);
    peer.queue = peer.queue.then(() => gcHandleSignal(from, sig)).catch(() => {});
  }

  async function gcGetMedia() {
    const md = navigator.mediaDevices;
    const vc = { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } };
    try { return await md.getUserMedia({ audio: true, video: vc }); }
    catch (e) {
      // нет камеры или она занята — заходим хотя бы с микрофоном
      if (e && (e.name === 'NotFoundError' || e.name === 'NotReadableError' || e.name === 'OverconstrainedError' || e.name === 'AbortError')) {
        return await md.getUserMedia({ audio: true, video: false });
      }
      throw e;
    }
  }

  async function joinGroupCall(info, cap) { // cap — oldindan olingan ekran { stream, track } (ixtiyoriy)
    const dropCap = () => { if (cap) ScreenShare.stop(cap.stream); };
    if (!info || info.type !== 'g') return dropCap();
    if (gc) {
      if (gc.group.id === info.id) { gcEnsureOverlay().hidden = false; if (cap) await gcAttachScreen(cap.stream, cap.track); }
      else { toast(t('call_busy')); dropCap(); }
      return;
    }
    if (callState && callState.id) { dropCap(); return toast(t('call_busy')); }
    if (!hasMedia()) { dropCap(); return toast(mediaErrMsg()); }
    let stream;
    try { stream = await gcGetMedia(); } catch (e) { dropCap(); return toast(mediaErrMsg(e)); }
    if (gc) { stream.getTracks().forEach((x) => x.stop()); dropCap(); return; } // за время ожидания разрешения уже зашли
    gc = { group: { id: info.id, name: info.name, av: info.av || 0 }, local: stream, camTrack: stream.getVideoTracks()[0] || null, peers: new Map(), users: new Map(), pendingMeta: {} };
    if (cap) { gc.screenStream = cap.stream; gc.screenTrack = cap.track; cap.track.onended = () => gcStopScreen(); }
    const el = gcEnsureOverlay();
    $('#gcGrid', el).innerHTML = '';
    $('#gcTitle', el).textContent = info.name;
    el.hidden = false;
    document.documentElement.classList.add('gc-open');
    gcSyncButtons(); gcLayout();
    try {
      const r = await api('/api/gcall/join', { group: info.id });
      if (!gc) return;
      (r.users || []).forEach((u) => { if (u.id !== me.id) gc.users.set(u.id, u); });
      gcLayout();
      // новичок сам звонит всем, кто уже в видеочате
      (r.others || []).forEach((id) => { if (!gc.peers.has(id)) gcMakePeer(id); });
    } catch (e) {
      toast(mediaErrMsg(e));
      gcLeave(false);
    }
  }

  function gcLeave(sendLeave) {
    const g = gc; if (!g) return;
    gc = null;
    g.peers.forEach((p) => { try { p.pc.close(); } catch (_) {} });
    if (g.screenTrack) { try { g.screenTrack.stop(); } catch (_) {} }
    if (g.local) g.local.getTracks().forEach((x) => { try { x.stop(); } catch (_) {} });
    const el = $('#gcOverlay');
    if (el) { el.hidden = true; $$('video', el).forEach((v) => { v.srcObject = null; }); $('#gcGrid', el).innerHTML = ''; }
    document.documentElement.classList.remove('gc-open');
    if (sendLeave) api('/api/gcall/leave', { group: g.group.id }).catch(() => {});
    gcUpdateBar();
  }

  function gcToggleMic() {
    if (!gc || !gc.local) return;
    const a = gc.local.getAudioTracks()[0]; if (!a) return;
    a.enabled = !a.enabled;
    gcSyncButtons(); gcRenderTile(me.id); gcSendMeta();
  }

  async function gcToggleCam() {
    if (!gc) return;
    try {
      if (gcLive(gc.camTrack)) {
        gc.camTrack.enabled = !gc.camTrack.enabled;
      } else {
        // камеры ещё нет — берём один раз и добавляем во все соединения
        if (!hasMedia()) throw new Error('no-media');
        const vs = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } });
        const cam = vs.getVideoTracks()[0]; if (!cam) throw new Error('no video track');
        if (!gc) { cam.stop(); return; }
        gc.camTrack = cam; gc.local.addTrack(cam);
        gc.peers.forEach((p) => { try { p.pc.addTrack(cam, gc.local); } catch (_) {} });
      }
      gcSyncButtons(); gcRenderTile(me.id); gcSendMeta();
    } catch (e) { console.warn('gc cam', e); toast(mediaErrMsg(e)); }
  }

  async function gcToggleScreen() {
    if (!gc) return;
    if (gc.screenTrack) return gcStopScreen();
    try {
      if (!canShareScreen()) throw new Error('no-screen');
      const { stream, track } = await ScreenShare.start();
      await gcAttachScreen(stream, track);
    } catch (e) {
      console.warn('gc screen', e);
      if (e && e.name !== 'NotAllowedError' && e.name !== 'AbortError') toast(t('call_screen_err'));
    }
  }
  async function gcAttachScreen(stream, track) {
    if (!gc || gc.screenTrack) { ScreenShare.stop(stream); return; }
    gc.screenStream = stream; gc.screenTrack = track;
    track.onended = () => gcStopScreen(); // «Прекратить доступ» в браузере
    await gcSendMeta(); // сначала сообщаем, что новый поток — это экран
    gc.peers.forEach((p) => { try { p.screenSender = p.pc.addTrack(track, stream); } catch (e) { console.warn('gc screen', e); } });
    gcSyncButtons(); gcLayout();
  }
  function gcStopScreen() {
    if (!gc || !gc.screenTrack) return;
    const tr = gc.screenTrack;
    gc.screenTrack = null; gc.screenStream = null;
    try { tr.stop(); } catch (_) {}
    gc.peers.forEach((p) => {
      if (p.screenSender) { try { p.pc.removeTrack(p.screenSender); } catch (_) {} p.screenSender = null; }
    });
    gcSendMeta(); gcSyncButtons(); gcLayout();
  }

  // Плашка «Идёт видеочат · Присоединиться» над перепиской группы
  function gcUpdateBar() {
    const bar = $('#gcBar'); if (!bar) return;
    const info = chatData && chatData.info, g = info && info.type === 'g' && chatData.key === cur ? info : null;
    const vcb = $('#videoChatBtn');
    if (!g) { bar.hidden = true; return; }
    if (gcRooms[g.id] === undefined) {
      gcRooms[g.id] = [];
      api('/api/gcall/state', { group: g.id }).then((r) => { gcRooms[g.id] = r.users || []; gcUpdateBar(); }).catch(() => {});
    }
    const n = gcRooms[g.id].length, inCall = !!gc && gc.group.id === g.id;
    if (vcb) vcb.classList.toggle('live', n > 0);
    if (!n) { bar.hidden = true; return; }
    bar.hidden = false;
    bar.innerHTML = '<span class="gcb-dot"></span><span class="gcb-t"><b>' + esc(t('gc_live')) + '</b> · ' + esc(t('gc_count', { n })) + '</span>' +
      '<button type="button" class="link-btn">' + esc(t('gc_join')) + '</button>';
    $('button', bar).onclick = () => joinGroupCall(g);
  }

  function handleGroupCallEvent(ev) {
    if (!ev) return;
    if (ev.action === 'state') {
      gcRooms[ev.group] = ev.users || [];
      if (gc && gc.group.id === ev.group) {
        if (ev.left === me.id) { toast(t('gc_removed')); gcLeave(false); return; }
        if (ev.left) gcRemovePeer(ev.left);
        (ev.users || []).forEach((u) => { if (u.id !== me.id) gc.users.set(u.id, u); });
        gcLayout();
      }
      gcUpdateBar();
    } else if (ev.action === 'signal' && gc && gc.group.id === ev.group && ev.signal) {
      gcQueue(ev.from, ev.signal);
    }
  }
  window.addEventListener('pagehide', () => { if (gc) gcLeave(true); });

  /* ---------- Вошёл / не вошёл ---------- */
  function connect() {
    if (es || !window.EventSource) return;
    es = new EventSource('/api/events?sid=' + encodeURIComponent(token || ''));
    es.onmessage = (e) => {
      if (!e.data || e.data === '1') return refresh();
      try {
        const j = JSON.parse(e.data);
        if (j && j.type === 'call') handleCallEvent(j);
        else if (j && j.type === 'gcall') handleGroupCallEvent(j);
        else refresh();
      } catch (_) { refresh(); }
    };
    es.onopen = () => refresh();
    es.onerror = () => refresh();
  }
  function disconnect() { if (es) { es.close(); es = null; } if (callState) closeCallUI(true); if (gc) gcLeave(true); for (const k in gcRooms) delete gcRooms[k]; }
  function setAuthed(user) {
    me = user;
    loginBtn.hidden = signupBtn.hidden = !!user;
    logoutBtn.hidden = !user; logoutBtn.title = user ? t('logged_as', { nick: user.nick }) : '';
    if (user) { connect(); refresh(true); loadIce(); }
    else { disconnect(); cancelEdit(); prevReqs = null; chats = []; cur = null; chatData = null; closeModal(); renderAll(); }
  }
  function boot() {
    return api('/api/me').then((d) => { if (!d.user) dropToken(); setAuthed(d.user); }).catch(() => setAuthed(null));
  }
  function start() {
    if (token) return boot();
    let saved = null;
    try { saved = localStorage.getItem(RKEY); } catch (e) {}
    if (!saved || !chan) { setAuthed(null); return Promise.resolve(); }
    // Спрашиваем другие вкладки: если кто-то уже открыт, не берём их аккаунт, а показываем вход
    return new Promise((done) => {
      let other = false;
      const on = (e) => { if (e.data === 'alive') other = true; };
      chan.addEventListener('message', on);
      chan.postMessage('hello');
      setTimeout(() => { chan.removeEventListener('message', on); done(other); }, 200);
    }).then((other) => {
      if (other) return setAuthed(null);
      storeToken(saved, false);
      return boot();
    });
  }
  start().then(() => nav.classList.remove('auth-pending'));
  logoutBtn.addEventListener('click', () => { api('/api/logout', {}).catch(() => {}).then(() => { dropToken(); setAuthed(null); }); });
  setInterval(() => { if (me && document.visibilityState === 'visible') refresh(); }, 20000);

  /* ---------- Смена языка ---------- */
  I18N.onChange(() => {
    markLang(); renderedKey = null;
    $$('.form-error').forEach((p) => { p.textContent = ''; });
    // формы, собранные скриптом, не переводятся «на лету»: закрываем их (список участников обновится сам)
    if (dynKind !== 'members' && dynEl.classList.contains('active')) closeModal();
    logoutBtn.title = me ? t('logged_as', { nick: me.nick }) : '';
    $('#send').setAttribute('aria-label', t(editing ? 'save_edit' : 'send'));
    closeMsgMenu(); renderAll();
  });

  /* ---------- Формы входа и регистрации ---------- */
  function setupForm(name, submitId, url, isSignup) {
    const m = modals[name], err = $('.form-error', m), submit = $('#' + submitId), remember = $('.remember input', m), f = {};
    $$('input[data-f]', m).forEach((i) => { f[i.dataset.f] = i; });
    if (f.nick) prefixInput(f.nick, '@');
    const bad = (t) => { err.textContent = t; };
    function run() {
      const body = { remember: remember.checked };
      Object.keys(f).forEach((k) => { body[k] = f[k].value; });
      body.email = body.email.trim();
      if (!body.email || !body.password) return bad(t('fill_email_pass'));
      if (isSignup) {
        if (!body.name.trim()) return bad(t('enter_name'));
        if (body.nick.replace(/@/g, '').length < 3) return bad(t('nick_min'));
        if (body.password !== body.password2) return bad(t('pw_mismatch'));
      }
      err.textContent = ''; submit.disabled = true;
      api(url, body).then((d) => { $$('input[data-f]', m).forEach((i) => { i.value = ''; }); closeModal(); storeToken(d.token, remember.checked); setAuthed(d.user); })
        .catch((e) => bad(netMsg(e))).then(() => { submit.disabled = false; });
    }
    submit.addEventListener('click', run);
    $$('input', m).forEach((i) => {
      i.addEventListener('input', () => { err.textContent = ''; });
      i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
    });
  }
  setupForm('login', 'doLogin', '/api/login', false);
  setupForm('signup', 'doSignup', '/api/register', true);
})();

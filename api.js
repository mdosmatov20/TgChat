const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const D = db.data;
const DAY = 24 * 60 * 60 * 1000;
const MAX_MB = Number(process.env.MAX_MEDIA_MB) || 2048, MAX_BYTES = MAX_MB * 1024 * 1024;
const MEDIA_DIR = path.join(db.DIR, 'media');
fs.mkdirSync(MEDIA_DIR, { recursive: true });

class HttpError extends Error {
  constructor(status, msg, code, params) { super(msg); this.status = status; this.code = code; this.params = params; }
}
// bad(код, русский текст по умолчанию, статус, параметры): клиент переводит ошибку по коду
const bad = (code, msg, status = 400, params) => { throw new HttpError(status, msg, code, params); };

/* ---------- Пароли ---------- */
const scrypt = (pw, salt) => new Promise((ok, no) =>
  crypto.scrypt(pw, salt, 64, (e, k) => (e ? no(e) : ok(k))));
async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return salt.toString('hex') + ':' + (await scrypt(pw, salt)).toString('hex');
}
async function verifyPassword(pw, stored) {
  const [s, k] = stored.split(':');
  const key = await scrypt(pw, Buffer.from(s, 'hex'));
  const exp = Buffer.from(k, 'hex');
  return key.length === exp.length && crypto.timingSafeEqual(key, exp);
}
const DUMMY_HASH = '00'.repeat(16) + ':' + '00'.repeat(64);

/* ---------- HTTP-помощники ---------- */
function json(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    if (!(req.headers['content-type'] || '').includes('application/json')) return reject(new HttpError(400, 'Некорректный запрос', 'bad_request'));
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 120 * 1024) { reject(new HttpError(413, 'Слишком большой запрос', 'too_large')); req.destroy(); } else chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(new HttpError(400, 'Некорректный запрос', 'bad_request')); }
    });
    req.on('error', reject);
  });
}
// Сессия привязана к вкладке: токен приходит в заголовке X-Session
// (для SSE — в параметре ?sid=, так как EventSource не умеет заголовки).
// Cookie не используется, поэтому в разных вкладках можно войти в разные аккаунты.
const TOKEN_RE = /^[a-f0-9]{64}$/;
const isLegacy = (req, query) => req.headers['x-session'] === undefined && !(query && query.has('sid'));
function getToken(req, query) {
  if (!isLegacy(req, query)) {
    const t = req.headers['x-session'] || (query && query.get('sid')) || '';
    return TOKEN_RE.test(t) ? t : null;
  }
  // Совместимость: страница, открытая до обновления, ещё работает через cookie
  return ((req.headers.cookie || '').match(/(?:^|;\s*)sid=([a-f0-9]+)/) || [])[1] || null;
}
function cookie(token, maxAge) {
  let c = `sid=${token}; Path=/; HttpOnly; SameSite=Lax`;
  if (maxAge !== undefined) c += `; Max-Age=${maxAge}`;
  return c;
}
// За nginx/Caddy все запросы приходят с 127.0.0.1 — берём настоящий адрес из заголовка (только при TRUST_PROXY=1)
function clientIp(req) {
  if (process.env.TRUST_PROXY === '1') {
    const f = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (f) return f;
  }
  return req.socket.remoteAddress;
}
const attempts = new Map();
function limited(ip) {
  const now = Date.now();
  let a = attempts.get(ip);
  if (!a || a.reset < now) a = { count: 0, reset: now + 10 * 60 * 1000 };
  a.count++; attempts.set(ip, a);
  return a.count > 20;
}

/* ---------- События в реальном времени (SSE) ---------- */
const clients = new Map();
// lastSeen обновляется не чаще раза в минуту, чтобы не писать базу на каждый запрос
function touch(u, force) {
  const now = Date.now();
  if (force || !u.lastSeen || now - u.lastSeen > 60000) { u.lastSeen = now; db.save(); }
}
function subscribe(uid, res) {
  let set = clients.get(uid);
  const first = !set;
  if (first) clients.set(uid, (set = new Set()));
  set.add(res);
  const u = userById(uid);
  if (u) { touch(u, true); if (first) notify(relatedIds(u)); }
  res.on('close', () => {
    set.delete(res);
    if (set.size) return;
    if (clients.get(uid) === set) clients.delete(uid);
    // 15 секунд на переподключение, иначе считаем, что человек вышел из видеочата
    setTimeout(() => { if (!clients.has(uid)) gcallDrop(uid); }, 15000).unref();
    const o = userById(uid);
    if (o) { o.lastSeen = Date.now(); db.save(); notify(relatedIds(o)); }
  });
}
function notify(ids, payload) {
  const data = payload ? JSON.stringify(payload) : '1';
  for (const id of new Set(ids)) for (const r of clients.get(id) || []) {
    try { r.write('data: ' + data + '\n\n'); } catch (_) {}
  }
}
setInterval(() => { for (const s of clients.values()) for (const r of s) r.write(': ping\n\n'); }, 25000).unref();

/* ---------- Звонки (сигналинг WebRTC в памяти) ---------- */
const calls = new Map(); // id -> { id, from, to, video, state, created }
function callNotify(call, extra) {
  const payload = { type: 'call', call: { id: call.id, from: call.from, to: call.to, video: !!call.video, state: call.state }, ...extra };
  notify([call.from, call.to], payload);
}
function getCallFor(me, id) {
  const c = calls.get(String(id || ''));
  if (!c || (c.from !== me.id && c.to !== me.id)) bad('call_not_found', 'Звонок не найден', 404);
  return c;
}

/* ---------- Групповой видеочат (WebRTC mesh, сигналинг в памяти) ---------- */
const gcalls = new Map(); // groupId -> Map(userId -> joinedAt)
function gcallUsers(g) {
  const room = gcalls.get(g.id);
  return room ? [...room.keys()].map(userById).filter(Boolean).map((u) => pub(u)) : [];
}
function gcallNotify(g, extra) {
  notify(g.members, { type: 'gcall', action: 'state', group: g.id, users: gcallUsers(g), ...extra });
}
function gcallLeave(g, uid) {
  const room = gcalls.get(g.id);
  if (!room || !room.delete(uid)) return;
  if (!room.size) gcalls.delete(g.id);
  gcallNotify(g, { left: uid });
}
// Пользователь пропал (закрыл вкладку, пропала сеть) — выводим его из видеочатов
function gcallDrop(uid) {
  for (const g of D.groups) if (g.members.includes(uid)) gcallLeave(g, uid);
}
// ICE-серверы: STUN по умолчанию; TURN включается переменными TURN_URL / TURN_USER / TURN_PASS
function iceServers(me) {
  const list = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  const urls = (process.env.TURN_URL || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (urls.length) {
    if (process.env.TURN_SECRET) {
      // временные ключи на 12 часов (coturn: use-auth-secret + static-auth-secret)
      const user = (Math.floor(Date.now() / 1000) + 12 * 3600) + ':' + (me ? me.id : 'guest');
      const cred = crypto.createHmac('sha1', process.env.TURN_SECRET).update(user).digest('base64');
      list.push({ urls, username: user, credential: cred });
    } else {
      list.push({ urls, username: process.env.TURN_USER || '', credential: process.env.TURN_PASS || '' });
    }
  }
  return list;
}

/* ---------- Данные ---------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ID_RE = /^[a-z0-9_]{3,32}$/;
const AVATAR_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const normId = (s) => String(s || '').trim().toLowerCase().replace(/^@+/, '');
const userById = (id) => D.users.find((u) => u.id === id);
const userByNick = (n) => D.users.find((u) => u.nick === n);
const groupById = (id) => D.groups.find((g) => g.id === id);
const groupByGid = (g) => D.groups.find((x) => x.gid === g);
const dmKey = (a, b) => 'u:' + [a, b].sort().join(':');

function checkName(v, max, what) {
  const s = String(v || '').trim().replace(/\s+/g, ' ');
  if (!s || s.length > max) bad(what === 'Имя' ? 'name_len' : 'gname_len', `${what}: от 1 до ${max} символов`, 400, { max });
  return s;
}
function checkNick(v, taken) {
  const n = normId(v);
  if (!ID_RE.test(n)) bad('nick_fmt', 'Никнейм: 3–32 символа, латиница, цифры и _');
  if (taken(n)) bad('nick_taken', 'Этот никнейм уже занят', 409);
  return n;
}
function checkGid(v, self) {
  const n = normId(v);
  if (!ID_RE.test(n)) bad('gid_fmt', 'ID группы: 3–32 символа, латиница, цифры и _');
  const g = groupByGid(n);
  if (g && g !== self) bad('gid_taken', 'Этот ID группы уже занят', 409);
  return n;
}
function checkAvatar(v) {
  if (typeof v !== 'string' || v.length > 80000 || !AVATAR_RE.test(v)) bad('bad_image', 'Некорректное изображение');
  return v;
}

const pub = (u, viewer) => {
  const base = { id: u.id, nick: u.nick, name: u.name, av: u.avatar ? u.avVer : 0, online: clients.has(u.id), seen: u.lastSeen || null, bio: u.bio || '', birthday: u.birthday || null };
  if (viewer && viewer.overrides && viewer.overrides[u.id]) {
    const o = viewer.overrides[u.id];
    if (o.name) base.name = o.name;
    if (o.avatar !== undefined) { base.av = o.avatar ? (o.avVer || 1) : 0; base.localAv = true; }
  }
  return base;
};
const meView = (u) => ({ ...pub(u), email: u.email, hasContacts: partnersOf(u).size > 0, bio: u.bio || '', birthday: u.birthday || null });
const isAdmin = (g, id) => g.admins.includes(id);

// Файлы аудио/видео лежат в data/media; D.media хранит, к какому чату относится файл
function rmMedia(id) { delete D.media[id]; fs.unlink(path.join(MEDIA_DIR, id), () => {}); }
function dropStore(store) { for (const [id, m] of Object.entries(D.media)) if (m.store === store) rmMedia(id); }
function addMsg(store, from, text, sys, k, n, media) {
  const arr = (D.messages[store] = D.messages[store] || []);
  const ts = Math.max(Date.now(), arr.length ? arr[arr.length - 1].ts + 1 : 0);
  arr.push({ id: crypto.randomBytes(6).toString('hex'), from: sys ? null : from, text, ts, sys: !!sys, ...(k ? { k, n } : {}), ...(media ? { media } : {}) });
  if (arr.length > 3000) for (const old of arr.splice(0, arr.length - 3000)) if (old.media) rmMedia(old.media.id);
  db.save();
}
const SYS_RU = { created: () => 'Группа создана', joined: (n) => `${n} вступил(а) в группу`,
  admin: (n) => `${n} назначен(а) администратором`, banned: (n) => `${n} заблокирован(а)`,
  kicked: (n) => `${n} исключён(а)`, left: (n) => `${n} покинул(а) группу` };
// Текст хранится по-русски на случай старых клиентов, а k и n позволяют клиенту перевести его
const sys = (g, k, name) => addMsg('g:' + g.id, null, SYS_RU[k](name), true, k, name);

function resolveChat(me, key) {
  key = String(key || '');
  if (key === 's:' + me.id || key === 's') {
    return { type: 's', key: 's:' + me.id, store: 's:' + me.id };
  }
  if (key.startsWith('u:')) {
    const o = userById(key.slice(2));
    if (!o || o.id === me.id) bad('chat_not_found', 'Чат не найден', 404);
    return { type: 'u', key, store: dmKey(me.id, o.id), other: o };
  }
  if (key.startsWith('g:')) {
    const g = groupById(key.slice(2));
    if (!g || !g.members.includes(me.id)) bad('chat_not_found', 'Чат не найден', 404);
    return { type: 'g', key, store: 'g:' + g.id, group: g };
  }
  return bad('chat_not_found', 'Чат не найден', 404);
}

// В личном чате нельзя писать, если кто-то из двоих заблокировал другого
function checkDm(me, c) {
  if (c.type === 's') return;
  if (c.type !== 'u') return;
  if (me.blocked.includes(c.other.id)) bad('you_blocked', 'Вы заблокировали этого пользователя', 403);
  if (c.other.blocked.includes(me.id)) bad('they_blocked', 'Этот пользователь не принимает ваши сообщения', 403);
}
const audience = (me, c) => (c.type === 'u' ? [me.id, c.other.id] : c.type === 's' ? [me.id] : c.group.members);
function findMsg(c, id) {
  const arr = D.messages[c.store] || [];
  const i = arr.findIndex((m) => m.id === String(id || ''));
  if (i < 0) bad('msg_not_found', 'Сообщение не найдено', 404);
  return { arr, i, m: arr[i] };
}

function unread(me, store) {
  const arr = D.messages[store] || [];
  const r = (D.reads[me.id] || {})[store] || 0;
  let n = 0;
  for (let i = arr.length - 1; i >= 0 && arr[i].ts > r; i--) if (arr[i].from && arr[i].from !== me.id) n++;
  return n;
}
function markRead(me, store) {
  const arr = D.messages[store];
  if (!arr || !arr.length) return;
  (D.reads[me.id] = D.reads[me.id] || {})[store] = arr[arr.length - 1].ts;
  db.save();
}

function partnersOf(me) {
  const set = new Set(me.contacts);
  // Те, кто добавил меня в контакты, тоже появляются в моём списке чатов
  for (const u of D.users) if (u.contacts.includes(me.id) && !me.blocked.includes(u.id)) set.add(u.id);
  for (const k of Object.keys(D.messages)) {
    if (!k.startsWith('u:')) continue;
    const ids = k.slice(2).split(':');
    if (ids.includes(me.id)) set.add(ids[0] === me.id ? ids[1] : ids[0]);
  }
  return set;
}
function relatedIds(me) {
  const s = partnersOf(me);
  for (const g of D.groups) if (g.members.includes(me.id)) g.members.forEach((m) => s.add(m));
  s.add(me.id);
  return [...s];
}

function lastOf(me, store, isGroup) {
  const arr = D.messages[store];
  const m = arr && arr[arr.length - 1];
  if (!m) return null;
  let who = '', whoK = '';
  if (!m.sys) {
    if (m.from === me.id) whoK = 'me';
    else if (isGroup) { const s = userById(m.from); if (s) who = s.name; else whoK = 'del'; }
  }
  return { text: m.text, ts: m.ts, who, whoK, sys: m.sys, k: m.k, n: m.n, media: m.media ? (m.media.voice ? 'voice' : m.media.kind) : '' };
}

function chatList(me) {
  const items = [];
  // Избранное (Saved Messages) — всегда первый
  const sStore = 's:' + me.id;
  const sLast = lastOf(me, sStore, false);
  items.push({ key: 's:' + me.id, type: 's', title: 'Избранное', sub: '', 
    avatar: { kind: 's', id: me.id, v: 0 }, last: sLast, unread: 0,
    ts: sLast ? sLast.ts : Number.MAX_SAFE_INTEGER, ord: 9999, pinnedTop: true });
  for (const pid of partnersOf(me)) {
    const o = userById(pid);
    if (!o) continue;
    const store = dmKey(me.id, pid), last = lastOf(me, store, false);
    const p = pub(o, me);
    items.push({ key: 'u:' + pid, type: 'u', title: p.name, sub: '@' + o.nick,
      avatar: { kind: 'u', id: o.id, v: p.av }, last, unread: unread(me, store),
      online: clients.has(o.id), seen: o.lastSeen || null, ts: last ? last.ts : 0, ord: me.contacts.indexOf(pid) });
  }
  for (const g of D.groups) {
    if (!g.members.includes(me.id)) continue;
    const store = 'g:' + g.id, last = lastOf(me, store, true);
    items.push({ key: 'g:' + g.id, type: 'g', title: g.name, sub: '@@' + g.gid,
      avatar: { kind: 'g', id: g.id, v: g.avatar ? g.avVer : 0 }, last, unread: unread(me, store),
      ts: last ? last.ts : g.createdAt, ord: 0, reqs: isAdmin(g, me.id) ? g.requests.length : 0 });
  }
  return items.sort((a, b) => (b.pinnedTop ? 1 : 0) - (a.pinnedTop ? 1 : 0) || b.ts - a.ts || b.ord - a.ord);
}

function chatDetail(me, key) {
  const c = resolveChat(me, key);
  const pinId = D.pins[c.store] || null;
  const msgs = (D.messages[c.store] || []).slice(-300).map((m) => {
    const u = m.from ? userById(m.from) : null;
    const p = u ? pub(u, me) : null;
    return {
      id: m.id, from: m.from, name: p ? p.name : (m.from ? '' : ''), del: !!m.from && !u,
      av: p ? p.av : 0, nick: p ? p.nick : '',
      text: m.text, ts: m.ts, edited: m.edited || 0, sys: m.sys, k: m.k, n: m.n, media: m.media || null,
      pinned: pinId === m.id,
    };
  });
  markRead(me, c.store);
  if (c.type === 's') {
    return { key: c.key, messages: msgs, info: { type: 's', title: 'Избранное' }, pin: pinId };
  }
  if (c.type === 'u') {
    const o = c.other;
    return { key, messages: msgs, info: { type: 'u', user: pub(o, me), contact: me.contacts.includes(o.id),
      blocked: me.blocked.includes(o.id) }, pin: pinId };
  }
  const g = c.group, admin = isAdmin(g, me.id);
  const role = (id) => (g.ownerId === id ? 'owner' : isAdmin(g, id) ? 'admin' : 'member');
  const order = { owner: 0, admin: 1, member: 2 };
  const members = g.members.map((id) => userById(id)).filter(Boolean)
    .map((u) => ({ ...pub(u, me), role: role(u.id), contact: me.contacts.includes(u.id) }))
    .sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name));
  return { key, messages: msgs, info: { type: 'g', id: g.id, gid: g.gid, name: g.name, kind: g.kind,
    desc: g.desc || '', av: g.avatar ? g.avVer : 0, role: role(me.id), members,
    requests: admin ? g.requests.map(userById).filter(Boolean).map((u) => pub(u, me)) : [],
    banned: admin ? g.banned.map(userById).filter(Boolean).map((u) => pub(u, me)) : [] }, pin: pinId };
}

function ownedGroup(me, id) {
  const g = groupById(String(id || ''));
  if (!g || !g.members.includes(me.id)) bad('group_not_found', 'Группа не найдена', 404);
  return g;
}
function adminGroup(me, id) {
  const g = ownedGroup(me, id);
  if (!isAdmin(g, me.id)) bad('admin_required', 'Нужны права администратора', 403);
  return g;
}

/* ---------- Методы для вошедших пользователей ---------- */
const routes = {
  'GET /api/state': (me) => ({ me: meView(me), chats: chatList(me), maxMb: MAX_MB }),
  'GET /api/chat': (me, b, q) => chatDetail(me, q.get('key')),

  'POST /api/send': (me, b) => {
    const text = String(b.text || '').trim();
    if (!text || text.length > 4000) bad('msg_len', 'Сообщение: от 1 до 4000 символов');
    const c = resolveChat(me, b.chat);
    checkDm(me, c);
    addMsg(c.store, me.id, text);
    notify(audience(me, c));
    return { ok: true };
  },

  // Изменить можно только свой текст; у сообщений с файлом текста нет
  'POST /api/message/edit': (me, b) => {
    const text = String(b.text || '').trim();
    if (!text || text.length > 4000) bad('msg_len', 'Сообщение: от 1 до 4000 символов');
    const c = resolveChat(me, b.chat);
    const { m } = findMsg(c, b.id);
    if (m.sys || m.from !== me.id) bad('not_yours', 'Можно изменять только свои сообщения', 403);
    if (m.media) bad('edit_media', 'Сообщение с файлом нельзя изменить');
    checkDm(me, c);
    if (text !== m.text) { m.text = text; m.edited = Date.now(); db.save(); notify(audience(me, c)); }
    return { ok: true };
  },

  // Удалить сообщение(я): в личном чате и Избранном — любое; в группе — только админ/владелец
  'POST /api/message/delete': (me, b) => {
    const c = resolveChat(me, b.chat);
    const ids = Array.isArray(b.ids) ? b.ids.map(String) : [String(b.id || '')];
    const arr = D.messages[c.store] || [];
    let changed = false;
    for (const id of ids) {
      const i = arr.findIndex((m) => m.id === id);
      if (i < 0) continue;
      const m = arr[i];
      if (m.sys) continue;
      if (c.type === 'g') {
        const g = c.group;
        // В группе удалять сообщения может только администратор или владелец
        if (!isAdmin(g, me.id)) continue;
        // Владельца нельзя трогать (кроме него самого)
        if (m.from === g.ownerId && me.id !== g.ownerId) continue;
        // Админа может удалять только владелец
        if (m.from !== me.id && isAdmin(g, m.from) && g.ownerId !== me.id) continue;
      }
      // personal (u) and saved (s): anyone in chat can delete any
      arr.splice(i, 1);
      if (m.media) rmMedia(m.media.id);
      if (D.pins[c.store] === id) delete D.pins[c.store];
      changed = true;
    }
    if (changed) { db.save(); notify(audience(me, c)); }
    return { ok: true };
  },

  'POST /api/message/pin': (me, b) => {
    const c = resolveChat(me, b.chat);
    if (c.type === 'g' && !isAdmin(c.group, me.id)) bad('admin_required', 'Нужны права администратора', 403);
    const id = String(b.id || '');
    if (b.unpin || !id) {
      delete D.pins[c.store];
    } else {
      const { m } = findMsg(c, id);
      if (m.sys) bad('not_yours', 'Системное сообщение нельзя закрепить', 403);
      D.pins[c.store] = id;
    }
    db.save(); notify(audience(me, c));
    return { ok: true, pin: D.pins[c.store] || null };
  },

  'POST /api/message/forward': (me, b) => {
    const fromC = resolveChat(me, b.from);
    const toC = resolveChat(me, b.to);
    checkDm(me, toC);
    const ids = Array.isArray(b.ids) ? b.ids.map(String) : [String(b.id || '')];
    const src = D.messages[fromC.store] || [];
    let n = 0;
    for (const id of ids) {
      const m = src.find((x) => x.id === id);
      if (!m || m.sys) continue;
      // copy text or media reference (media stays in original store for access check; for simplicity re-add as text note if media)
      if (m.media) {
        // forward media by copying the media record to new store if needed, but for simplicity allow access if original store accessible
        addMsg(toC.store, me.id, m.text || '', false, undefined, undefined, { ...m.media, fwd: true });
      } else {
        addMsg(toC.store, me.id, m.text);
      }
      n++;
    }
    if (n) notify(audience(me, toC));
    return { ok: true, count: n };
  },

  'POST /api/message/save': (me, b) => {
    // save to Избранное
    const fromC = resolveChat(me, b.chat);
    const ids = Array.isArray(b.ids) ? b.ids.map(String) : [String(b.id || '')];
    const src = D.messages[fromC.store] || [];
    const toStore = 's:' + me.id;
    let n = 0;
    for (const id of ids) {
      const m = src.find((x) => x.id === id);
      if (!m || m.sys) continue;
      if (m.media) addMsg(toStore, me.id, m.text || '', false, undefined, undefined, { ...m.media });
      else addMsg(toStore, me.id, m.text);
      n++;
    }
    if (n) notify([me.id]);
    return { ok: true, count: n };
  },

  'POST /api/contact/override': (me, b) => {
    const t = userById(b.userId);
    if (!t || t.id === me.id) bad('user_not_found', 'Пользователь не найден', 404);
    me.overrides = me.overrides || {};
    if (b.clear) {
      delete me.overrides[t.id];
    } else {
      const o = me.overrides[t.id] = me.overrides[t.id] || {};
      if (b.name !== undefined) {
        const n = String(b.name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
        if (n) o.name = n; else delete o.name;
      }
      if (b.avatar === null) { o.avatar = null; o.avVer = (o.avVer || 0) + 1; }
      else if (b.avatar !== undefined) { o.avatar = checkAvatar(b.avatar); o.avVer = (o.avVer || 0) + 1; }
      if (!o.name && o.avatar === undefined) delete me.overrides[t.id];
    }
    db.save(); notify([me.id]);
    return { ok: true, user: pub(t, me) };
  },

  'POST /api/contacts/add': (me, b) => {
    const t = b.userId ? userById(b.userId) : userByNick(normId(b.nick));
    if (!t) bad('user_not_found', 'Пользователь не найден', 404);
    if (t.id === me.id) bad('self_contact', 'Нельзя добавить самого себя');
    if (!me.contacts.includes(t.id)) { me.contacts.push(t.id); db.save(); }
    notify([me.id, t.id]);
    return { key: 'u:' + t.id, user: pub(t) };
  },

  'POST /api/block': (me, b) => {
    const t = userById(b.userId);
    if (!t || t.id === me.id) bad('user_not_found', 'Пользователь не найден', 404);
    me.blocked = me.blocked.filter((x) => x !== t.id);
    if (b.block) me.blocked.push(t.id);
    db.save(); notify([me.id]);
    return { ok: true };
  },

  'POST /api/profile': (me, b) => {
    const name = checkName(b.name, 40, 'Имя');
    const nick = checkNick(b.nick, (n) => D.users.some((u) => u !== me && u.nick === n));
    if (b.avatar === null) { me.avatar = null; me.avVer++; }
    else if (b.avatar !== undefined) { me.avatar = checkAvatar(b.avatar); me.avVer++; }
    me.name = name; me.nick = nick;
    if (b.bio !== undefined) me.bio = String(b.bio || '').trim().slice(0, 200);
    if (b.birthday !== undefined) {
      const bd = String(b.birthday || '').trim();
      me.birthday = bd && /^\d{4}-\d{2}-\d{2}$/.test(bd) ? bd : null;
    }
    db.save(); notify(relatedIds(me));
    return { user: meView(me) };
  },

  'POST /api/groups/create': (me, b) => {
    const name = checkName(b.name, 64, 'Название группы');
    const gid = checkGid(b.gid, null);
    if (!['public', 'private'].includes(b.kind)) bad('pick_type', 'Выберите тип группы');
    const desc = String(b.desc || '').trim().slice(0, 200);
    const g = { id: crypto.randomUUID(), gid, name, kind: b.kind, desc, ownerId: me.id, admins: [me.id],
      members: [me.id], banned: [], requests: [], avatar: null, avVer: 0, createdAt: Date.now() };
    D.groups.push(g);
    sys(g, 'created');
    notify([me.id]);
    return { key: 'g:' + g.id };
  },

  'POST /api/groups/join': (me, b) => {
    const g = groupByGid(normId(b.gid));
    if (!g) bad('group_not_found', 'Группа не найдена', 404);
    if (g.members.includes(me.id)) return { status: 'member', key: 'g:' + g.id };
    if (g.banned.includes(me.id)) bad('banned_here', 'Вы заблокированы в этой группе', 403);
    if (g.kind === 'public') {
      g.members.push(me.id);
      sys(g, 'joined', me.name);
      notify(g.members);
      return { status: 'joined', key: 'g:' + g.id };
    }
    if (!g.requests.includes(me.id)) { g.requests.push(me.id); db.save(); }
    notify(g.admins);
    return { status: 'requested' };
  },

  'POST /api/groups/update': (me, b) => {
    const g = adminGroup(me, b.group);
    g.name = checkName(b.name, 64, 'Название группы');
    g.gid = checkGid(b.gid, g);
    if (b.desc !== undefined) g.desc = String(b.desc || '').trim().slice(0, 200);
    if (b.avatar === null) { g.avatar = null; g.avVer++; }
    else if (b.avatar !== undefined) { g.avatar = checkAvatar(b.avatar); g.avVer++; }
    if (b.addAdmin) {
      const u = userById(b.addAdmin);
      if (!u || !g.members.includes(u.id)) bad('not_member', 'Пользователь не состоит в группе');
      if (!isAdmin(g, u.id)) { g.admins.push(u.id); sys(g, 'admin', u.name); }
    }
    db.save(); notify(g.members);
    return { ok: true };
  },

  'POST /api/groups/member': (me, b) => {
    const g = adminGroup(me, b.group);
    const t = userById(b.userId);
    if (!t) bad('user_not_found', 'Пользователь не найден', 404);
    const owner = g.ownerId === me.id;
    const drop = (arr, id) => { const i = arr.indexOf(id); if (i >= 0) arr.splice(i, 1); };
    const guardTarget = () => {
      if (t.id === g.ownerId) bad('target_owner', 'Нельзя применить к владельцу', 403);
      if (isAdmin(g, t.id) && !owner) bad('owner_only_admins', 'Только владелец может действовать на администраторов', 403);
    };
    switch (b.action) {
      case 'accept':
        if (!g.requests.includes(t.id)) bad('req_not_found', 'Заявка не найдена', 404);
        drop(g.requests, t.id); g.members.push(t.id); sys(g, 'joined', t.name); break;
      case 'decline':
        drop(g.requests, t.id); break;
      case 'kick':
      case 'ban':
        guardTarget();
        if (g.members.includes(t.id)) {
          drop(g.members, t.id); drop(g.admins, t.id);
          sys(g, b.action === 'ban' ? 'banned' : 'kicked', t.name);
        }
        drop(g.requests, t.id);
        if (b.action === 'ban' && !g.banned.includes(t.id)) g.banned.push(t.id);
        break;
      case 'unban':
        drop(g.banned, t.id); break;
      case 'admin':
        if (!g.members.includes(t.id)) bad('not_member', 'Пользователь не состоит в группе');
        if (!isAdmin(g, t.id)) { g.admins.push(t.id); sys(g, 'admin', t.name); }
        break;
      case 'unadmin':
        if (!owner) bad('owner_only_unadmin', 'Только владелец может снимать администраторов', 403);
        if (t.id === g.ownerId) bad('target_owner', 'Нельзя применить к владельцу', 403);
        drop(g.admins, t.id); break;
      default: bad('unknown_action', 'Неизвестное действие');
    }
    db.save(); notify([...g.members, t.id]);
    return { ok: true };
  },

  'POST /api/groups/leave': (me, b) => {
    const g = ownedGroup(me, b.group);
    const members = [...g.members];
    g.members = g.members.filter((x) => x !== me.id);
    g.admins = g.admins.filter((x) => x !== me.id);
    if (!g.members.length) {
      D.groups.splice(D.groups.indexOf(g), 1);
      dropStore('g:' + g.id); delete D.messages['g:' + g.id];
    } else {
      if (g.ownerId === me.id) {
        g.ownerId = g.admins[0] || g.members[0];
        if (!isAdmin(g, g.ownerId)) g.admins.push(g.ownerId);
      }
      sys(g, 'left', me.name);
    }
    db.save(); notify(members);
    return { ok: true };
  },

  // ----- Звонки -----
  'POST /api/call/start': (me, b) => {
    const to = userById(b.to);
    if (!to || to.id === me.id) bad('user_not_found', 'Пользователь не найден', 404);
    if (me.blocked.includes(to.id) || to.blocked.includes(me.id)) bad('they_blocked', 'Нельзя позвонить этому пользователю', 403);
    // один активный звонок на пару
    for (const c of calls.values()) {
      if (c.state === 'ended' || c.state === 'rejected') continue;
      if ((c.from === me.id || c.to === me.id) && (c.from === to.id || c.to === to.id)) {
        if (Date.now() - c.created < 120000) bad('call_busy', 'Уже есть активный звонок', 409);
      }
    }
    const call = {
      id: crypto.randomBytes(8).toString('hex'),
      from: me.id, to: to.id,
      video: !!b.video,
      state: 'ringing',
      created: Date.now(),
    };
    calls.set(call.id, call);
    callNotify(call, { action: 'incoming', fromUser: pub(me) });
    // авто-очистка через 2 мин
    setTimeout(() => {
      const c = calls.get(call.id);
      if (c && c.state === 'ringing') {
        c.state = 'ended';
        callNotify(c, { action: 'ended', reason: 'timeout' });
        calls.delete(call.id);
      }
    }, 120000).unref();
    return { ok: true, call: { id: call.id, from: call.from, to: call.to, video: call.video, state: call.state } };
  },

  'POST /api/call/accept': (me, b) => {
    const call = getCallFor(me, b.callId);
    if (call.to !== me.id) bad('not_yours', 'Нет прав на это действие', 403);
    if (call.state !== 'ringing') bad('call_not_found', 'Звонок уже завершён', 404);
    call.state = 'active';
    if (b.video !== undefined) call.video = !!b.video;
    callNotify(call, { action: 'accepted' });
    return { ok: true, call: { id: call.id, video: call.video, state: call.state } };
  },

  'POST /api/call/reject': (me, b) => {
    const call = getCallFor(me, b.callId);
    if (call.to !== me.id && call.from !== me.id) bad('not_yours', 'Нет прав на это действие', 403);
    call.state = 'rejected';
    callNotify(call, { action: 'rejected' });
    calls.delete(call.id);
    return { ok: true };
  },

  'POST /api/call/end': (me, b) => {
    const call = getCallFor(me, b.callId);
    call.state = 'ended';
    callNotify(call, { action: 'ended' });
    calls.delete(call.id);
    return { ok: true };
  },

  // ----- Групповой видеочат -----
  'GET /api/ice': (me) => ({ iceServers: iceServers(me) }),

  'POST /api/gcall/state': (me, b) => {
    const g = ownedGroup(me, b.group);
    return { ok: true, users: gcallUsers(g) };
  },

  'POST /api/gcall/join': (me, b) => {
    const g = ownedGroup(me, b.group);
    let room = gcalls.get(g.id);
    if (!room) gcalls.set(g.id, (room = new Map()));
    const others = [...room.keys()].filter((id) => id !== me.id);
    room.set(me.id, Date.now());
    gcallNotify(g, { joined: me.id });
    // others — кому новичок должен отправить предложения соединения
    return { ok: true, others, users: gcallUsers(g) };
  },

  'POST /api/gcall/leave': (me, b) => {
    const g = ownedGroup(me, b.group);
    gcallLeave(g, me.id);
    return { ok: true };
  },

  'POST /api/gcall/signal': (me, b) => {
    const g = ownedGroup(me, b.group);
    const room = gcalls.get(g.id);
    const to = String(b.to || '');
    if (!room || !room.has(me.id)) bad('call_not_found', 'Звонок уже завершён', 404);
    if (!room.has(to) || to === me.id) return { ok: true }; // собеседник уже вышел
    notify([to], { type: 'gcall', action: 'signal', group: g.id, from: me.id, signal: b.signal });
    return { ok: true };
  },

  'POST /api/call/signal': (me, b) => {
    const call = getCallFor(me, b.callId);
    if (call.state === 'ended' || call.state === 'rejected') bad('call_not_found', 'Звонок уже завершён', 404);
    const peer = call.from === me.id ? call.to : call.from;
    notify([peer], {
      type: 'call',
      action: 'signal',
      call: { id: call.id, from: call.from, to: call.to, video: call.video, state: call.state },
      signal: b.signal, // { type: 'offer'|'answer'|'ice', sdp?, candidate? }
    });
    return { ok: true };
  },
};

/* ---------- Удаление аккаунта (команда /delakk в терминале) ---------- */
function deleteAccount(email) {
  const u = db.findUserByEmail(String(email || '').trim().toLowerCase());
  if (!u) return null;
  const others = D.users.filter((x) => x !== u).map((x) => x.id);

  // Группы: выходим из всех, при необходимости передаём владение, пустые удаляем
  for (const g of [...D.groups]) {
    const was = g.members.includes(u.id);
    g.members = g.members.filter((x) => x !== u.id);
    g.admins = g.admins.filter((x) => x !== u.id);
    g.banned = g.banned.filter((x) => x !== u.id);
    g.requests = g.requests.filter((x) => x !== u.id);
    if (!was) continue;
    if (!g.members.length) {
      D.groups.splice(D.groups.indexOf(g), 1);
      dropStore('g:' + g.id); delete D.messages['g:' + g.id];
      continue;
    }
    if (g.ownerId === u.id) {
      g.ownerId = g.admins[0] || g.members[0];
      if (!isAdmin(g, g.ownerId)) g.admins.push(g.ownerId);
    }
    sys(g, 'left', u.name);
  }

  // Личные переписки и отметки о прочтении
  const mine = (k) => k.startsWith('u:') && k.slice(2).split(':').includes(u.id);
  for (const k of Object.keys(D.messages)) if (mine(k)) { dropStore(k); delete D.messages[k]; }
  delete D.reads[u.id];
  for (const r of Object.values(D.reads)) for (const k of Object.keys(r)) if (mine(k)) delete r[k];

  // Контакты и блокировки у остальных, сессии, сам пользователь
  for (const o of D.users) {
    o.contacts = o.contacts.filter((x) => x !== u.id);
    o.blocked = o.blocked.filter((x) => x !== u.id);
  }
  for (const [k, s] of Object.entries(D.sessions)) if (s.userId === u.id) delete D.sessions[k];
  D.users.splice(D.users.indexOf(u), 1);

  // Закрываем открытые вкладки удалённого пользователя и обновляем остальных
  for (const r of [...(clients.get(u.id) || [])]) r.end();
  clients.delete(u.id);
  db.save();
  notify(others);
  return u;
}

/* ---------- Файлы (фото, аудио, видео и любые другие, до MAX_MB) ---------- */
const cleanName = (s) => { let n = ''; try { n = decodeURIComponent(s || ''); } catch { n = String(s || ''); }
  return n.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(-120) || 'file'; };

const EXT_MIME = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', heic: 'image/heic', heif: 'image/heif',
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska',
  avi: 'video/x-msvideo', wmv: 'video/x-ms-wmv', flv: 'video/x-flv', '3gp': 'video/3gpp', '3g2': 'video/3gpp2',
  mpeg: 'video/mpeg', mpg: 'video/mpeg', ts: 'video/mp2t', mts: 'video/mp2t', m2ts: 'video/mp2t', ogv: 'video/ogg',
};
function mimeFromName(name) {
  const ext = String(name || '').split('.').pop().toLowerCase();
  return EXT_MIME[ext] || '';
}
function resolveMediaKind(sent, name) {
  let mime = String(sent || '').split(';')[0].trim().toLowerCase();
  if (!mime || mime === 'application/octet-stream' || mime === 'binary/octet-stream') {
    const byName = mimeFromName(name);
    if (byName) mime = byName;
  }
  // Показывать прямо в чате: аудио, видео и безопасные растровые фото
  const inline = mime.match(/^(audio|video)\/[a-z0-9.+-]+$/) || mime.match(/^(image)\/(jpeg|png|gif|webp|avif|bmp|heic|heif)$/);
  if (inline) return { kind: inline[1], mime };
  return { kind: 'file', mime: mime && mime !== 'application/octet-stream' ? mime : 'application/octet-stream' };
}

/* Голосовые, записанные на ПК (Chrome/Firefox), приходят в webm/ogg — iPhone/Safari их не проигрывает.
   Если на сервере есть ffmpeg, перекодируем в m4a (AAC), который играет везде. Нет ffmpeg — оставляем как есть. */
function toM4a(file) {
  return new Promise((resolve) => {
    const tmp = file + '.m4a';
    require('child_process').execFile('ffmpeg', ['-y', '-v', 'error', '-i', file, '-vn', '-c:a', 'aac', '-b:a', '64k', '-ac', '1', '-f', 'mp4', '-movflags', '+faststart', tmp],
      { timeout: 60000 }, (err) => {
        if (err) { fs.unlink(tmp, () => {}); return resolve(false); }
        fs.rename(tmp, file, (e2) => resolve(!e2));
      });
  });
}

function upload(me, req, res, query) {
  const c = resolveChat(me, query.get('chat'));
  checkDm(me, c);
  const nameHint = cleanName(query.get('name'));
  const { kind, mime } = resolveMediaKind(req.headers['content-type'], nameHint);
  // Голосовое сообщение: аудио с пометкой voice и длительностью (секунды)
  const voice = kind === 'audio' && query.get('voice') === '1';
  const dur = voice ? Math.max(0, Math.min(3600, Math.round(Number(query.get('dur')) || 0))) : 0;
  const len = Number(req.headers['content-length']);
  if (!len) bad('bad_request', 'Некорректный запрос', 411);
  if (len > MAX_BYTES) bad('media_big', `Файл слишком большой (максимум ${MAX_MB} МБ)`, 413, { mb: MAX_MB });

  return new Promise((resolve) => {
    const id = crypto.randomBytes(12).toString('hex'), file = path.join(MEDIA_DIR, id);
    const out = fs.createWriteStream(file);
    let size = 0, done = false;
    const abort = (status, msg, code, params) => {
      if (done) return; done = true;
      req.unpipe(out); out.destroy(); fs.unlink(file, () => {});
      if (!res.writableEnded && !res.destroyed) {
        res.on('finish', () => req.destroy());
        json(res, status, { error: msg, code, params }, { Connection: 'close' });
      }
      resolve();
    };
    req.on('data', (ch) => { size += ch.length; if (size > MAX_BYTES) abort(413, 'Файл слишком большой', 'media_big', { mb: MAX_MB }); });
    req.on('error', () => abort(400, 'Некорректный запрос', 'bad_request'));
    req.on('close', () => { if (!req.complete) abort(400, 'Некорректный запрос', 'bad_request'); });
    out.on('error', () => abort(500, 'Ошибка сервера', 'server_error'));
    out.on('finish', async () => {
      if (done) return; done = true;
      if (!size) { fs.unlink(file, () => {}); json(res, 400, { error: 'Некорректный запрос', code: 'bad_request' }); return resolve(); }
      let name = nameHint || 'file', mime2 = mime;
      if (voice && /webm|ogg/.test(mime) && await toM4a(file)) {
        mime2 = 'audio/mp4'; name = name.replace(/\.[^.]+$/, '') + '.m4a';
        try { size = fs.statSync(file).size; } catch (_) {}
      }
      D.media[id] = { store: c.store, mime: mime2, size, name };
      addMsg(c.store, me.id, '', false, undefined, undefined, { id, kind, mime: mime2, size, name, ...(voice ? { voice: true, dur } : {}) });
      notify(audience(me, c));
      json(res, 200, { ok: true });
      resolve();
    });
    req.pipe(out);
  });
}

// Имя файла в заголовке: ASCII-вариант для старых браузеров + filename* (RFC 5987) для настоящего имени
function disposition(name) {
  const n = name || 'file';
  const star = encodeURIComponent(n).replace(/['()*]/g, (ch) => '%' + ch.charCodeAt(0).toString(16).toUpperCase());
  return `attachment; filename="${n.replace(/[^\w.\- ]/g, '_')}"; filename*=UTF-8''${star}`;
}

function serveMedia(me, id, req, res, query) {
  const m = D.media[id];
  let ok = false;
  if (m) {
    if (m.store.startsWith('s:')) ok = m.store === 's:' + me.id;
    else if (m.store.startsWith('u:')) ok = m.store.slice(2).split(':').includes(me.id);
    else { const g = groupById(m.store.slice(2)); ok = !!g && g.members.includes(me.id); }
  }
  if (!ok) return json(res, 404, { error: 'Не найдено', code: 'not_found' });
  const file = path.join(MEDIA_DIR, id);
  let st;
  try { st = fs.statSync(file); } catch { return json(res, 404, { error: 'Не найдено', code: 'not_found' }); }
  let start = 0, end = st.size - 1, partial = false;
  const r = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (r && (r[1] || r[2])) {
    if (r[1] === '') start = Math.max(0, st.size - Number(r[2]));
    else { start = Number(r[1]); if (r[2] !== '') end = Math.min(Number(r[2]), end); }
    if (start > end || start >= st.size) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
    partial = true;
  }
  const asDownload = query && (query.get('download') === '1' || query.get('download') === 'true');
  const h = { 'Content-Type': m.mime, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1,
    'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" };
  if (asDownload || m.mime === 'application/octet-stream') h['Content-Disposition'] = disposition(m.name || 'video');
  if (partial) h['Content-Range'] = `bytes ${start}-${end}/${st.size}`;
  res.writeHead(partial ? 206 : 200, h);
  const rs = fs.createReadStream(file, { start, end });
  rs.on('error', () => res.destroy());
  res.on('close', () => rs.destroy());
  rs.pipe(res);
}

/* ---------- Главный обработчик ---------- */
async function handle(req, res, pathname, query) {
  try {
    const method = req.method;

    // Аватарки (картинки), адрес содержит версию, поэтому кешируются надолго
    const av = pathname.match(/^\/api\/avatar\/([ug])\/([\w-]+)$/);
    if (av && method === 'GET') {
      const o = av[1] === 'u' ? userById(av[2]) : groupById(av[2]);
      const m = o && o.avatar && o.avatar.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!m) return json(res, 404, { error: 'Нет изображения' });
      res.writeHead(200, { 'Content-Type': m[1], 'Cache-Control': 'public, max-age=31536000, immutable' });
      return res.end(Buffer.from(m[2], 'base64'));
    }

    if (pathname === '/api/me' && method === 'GET') {
      const u = db.getUserBySession(getToken(req, query));
      if (u) touch(u);
      return json(res, 200, { user: u ? meView(u) : null });
    }

    if (method === 'POST' && pathname === '/api/logout') {
      const t = getToken(req, query);
      if (t) db.deleteSession(t);
      return json(res, 200, { ok: true }, isLegacy(req, query) ? { 'Set-Cookie': cookie('', 0) } : {});
    }

    if (method === 'POST' && (pathname === '/api/register' || pathname === '/api/login')) {
      if (limited(clientIp(req))) return json(res, 429, { error: 'Слишком много попыток. Попробуйте позже', code: 'rate_limited' });
      const b = await readJson(req);
      const email = String(b.email || '').trim().toLowerCase();
      const password = String(b.password || '');
      let user;
      if (pathname === '/api/register') {
        if (!EMAIL_RE.test(email) || email.length > 254) bad('bad_email', 'Введите корректный адрес электронной почты');
        const name = checkName(b.name, 40, 'Имя');
        const nick = checkNick(b.nick, (n) => D.users.some((u) => u.nick === n));
        if (password.length < 6 || password.length > 128) bad('pw_len', 'Пароль должен быть от 6 до 128 символов');
        if (b.password2 !== undefined && b.password2 !== password) bad('pw_mismatch', 'Пароли не совпадают');
        if (db.findUserByEmail(email)) bad('email_taken', 'Этот адрес уже зарегистрирован', 409);
        user = db.createUser({ email, name, nick, passHash: await hashPassword(password) });
      } else {
        const found = db.findUserByEmail(email);
        const ok = await verifyPassword(password.slice(0, 128), found ? found.passHash : DUMMY_HASH);
        if (!found || !ok) bad('bad_creds', 'Неверный адрес почты или пароль', 401);
        user = found;
      }
      const remember = b.remember === true, ttl = remember ? 30 * DAY : DAY;
      touch(user, true);
      const token = db.createSession(user.id, ttl);
      const extra = isLegacy(req, query) ? { 'Set-Cookie': cookie(token, remember ? ttl / 1000 : undefined) } : {};
      return json(res, 200, { user: meView(user), token }, extra);
    }

    // Дальше — только для вошедших
    const me = db.getUserBySession(getToken(req, query));
    if (!me) return json(res, 401, { error: 'Нужно войти', code: 'need_login' });
    touch(me);

    if (pathname === '/api/events' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write('retry: 3000\n\n');
      return subscribe(me.id, res);
    }

    if (method === 'POST' && pathname === '/api/upload') return upload(me, req, res, query);
    const mm = pathname.match(/^\/api\/media\/([a-f0-9]{24})$/);
    if (mm && method === 'GET') return serveMedia(me, mm[1], req, res, query);

    const route = routes[method + ' ' + pathname];
    if (!route) return json(res, method === 'GET' || method === 'POST' ? 404 : 405, { error: 'Не найдено', code: 'not_found' });
    const body = method === 'POST' ? await readJson(req) : {};
    return json(res, 200, route(me, body, query));
  } catch (e) {
    if (e instanceof HttpError) return json(res, e.status, { error: e.message, code: e.code, params: e.params });
    console.error(e);
    return json(res, 500, { error: 'Ошибка сервера', code: 'server_error' });
  }
}

/* ---------- Для админ-панели (admin.js) ---------- */
function deleteGroup(id) {
  const g = groupById(id);
  if (!g) return null;
  D.groups.splice(D.groups.indexOf(g), 1);
  const store = 'g:' + g.id;
  dropStore(store); delete D.messages[store]; delete D.pins[store];
  for (const r of Object.values(D.reads)) delete r[store];
  gcalls.delete(g.id);
  db.save();
  notify(g.members);
  return g;
}
const onlineCount = () => clients.size;
const liveCalls = () => ({
  calls: [...calls.values()].filter((c) => c.state === 'active').length,
  videochats: gcalls.size,
  videochatUsers: [...gcalls.values()].reduce((n, r) => n + r.size, 0),
});
const isOnline = (uid) => clients.has(uid);

module.exports = { handle, deleteAccount, deleteGroup, hashPassword, onlineCount, isOnline, liveCalls, MEDIA_DIR };

// DarkChat — admin panel (server qismi). Alohida modul: faqat /api/admin/* yo'llarini boshqaradi.
// Yoqish: ADMIN_PASSWORD=uzun_parol node server.js  (parol berilmasa admin panel o'chiq).
const crypto = require('crypto');
const fs = require('fs');
const db = require('./db');
const api = require('./api');

const D = db.data;
// Parol: ADMIN_PASSWORD o'zgaruvchisidan, bo'lmasa admin-password.txt faylidan (birinchi qator)
function loadPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  try { return fs.readFileSync(require('path').join(__dirname, 'admin-password.txt'), 'utf8').split(/\r?\n/)[0].trim(); }
  catch (_) { return ''; }
}
const PASSWORD = loadPassword();
const TTL = 8 * 60 * 60 * 1000;
const sessions = new Map(); // token -> expires
const attempts = new Map(); // ip -> { count, reset }

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const passOk = (p) => crypto.timingSafeEqual(sha(p), sha(PASSWORD));

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > 10 * 1024) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function clientIp(req) {
  if (process.env.TRUST_PROXY === '1') {
    const f = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (f) return f;
  }
  return req.socket.remoteAddress;
}
function limited(ip) {
  const now = Date.now();
  let a = attempts.get(ip);
  if (!a || a.reset < now) a = { count: 0, reset: now + 10 * 60 * 1000 };
  a.count++; attempts.set(ip, a);
  return a.count > 10;
}
function authed(req) {
  const m = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '');
  const exp = m && sessions.get(m[1]);
  if (!exp || exp < Date.now()) { if (m) sessions.delete(m[1]); return false; }
  return true;
}
setInterval(() => { const n = Date.now(); for (const [k, v] of sessions) if (v < n) sessions.delete(k); }, 10 * 60 * 1000).unref();

function mediaStats() {
  let files = 0, bytes = 0;
  for (const id of Object.keys(D.media)) {
    try { bytes += fs.statSync(require('path').join(api.MEDIA_DIR, id)).size; files++; } catch (_) {}
  }
  return { files, bytes };
}

const routes = {
  'GET stats': () => {
    const now = Date.now();
    const msgs = Object.values(D.messages).reduce((n, a) => n + a.filter((m) => !m.sys).length, 0);
    const created = (u) => Date.parse(u.createdAt) || 0;
    return {
      users: D.users.length,
      online: api.onlineCount(),
      live: api.liveCalls(),
      serverTime: now,
      groups: D.groups.length,
      messages: msgs,
      new24h: D.users.filter((u) => now - created(u) < 864e5).length,
      new7d: D.users.filter((u) => now - created(u) < 7 * 864e5).length,
      media: mediaStats(),
    };
  },

  'GET users': () => ({
    users: D.users.map((u) => ({
      id: u.id, nick: u.nick, name: u.name, email: u.email, createdAt: u.createdAt,
      lastSeen: u.lastSeen || null, online: api.isOnline(u.id),
      groups: D.groups.filter((g) => g.members.includes(u.id)).length,
      contacts: (u.contacts || []).length,
    })).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
  }),

  'POST users/delete': (b) => {
    const u = D.users.find((x) => x.id === b.id);
    if (!u) return [404, { error: 'Foydalanuvchi topilmadi' }];
    api.deleteAccount(u.email);
    return { ok: true };
  },

  // Foydalanuvchining barcha sessiyalarini yopadi (qayta kirish kerak bo'ladi)
  'POST users/logout': (b) => {
    const u = D.users.find((x) => x.id === b.id);
    if (!u) return [404, { error: 'Foydalanuvchi topilmadi' }];
    for (const [k, s] of Object.entries(D.sessions)) if (s.userId === u.id) delete D.sessions[k];
    db.save();
    return { ok: true };
  },

  // Parolni ko'rsatib bo'lmaydi (scrypt hash sifatida saqlanadi) — o'rniga yangi parol o'rnatiladi
  'POST users/password': async (b) => {
    const u = D.users.find((x) => x.id === b.id);
    if (!u) return [404, { error: 'Foydalanuvchi topilmadi' }];
    const pw = typeof b.password === 'string' ? b.password : '';
    if (pw.length < 6 || pw.length > 128) return [400, { error: 'Parol 6 dan 128 gacha belgi bo\'lishi kerak' }];
    u.passHash = await api.hashPassword(pw);
    for (const [k, s] of Object.entries(D.sessions)) if (s.userId === u.id) delete D.sessions[k];
    db.save();
    return { ok: true };
  },

  'GET groups': () => ({
    groups: D.groups.map((g) => {
      const owner = D.users.find((u) => u.id === g.ownerId);
      return { id: g.id, gid: g.gid, name: g.name, kind: g.kind, members: g.members.length,
        owner: owner ? owner.name : '—', createdAt: g.createdAt,
        messages: (D.messages['g:' + g.id] || []).filter((m) => !m.sys).length };
    }).sort((a, b) => b.createdAt - a.createdAt),
  }),

  'POST groups/delete': (b) => {
    if (!api.deleteGroup(b.id)) return [404, { error: 'Guruh topilmadi' }];
    return { ok: true };
  },
};

async function handle(req, res, pathname) {
  try {
    if (!PASSWORD) return json(res, 503, { error: 'Admin panel o\'chiq: ADMIN_PASSWORD o\'rnatilmagan' });
    const name = pathname.slice('/api/admin/'.length);

    if (req.method === 'POST' && name === 'login') {
      if (limited(clientIp(req))) return json(res, 429, { error: 'Juda ko\'p urinish. Keyinroq urinib ko\'ring' });
      const b = await readJson(req);
      if (typeof b.password !== 'string' || !passOk(b.password.slice(0, 256))) return json(res, 401, { error: 'Parol noto\'g\'ri' });
      const token = crypto.randomBytes(32).toString('hex');
      sessions.set(token, Date.now() + TTL);
      return json(res, 200, { token });
    }

    if (!authed(req)) return json(res, 401, { error: 'Kirish kerak' });
    if (req.method === 'POST' && name === 'logout') {
      const t = (req.headers.authorization || '').slice(7);
      sessions.delete(t);
      return json(res, 200, { ok: true });
    }

    const route = routes[req.method + ' ' + name];
    if (!route) return json(res, 404, { error: 'Topilmadi' });
    const body = req.method === 'POST' ? await readJson(req) : {};
    const out = await route(body);
    return Array.isArray(out) ? json(res, out[0], out[1]) : json(res, 200, out);
  } catch (e) {
    console.error('admin:', e);
    return json(res, 500, { error: 'Server xatosi' });
  }
}

module.exports = { handle, enabled: !!PASSWORD };

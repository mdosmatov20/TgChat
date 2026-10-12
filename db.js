// Простая база данных в файле data/db.json (без внешних библиотек)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DIR, 'db.json');

const data = { users: [], sessions: {}, groups: [], messages: {}, reads: {}, media: {}, pins: {}, saved: {} };

function saveNow() {
  clearTimeout(timer);
  timer = null;
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, FILE);
}
let timer = null;
// Запись откладывается на 150 мс, чтобы не писать файл на каждое сообщение
function save() {
  if (!timer) timer = setTimeout(saveNow, 150);
}

function prune() {
  const now = Date.now();
  for (const [k, s] of Object.entries(data.sessions)) {
    if (s.expires < now) delete data.sessions[k];
  }
}

function load() {
  fs.mkdirSync(DIR, { recursive: true });
  if (fs.existsSync(FILE)) {
    let loaded;
    try {
      loaded = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    } catch (e) {
      throw new Error('Файл базы данных повреждён: ' + FILE);
    }
    Object.assign(data, loaded);
  }
  data.users = data.users || [];
  data.sessions = data.sessions || {};
  data.groups = data.groups || [];
  data.messages = data.messages || {};
  data.reads = data.reads || {};
  data.media = data.media || {};
  data.pins = data.pins || {};
  data.saved = data.saved || {};
  // Миграция аккаунтов, созданных в старой версии (без никнейма и имени)
  const taken = new Set(data.users.map((u) => u.nick).filter(Boolean));
  for (const u of data.users) {
    if (!u.nick) {
      let base = u.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (base.length < 3) base = (base + 'user').slice(0, 8);
      let nick = base.slice(0, 32), i = 1;
      while (taken.has(nick)) nick = base.slice(0, 28) + i++;
      u.nick = nick;
      taken.add(nick);
    }
    u.name = u.name || u.nick;
    u.contacts = u.contacts || [];
    u.blocked = u.blocked || [];
    u.avatar = u.avatar || null;
    u.avVer = u.avVer || 0;
    u.lastSeen = u.lastSeen || null;
    u.bio = u.bio || '';
    u.birthday = u.birthday || null;
    u.overrides = u.overrides || {}; // local contact name/avatar overrides (only for this user)
  }
  data.pins = data.pins || {}; // chat store -> pinned msg id
  data.saved = data.saved || {}; // userId -> array of saved messages for Избранное
  for (const g of data.groups) {
    if (g.desc === undefined) g.desc = '';
  }
  // Миграция системных сообщений: храним код и имя, чтобы клиент переводил их на выбранный язык
  const SYS = [[/^Группа создана$/, 'created'], [/^(.*) вступил\(а\) в группу$/, 'joined'],
    [/^(.*) назначен\(а\) администратором$/, 'admin'], [/^(.*) заблокирован\(а\)$/, 'banned'],
    [/^(.*) исключён\(а\)$/, 'kicked'], [/^(.*) покинул\(а\) группу$/, 'left']];
  for (const arr of Object.values(data.messages)) {
    for (const m of arr) {
      if (!m.sys || m.k) continue;
      for (const [re, k] of SYS) { const r = re.exec(m.text); if (r) { m.k = k; m.n = r[1] || ''; break; } }
    }
  }
  prune();
  saveNow();
}

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

function findUserByEmail(email) {
  return data.users.find((u) => u.email === email) || null;
}

function createUser(fields) {
  const user = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    contacts: [], blocked: [], avatar: null, avVer: 0, lastSeen: Date.now(),
    bio: '', birthday: null, overrides: {},
    ...fields,
  };
  data.users.push(user);
  save();
  return user;
}

function createSession(userId, ttlMs) {
  prune();
  const token = crypto.randomBytes(32).toString('hex');
  data.sessions[hashToken(token)] = { userId, expires: Date.now() + ttlMs };
  save();
  return token;
}

function getUserBySession(token) {
  if (!token) return null;
  const s = data.sessions[hashToken(token)];
  if (!s || s.expires < Date.now()) return null;
  return data.users.find((u) => u.id === s.userId) || null;
}

function deleteSession(token) {
  const k = hashToken(token);
  if (data.sessions[k]) {
    delete data.sessions[k];
    save();
  }
}

function flush() {
  if (timer) saveNow();
}
process.on('exit', flush);
process.on('SIGINT', () => { flush(); process.exit(0); });
process.on('SIGTERM', () => { flush(); process.exit(0); });

load();
module.exports = { DIR, data, save, flush, findUserByEmail, createUser, createSession, getUserBySession, deleteSession };

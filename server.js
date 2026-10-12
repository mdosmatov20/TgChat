const http = require('http');
const https = require('https');
const os = require('os');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const api = require('./api');
const admin = require('./admin');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

const handler = (req, res) => {
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    res.writeHead(400);
    return res.end('Bad Request');
  }
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    return res.end('Bad Request');
  }

  if (pathname.startsWith('/api/admin/')) return admin.handle(req, res, pathname, url.searchParams);
  if (pathname.startsWith('/api/')) return api.handle(req, res, pathname, url.searchParams);

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end('Method Not Allowed');
  }
  if (pathname === '/') pathname = '/index.html';

  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Страница не найдена · Page not found · Sahifa topilmadi');
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
};

/* ---------- HTTPS ----------
   Камера и микрофон (звонки, видеочат) в браузере работают только на защищённых адресах:
   https://… или http://localhost. Поэтому на телефоне по http://192.168.x.x звонки не работают.
   Варианты:
   1) положить свои сертификаты в data/cert.pem и data/key.pem (или задать SSL_CERT / SSL_KEY);
   2) ничего не делать: сервер сам создаст самоподписанный сертификат (нужен openssl) и запустится по https.
   Отключить HTTPS: HTTPS=0 (например, когда перед сайтом стоит nginx/Caddy/туннель с настоящим HTTPS). */
function lanIps() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) out.push(i.address);
  }
  return out;
}
function loadTls() {
  if (process.env.HTTPS === '0') return null;
  const dir = path.join(__dirname, 'data');
  const certFile = process.env.SSL_CERT || path.join(dir, 'cert.pem');
  const keyFile = process.env.SSL_KEY || path.join(dir, 'key.pem');
  if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const ips = lanIps();
      const san = ['DNS:localhost', 'IP:127.0.0.1', ...ips.map((ip) => 'IP:' + ip)].join(',');
      execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '825',
        '-keyout', keyFile, '-out', certFile, '-subj', '/CN=DarkChat', '-addext', 'subjectAltName=' + san],
        { stdio: 'ignore' });
      console.log('Создан самоподписанный сертификат (data/cert.pem). Браузер один раз покажет предупреждение — подтвердите вход.');
    } catch (e) {
      console.log('Не удалось создать сертификат (нет openssl?). Запуск по http — звонки на телефоне работать не будут.');
      return null;
    }
  }
  try {
    return { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) };
  } catch (e) {
    console.log('Не удалось прочитать сертификат:', e.message);
    return null;
  }
}

const tls = loadTls();
const HTTPS_PORT = Number(process.env.HTTPS_PORT) || (Number(PORT) + 1);

// Основной адрес — обычный http (как раньше): с компьютера http://localhost:PORT работает без предупреждений
const server = http.createServer(handler);
// Большие файлы (до 2 ГБ) на медленном канале грузятся дольше стандартных 5 минут
server.requestTimeout = 0;

server.listen(PORT, process.env.HOST || undefined, () => {
  console.log(`DarkChat запущен: http://localhost:${PORT}`);
  showPublicIp();
  if (tls) {
    const s2 = https.createServer(tls, handler);
    s2.requestTimeout = 0;
    s2.listen(HTTPS_PORT, () => {
      for (const ip of lanIps()) console.log(`  https (самоподписанный сертификат): https://${ip}:${HTTPS_PORT}`);
    });
  }
  console.log(admin.enabled ? `  Админ-панель: http://localhost:${PORT}/admin.html` : '  Админ-панель выключена: задайте ADMIN_PASSWORD или создайте файл admin-password.txt (см. README).');
  if (process.env.TUNNEL === '1') startTunnel();
  else console.log('  Для звонков с телефона нужен настоящий HTTPS: запустите с TUNNEL=1 (см. README).');
});

/* ---------- Внешний (публичный) IP ----------
   Показывает адрес, по которому сайт открывается из интернета (если на роутере проброшен порт). */
function showPublicIp() {
  https.get('https://api.ipify.org', { timeout: 5000 }, (r) => {
    let ip = '';
    r.on('data', (d) => { ip += d; });
    r.on('end', () => {
      ip = ip.trim();
      if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return;
      console.log(`  Внешний адрес: http://${ip}:${PORT}  (нужен проброс порта ${PORT} на роутере)`);
    });
  }).on('error', () => {}).on('timeout', function () { this.destroy(); });
}

/* ---------- Туннель с настоящим HTTPS (cloudflared, бесплатно, без регистрации) ----------
   TUNNEL=1 node server.js  → в консоли появится адрес вида https://что-то.trycloudflare.com
   Этот адрес открывается на любом телефоне без предупреждений, камера и микрофон работают. */
function startTunnel() {
  const { spawn } = require('child_process');
  let p;
  try {
    p = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${PORT}`, '--no-autoupdate'], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { p = null; }
  if (!p) return console.log('  Не удалось запустить cloudflared.');
  let shown = false;
  const onData = (d) => {
    const m = String(d).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m && !shown) { shown = true; console.log(`\n  ✅ Адрес для телефона (настоящий HTTPS): ${m[0]}\n`); }
  };
  p.stdout.on('data', onData); p.stderr.on('data', onData);
  p.on('error', () => console.log('  cloudflared не найден. Установите его (см. README) и запустите снова.'));
  process.on('exit', () => { try { p.kill(); } catch (_) {} });
}

/* ---------- Команды в терминале, где запущен сервер ---------- */
const HELP = 'Команды:\n  /delakk <почта>  удалить аккаунт с этим адресом электронной почты\n  /help            показать эту подсказку';
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const text = line.trim();
  if (!text) return;
  const [cmd, ...args] = text.split(/\s+/);
  try {
    if (cmd === '/delakk') {
      const email = args.join('').toLowerCase();
      if (!email) return console.log('Использование: /delakk <адрес электронной почты>');
      const u = api.deleteAccount(email);
      console.log(u
        ? `Аккаунт удалён: ${u.email} (${u.name}, @${u.nick})`
        : `Аккаунт с адресом ${email} не найден`);
    } else if (cmd === '/help') {
      console.log(HELP);
    } else if (cmd.startsWith('/')) {
      console.log(`Неизвестная команда ${cmd}\n${HELP}`);
    }
  } catch (e) {
    console.error('Ошибка при выполнении команды:', e);
  }
});
rl.on('error', () => {});

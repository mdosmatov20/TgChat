# DarkChat

## Запуск
```
node server.js
```
Сайт доступен по `http://localhost:3000` (с компьютера, камера работает).

## Звонки и видеочат с телефона — нужен настоящий HTTPS
Браузер даёт камеру и микрофон только на защищённых адресах. По `http://192.168.x.x` на телефоне
будет ошибка `navigator.mediaDevices ... undefined`. Самоподписанный сертификат
(`https://192.168.x.x:3001`) тоже часто не подходит: встроенные браузеры мессенджеров его не принимают.

**Самый простой способ — туннель Cloudflare (бесплатно, без регистрации):**
1. Установите `cloudflared`:
   - Windows: `winget install Cloudflare.cloudflared`
   - macOS: `brew install cloudflared`
   - Linux: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
2. Запустите: `TUNNEL=1 node server.js` (Windows PowerShell: `$env:TUNNEL=1; node server.js`).
3. В консоли появится адрес `https://....trycloudflare.com` — откройте его на телефоне в Safari/Chrome.
   Адрес меняется при каждом запуске.

Альтернативы: выложить сайт на хостинг с HTTPS (Render, Railway, VPS + Caddy) или nginx/Caddy с сертификатом Let's Encrypt.

Самоподписанный вариант (`https://IP:3001`): Safari → «Подробнее» → «Перейти на сайт». Только в Safari/Chrome, не во встроенных браузерах.
Свои сертификаты: `data/cert.pem` и `data/key.pem` (или `SSL_CERT`, `SSL_KEY`). Отключить: `HTTPS=0`. Порт: `HTTPS_PORT`.

## Свой домен и сервер
См. **DEPLOY.md** (пошаговая инструкция, готовые конфиги в папке `deploy/`).

## Звонки через мобильный интернет (TURN)
Без TURN-сервера звонки между разными сетями (например, Wi-Fi ↔ 4G) могут не соединяться.
Задайте `TURN_URL=turn:host:3478` и либо `TURN_USER` + `TURN_PASS`, либо `TURN_SECRET` (временные ключи для coturn). Установка coturn — в DEPLOY.md.

## Групповой видеочат
В группе: значок видеочата в шапке чата или меню «⋮ → Видеозвонок». Пока кто-то в видеочате,
над перепиской появляется плашка «Идёт видеочат · Присоединиться». Участники соединяются напрямую (каждый с каждым),
поэтому комфортно работает до 6–8 человек.

## Демонстрация экрана
В звонке и в групповом видеочате есть кнопка экрана (на компьютере). На телефонах браузеры эту функцию не поддерживают, кнопка там скрыта.

## Дизайн
Оформление — Liquid Glass. В шапке кнопка «Дизайн» открывает 10 вариантов (Аврора, Океан, Закат, Лес, Сакура, Фиалка, Графит, Янтарь, Рубин, Неон);
выбор сохраняется в браузере. Светлая и тёмная тема («Тема») работают поверх любого дизайна.
Файлы: `public/style.css` (стили и палитры), `public/design.js` (переключатель), названия дизайнов — в `public/i18n.js`.
Логотипы: `public/logo-light.png`, `public/logo-dark.png` (исходники — `.svg`).

## Ekran ulashish (alohida modul)
Ekran ulashish mantig'i endi alohida faylda: `public/screenshare.js` (`window.ScreenShare`: `supported()`, `start(opts)`, `stop(x)`).
`script.js` (1:1 qo'ng'iroq va guruh videochat) faqat shu modulni chaqiradi. Sozlamalar (o'lcham, kadr tezligi, kursor) — `screenshare.js` boshidagi `DEFAULTS` ichida.

## Admin panel
Server qismi — `admin.js`, interfeys — `public/admin.html`, `admin.js`, `admin.css`. Yoqish:
```
ADMIN_PASSWORD=uzun_va_murakkab_parol node server.js
```
(Windows PowerShell: `$env:ADMIN_PASSWORD="parol"; node server.js`). Keyin `http://localhost:3000/admin.html` ni oching.
`ADMIN_PASSWORD` berilmasa, admin panel o'chiq turadi. Serverda parolni `deploy/darkchat.service` ga `Environment=ADMIN_PASSWORD=...` qilib qo'shing.
Imkoniyatlar: statistika (foydalanuvchilar, onlayn, guruhlar, xabarlar, media hajmi), foydalanuvchilarni qidirish / sessiyasini yopish / o'chirish, guruhlarni ko'rish / o'chirish.
Admin sessiyasi 8 soat amal qiladi, parol kiritishda 10 urinish / 10 daqiqa chegarasi bor.

## Tez ishga tushirish
Oddiy: `node server.js` (parol `admin-password.txt` dan olinadi). Ixtiyoriy: macOS/Linux uchun `./start.sh`. Admin panel: `/admin.html`, parol: `adminpass` (start.bat / start.sh ichida o'zgartirish mumkin).

## Admin parol fayli
`admin-password.txt` ning birinchi qatori — admin parol (ADMIN_PASSWORD berilmasa shu ishlatiladi). `node server.js` yoki `npm start` bilan ham ishlaydi.

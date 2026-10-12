# Выкладка сайта на свой домен и сервер

Схема: **домен → VPS-сервер → Caddy (HTTPS) → Node (DarkChat)** + **coturn** для звонков.
Ниже `example.uz` — замените на ваш домен.

## 1. Сервер
Нужен VPS с Ubuntu 22.04/24.04 (1 ядро и 1 ГБ памяти достаточно для начала) и **публичным IP**.
Запишите IP-адрес. Подключитесь: `ssh root@IP`.

## 2. DNS (у регистратора домена)
Создайте A-записи:
| Имя | Тип | Значение |
|-----|-----|----------|
| `@` | A | IP сервера |
| `www` | A | IP сервера |

Подождите от нескольких минут до пары часов. Проверка: `nslookup example.uz` должен показать ваш IP.

## 3. Установка программ
```
apt update && apt install -y curl ufw coturn debian-keyring debian-archive-keyring apt-transport-https gpg
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs
# Caddy (официальный репозиторий)
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```

## 4. Файлы сайта
```
adduser --system --group --home /opt/darkchat darkchat
```
С вашего компьютера (в папке, где лежит `darkchat/`):
```
scp -r darkchat/* root@IP:/opt/darkchat/
```
(папку `data/` с компьютера копировать не нужно, если не хотите переносить аккаунты)
```
chown -R darkchat:darkchat /opt/darkchat
```
Зависимостей (`npm install`) у проекта нет.

## 5. Запуск как службы
Скопируйте `deploy/darkchat.service` в `/etc/systemd/system/`, откройте и замените домен и секрет
(секрет — любая длинная случайная строка, например результат `openssl rand -hex 24`). Затем:
```
systemctl daemon-reload
systemctl enable --now darkchat
systemctl status darkchat      # должно быть active (running)
```
Логи: `journalctl -u darkchat -f`

## 6. HTTPS через Caddy
Скопируйте `deploy/Caddyfile` в `/etc/caddy/Caddyfile`, замените домен и выполните:
```
ufw allow OpenSSH && ufw allow 80,443/tcp
ufw allow 3478 && ufw allow 49152:65535/udp
ufw enable
systemctl reload caddy
```
Откройте `https://example.uz` — сертификат Caddy получит сам (DNS уже должен указывать на сервер, порты 80 и 443 открыты).

## 7. TURN-сервер (чтобы звонки работали между Wi-Fi и мобильным интернетом)
Без него видео/звук между разными сетями часто не соединяются.
1. Скопируйте `deploy/turnserver.conf` в `/etc/turnserver.conf`, замените домен и секрет
   (**секрет тот же, что в `TURN_SECRET` в службе**).
2. Если в `/etc/default/coturn` есть строка `#TURNSERVER_ENABLED=1` — уберите `#`.
3. `systemctl enable --now coturn` и `systemctl restart darkchat`.

## 8. Резервные копии и обновления
- Все аккаунты, сообщения и файлы лежат в `/opt/darkchat/data/` — копируйте эту папку.
- Обновление: загрузите новые файлы через `scp`, затем `systemctl restart darkchat`.

## Если сервера нет, а сайт крутится на домашнем компьютере
- **Cloudflare Tunnel с вашим доменом**: домен нужно перенести на DNS Cloudflare (бесплатно), затем
  `cloudflared tunnel login`, `cloudflared tunnel create darkchat`, `cloudflared tunnel route dns darkchat example.uz`,
  `cloudflared tunnel run --url http://localhost:3000 darkchat`. Компьютер должен быть всегда включён.
- Проброс портов 80/443 на роутере + Caddy на домашнем ПК — работает только с белым (публичным) IP.

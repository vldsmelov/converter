# systemd: пример unit для автодеплоя (СБ)

Файлы **не включают секреты**. Пути и пользователь `User=` задайте под свой хост.

## `/etc/systemd/system/converter-autodeploy.service`

```ini
[Unit]
Description=Converter Git pull and docker compose (branch test)
After=network-online.target docker.service

[Service]
Type=oneshot
User=root
WorkingDirectory=/opt/converter
Environment=REPO_DIR=/opt/converter
Environment=BRANCH=test
ExecStart=/usr/local/bin/converter-autodeploy-test.sh
```

Скрипт положить из репозитория: `deploy/vps/systemd/converter-autodeploy-test.sh.example` → `/usr/local/bin/converter-autodeploy-test.sh`.

## Таймер (пример)

```ini
[Unit]
Description=Run converter autodeploy hourly

[Timer]
OnCalendar=hourly
Persistent=true

[Install]
WantedBy=timers.target
```

Активация: `systemctl enable --now converter-autodeploy.timer` (имена unit’ов согласовать локально).

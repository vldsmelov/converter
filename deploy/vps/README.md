# VPS / СБ — артефакты в форке

**Форк:** `https://github.com/vvv-web/converter` — здесь можно пробовать требования СБ до переноса в канон.

**Канон (upstream):** `https://github.com/vldsmelov/converter`, рабочая ветка выката обычно **`test`**.

## Актуальность форка относительно `test`

На машине разработчика:

```bash
git remote add fork https://github.com/vvv-web/converter.git   # один раз
git remote update
git rev-parse origin/test    # vldsmelov
git rev-parse fork/test      # vvv-web
```

Если SHA **совпадают** — ветка `test` форка выровнена с `test` канона. Если нет: `git fetch fork test && git log --oneline fork/test..origin/test` (что отстало) и наоборот.

Локальный клон может иметь `origin` на vldsmelov или на форк — ориентируйтесь на URL `git remote -v`.

## Файлы

| Файл | Назначение |
|------|------------|
| `../docker-compose.vps.yml` | Прод-стек: loopback-порты, пины версий образов, без dev bind-mount кода. |
| `.env.example` | Шаблон переменных; реальный `.env` создаётся на сервере и **не коммитится**. |
| `nginx/converter-upstreams.conf.example` | Пример upstream на `127.0.0.1` для Nginx на хосте. |
| `keycloak-import/README.md` | Куда класть prod JSON realm без секретов. |
| `systemd/converter-autodeploy-test.sh.example` | Пример скрипта pull + compose; **systemd/README.md** — unit/timer. |

Дополнительно: `docs/security-*.md`, `infra/keycloak/README-SB.md`.

## Быстрый старт на сервере

```bash
cp deploy/vps/.env.example deploy/vps/.env
# отредактировать секреты и домены
docker compose -f docker-compose.vps.yml up -d --build
```

Однократный seed (профиль `bootstrap`): см. комментарии в `docker-compose.vps.yml`.

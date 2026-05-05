# Импорт realm Keycloak на VPS (СБ)

- **Dev / репозиторий по умолчанию:** JSON лежит в `infra/keycloak/` и монтируется в контейнер как `/opt/keycloak/data/import` (см. `docker-compose.vps.yml`).
- **Prod с отдельным файлом:** `realm-prod-template.json.example` — обезличенный шаблон без пользователей, паролей и client secret. Перед первым запуском можно скопировать его в `realm-export.json`, если ИБ подтверждает import-at-startup для нового realm.
- В шаблоне `frontend.redirectUris` / `webOrigins` сужены до `https://converter.acom-offer-desk.ru`, а required action `CONFIGURE_TOTP` включён как default action для первичной настройки OTP.

Поведение `--import-realm` при существующем realm: см. [оф. доку Keycloak — import at startup](https://www.keycloak.org/server/importExport) (realm уже есть — импорт может быть пропущен; изменения политик — через консоль/API).

Дополнительно: `infra/keycloak/README-SB.md` (2FA, audience).

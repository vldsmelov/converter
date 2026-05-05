# Импорт realm Keycloak на VPS (СБ)

- **Dev / репозиторий по умолчанию:** JSON лежит в `infra/keycloak/` и монтируется в контейнер как `/opt/keycloak/data/import` (см. `docker-compose.vps.yml`).
- **Прод с отдельным файлом:** положите сюда (в этом каталоге на сервере или в форке) **обезличенный** export без демо-паролей и с суженными `redirectUris` / `webOrigins`, затем смонтируйте каталог вместо `infra/keycloak` или используйте Admin API.

Поведение `--import-realm` при существующем realm: см. [оф. доку Keycloak — import at startup](https://www.keycloak.org/server/importExport) (realm уже есть — импорт может быть пропущен; изменения политик — через консоль/API).

Дополнительно: `infra/keycloak/README-SB.md` (2FA, audience).

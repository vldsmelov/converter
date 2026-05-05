# Ужесточение API в проде (СБ)

Следующие места в коде **намеренно мягкие для dev**; перед внешним контуром пройти ревью с ИБ:

| Область | Файлы / что сделать |
|---------|---------------------|
| OpenAPI / Swagger | `AllowAny` на `/api/schema/`, `/api/docs/` в `services/*/urls.py` — в проде ограничить по IP, Basic auth за Nginx или отключить. |
| Анонимные read | `allow_anonymous_read` в NSI/Documents views — убедиться, что для прода не раскрывают лишние данные. |
| Conversion optional auth | Эндпоинты с `optional_bearer` — проверить, что без токена не отдаётся бизнес-логика. |

JWT: проверка `aud` включается переменной **`KEYCLOAK_JWT_AUDIENCE`** (см. `services/*/authn/authentication.py`, `services/conversion/app/main.py`).

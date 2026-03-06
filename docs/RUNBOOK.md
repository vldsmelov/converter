# RUNBOOK

## 1. Сервисы и порты
- `keycloak` — `8080`
- `nsi` — `8001`
- `documents` — `8002`
- `conversion` — `8003`
- `rabbitmq` — `5672/15672`
- `minio` — `9000/9001`

## 2. Основной поток
1. Пользователь логинится в Keycloak из UI.
2. UI создает накладную в `documents`.
3. `documents` запускает Celery задачу `calculate_invoice`.
4. Задача получает service token (`documents-service`) и вызывает `conversion`.
5. `conversion` читает справочники/правила из `nsi` и возвращает результат конвертации.
6. `documents` сохраняет `ConvertedLine`, затем генерирует XLSX/PDF и загружает в MinIO.

## 3. Проверка состояния
- `GET /healthz` для `nsi`, `documents`, `conversion`.
- OpenAPI:
  - NSI: `/api/schema/`, `/api/docs/`
  - Documents: `/api/schema/`, `/api/docs/`

## 4. Полезные команды
- Полный старт:
  - `docker compose up --build -d`
- UI:
  - `docker compose --profile ui up -d frontend`
- Ручной сидинг:
  - `docker compose run --rm seed`
- E2E smoke:
  - `docker compose --profile tools run --rm e2e`

## 5. Роли Keycloak (realm roles)
- NSI: `nsi.uom.*`, `nsi.item.*`, `nsi.package.*`, `nsi.rule.*`
- Conversion: `conversion.convert`, `conversion.ping`
- Documents: `documents.invoice.read|write|calculate|generate`

## 6. Безопасность и секреты
- Секреты не должны храниться в git.
- Используйте `.env`:
  - `NSI_DJANGO_SECRET_KEY`
  - `DOCS_DJANGO_SECRET_KEY`
  - `S2S_CLIENT_SECRET`
- Для `documents` ключ, debug и hosts управляются только env-переменными.

## 7. CI
Workflow `.github/workflows/ci.yml`:
- `frontend-build`: `npm ci && npm run build`
- `python-smoke`: install requirements + `compileall` + pytest collect
- `e2e-smoke`: поднимает compose-контур и гоняет `services/e2e/tests/test_end_to_end.py`

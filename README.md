# Converter

[![CI](https://github.com/vldsmelov/converter/actions/workflows/ci.yml/badge.svg)](https://github.com/vldsmelov/converter/actions/workflows/ci.yml)
РњРёРєСЂРѕСЃРµСЂРІРёСЃРЅС‹Р№ РїСЂРѕС‚РѕС‚РёРї РґР»СЏ:
- РІРµРґРµРЅРёСЏ РќРЎР (Р•Р, РєР°С‚РµРіРѕСЂРёРё, РЅРѕРјРµРЅРєР»Р°С‚СѓСЂР°, СѓРїР°РєРѕРІРєРё, РїСЂР°РІРёР»Р° РєРѕРЅРІРµСЂС‚Р°С†РёРё),
- СЂР°СЃС‡РµС‚Р° РЅР°РєР»Р°РґРЅС‹С…,
- РіРµРЅРµСЂР°С†РёРё РёС‚РѕРіРѕРІС‹С… XLSX/PDF,
- С…СЂР°РЅРµРЅРёСЏ С„Р°Р№Р»РѕРІ РІ MinIO,
- Р°РІС‚РѕСЂРёР·Р°С†РёРё Рё СЂРѕР»РµР№ С‡РµСЂРµР· Keycloak.

## РЎРѕСЃС‚Р°РІ СЃРµСЂРІРёСЃРѕРІ
- `keycloak` (`8080`) - Р°СѓС‚РµРЅС‚РёС„РёРєР°С†РёСЏ/Р°РІС‚РѕСЂРёР·Р°С†РёСЏ.
- `nsi` (`8001`) - СЃРїСЂР°РІРѕС‡РЅРёРєРё Рё РїСЂР°РІРёР»Р°.
- `conversion` (`8003`) - СЂР°СЃС‡РµС‚ РєРѕРЅРІРµСЂС‚Р°С†РёРё РїРѕ РґР°РЅРЅС‹Рј NSI.
- `documents` (`8002`) - РЅР°РєР»Р°РґРЅС‹Рµ, СЂР°СЃС‡РµС‚, РіРµРЅРµСЂР°С†РёСЏ С„Р°Р№Р»РѕРІ.
- `documents_worker` - Celery worker РґР»СЏ С„РѕРЅРѕРІС‹С… Р·Р°РґР°С‡.
- `rabbitmq` (`5672`, `15672`) - Р±СЂРѕРєРµСЂ Р·Р°РґР°С‡ Celery.
- `minio` (`9000`, `9001`) - РѕР±СЉРµРєС‚РЅРѕРµ С…СЂР°РЅРёР»РёС‰Рµ С„Р°Р№Р»РѕРІ.

## Р‘С‹СЃС‚СЂС‹Р№ СЃС‚Р°СЂС‚
1. РџРѕРґРіРѕС‚РѕРІРёС‚СЊ РїРµСЂРµРјРµРЅРЅС‹Рµ:
   - `Copy-Item .env.example .env -Force`
2. РџРѕРґРЅСЏС‚СЊ backend-РєРѕРЅС‚СѓСЂ:
   - `docker compose up --build -d`
3. РџРѕРґРЅСЏС‚СЊ frontend:
   - `docker compose --profile ui up -d frontend`
4. РћС‚РєСЂС‹С‚СЊ:
   - UI: `http://localhost:5173`
   - Keycloak: `http://localhost:8080`

## Health-check
- NSI: `http://localhost:8001/healthz`
- Documents: `http://localhost:8002/healthz`
- Conversion: `http://localhost:8003/healthz`

## РўРµРєСѓС‰РёР№ С„СѓРЅРєС†РёРѕРЅР°Р»

### РќРЎР
- Р•Р:
  - СЃРїРёСЃРѕРє, СЃРѕР·РґР°РЅРёРµ, СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ, СѓРґР°Р»РµРЅРёРµ.
- РљР°С‚РµРіРѕСЂРёРё РЅРѕРјРµРЅРєР»Р°С‚СѓСЂС‹:
  - СЃРїРёСЃРѕРє, СЃРѕР·РґР°РЅРёРµ, СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ, СѓРґР°Р»РµРЅРёРµ.
- РќРѕРјРµРЅРєР»Р°С‚СѓСЂР°:
  - СЃРїРёСЃРѕРє, СЃРѕР·РґР°РЅРёРµ, СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ.
- РЈРїР°РєРѕРІРєРё:
  - СЃРїРёСЃРѕРє, СЃРѕР·РґР°РЅРёРµ, СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ, СѓРґР°Р»РµРЅРёРµ.
- РџСЂР°РІРёР»Р°:
  - СЃРїРёСЃРѕРє РІ РІРёРґРµ РІРєР»Р°РґРѕРє:
    - РіР»РѕР±Р°Р»СЊРЅС‹Рµ,
    - РїСЂР°РІРёР»Р° РєР°С‚РµРіРѕСЂРёР№,
    - РїСЂР°РІРёР»Р° РЅРѕРјРµРЅРєР»Р°С‚СѓСЂС‹;
  - СЃРѕР·РґР°РЅРёРµ, СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ, СѓРґР°Р»РµРЅРёРµ РґР»СЏ РєР°Р¶РґРѕРіРѕ С‚РёРїР°.

### РќР°РєР»Р°РґРЅС‹Рµ
- РЎРѕР·РґР°РЅРёРµ РЅР°РєР»Р°РґРЅРѕР№.
- РџСЂРѕРІРµСЂРєР° РЅР°Р»РёС‡РёСЏ РїСЂР°РІРёР» РєРѕРЅРІРµСЂС‚Р°С†РёРё РїСЂРё РІРІРѕРґРµ СЃС‚СЂРѕРє.
- Р Р°СЃС‡РµС‚ (`calculate`).
- Р“РµРЅРµСЂР°С†РёСЏ РёС‚РѕРіРѕРІС‹С… С„Р°Р№Р»РѕРІ (`generate`).
- РЎРєР°С‡РёРІР°РЅРёРµ XLSX/PDF.

## РР·РјРµРЅРµРЅРёСЏ РІ СЌРєСЃРїРѕСЂС‚Рµ С„Р°Р№Р»РѕРІ (Р°РєС‚СѓР°Р»СЊРЅРѕ)
- Р’ РёС‚РѕРіРѕРІС‹С… XLSX/PDF РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ СЂСѓСЃСЃРєРёР№ РЅР°Р±РѕСЂ РєРѕР»РѕРЅРѕРє:
  - `#`, `РўРѕРІР°СЂ`, `РљРѕР»-РІРѕ`, `Р•Р (РІ РґРѕРєСѓРјРµРЅС‚Рµ)`, `РћРїСЂРёС…РѕРґРѕРІР°РЅРёРµ`, `РЎС‚Р°С‚СѓСЃ СЃС‚СЂРѕРєРё`.
- Р’ РєРѕР»РѕРЅРєРµ `РўРѕРІР°СЂ` Р·Р°РїРёСЃС‹РІР°РµС‚СЃСЏ **РЅР°Р·РІР°РЅРёРµ РЅРѕРјРµРЅРєР»Р°С‚СѓСЂС‹**, Р° РЅРµ `item_id`.
- Р”Р»СЏ РёРјРµРЅРё С‚РѕРІР°СЂР° РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ:
  1. `line.context.item_name` (РµСЃР»Рё РїРµСЂРµРґР°РЅ),
  2. fallback-Р·Р°РїСЂРѕСЃ РІ NSI РїРѕ `item_id`,
  3. СЂРµР·РµСЂРІРЅС‹Р№ РІР°СЂРёР°РЅС‚ `item_id=...`.
- PDF-РіРµРЅРµСЂР°С†РёСЏ РїРµСЂРµРІРµРґРµРЅР° РЅР° Unicode-С€СЂРёС„С‚ `DejaVuSans` (РІ Docker-РѕР±СЂР°Р· `documents` РґРѕР±Р°РІР»РµРЅР° СѓСЃС‚Р°РЅРѕРІРєР° `fonts-dejavu-core`), С‡С‚РѕР±С‹ РєРѕСЂСЂРµРєС‚РЅРѕ РїРµС‡Р°С‚Р°Р»Р°СЃСЊ РєРёСЂРёР»Р»РёС†Р°.

## Р РѕР»Рё Keycloak (РѕСЃРЅРѕРІРЅС‹Рµ)
- NSI: `nsi.uom.*`, `nsi.item.*`, `nsi.package.*`, `nsi.rule.*`
- Conversion: `conversion.convert`, `conversion.ping`
- Documents: `documents.invoice.read`, `documents.invoice.write`, `documents.invoice.calculate`, `documents.invoice.generate`

## РџРѕР»РµР·РЅС‹Рµ РєРѕРјР°РЅРґС‹
- РџРѕР»РЅС‹Р№ РїРµСЂРµР·Р°РїСѓСЃРє:
  - `docker compose down -v --remove-orphans`
  - `docker compose up -d --build`
- РџРµСЂРµСЃРѕР±СЂР°С‚СЊ/РїРµСЂРµР·Р°РїСѓСЃС‚РёС‚СЊ РґРѕРєСѓРјРµРЅС‚С‹:
  - `docker compose up -d --build documents documents_worker`
- РЎР±РѕСЂРєР° frontend:
  - `docker run --rm -v ${PWD}:/repo -w /repo/frontend node:20-alpine sh -lc "npm ci && npm run build"`
- E2E smoke:
  - `docker compose --profile tools run --rm e2e pytest -q tests/test_invoice_flow.py`
  - `docker compose --profile tools run --rm e2e pytest -q tests/test_end_to_end.py`

## Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ
- РћРїРµСЂР°С†РёРѕРЅРЅС‹Р№ runbook: [docs/RUNBOOK.md](docs/RUNBOOK.md)
- Frontend Р·Р°РјРµС‚РєРё: [frontend/README.md](frontend/README.md)

## Admin reset (test mode)
- Realm role: `system.admin`
- Default admin user (realm import): `administrator` / `administrator`
- Reset endpoints (POST, admin only):
  - NSI: `/api/v1/admin/reset-defaults/`
  - Documents: `/api/v1/admin/reset-defaults/`
- Frontend: admin sees a reset icon button in the header.

## РђРґРјРёРЅРёСЃС‚СЂРёСЂРѕРІР°РЅРёРµ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ Рё СЂРѕР»РµР№
- Р’ UI РґРѕСЃС‚СѓРїРЅР° СЃС‚СЂР°РЅРёС†Р° `/admin/console` (РІРёРґРЅР° С‚РѕР»СЊРєРѕ СЃ СЂРѕР»СЊСЋ `system.admin`).
- РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ РјРѕР¶РµС‚:
  - СЃРѕР·РґР°РІР°С‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№,
  - СЃРѕР·РґР°РІР°С‚СЊ/СЂРµРґР°РєС‚РёСЂРѕРІР°С‚СЊ СЂРѕР»Рё Рё РЅР°Р±РѕСЂС‹ РїСЂР°РІ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№,
  - РЅР°Р·РЅР°С‡Р°С‚СЊ СЂРѕР»СЊ-РїР°РєРµС‚С‹ (`bundle.*`) РЅР° РѕСЃРЅРѕРІР°РЅРёРё permissions.
- Backend API (NSI, С‚РѕР»СЊРєРѕ `system.admin`):
  - `GET/POST /api/v1/admin/iam/roles/`
  - `GET/POST /api/v1/admin/iam/users/`
  - `PUT /api/v1/admin/iam/users/{user_id}/roles/`

## РџРѕР»СЏ РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ
- РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ РјРѕР¶РµС‚ СЃРѕР·РґР°РІР°С‚СЊ СЃРёСЃС‚РµРјРЅС‹Рµ РїРѕР»СЏ РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ:
  - `GET/POST /api/v1/admin/default-fields/` (admin only)
  - `GET /api/v1/default-fields/` (read РґР»СЏ РІСЃРµС… С„РѕСЂРј NSI)
- Р­С‚Рё РїРѕР»СЏ РґРѕСЃС‚СѓРїРЅС‹ РІ РёРЅС‚РµСЂС„РµР№СЃРµ, РЅРѕ РЅРµ РјРѕРіСѓС‚ Р±С‹С‚СЊ РёР·РјРµРЅРµРЅС‹/СѓРґР°Р»РµРЅС‹ С‡РµСЂРµР· РѕР±С‹С‡РЅС‹Рµ API.
- РџСЂРё РѕР±С‰РµРј СЃР±СЂРѕСЃРµ (`/api/v1/admin/reset-defaults/`) СЃРёСЃС‚РµРјРЅС‹Рµ РїРѕР»СЏ СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ.

## Quality Gate (CI)
- Frontend:
  - `npm run lint:strict`
  - `npm run build`
- Backend:
  - `python -m compileall services`
  - `ruff check services/nsi/apps services/nsi/nsi_service services/documents/apps services/documents/documents_service services/conversion/app`
  - NSI: `python manage.py check` and `python manage.py makemigrations --check --dry-run`
  - Documents: `python manage.py check` and `python manage.py makemigrations --check --dry-run`
- E2E:
  - `pytest -q --collect-only services/e2e/tests`

Local smoke (Docker):
```bash
docker run --rm -v ${PWD}:/repo -w /repo/frontend node:20-alpine sh -lc "npm ci && npm run lint:strict && npm run build"
docker compose run --rm nsi python manage.py check
docker compose run --rm nsi python manage.py makemigrations --check --dry-run
docker compose run --rm documents python manage.py check
docker compose run --rm documents python manage.py makemigrations --check --dry-run
```

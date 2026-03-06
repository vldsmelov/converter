# Converter

Микросервисный прототип для:
- ведения НСИ (ЕИ, категории, номенклатура, фасовки, правила),
- расчета накладных,
- генерации XLSX/PDF и скачивания из MinIO,
- авторизации через Keycloak.

## Быстрый старт
1. Подготовить переменные:
   `cp .env.example .env`
2. Запустить backend-контур:
   `docker compose up --build -d`
3. Запустить UI:
   `docker compose --profile ui up -d frontend`
4. Открыть:
   - UI: `http://localhost:5173`
   - Keycloak: `http://localhost:8080`

## Health-check
- NSI: `http://localhost:8001/healthz`
- Documents: `http://localhost:8002/healthz`
- Conversion: `http://localhost:8003/healthz`

## Документация
- Архитектура и поток данных: [docs/RUNBOOK.md](docs/RUNBOOK.md)
- Frontend заметки: [frontend/README.md](frontend/README.md)

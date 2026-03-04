# Frontend (Vite + React + TypeScript)

## Запуск (docker)
1) Если менялись клиенты/realm:
   docker compose down -v
   docker compose up --build -d

2) UI:
   docker compose --profile ui up -d frontend

Открыть:
- UI: http://localhost:5173
- Keycloak: http://localhost:8080 (operator/operator)

## Что есть
- Накладные: список, карточка, рассчитать, сформировать XLSX/PDF, скачивание по presigned_url
- Создание накладной: конструктор строк (товар из НСИ + количество + ЕИ)
- НСИ: ЕИ / Номенклатура / Упаковки / Правила (простые формы)

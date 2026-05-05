# Keycloak и СБ (форк / подготовка к прод)

## Что даёт `realm-export.json`

В репозитории — **частичный** экспорт realm `uom` для `--import-realm` при первом старте. Поля `otpPolicy*` задают параметры TOTP (6 цифр, 30 с) — это **не** включает обязательный 2FA для всех пользователей автоматически.

## Обязательный 2FA (требование СБ)

После поднятия Keycloak в прод-режиме (`start`, не `start-dev`):

1. В Admin Console: **Authentication → Flows → Browser** — добавить шаг OTP (или Conditional OTP) согласно [Server Administration Guide](https://www.keycloak.org/docs/latest/server_admin/).
2. Либо назначить пользователям **Required user action** `Configure OTP` (или политику realm для новых пользователей).

Импорт JSON **пропускает** уже существующий realm при рестарте — изменения политик безопаснее вносить через Admin API/Console или отдельный controlled import.

## Клиенты `redirectUris` / `webOrigins`

В dev-экспорте могут быть широкие шаблоны. Для прода сузить под реальный HTTPS-ориджин фронта (см. служебку СБ). Правки — в отдельной ветке форка и ревью перед merge в `test`.

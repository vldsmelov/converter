# Чеклист СБ (Converter) — форк

Краткий трекер; детали — в `docs/security-*.md` и служебке ИБ.

- [ ] **МЭ:** снаружи только 443 (и редирект 80); `ss`/firewall согласованы.
- [ ] **SSH:** доступ только с терминального сервера / allowlist.
- [ ] **GitOps:** `docker-compose.vps.yml` и `deploy/vps/.env.example` в репо; секреты только в `.env` на сервере.
- [ ] **Keycloak:** 2FA обязателен для нужных ролей; сужены `redirectUris` / `webOrigins` под прод (`infra/keycloak/README-SB.md`).
- [ ] **JWT:** в проде задан `KEYCLOAK_JWT_AUDIENCE`; см. `docs/security-api-hardening.md`.
- [ ] **OpenAPI / анонимные эндпоинты:** ревью по `docs/security-api-hardening.md`.
- [ ] **Образы:** не `latest` в прод-контуре; список digest + scan/SBOM по регламенту ИБ.
- [ ] **Контейнеры:** процесс не root (`USER` в Dockerfile; проверка в CI).
- [ ] **БД:** TLS к Postgres и/или шифрование томов — по решению ИБ.

Карточки Kaiten и внешний свод требований — по внутренней служебке ИБ.

# Чеклист СБ (Converter) — форк

Краткий трекер; детали в `CONVERTER-SB-IMPLEMENTATION-PLAN.md` на Desktop / у ИБ.

- [ ] **МЭ:** снаружи только 443 (и редирект 80); `ss`/firewall согласованы.
- [ ] **SSH:** доступ только с терминального сервера / allowlist.
- [ ] **GitOps:** `docker-compose.vps.yml` и `deploy/vps/.env.example` в репо; секреты только в `.env` на сервере.
- [ ] **Keycloak:** 2FA обязателен для нужных ролей; сужены `redirectUris` / `webOrigins` под прод.
- [ ] **Образы:** не `latest` в прод-контуре; список digest + scan/SBOM по регламенту ИБ.
- [ ] **Контейнеры:** процесс не root (`USER` в Dockerfile; проверка в CI).
- [ ] **БД:** TLS к Postgres и/или шифрование томов — по решению ИБ.

Карточки Kaiten и внешний свод требований — по внутренней служебке ИБ.

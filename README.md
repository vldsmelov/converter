Получение токена:

RESP=$(curl -s -X POST "http://localhost:8080/realms/uom/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=uom-cli" \
  -d "username=operator" \
  -d "password=operator")
TOKEN=$(echo "$RESP" | tr -d '\n' | sed -n 's/.*"access_token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
echo "TOKEN length: ${#TOKEN}"
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8001/api/v1/secure-ping"

Проверка состояний:
curl -s localhost:8001/healthz
curl -s localhost:8002/healthz
curl -s localhost:8003/healthz

Проверяем REALM Keylock:
curl -s -o /dev/null -w "HTTP:%{http_code}\n" \
  "http://localhost:8080/realms/uom/.well-known/openid-configuration"

Миграции:
docker compose exec nsi python manage.py migrate
docker compose exec nsi python manage.py seed_uom

проверяем UoM категории:
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8001/api/v1/uom-categories/
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8001/api/v1/uoms/

Создаём Item “Цемент” (storage/posting = TON) 
curl -s -X POST http://localhost:8001/api/v1/items/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data-raw '{"sku":"CEM-001","name":"\u0426\u0435\u043c\u0435\u043d\u0442","is_active":true,"policy":{"storage_uom":2,"posting_uom":2,"allow_fractional":true,"rounding_precision":3}}'
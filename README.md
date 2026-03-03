RESP=$(curl -s -X POST "http://localhost:8080/realms/uom/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=uom-cli" \
  -d "username=operator" \
  -d "password=operator")

TOKEN=$(echo "$RESP" | tr -d '\n' | sed -n 's/.*"access_token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
echo "TOKEN length: ${#TOKEN}"
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8001/api/v1/secure-ping"
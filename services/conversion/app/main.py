import os
import jwt
from jwt import PyJWKClient
from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

app = FastAPI(title="conversion-service")
bearer = HTTPBearer(auto_error=True)

JWKS_URL = os.environ["KEYCLOAK_JWKS_URL"]
ISSUER = os.environ["KEYCLOAK_ISSUER"]

jwks_client = PyJWKClient(JWKS_URL)

def decode_token(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    token = creds.credentials
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token).key
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            issuer=ISSUER,
            options={"verify_aud": False},
        )
        return claims
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

def require_role(role: str):
    def _dep(claims: dict = Depends(decode_token)) -> dict:
        roles = set((claims.get("realm_access") or {}).get("roles") or [])
        if role not in roles:
            raise HTTPException(status_code=403, detail=f"Missing role: {role}")
        return claims
    return _dep

@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "conversion"}

@app.get("/api/v1/secure-ping")
def secure_ping(claims: dict = Depends(require_role("conversion.ping"))):
    return {"ok": True, "service": "conversion", "user": claims.get("preferred_username")}
import os
import jwt
from jwt import PyJWKClient
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

_JWKS_URL = os.environ.get("KEYCLOAK_JWKS_URL")
_ISSUER = os.environ.get("KEYCLOAK_ISSUER")

if not _JWKS_URL or not _ISSUER:
    raise RuntimeError("KEYCLOAK_JWKS_URL and KEYCLOAK_ISSUER must be set")

_jwks_client = PyJWKClient(_JWKS_URL)

class TokenUser:
    def __init__(self, claims: dict):
        self.claims = claims
        self.username = claims.get("preferred_username") or claims.get("sub")
        self.is_authenticated = True

class KeycloakJWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return None  # DRF сам вернет 401 при IsAuthenticated

        token = auth[len("Bearer "):].strip()
        try:
            signing_key = _jwks_client.get_signing_key_from_jwt(token).key
            claims = jwt.decode(
                token,
                signing_key,
                algorithms=["RS256"],
                issuer=_ISSUER,
                options={"verify_aud": False},  # шаг 2: без audience, усложним позже
            )
        except Exception as e:
            raise AuthenticationFailed(f"Invalid token: {e}")

        return (TokenUser(claims), claims)

def get_realm_roles(claims: dict) -> set[str]:
    return set((claims.get("realm_access") or {}).get("roles") or [])
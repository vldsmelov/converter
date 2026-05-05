import os

import jwt
from jwt import PyJWKClient
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


_JWKS_URL = os.environ.get("KEYCLOAK_JWKS_URL")

# KEYCLOAK_ISSUER may be a comma-separated list.
_ISSUERS_RAW = os.environ.get("KEYCLOAK_ISSUER")
_ISSUERS = [p.strip() for p in (_ISSUERS_RAW or "").split(",") if p.strip()]

# СБ (прод): задать KEYCLOAK_JWT_AUDIENCE — тогда PyJWT проверяет claim `aud` (снижает риск токена другого клиента).
# Пусто в dev: поведение как раньше. Типичные значения Keycloak см. в токене на jwt.io или в Admin → клиент → audience mapper.
_JWT_AUDIENCE_RAW = os.environ.get("KEYCLOAK_JWT_AUDIENCE", "").strip()
_JWT_AUDIENCES = [p.strip() for p in _JWT_AUDIENCE_RAW.split(",") if p.strip()] if _JWT_AUDIENCE_RAW else []

if not _JWKS_URL or not _ISSUERS:
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

        token = auth[len("Bearer ") :].strip()

        try:
            signing_key = _jwks_client.get_signing_key_from_jwt(token).key
            verify_aud = bool(_JWT_AUDIENCES)
            audience = (
                _JWT_AUDIENCES[0]
                if len(_JWT_AUDIENCES) == 1
                else (_JWT_AUDIENCES if len(_JWT_AUDIENCES) > 1 else None)
            )
            claims = jwt.decode(
                token,
                signing_key,
                algorithms=["RS256"],
                audience=audience if verify_aud else None,
                options={"verify_aud": verify_aud, "verify_iss": False},
            )
            iss = claims.get("iss")
            if iss not in _ISSUERS:
                raise AuthenticationFailed(f"Invalid token issuer: {iss}")

        except AuthenticationFailed:
            raise
        except Exception as e:
            raise AuthenticationFailed(f"Invalid token: {e}")

        return (TokenUser(claims), claims)


def get_realm_roles(claims: dict) -> set[str]:
    return set((claims.get("realm_access") or {}).get("roles") or [])

import os
import time
import httpx

_TOKEN = None
_EXP = 0

def get_service_token() -> str:
    global _TOKEN, _EXP

    now = int(time.time())
    if _TOKEN and now < (_EXP - 30):
        return _TOKEN

    token_url = os.environ["KEYCLOAK_TOKEN_URL"]
    client_id = os.environ["S2S_CLIENT_ID"]
    client_secret = os.environ["S2S_CLIENT_SECRET"]

    data = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
    }

    with httpx.Client(timeout=10) as c:
        r = c.post(token_url, data=data, headers={"Content-Type": "application/x-www-form-urlencoded"})
        r.raise_for_status()
        payload = r.json()

    _TOKEN = payload["access_token"]
    _EXP = now + int(payload.get("expires_in", 60))
    return _TOKEN
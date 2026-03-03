import os
from datetime import date
from decimal import Decimal, ROUND_HALF_UP, getcontext
from typing import Any, Dict, List, Optional, Tuple

import httpx
import jwt
from jwt import PyJWKClient
from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

getcontext().prec = 28

app = FastAPI(title="conversion-service")
bearer = HTTPBearer(auto_error=True)

JWKS_URL = os.environ["KEYCLOAK_JWKS_URL"]
ISSUER = os.environ["KEYCLOAK_ISSUER"]
NSI_BASE_URL = os.environ["NSI_BASE_URL"].rstrip("/")

jwks_client = PyJWKClient(JWKS_URL)

CATEGORY_BASE_UOM = {
    "MASS": "KG",
    "VOLUME": "L",
    "LENGTH": "M",
    "COUNT": "PCS",
}

# ----------------- Auth helpers -----------------

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

# ----------------- NSI client -----------------

async def nsi_get(client: httpx.AsyncClient, token: str, path: str) -> Any:
    url = f"{NSI_BASE_URL}{path}"
    r = await client.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=10)
    if r.status_code == 401:
        raise HTTPException(status_code=502, detail="NSI auth failed (token rejected by NSI)")
    if r.status_code == 403:
        raise HTTPException(status_code=502, detail="NSI forbidden (missing NSI roles in token)")
    r.raise_for_status()
    return r.json()

async def nsi_post(client: httpx.AsyncClient, token: str, path: str, payload: dict) -> Any:
    url = f"{NSI_BASE_URL}{path}"
    r = await client.post(url, json=payload, headers={"Authorization": f"Bearer {token}"}, timeout=10)
    if r.status_code == 401:
        raise HTTPException(status_code=502, detail="NSI auth failed (token rejected by NSI)")
    if r.status_code == 403:
        raise HTTPException(status_code=502, detail="NSI forbidden (missing NSI roles in token)")
    if r.status_code == 404:
        return {"_not_found": True}
    if r.status_code == 409:
        data = r.json()
        raise HTTPException(status_code=409, detail=data)
    r.raise_for_status()
    return r.json()

def _unwrap_list(payload: Any) -> List[dict]:
    # DRF может вернуть список или пагинированный объект {"results":[...]}
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and "results" in payload and isinstance(payload["results"], list):
        return payload["results"]
    raise HTTPException(status_code=502, detail="Unexpected NSI response format")

# ----------------- Models -----------------

class ConvertRequest(BaseModel):
    item_id: int
    qty: Decimal
    from_uom: str  # code, e.g. "BAG", "KG", "TON"
    to_uom: Optional[str] = None  # code; if None -> posting_uom
    context: Dict[str, Any] = Field(default_factory=dict)
    on_date: Optional[date] = None

    # подсказки для выбора фасовки (если несколько)
    barcode: Optional[str] = None
    supplier_code: Optional[str] = None

class Step(BaseModel):
    kind: str  # UOM_FACTOR | PACKAGE | RULE
    description: str
    from_qty: Decimal
    from_uom: str
    to_qty: Decimal
    to_uom: str
    meta: Dict[str, Any] = Field(default_factory=dict)

class ConvertResponse(BaseModel):
    item_id: int
    from_: Dict[str, Any] = Field(alias="from")
    to: Dict[str, Any]
    steps: List[Step]
    warnings: List[str] = Field(default_factory=list)

# ----------------- Conversion helpers -----------------

def d(x: Any) -> Decimal:
    return x if isinstance(x, Decimal) else Decimal(str(x))

def quantize_qty(qty: Decimal, precision: int) -> Decimal:
    if precision < 0:
        precision = 0
    exp = Decimal("1") if precision == 0 else Decimal("1").scaleb(-precision)  # 10^-precision
    return qty.quantize(exp, rounding=ROUND_HALF_UP)

def uom_info(uoms_by_code: Dict[str, dict], code: str) -> dict:
    if code not in uoms_by_code:
        raise HTTPException(status_code=400, detail=f"Unknown UoM code: {code}")
    return uoms_by_code[code]

def convert_within_category(
    qty: Decimal,
    from_code: str,
    to_code: str,
    uoms_by_code: Dict[str, dict],
    steps: List[Step],
) -> Decimal:
    f = uom_info(uoms_by_code, from_code)
    t = uom_info(uoms_by_code, to_code)
    if f["category_code"] != t["category_code"]:
        raise HTTPException(status_code=500, detail="Internal error: within_category called for different categories")

    factor_from = d(f["factor_to_base"])
    factor_to = d(t["factor_to_base"])
    if factor_from == 0 or factor_to == 0:
        raise HTTPException(status_code=500, detail="Invalid UoM factors")

    qty_base = qty * factor_from
    qty_to = qty_base / factor_to

    if from_code != to_code:
        steps.append(Step(
            kind="UOM_FACTOR",
            description=f"Convert within category {f['category_code']} using factors to base",
            from_qty=qty,
            from_uom=from_code,
            to_qty=qty_to,
            to_uom=to_code,
            meta={"from_factor_to_base": str(factor_from), "to_factor_to_base": str(factor_to)}
        ))
    return qty_to

def pick_package(
    item: dict,
    from_uom_code: str,
    req: ConvertRequest,
    uoms_by_id: Dict[int, dict],
    uoms_by_code: Dict[str, dict],
    on_date: date,
) -> dict:
    packages = item.get("packages") or []
    candidates = []
    for p in packages:
        if p.get("status") != "active":
            continue
        pu = uoms_by_id.get(p["package_uom"])
        cu = uoms_by_id.get(p["content_uom"])
        if not pu or not cu:
            continue
        if pu["code"] != from_uom_code:
            continue

        # date window
        ef = p.get("effective_from")
        et = p.get("effective_to")
        if ef and on_date < date.fromisoformat(ef):
            continue
        if et and on_date > date.fromisoformat(et):
            continue

        # hints
        if req.barcode and p.get("barcode") and p["barcode"] != req.barcode:
            continue
        if req.supplier_code and p.get("supplier_code") and p["supplier_code"] != req.supplier_code:
            continue

        candidates.append(p)

    if not candidates:
        raise HTTPException(status_code=422, detail=f"No active package spec for {from_uom_code} on item {item['id']}")

    if len(candidates) > 1:
        raise HTTPException(
            status_code=409,
            detail={"error": "Ambiguous package specs", "package_ids": [c["id"] for c in candidates]}
        )
    return candidates[0]

def apply_rule_base_to_base(qty_base: Decimal, from_cat: str, to_cat: str, rule: dict) -> Tuple[Decimal, Dict[str, Any]]:
    rtype = rule["rule_type"]
    params = rule["params"] or {}

    if rtype == "kg_per_m":
        kg_per_m = d(params["kg_per_m"])
        if kg_per_m <= 0:
            raise HTTPException(status_code=500, detail="Invalid kg_per_m")
        if from_cat == "MASS" and to_cat == "LENGTH":
            return (qty_base / kg_per_m, {"kg_per_m": str(kg_per_m), "direction": "kg->m"})
        if from_cat == "LENGTH" and to_cat == "MASS":
            return (qty_base * kg_per_m, {"kg_per_m": str(kg_per_m), "direction": "m->kg"})

    if rtype == "density":
        dens = d(params["density_kg_per_l"])
        if dens <= 0:
            raise HTTPException(status_code=500, detail="Invalid density_kg_per_l")
        if from_cat == "MASS" and to_cat == "VOLUME":
            return (qty_base / dens, {"density_kg_per_l": str(dens), "direction": "kg->l"})
        if from_cat == "VOLUME" and to_cat == "MASS":
            return (qty_base * dens, {"density_kg_per_l": str(dens), "direction": "l->kg"})

    if rtype == "pcs_weight":
        kg_per_pc = d(params["kg_per_pc"])
        if kg_per_pc <= 0:
            raise HTTPException(status_code=500, detail="Invalid kg_per_pc")
        if from_cat == "COUNT" and to_cat == "MASS":
            return (qty_base * kg_per_pc, {"kg_per_pc": str(kg_per_pc), "direction": "pcs->kg"})
        if from_cat == "MASS" and to_cat == "COUNT":
            return (qty_base / kg_per_pc, {"kg_per_pc": str(kg_per_pc), "direction": "kg->pcs"})

    raise HTTPException(status_code=422, detail=f"Rule type {rtype} cannot convert {from_cat} -> {to_cat}")

async def find_category_path_and_convert(
    client: httpx.AsyncClient,
    token: str,
    item_id: int,
    start_cat: str,
    qty_base_start: Decimal,
    target_cat: str,
    context: dict,
    on_date: date,
    steps: List[Step],
) -> Tuple[Decimal, str]:
    if start_cat == target_cat:
        return qty_base_start, start_cat

    cats = ["MASS", "VOLUME", "LENGTH", "COUNT"]
    # BFS over categories, depth <= 2 rules (можно поднять позже)
    from collections import deque
    queue = deque()
    queue.append((start_cat, qty_base_start, [] , {start_cat}))  # (cat, qty_base, rule_steps, visited)

    while queue:
        cat, qty_base, local_steps, visited = queue.popleft()
        if len(local_steps) >= 2:
            continue

        for nxt in cats:
            if nxt == cat or nxt in visited:
                continue
            # match rule between cat and nxt
            payload = {
                "item": item_id,
                "from_category": cat,
                "to_category": nxt,
                "context": context,
                "on_date": on_date.isoformat(),
            }
            resp = await nsi_post(client, token, "/api/v1/rules/match", payload)
            if resp.get("_not_found"):
                continue

            rule = resp["rule"]
            qty_next, meta = apply_rule_base_to_base(qty_base, cat, nxt, rule)

            step = Step(
                kind="RULE",
                description=f"Apply rule {rule['rule_type']} (rule_id={rule['id']}, v{rule['version']})",
                from_qty=qty_base,
                from_uom=CATEGORY_BASE_UOM[cat],
                to_qty=qty_next,
                to_uom=CATEGORY_BASE_UOM[nxt],
                meta={
                    "rule_id": rule["id"],
                    "logical_id": rule["logical_id"],
                    "version": rule["version"],
                    "rule_type": rule["rule_type"],
                    "conditions": rule.get("conditions", {}),
                    **meta,
                }
            )

            new_steps = local_steps + [step]
            if nxt == target_cat:
                # append found steps to main steps
                steps.extend(new_steps)
                return qty_next, nxt

            queue.append((nxt, qty_next, new_steps, visited | {nxt}))

    raise HTTPException(status_code=422, detail=f"No conversion path from {start_cat} to {target_cat} (rules not found)")

# ----------------- Endpoints -----------------

@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "conversion"}

@app.get("/api/v1/secure-ping")
def secure_ping(_claims: dict = Depends(require_role("conversion.ping"))):
    return {"ok": True, "service": "conversion"}

@app.post("/api/v1/convert", response_model=ConvertResponse)
async def convert(
    req: ConvertRequest,
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    claims: dict = Depends(require_role("conversion.convert")),
):
    bearer_token = creds.credentials
    on_date = req.on_date or date.today()

    async with httpx.AsyncClient() as client:
        uoms_payload = await nsi_get(client, bearer_token, "/api/v1/uoms/")
        uoms_list = _unwrap_list(uoms_payload)

        uoms_by_code: Dict[str, dict] = {}
        uoms_by_id: Dict[int, dict] = {}
        for u in uoms_list:
            # u["category"] == id категории; нам нужен code категории — подтянем отдельным запросом не будем.
            # Поэтому будем хранить category_id, а category_code будем получать через отдельный маппинг.
            uoms_by_id[int(u["id"])] = {
                "id": int(u["id"]),
                "code": u["code"],
                "name": u["name"],
                "category_id": int(u["category"]),
                "factor_to_base": u["factor_to_base"],
                "precision": int(u["precision"]),
            }

        # нужно получить category_code по category_id — берём из uom-categories
        cats_payload = await nsi_get(client, bearer_token, "/api/v1/uom-categories/")
        cats_list = _unwrap_list(cats_payload)
        cat_code_by_id = {int(c["id"]): c["code"] for c in cats_list}

        for u in uoms_by_id.values():
            u["category_code"] = cat_code_by_id.get(u["category_id"])
            uoms_by_code[u["code"]] = u

        item = await nsi_get(client, bearer_token, f"/api/v1/items/{req.item_id}/")

    steps: List[Step] = []
    warnings: List[str] = []

    # определить target uom
    target_uom_code: str
    if req.to_uom:
        target_uom_code = req.to_uom
    else:
        policy = item.get("policy") or {}
        posting_uom_id = policy.get("posting_uom")
        if not posting_uom_id:
            raise HTTPException(status_code=422, detail="Item has no posting_uom in policy")
        target_uom_code = uoms_by_id[int(posting_uom_id)]["code"]

    # начальные данные
    cur_qty = d(req.qty)
    cur_uom = req.from_uom

    if cur_uom not in uoms_by_code:
        raise HTTPException(status_code=400, detail=f"Unknown from_uom: {cur_uom}")
    if target_uom_code not in uoms_by_code:
        raise HTTPException(status_code=400, detail=f"Unknown to_uom: {target_uom_code}")

    # 1) если from_uom — упаковка (COUNT) и есть фасовка -> разупаковать
    from_info = uom_info(uoms_by_code, cur_uom)
    if from_info["category_code"] == "COUNT":
        # пробуем применить фасовку только если есть package spec с этим UoM
        try:
            pkg = pick_package(item, cur_uom, req, uoms_by_id, uoms_by_code, on_date)
            pu = uoms_by_id[int(pkg["package_uom"])]
            cu = uoms_by_id[int(pkg["content_uom"])]
            content_qty = d(pkg["content_qty"])
            new_qty = cur_qty * content_qty

            steps.append(Step(
                kind="PACKAGE",
                description=f"Unpack using PackageSpec id={pkg['id']}: 1 {pu['code']} = {content_qty} {cu['code']}",
                from_qty=cur_qty,
                from_uom=pu["code"],
                to_qty=new_qty,
                to_uom=cu["code"],
                meta={"package_id": pkg["id"], "content_qty": str(content_qty)}
            ))

            cur_qty = new_qty
            cur_uom = cu["code"]
            from_info = uom_info(uoms_by_code, cur_uom)
        except HTTPException as e:
            # если упаковка не найдена — оставим как есть (COUNT может быть просто PCS)
            if e.status_code in (422,):
                pass
            else:
                raise

    # 2) привести текущую единицу к базе её категории (KG/L/M/PCS)
    cur_cat = from_info["category_code"]
    if cur_cat not in CATEGORY_BASE_UOM:
        raise HTTPException(status_code=422, detail=f"Unsupported category: {cur_cat}")
    base_uom_code = CATEGORY_BASE_UOM[cur_cat]
    cur_qty_base = convert_within_category(cur_qty, cur_uom, base_uom_code, uoms_by_code, steps)

    # 3) привести target uom к базе target категории (чтобы знать target_cat)
    target_info = uom_info(uoms_by_code, target_uom_code)
    target_cat = target_info["category_code"]
    if target_cat not in CATEGORY_BASE_UOM:
        raise HTTPException(status_code=422, detail=f"Unsupported target category: {target_cat}")
    target_base_uom_code = CATEGORY_BASE_UOM[target_cat]

    # 4) если категории разные — применить правила через NSI match (BFS до 2 правил)
    if cur_cat != target_cat:
        async with httpx.AsyncClient() as client:
            cur_qty_base, cur_cat = await find_category_path_and_convert(
                client=client,
                token=bearer_token,
                item_id=req.item_id,
                start_cat=cur_cat,
                qty_base_start=cur_qty_base,
                target_cat=target_cat,
                context=req.context,
                on_date=on_date,
                steps=steps,
            )

    # 5) теперь cur_qty_base в базе target категории; перевести в target uom
    # сначала в base uom target_cat (оно уже base), затем в target_uom
    if target_base_uom_code != target_uom_code:
        cur_qty_final = convert_within_category(cur_qty_base, target_base_uom_code, target_uom_code, uoms_by_code, steps)
    else:
        cur_qty_final = cur_qty_base

    # 6) округление
    precision = int(target_info.get("precision", 3))
    policy = item.get("policy") or {}
    if policy.get("rounding_precision") is not None:
        precision = int(policy["rounding_precision"])
    cur_qty_final = quantize_qty(cur_qty_final, precision)

    return ConvertResponse(
        item_id=req.item_id,
        **{
            "from": {"qty": str(req.qty), "uom": req.from_uom},
            "to": {"qty": str(cur_qty_final), "uom": target_uom_code},
            "steps": steps,
            "warnings": warnings,
        }
    )
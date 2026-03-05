import os
import time
import httpx

KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://keycloak:8080").rstrip("/")
NSI_URL = os.getenv("NSI_URL", "http://nsi:8000").rstrip("/")
DOCS_URL = os.getenv("DOCS_URL", "http://documents:8000").rstrip("/")
USERNAME = os.getenv("SEED_USERNAME", "operator")
PASSWORD = os.getenv("SEED_PASSWORD", "operator")
CLIENT_ID = os.getenv("SEED_CLIENT_ID", "uom-cli")


def wait_http_ok(url: str, timeout_s: int = 240) -> None:
    deadline = time.time() + timeout_s
    last = None
    while time.time() < deadline:
        try:
            r = httpx.get(url, timeout=5)
            if r.status_code == 200:
                return
            last = f"{r.status_code} {r.text[:200]}"
        except Exception as e:
            last = str(e)
        time.sleep(1)
    raise RuntimeError(f"Service not ready: {url}. Last={last}")


def get_token() -> str:
    r = httpx.post(
        f"{KEYCLOAK_URL}/realms/uom/protocol/openid-connect/token",
        data={
            "grant_type": "password",
            "client_id": CLIENT_ID,
            "username": USERNAME,
            "password": PASSWORD,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=20,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def get_uoms(token: str):
    r = httpx.get(f"{NSI_URL}/api/v1/uoms/", headers=auth(token), timeout=20)
    r.raise_for_status()
    return r.json()


def get_uom_cats(token: str):
    r = httpx.get(f"{NSI_URL}/api/v1/uom-categories/", headers=auth(token), timeout=20)
    r.raise_for_status()
    return r.json()


def ensure_item_category(token: str, name: str, default_uom_id: int) -> int:
    r = httpx.get(f"{NSI_URL}/api/v1/item-categories/", headers=auth(token), timeout=20)
    r.raise_for_status()
    for c in r.json():
        if c.get("name") == name:
            return c["id"]
    rr = httpx.post(
        f"{NSI_URL}/api/v1/item-categories/",
        headers={**auth(token), "Content-Type": "application/json"},
        json={"name": name, "default_uom": default_uom_id, "is_active": True},
        timeout=20,
    )
    rr.raise_for_status()
    return rr.json()["id"]


def ensure_item(token: str, sku: str, name: str, category_id: int, posting_uom_id: int) -> int:
    r = httpx.get(f"{NSI_URL}/api/v1/items/", headers=auth(token), timeout=20)
    r.raise_for_status()
    for it in r.json():
        if it.get("sku") == sku:
            return it["id"]
    rr = httpx.post(
        f"{NSI_URL}/api/v1/items/",
        headers={**auth(token), "Content-Type": "application/json"},
        json={
            "sku": sku,
            "name": name,
            "category": category_id,
            "is_active": True,
            "policy": {
                "storage_uom": posting_uom_id,
                "posting_uom": posting_uom_id,
                "allow_fractional": True,
                "rounding_precision": 6,
            },
        },
        timeout=20,
    )
    rr.raise_for_status()
    return rr.json()["id"]


def ensure_category_package(token: str, category_id: int, package_uom_id: int, content_uom_id: int, qty: str) -> None:
    r = httpx.get(f"{NSI_URL}/api/v1/category-packages/", headers=auth(token), timeout=20)
    if r.status_code == 404:
        return
    r.raise_for_status()
    for p in r.json():
        if p.get("category") == category_id and p.get("package_uom") == package_uom_id and p.get("content_uom") == content_uom_id:
            return
    rr = httpx.post(
        f"{NSI_URL}/api/v1/category-packages/",
        headers={**auth(token), "Content-Type": "application/json"},
        json={
            "category": category_id,
            "package_uom": package_uom_id,
            "content_uom": content_uom_id,
            "content_qty": qty,
            "status": "active",
            "supplier_code": "",
            "barcode": "",
            "effective_from": None,
            "effective_to": None,
        },
        timeout=20,
    )
    rr.raise_for_status()


def ensure_global_uom_rule(token: str, from_uom_id: int, to_uom_id: int, mult: str) -> None:
    r = httpx.get(f"{NSI_URL}/api/v1/global-uom-rules/", headers=auth(token), timeout=20)
    if r.status_code == 404:
        return
    r.raise_for_status()
    for g in r.json():
        if g.get("from_uom") == from_uom_id and g.get("to_uom") == to_uom_id:
            return
    rr = httpx.post(
        f"{NSI_URL}/api/v1/global-uom-rules/",
        headers={**auth(token), "Content-Type": "application/json"},
        json={"from_uom": from_uom_id, "to_uom": to_uom_id, "multiplier": mult, "status": "active"},
        timeout=20,
    )
    rr.raise_for_status()


def ensure_rule_pcs_weight(token: str, item_id: int, from_cat_id: int, to_cat_id: int, kg_per_pc: str) -> None:
    r = httpx.get(f"{NSI_URL}/api/v1/rules/", headers=auth(token), timeout=20)
    r.raise_for_status()
    for rule in r.json():
        if rule.get("item") == item_id and rule.get("rule_type") == "pcs_weight":
            return
    httpx.post(
        f"{NSI_URL}/api/v1/rules/",
        headers={**auth(token), "Content-Type": "application/json"},
        json={
            "item": item_id,
            "from_category": from_cat_id,
            "to_category": to_cat_id,
            "rule_type": "pcs_weight",
            "conditions": {},
            "params": {"kg_per_pc": kg_per_pc},
            "priority": 0,
            "status": "active",
        },
        timeout=20,
    ).raise_for_status()


def main() -> None:
    wait_http_ok(f"{NSI_URL}/healthz")
    wait_http_ok(f"{DOCS_URL}/healthz")
    wait_http_ok(f"{KEYCLOAK_URL}/realms/uom")

    token = get_token()

    uoms = get_uoms(token)
    uom_by_code = {u["code"]: u for u in uoms}

    cats = get_uom_cats(token)
    cat_by_code = {c["code"]: c for c in cats}

    # global rules examples (will update factor_to_base for from_uom)
    if "CM" in uom_by_code and "M" in uom_by_code:
        ensure_global_uom_rule(token, uom_by_code["CM"]["id"], uom_by_code["M"]["id"], "0.01")
        ensure_global_uom_rule(token, uom_by_code["M"]["id"], uom_by_code["CM"]["id"], "100")
    if "TON" in uom_by_code and "KG" in uom_by_code:
        ensure_global_uom_rule(token, uom_by_code["TON"]["id"], uom_by_code["KG"]["id"], "1000")
        ensure_global_uom_rule(token, uom_by_code["KG"]["id"], uom_by_code["TON"]["id"], "0.001")

    # item categories + examples
    kg_id = uom_by_code.get("KG", {}).get("id")
    m_id = uom_by_code.get("M", {}).get("id") or kg_id
    bag_id = uom_by_code.get("BAG", {}).get("id")
    pcs_id = uom_by_code.get("PCS", {}).get("id")

    cement_cat_id = ensure_item_category(token, "Цемент", kg_id)
    sand_cat_id = ensure_item_category(token, "Песок", kg_id)
    fast_cat_id = ensure_item_category(token, "Крепёж", kg_id)
    pipes_cat_id = ensure_item_category(token, "Трубы", m_id)

    if bag_id and kg_id:
        ensure_category_package(token, cement_cat_id, bag_id, kg_id, "50")
        ensure_category_package(token, sand_cat_id, bag_id, kg_id, "25")

    if m_id:
        ensure_item(token, "PIPE-DEMO-001", "Труба канализационная", pipes_cat_id, m_id)

    bolt_id = ensure_item(
        token,
        "BOLT-DEMO-001",
        "Рым-болт удлиненный АРТ 8267 (AISI 316) М6х40",
        fast_cat_id,
        kg_id,
    )
    if pcs_id and kg_id and cat_by_code.get("COUNT") and cat_by_code.get("MASS"):
        ensure_rule_pcs_weight(token, bolt_id, cat_by_code["COUNT"]["id"], cat_by_code["MASS"]["id"], "0.023")  # 23 g

    print("[seed] done")


if __name__ == "__main__":
    main()

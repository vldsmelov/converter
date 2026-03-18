from __future__ import annotations

from decimal import Decimal

from django.db import transaction

from apps.catalog.models import CategoryPackageSpec, ItemCategory

from .models import ConversionRule, GlobalUomRule, Item, ItemPolicy, PackageSpec, SystemDefaultField, UoM, UoMCategory


def _seed_defaults() -> dict:
    created = {
        "uom_categories": 0,
        "uoms": 0,
        "item_categories": 0,
        "items": 0,
        "item_policies": 0,
        "category_packages": 0,
        "packages": 0,
        "rules": 0,
        "global_uom_rules": 0,
    }

    cats: dict[str, UoMCategory] = {}
    for code, name in [
        ("MASS", "Mass"),
        ("VOLUME", "Volume"),
        ("LENGTH", "Length"),
        ("COUNT", "Count"),
    ]:
        cats[code] = UoMCategory.objects.create(code=code, name=name)
        created["uom_categories"] += 1

    uoms: dict[str, UoM] = {}

    def add_uom(code: str, name: str, cat_code: str, factor_to_base: str, precision: int) -> UoM:
        obj = UoM.objects.create(
            code=code,
            name=name,
            category=cats[cat_code],
            factor_to_base=Decimal(factor_to_base),
            precision=precision,
        )
        created["uoms"] += 1
        uoms[code] = obj
        return obj

    add_uom("KG", "Kilogram", "MASS", "1", 3)
    add_uom("G", "Gram", "MASS", "0.001", 0)
    add_uom("TON", "Tonne", "MASS", "1000", 3)
    add_uom("L", "Liter", "VOLUME", "1", 3)
    add_uom("ML", "Milliliter", "VOLUME", "0.001", 0)
    add_uom("M", "Meter", "LENGTH", "1", 3)
    add_uom("CM", "Centimeter", "LENGTH", "0.01", 0)
    add_uom("PCS", "Piece", "COUNT", "1", 0)
    add_uom("BAG", "Bag", "COUNT", "1", 0)

    item_cats: dict[str, ItemCategory] = {}
    for key, name, default_uom in [
        ("CEMENT", "Cement", "KG"),
        ("SAND", "Sand", "KG"),
        ("FASTENERS", "Fasteners", "KG"),
        ("PIPES", "Pipes", "M"),
    ]:
        item_cats[key] = ItemCategory.objects.create(name=name, default_uom=uoms[default_uom], is_active=True)
        created["item_categories"] += 1

    def add_item(sku: str, name: str, category_key: str, storage_uom: str, posting_uom: str) -> Item:
        item = Item.objects.create(
            sku=sku,
            name=name,
            category=item_cats[category_key],
            is_active=True,
        )
        created["items"] += 1
        ItemPolicy.objects.create(
            item=item,
            storage_uom=uoms[storage_uom],
            posting_uom=uoms[posting_uom],
            allow_fractional=True,
            rounding_precision=6,
        )
        created["item_policies"] += 1
        return item

    pipe_item = add_item("PIPE-DEMO-001", "Pipe demo", "PIPES", "M", "M")
    bolt_item = add_item("BOLT-DEMO-001", "Bolt demo", "FASTENERS", "KG", "KG")
    demo_item = add_item("DEMO-ITEM-001", "Demo item (for converter tests)", "FASTENERS", "KG", "KG")

    for cat_key, qty in [("CEMENT", "50"), ("SAND", "25")]:
        CategoryPackageSpec.objects.create(
            category=item_cats[cat_key],
            package_uom=uoms["BAG"],
            content_uom=uoms["KG"],
            content_qty=Decimal(qty),
            status="active",
            supplier_code="",
            barcode="",
        )
        created["category_packages"] += 1

    PackageSpec.objects.create(
        item=demo_item,
        package_uom=uoms["BAG"],
        content_uom=uoms["KG"],
        content_qty=Decimal("25"),
        status="active",
        supplier_code="",
        barcode="",
    )
    created["packages"] += 1

    for payload in [
        {
            "item": bolt_item,
            "from_category": cats["COUNT"],
            "to_category": cats["MASS"],
            "rule_type": "pcs_weight",
            "params": {"kg_per_pc": "0.023"},
        },
        {
            "item": demo_item,
            "from_category": cats["COUNT"],
            "to_category": cats["MASS"],
            "rule_type": "pcs_weight",
            "params": {"kg_per_pc": "2.5"},
        },
        {
            "item": pipe_item,
            "from_category": cats["LENGTH"],
            "to_category": cats["MASS"],
            "rule_type": "kg_per_m",
            "params": {"kg_per_m": "1.2"},
        },
        {
            "item": None,
            "from_category": cats["MASS"],
            "to_category": cats["VOLUME"],
            "rule_type": "density",
            "params": {"density_kg_per_l": "0.8"},
        },
    ]:
        ConversionRule.objects.create(
            item=payload["item"],
            from_category=payload["from_category"],
            to_category=payload["to_category"],
            rule_type=payload["rule_type"],
            conditions={},
            params=payload["params"],
            priority=0,
            status="active",
        )
        created["rules"] += 1

    for from_code, to_code, multiplier in [
        ("CM", "M", "0.01"),
        ("M", "CM", "100"),
        ("TON", "KG", "1000"),
        ("KG", "TON", "0.001"),
    ]:
        GlobalUomRule.objects.create(
            from_uom=uoms[from_code],
            to_uom=uoms[to_code],
            multiplier=Decimal(multiplier),
            status="active",
        )
        created["global_uom_rules"] += 1

    return created


def reset_to_defaults() -> dict:
    with transaction.atomic():
        deleted = {
            "rules": ConversionRule.objects.count(),
            "global_uom_rules": GlobalUomRule.objects.count(),
            "packages": PackageSpec.objects.count(),
            "category_packages": CategoryPackageSpec.objects.count(),
            "items": Item.objects.count(),
            "item_categories": ItemCategory.objects.count(),
            "uoms": UoM.objects.count(),
            "uom_categories": UoMCategory.objects.count(),
        }

        ConversionRule.objects.all().delete()
        GlobalUomRule.objects.all().delete()
        PackageSpec.objects.all().delete()
        CategoryPackageSpec.objects.all().delete()
        Item.objects.all().delete()
        ItemCategory.objects.all().delete()
        UoM.objects.all().delete()
        UoMCategory.objects.all().delete()

        created = _seed_defaults()

    return {
        "deleted": deleted,
        "created": created,
        "preserved": {
            "system_default_fields": SystemDefaultField.objects.count(),
        },
    }

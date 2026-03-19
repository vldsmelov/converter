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
    add_uom("M3", "Cubic meter", "VOLUME", "1000", 3)
    add_uom("M", "Meter", "LENGTH", "1", 3)
    add_uom("CM", "Centimeter", "LENGTH", "0.01", 0)
    add_uom("PCS", "Piece", "COUNT", "1", 0)
    add_uom("BAG", "Bag", "COUNT", "1", 0)

    item_cats: dict[str, ItemCategory] = {}
    for key, name, default_uom in [
        ("FASTENERS", "Fasteners", "KG"),
        ("BULK_MATERIALS", "Сыпучие стройматериалы", "M3"),
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

    fastener_items = [
        add_item("FAST-BOLT-M20X65-GOST7798-001", "Болт M20x65, 8,8, ГОСТ 7798-70 оц.", "FASTENERS", "KG", "KG"),
        add_item("FAST-NUT-M16-8.8-ZN-KP8-001", "Гайка M16, 8,8, оцинк КП 8", "FASTENERS", "KG", "KG"),
        add_item("FAST-NUT-M20-8.8-ZN-KP8-KK-001", "Гайка M20, 8,8, оцинк КП 8 KK", "FASTENERS", "KG", "KG"),
        add_item("FAST-WASHER-16-8.8-ZN-M16-DIN125-001", "Шайба 16, 8,8, оц М16 DIN 125", "FASTENERS", "KG", "KG"),
        add_item(
            "FAST-WASHER-20-8.8-ZN-M20-DIN125-KKSR-001",
            "Шайба 20, 8,8, оц М20 DIN 125 KK/SR",
            "FASTENERS",
            "KG",
            "KG",
        ),
        add_item(
            "FAST-WASHER-LARGE-M16-ZN-DIN9021-001",
            "Шайба увеличенная М16 ОЦ (25кг) DIN9021 (ГОСТ 6958)",
            "FASTENERS",
            "KG",
            "KG",
        ),
        add_item("FAST-NUT-M16-DIN934-001", "Гайка M16 DIN 934", "FASTENERS", "KG", "KG"),
        add_item("FAST-NUT-M20-DIN934-001", "Гайка M20 DIN 934", "FASTENERS", "KG", "KG"),
        add_item("FAST-WASHER-D16-DIN125-001", "Шайба d16 , DIN 125", "FASTENERS", "KG", "KG"),
        add_item("FAST-WASHER-D20-DIN125-001", "Шайба d20 , DIN 125", "FASTENERS", "KG", "KG"),
        add_item("FAST-BOLT-20X60-DIN933-001", "Болт 20х60 DIN 933", "FASTENERS", "KG", "KG"),
        add_item("FAST-BOLT-16X55-DIN933-001", "Болт 16х55 DIN 933", "FASTENERS", "KG", "KG"),
    ]
    bulk_items = [
        add_item("BULK-CRUSH-M800-20-40-001", "Щебень М 800, фракция 20-40 мм", "BULK_MATERIALS", "M3", "M3"),
        add_item("BULK-CRUSH-M800-20-40-002", "Щебень М 800, фракция 20-40 мм", "BULK_MATERIALS", "M3", "M3"),
        add_item("BULK-GRAVEL-5X20-001", "Щебень гравийный 5х20", "BULK_MATERIALS", "M3", "M3"),
        add_item(
            "BULK-DENSE-ROCK-M800-20-40-001",
            "Щебень из плотных горных пород для строительных работ М 800, фракция 20-40 мм",
            "BULK_MATERIALS",
            "M3",
            "M3",
        ),
        add_item("BULK-RIVER-SAND-001", "Песок речной", "BULK_MATERIALS", "M3", "M3"),
        add_item(
            "BULK-NATURAL-SAND-II-MEDIUM-001",
            "Песок природный для строительных работ II класс, средний",
            "BULK_MATERIALS",
            "M3",
            "M3",
        ),
    ]

    for payload in [
        {
            "item": fastener_items[0],
            "from_category": cats["COUNT"],
            "to_category": cats["MASS"],
            "rule_type": "pcs_weight",
            "params": {"kg_per_pc": "0.219"},
        },
        {
            "item": fastener_items[1],
            "from_category": cats["COUNT"],
            "to_category": cats["MASS"],
            "rule_type": "pcs_weight",
            "params": {"kg_per_pc": "0.0333"},
        },
        {
            "item": fastener_items[2],
            "from_category": cats["COUNT"],
            "to_category": cats["MASS"],
            "rule_type": "pcs_weight",
            "params": {"kg_per_pc": "0.0640"},
        },
        {
            "item": fastener_items[3],
            "from_category": cats["COUNT"],
            "to_category": cats["MASS"],
            "rule_type": "pcs_weight",
            "params": {"kg_per_pc": "0.0113"},
        },
        {
            "item": fastener_items[4],
            "from_category": cats["COUNT"],
            "to_category": cats["MASS"],
            "rule_type": "pcs_weight",
            "params": {"kg_per_pc": "0.0172"},
        },
        {
            "item": fastener_items[5],
            "from_category": cats["COUNT"],
            "to_category": cats["MASS"],
            "rule_type": "pcs_weight",
            "params": {"kg_per_pc": "0.0409"},
        },
        {
            "item": fastener_items[6],
            "from_category": cats["COUNT"],
            "to_category": cats["MASS"],
            "rule_type": "pcs_weight",
            "params": {"kg_per_pc": "0.0333"},
        },
        {
            "item": fastener_items[7],
            "from_category": cats["COUNT"],
            "to_category": cats["MASS"],
            "rule_type": "pcs_weight",
            "params": {"kg_per_pc": "0.0640"},
        },
        {
            "item": fastener_items[8],
            "from_category": cats["COUNT"],
            "to_category": cats["MASS"],
            "rule_type": "pcs_weight",
            "params": {"kg_per_pc": "0.0113"},
        },
        {
            "item": fastener_items[9],
            "from_category": cats["COUNT"],
            "to_category": cats["MASS"],
            "rule_type": "pcs_weight",
            "params": {"kg_per_pc": "0.0172"},
        },
        {
            "item": fastener_items[10],
            "from_category": cats["COUNT"],
            "to_category": cats["MASS"],
            "rule_type": "pcs_weight",
            "params": {"kg_per_pc": "0.2440"},
        },
        {
            "item": fastener_items[11],
            "from_category": cats["COUNT"],
            "to_category": cats["MASS"],
            "rule_type": "pcs_weight",
            "params": {"kg_per_pc": "0.1122"},
        },
        {
            "item": bulk_items[0],
            "from_category": cats["MASS"],
            "to_category": cats["VOLUME"],
            "rule_type": "density",
            "params": {"density_kg_per_l": "1.41"},
        },
        {
            "item": bulk_items[1],
            "from_category": cats["MASS"],
            "to_category": cats["VOLUME"],
            "rule_type": "density",
            "params": {"density_kg_per_l": "1.41"},
        },
        {
            "item": bulk_items[2],
            "from_category": cats["MASS"],
            "to_category": cats["VOLUME"],
            "rule_type": "density",
            "params": {"density_kg_per_l": "1.4"},
        },
        {
            "item": bulk_items[3],
            "from_category": cats["MASS"],
            "to_category": cats["VOLUME"],
            "rule_type": "density",
            "params": {"density_kg_per_l": "1.45"},
        },
        {
            "item": bulk_items[4],
            "from_category": cats["MASS"],
            "to_category": cats["VOLUME"],
            "rule_type": "density",
            "params": {"density_kg_per_l": "1.6"},
        },
        {
            "item": bulk_items[5],
            "from_category": cats["MASS"],
            "to_category": cats["VOLUME"],
            "rule_type": "density",
            "params": {"density_kg_per_l": "1.55"},
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
        ("M3", "L", "1000"),
        ("L", "M3", "0.001"),
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

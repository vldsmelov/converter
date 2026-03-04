from decimal import Decimal

from django.db import migrations


def seed_demo(apps, schema_editor):
    UoMCategory = apps.get_model("nsi_core", "UoMCategory")
    UoM = apps.get_model("nsi_core", "UoM")
    Item = apps.get_model("nsi_core", "Item")
    ItemPolicy = apps.get_model("nsi_core", "ItemPolicy")
    PackageSpec = apps.get_model("nsi_core", "PackageSpec")
    ConversionRule = apps.get_model("nsi_core", "ConversionRule")

    # ---- Categories ----
    # Делаем сид идемпотентным: если уже есть записи (например, после старого запуска),
    # обновим значения.
    cats = {}
    for code, name in [
        ("MASS", "Масса"),
        ("VOLUME", "Объём"),
        ("LENGTH", "Длина"),
        ("COUNT", "Штуки"),
    ]:
        obj, _ = UoMCategory.objects.update_or_create(code=code, defaults={"name": name})
        cats[code] = obj

    # ---- UoMs ----
    def uom(code: str, name: str, cat_code: str, factor_to_base: str, precision: int):
        obj, _ = UoM.objects.update_or_create(
            code=code,
            defaults={
                "name": name,
                "category": cats[cat_code],
                "factor_to_base": Decimal(factor_to_base),
                "precision": precision,
            },
        )
        return obj

    kg = uom("KG", "Килограмм", "MASS", "1", 3)
    uom("G", "Грамм", "MASS", "0.001", 0)
    uom("TON", "Тонна", "MASS", "1000", 3)

    uom("L", "Литр", "VOLUME", "1", 3)
    uom("ML", "Миллилитр", "VOLUME", "0.001", 0)

    uom("M", "Метр", "LENGTH", "1", 3)
    uom("CM", "Сантиметр", "LENGTH", "0.01", 0)

    pcs = uom("PCS", "Штука", "COUNT", "1", 0)
    bag = uom("BAG", "Мешок", "COUNT", "1", 0)

    # ---- Demo Item ----
    item, _ = Item.objects.update_or_create(
        sku="DEMO-ITEM-001",
        defaults={"name": "Demo item (for converter tests)", "is_active": True},
    )

    ItemPolicy.objects.update_or_create(
        item=item,
        defaults={
            "storage_uom": kg,
            "posting_uom": kg,
            "allow_fractional": True,
            "rounding_precision": 3,
        },
    )

    # ---- Demo package: 1 BAG = 25 KG ----
    PackageSpec.objects.update_or_create(
        item=item,
        package_uom=bag,
        content_uom=kg,
        defaults={
            "content_qty": Decimal("25"),
            "status": "active",
        },
    )

    # ---- Demo rule: 1 PCS = 2.5 KG (count<->mass) ----
    ConversionRule.objects.update_or_create(
        item=item,
        from_category=cats["COUNT"],
        to_category=cats["MASS"],
        rule_type="pcs_weight",
        defaults={
            "conditions": {},
            "params": {"kg_per_pc": "2.5"},
            "priority": 0,
            "status": "active",
        },
    )

    # ---- Global density rule MASS<->VOLUME (for extra tests) ----
    ConversionRule.objects.update_or_create(
        item=None,
        from_category=cats["MASS"],
        to_category=cats["VOLUME"],
        rule_type="density",
        defaults={
            "conditions": {},
            "params": {"density_kg_per_l": "0.8"},
            "priority": 0,
            "status": "active",
        },
    )


class Migration(migrations.Migration):
    dependencies = [
        ("nsi_core", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_demo, migrations.RunPython.noop),
    ]

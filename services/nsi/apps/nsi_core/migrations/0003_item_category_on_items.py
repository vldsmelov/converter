from django.db import migrations, models
import django.db.models.deletion


def forwards(apps, schema_editor):
    UoM = apps.get_model("nsi_core", "UoM")
    Item = apps.get_model("nsi_core", "Item")
    ItemCategory = apps.get_model("catalog", "ItemCategory")

    # берем KG как дефолт (должен существовать из сидов). Если нет — возьмем первый UoM.
    kg = UoM.objects.filter(code="KG").first() or UoM.objects.order_by("id").first()
    if kg is None:
        return

    default_cat, _ = ItemCategory.objects.get_or_create(
        name="Без категории",
        defaults={"default_uom": kg, "is_active": True},
    )

    # привязываем все существующие позиции
    Item.objects.filter(category__isnull=True).update(category=default_cat)


class Migration(migrations.Migration):
    # PostgreSQL can error with:
    #   "cannot ALTER TABLE ... because it has pending trigger events"
    # when we both INSERT into referenced table (ItemCategory) and run ALTER statements
    # in the same transaction. Disable atomic wrapping so each statement is committed.
    atomic = False

    dependencies = [
        ("nsi_core", "0002_seed_demo_data"),
        ("catalog", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="item",
            name="sku",
            field=models.CharField(max_length=64, unique=True, null=True, blank=True),
        ),
        migrations.AddField(
            model_name="item",
            name="category",
            field=models.ForeignKey(
                to="catalog.itemcategory",
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="items",
            ),
        ),
        migrations.RunPython(forwards, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="item",
            name="category",
            field=models.ForeignKey(
                to="catalog.itemcategory",
                on_delete=django.db.models.deletion.PROTECT,
                related_name="items",
            ),
        ),
    ]

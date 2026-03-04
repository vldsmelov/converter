# Generated manually for prototype branch (initial schema for NSI)

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="UoMCategory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=32, unique=True)),
                ("name", models.CharField(max_length=128)),
            ],
        ),
        migrations.CreateModel(
            name="UoM",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=32, unique=True)),
                ("name", models.CharField(max_length=128)),
                (
                    "category",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="uoms",
                        to="nsi_core.uomcategory",
                    ),
                ),
                ("factor_to_base", models.DecimalField(decimal_places=9, default=1, max_digits=18)),
                ("precision", models.PositiveSmallIntegerField(default=3)),
            ],
        ),
        migrations.CreateModel(
            name="Item",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sku", models.CharField(max_length=64, unique=True)),
                ("name", models.CharField(max_length=256)),
                ("is_active", models.BooleanField(default=True)),
            ],
        ),
        migrations.CreateModel(
            name="ItemPolicy",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "item",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="policy",
                        to="nsi_core.item",
                    ),
                ),
                (
                    "storage_uom",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="storage_for_items",
                        to="nsi_core.uom",
                    ),
                ),
                (
                    "posting_uom",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="posting_for_items",
                        to="nsi_core.uom",
                    ),
                ),
                ("allow_fractional", models.BooleanField(default=True)),
                ("rounding_precision", models.PositiveSmallIntegerField(blank=True, null=True)),
            ],
        ),
        migrations.CreateModel(
            name="PackageSpec",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("content_qty", models.DecimalField(decimal_places=6, max_digits=18)),
                ("supplier_code", models.CharField(blank=True, default="", max_length=64)),
                ("barcode", models.CharField(blank=True, default="", max_length=64)),
                (
                    "status",
                    models.CharField(
                        choices=[("draft", "Draft"), ("active", "Active"), ("archived", "Archived")],
                        default="draft",
                        max_length=16,
                    ),
                ),
                ("effective_from", models.DateField(blank=True, null=True)),
                ("effective_to", models.DateField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="packages",
                        to="nsi_core.item",
                    ),
                ),
                (
                    "package_uom",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="package_specs",
                        to="nsi_core.uom",
                    ),
                ),
                (
                    "content_uom",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="package_contents",
                        to="nsi_core.uom",
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["item", "package_uom", "status"], name="nsi_pkg_item_uom_status_idx"),
                    models.Index(fields=["barcode"], name="nsi_pkg_barcode_idx"),
                ]
            },
        ),
        migrations.CreateModel(
            name="ConversionRule",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("logical_id", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False)),
                ("version", models.PositiveIntegerField(default=1)),
                (
                    "rule_type",
                    models.CharField(
                        choices=[
                            ("density", "Density (mass<->volume)"),
                            ("kg_per_m", "Kg per meter (mass<->length)"),
                            ("pcs_weight", "Piece weight (count<->mass)"),
                            ("custom_expr", "Custom expression"),
                        ],
                        max_length=32,
                    ),
                ),
                ("conditions", models.JSONField(blank=True, default=dict)),
                ("params", models.JSONField(default=dict)),
                ("priority", models.IntegerField(default=0)),
                (
                    "status",
                    models.CharField(
                        choices=[("draft", "Draft"), ("active", "Active"), ("archived", "Archived")],
                        default="draft",
                        max_length=16,
                    ),
                ),
                ("effective_from", models.DateField(blank=True, null=True)),
                ("effective_to", models.DateField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "supersedes",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="superseded_by",
                        to="nsi_core.conversionrule",
                    ),
                ),
                (
                    "item",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="conversion_rules",
                        to="nsi_core.item",
                    ),
                ),
                (
                    "from_category",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="rules_from",
                        to="nsi_core.uomcategory",
                    ),
                ),
                (
                    "to_category",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="rules_to",
                        to="nsi_core.uomcategory",
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["item", "status"], name="nsi_rule_item_status_idx"),
                    models.Index(fields=["logical_id", "version"], name="nsi_rule_logical_version_idx"),
                    models.Index(fields=["status", "from_category", "to_category"], name="nsi_rule_status_pair_idx"),
                ]
            },
        ),
    ]

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0001_initial"),
        ("nsi_core", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="CategoryPackageSpec",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("content_qty", models.DecimalField(decimal_places=6, max_digits=18)),
                ("supplier_code", models.CharField(blank=True, default="", max_length=64)),
                ("barcode", models.CharField(blank=True, default="", max_length=64)),
                ("status", models.CharField(choices=[("draft", "Draft"), ("active", "Active"), ("archived", "Archived")], default="draft", max_length=16)),
                ("effective_from", models.DateField(blank=True, null=True)),
                ("effective_to", models.DateField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("category", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="package_specs", to="catalog.itemcategory")),
                ("package_uom", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="category_package_specs", to="nsi_core.uom")),
                ("content_uom", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="category_package_contents", to="nsi_core.uom")),
            ],
            options={
                "ordering": ["-created_at", "-id"],
                "indexes": [
                    models.Index(fields=["category", "package_uom", "status"], name="catpkg_cat_pkg_status_idx"),
                    models.Index(fields=["barcode"], name="catpkg_barcode_idx"),
                ],
            },
        ),
    ]

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("nsi_core", "0003_item_category_on_items"),
    ]

    operations = [
        migrations.CreateModel(
            name="GlobalUomRule",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("multiplier", models.DecimalField(decimal_places=9, max_digits=18)),
                ("status", models.CharField(choices=[("draft", "Draft"), ("active", "Active"), ("archived", "Archived")], default="active", max_length=16)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("from_uom", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="global_rules_from", to="nsi_core.uom")),
                ("to_uom", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="global_rules_to", to="nsi_core.uom")),
            ],
            options={
                "ordering": ["-created_at", "-id"],
                "indexes": [
                    models.Index(fields=["status", "from_uom", "to_uom"], name="globuom_status_from_to_idx"),
                ],
            },
        ),
        migrations.AddConstraint(
            model_name="globaluomrule",
            constraint=models.UniqueConstraint(fields=("from_uom", "to_uom"), name="uniq_global_uom_rule_pair"),
        ),
    ]

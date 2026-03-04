from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("documents_core", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="invoice",
            name="status",
            field=models.CharField(
                choices=[
                    ("new", "New"),
                    ("calculating", "Calculating"),
                    ("calculated", "Calculated"),
                    ("generating", "Generating"),
                    ("generated", "Generated"),
                    ("failed", "Failed"),
                ],
                default="new",
                max_length=16,
            ),
        ),
        migrations.CreateModel(
            name="InvoiceFile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file_type", models.CharField(choices=[("xlsx", "XLSX"), ("pdf", "PDF")], max_length=8)),
                ("object_key", models.CharField(max_length=512)),
                ("file_name", models.CharField(max_length=256)),
                ("content_type", models.CharField(max_length=128)),
                ("size", models.BigIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "invoice",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="files",
                        to="documents_core.invoice",
                    ),
                ),
            ],
            options={
                "unique_together": {("invoice", "file_type")},
            },
        ),
        migrations.AddIndex(
            model_name="invoicefile",
            index=models.Index(fields=["invoice", "file_type"], name="documents_c_invoicef_6c2f49_idx"),
        ),
    ]

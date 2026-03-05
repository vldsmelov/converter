from __future__ import annotations

from django.core.exceptions import ValidationError
from django.db import models


class ItemCategory(models.Model):
    """Категория номенклатуры (трубы/провода/цемент и т.д.)."""

    name = models.CharField(max_length=128, unique=True)
    default_uom = models.ForeignKey(
        "nsi_core.UoM",
        on_delete=models.PROTECT,
        related_name="item_categories_default_for",
    )
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["is_active", "name"], name="nsi_itemcat_active_name_idx"),
        ]
        ordering = ["id"]

    def __str__(self) -> str:
        return self.name


class CategoryPackageSpec(models.Model):
    """Правило "упаковка -> содержимое" на уровне категории.

    Пример: Категория "Цемент": 1 BAG = 50 KG
            Категория "Песок": 1 BAG = 25 KG

    Используется конвертером так же, как PackageSpec на уровне номенклатурной позиции,
    но применяется только если у позиции нет собственного PackageSpec для этой упаковки.
    """

    category = models.ForeignKey(ItemCategory, on_delete=models.CASCADE, related_name="package_specs")
    package_uom = models.ForeignKey("nsi_core.UoM", on_delete=models.PROTECT, related_name="category_package_specs")
    content_qty = models.DecimalField(max_digits=18, decimal_places=6)
    content_uom = models.ForeignKey("nsi_core.UoM", on_delete=models.PROTECT, related_name="category_package_contents")

    supplier_code = models.CharField(max_length=64, blank=True, default="")
    barcode = models.CharField(max_length=64, blank=True, default="")
    STATUS_CHOICES = (("draft","Draft"),("active","Active"),("archived","Archived"))

    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="draft")
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["category", "package_uom", "status"]),
            models.Index(fields=["barcode"]),
        ]
        ordering = ["-created_at", "-id"]

    def clean(self):
        if self.content_qty is None or self.content_qty <= 0:
            raise ValidationError({"content_qty": "content_qty must be > 0"})
        if self.package_uom and self.package_uom.category.code != "COUNT":
            raise ValidationError({"package_uom": "package_uom must be in COUNT category (e.g. BAG/BOX)."})
        if self.effective_from and self.effective_to and self.effective_from > self.effective_to:
            raise ValidationError({"effective_to": "effective_to must be >= effective_from"})

    def __str__(self) -> str:
        return f"{self.category_id}: 1 {self.package_uom.code} = {self.content_qty} {self.content_uom.code}"

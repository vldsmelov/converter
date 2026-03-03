from django.core.exceptions import ValidationError
from django.db import models

class UoMCategory(models.Model):
    code = models.CharField(max_length=32, unique=True)  # MASS/VOLUME/LENGTH/COUNT
    name = models.CharField(max_length=128)

    def __str__(self):
        return f"{self.code} — {self.name}"

class UoM(models.Model):
    code = models.CharField(max_length=32, unique=True)  # KG, TON, L, M, PCS...
    name = models.CharField(max_length=128)
    category = models.ForeignKey(UoMCategory, on_delete=models.PROTECT, related_name="uoms")
    factor_to_base = models.DecimalField(max_digits=18, decimal_places=9, default=1)  # to base of category
    precision = models.PositiveSmallIntegerField(default=3)

    def __str__(self):
        return self.code

class Item(models.Model):
    sku = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=256)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.sku} — {self.name}"

class ItemPolicy(models.Model):
    item = models.OneToOneField(Item, on_delete=models.CASCADE, related_name="policy")
    storage_uom = models.ForeignKey(UoM, on_delete=models.PROTECT, related_name="storage_for_items")
    posting_uom = models.ForeignKey(UoM, on_delete=models.PROTECT, related_name="posting_for_items", null=True, blank=True)
    allow_fractional = models.BooleanField(default=True)  # можно ли дроби в эталонной мере
    rounding_precision = models.PositiveSmallIntegerField(null=True, blank=True)  # override, если надо

    def clean(self):
        if self.posting_uom is None:
            # разрешаем не заполнять — на save подставим storage
            return
        # мягкая валидация: часто posting=storage, но иногда бывает иначе.
        # Не запрещаем, но можно включить строгую проверку позже.

    def save(self, *args, **kwargs):
        if self.posting_uom is None:
            self.posting_uom = self.storage_uom
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Policy for {self.item.sku}"
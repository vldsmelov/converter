from django.core.exceptions import ValidationError
from django.utils import timezone
from django.db import models
import uuid

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


class RefStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    ACTIVE = "active", "Active"
    ARCHIVED = "archived", "Archived"

class PackageSpec(models.Model):
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="packages")

    package_uom = models.ForeignKey(UoM, on_delete=models.PROTECT, related_name="package_specs")
    content_qty = models.DecimalField(max_digits=18, decimal_places=6)
    content_uom = models.ForeignKey(UoM, on_delete=models.PROTECT, related_name="package_contents")

    supplier_code = models.CharField(max_length=64, blank=True, default="")  # например код поставщика/контракта
    barcode = models.CharField(max_length=64, blank=True, default="")

    status = models.CharField(max_length=16, choices=RefStatus.choices, default=RefStatus.DRAFT)
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["item", "package_uom", "status"]),
            models.Index(fields=["barcode"]),
        ]

    def clean(self):
        if self.content_qty is None or self.content_qty <= 0:
            raise ValidationError({"content_qty": "content_qty must be > 0"})

        # пакеты должны быть COUNT (BAG/CAN/PCS)
        if self.package_uom and self.package_uom.category.code != "COUNT":
            raise ValidationError({"package_uom": "package_uom must be in COUNT category (e.g. BAG/CAN/BOX)."})

        # содержимое НЕ должно быть LENGTH? может быть, но обычно KG/L/PCS.
        # не запрещаем жёстко, но можно включить позже.

        if self.effective_from and self.effective_to and self.effective_from > self.effective_to:
            raise ValidationError({"effective_to": "effective_to must be >= effective_from"})

    def __str__(self):
        return f"{self.item.sku}: 1 {self.package_uom.code} = {self.content_qty} {self.content_uom.code}"


class RuleType(models.TextChoices):
    DENSITY = "density", "Density (mass<->volume)"
    KG_PER_M = "kg_per_m", "Kg per meter (mass<->length)"
    PCS_WEIGHT = "pcs_weight", "Piece weight (count<->mass)"
    CUSTOM_EXPR = "custom_expr", "Custom expression"

class ConversionRule(models.Model):
    logical_id = models.UUIDField(default=uuid.uuid4, editable=False, db_index=True)
    version = models.PositiveIntegerField(default=1)
    supersedes = models.ForeignKey("self", null=True, blank=True, on_delete=models.PROTECT, related_name="superseded_by")

    item = models.ForeignKey(Item, null=True, blank=True, on_delete=models.CASCADE, related_name="conversion_rules")

    from_category = models.ForeignKey(UoMCategory, on_delete=models.PROTECT, related_name="rules_from")
    to_category = models.ForeignKey(UoMCategory, on_delete=models.PROTECT, related_name="rules_to")

    rule_type = models.CharField(max_length=32, choices=RuleType.choices)

    # применимость: все ключи должны совпасть с context
    conditions = models.JSONField(default=dict, blank=True)
    # параметры формулы
    params = models.JSONField(default=dict)

    priority = models.IntegerField(default=0)
    status = models.CharField(max_length=16, choices=RefStatus.choices, default=RefStatus.DRAFT)
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["item", "status"]),
            models.Index(fields=["logical_id", "version"]),
            models.Index(fields=["status", "from_category", "to_category"]),
        ]

    def clean(self):
        if self.effective_from and self.effective_to and self.effective_from > self.effective_to:
            raise ValidationError({"effective_to": "effective_to must be >= effective_from"})

        # базовая проверка на соответствие rule_type категориям:
        fc = self.from_category.code if self.from_category_id else None
        tc = self.to_category.code if self.to_category_id else None

        if self.rule_type == RuleType.DENSITY:
            if set([fc, tc]) != set(["MASS", "VOLUME"]):
                raise ValidationError("DENSITY requires MASS<->VOLUME categories")
            if "density_kg_per_l" not in self.params:
                raise ValidationError("DENSITY params must contain density_kg_per_l")
        elif self.rule_type == RuleType.KG_PER_M:
            if set([fc, tc]) != set(["MASS", "LENGTH"]):
                raise ValidationError("KG_PER_M requires MASS<->LENGTH categories")
            if "kg_per_m" not in self.params:
                raise ValidationError("KG_PER_M params must contain kg_per_m")
        elif self.rule_type == RuleType.PCS_WEIGHT:
            if set([fc, tc]) != set(["COUNT", "MASS"]):
                raise ValidationError("PCS_WEIGHT requires COUNT<->MASS categories")
            if "kg_per_pc" not in self.params:
                raise ValidationError("PCS_WEIGHT params must contain kg_per_pc")

    def save(self, *args, **kwargs):
        # Версионирование: если это новая запись и есть supersedes — наследуем logical_id и увеличиваем version
        if self._state.adding and self.supersedes_id:
            self.logical_id = self.supersedes.logical_id
            self.version = self.supersedes.version + 1
        super().save(*args, **kwargs)

    def __str__(self):
        scope = self.item.sku if self.item_id else "GLOBAL"
        return f"{scope} {self.rule_type} v{self.version} ({self.from_category.code}<->{self.to_category.code}) [{self.status}]"
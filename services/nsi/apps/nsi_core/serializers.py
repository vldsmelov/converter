from __future__ import annotations

import uuid

from rest_framework import serializers

from apps.catalog.models import CategoryPackageSpec, ItemCategory

from .models import (
    Counterparty,
    ConversionRule,
    DefaultFieldType,
    GlobalUomRule,
    Item,
    ItemPolicy,
    PackageSpec,
    SystemDefaultField,
    UoM,
    UoMCategory,
)


class PackageSpecSerializer(serializers.ModelSerializer):
    class Meta:
        model = PackageSpec
        fields = [
            "id",
            "item",
            "status",
            "package_uom",
            "content_qty",
            "content_uom",
            "supplier_code",
            "barcode",
            "effective_from",
            "effective_to",
        ]


class CategoryPackageSpecAsPackageSerializer(serializers.ModelSerializer):
    """Сериализуем категорийный PackageSpec в формате, совместимом с конвертером (как PackageSpec)."""

    item = serializers.SerializerMethodField()

    class Meta:
        model = CategoryPackageSpec
        fields = [
            "id",
            "item",
            "status",
            "package_uom",
            "content_qty",
            "content_uom",
            "supplier_code",
            "barcode",
            "effective_from",
            "effective_to",
            "category",
        ]

    def get_item(self, obj):
        # для совместимости (конвертер не использует item, но пусть будет)
        item_id = self.context.get("item_id")
        return item_id


class UoMCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = UoMCategory
        fields = ["id", "code", "name"]


class UoMSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(queryset=UoMCategory.objects.all())

    class Meta:
        model = UoM
        fields = ["id", "code", "name", "category", "factor_to_base", "precision"]


class CounterpartySerializer(serializers.ModelSerializer):
    class Meta:
        model = Counterparty
        fields = ["id", "name", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]


class ItemPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemPolicy
        fields = ["storage_uom", "posting_uom", "allow_fractional", "rounding_precision"]


class ItemSerializer(serializers.ModelSerializer):
    # sku оставляем, но делаем необязательным (можно не задавать из UI)
    sku = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    category = serializers.PrimaryKeyRelatedField(queryset=ItemCategory.objects.all())
    policy = ItemPolicySerializer(required=False)

    # IMPORTANT: packages here are used by conversion-service to unpack BAG/BOX/etc.
    # We merge item-level packages + category-level packages.
    packages = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = ["id", "sku", "name", "category", "density_kg_per_l", "is_active", "policy", "packages"]

    def _default_policy(self, category: ItemCategory) -> dict:
        u = category.default_uom
        return {
            "storage_uom": u,
            "posting_uom": u,
            "allow_fractional": True,
            "rounding_precision": 3,
        }

    def get_packages(self, obj: Item):
        item_pkgs = list(obj.packages.all())
        item_pkg_keys = {
            (
                int(p.package_uom_id),
                str(getattr(p, "supplier_code", "") or "").strip().casefold(),
                str(getattr(p, "barcode", "") or "").strip(),
            )
            for p in item_pkgs
        }
        data = PackageSpecSerializer(item_pkgs, many=True).data

        # Include category packages unless item has an exact variant
        # for the same (package_uom, supplier_code, barcode).
        cat_pkgs_all = CategoryPackageSpec.objects.filter(category=obj.category)
        cat_pkgs = [
            cp
            for cp in cat_pkgs_all
            if (
                int(cp.package_uom_id),
                str(getattr(cp, "supplier_code", "") or "").strip().casefold(),
                str(getattr(cp, "barcode", "") or "").strip(),
            )
            not in item_pkg_keys
        ]
        data += CategoryPackageSpecAsPackageSerializer(cat_pkgs, many=True, context={"item_id": obj.id}).data
        return data

    def create(self, validated_data):
        category = validated_data["category"]
        policy_data = validated_data.pop("policy", None)

        sku = validated_data.get("sku")
        if not sku:
            validated_data["sku"] = f"ITEM-{uuid.uuid4().hex[:8].upper()}"

        item = Item.objects.create(**validated_data)

        if policy_data is None:
            policy_data = self._default_policy(category)
        else:
            # гарантируем storage_uom, если забыли
            policy_data = dict(policy_data)
            if not policy_data.get("storage_uom"):
                policy_data["storage_uom"] = category.default_uom
            if "posting_uom" not in policy_data or policy_data.get("posting_uom") is None:
                policy_data["posting_uom"] = category.default_uom
            if "allow_fractional" not in policy_data:
                policy_data["allow_fractional"] = True

        ItemPolicy.objects.create(item=item, **policy_data)
        return item

    def update(self, instance, validated_data):
        policy_data = validated_data.pop("policy", None)

        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()

        if policy_data is not None:
            policy, _ = ItemPolicy.objects.get_or_create(
                item=instance,
                defaults=self._default_policy(instance.category),
            )
            for k, v in policy_data.items():
                setattr(policy, k, v)
            policy.save()

        return instance


class ItemLookupSerializer(serializers.ModelSerializer):
    sku = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    policy = ItemPolicySerializer(required=False)

    class Meta:
        model = Item
        fields = ["id", "sku", "name", "category", "density_kg_per_l", "is_active", "policy"]


class ConversionRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConversionRule
        fields = [
            "id",
            "logical_id",
            "version",
            "supersedes",
            "item",
            "from_category",
            "to_category",
            "rule_type",
            "conditions",
            "params",
            "priority",
            "status",
            "effective_from",
            "effective_to",
            "created_at",
        ]
        read_only_fields = ["logical_id", "version", "created_at"]


class GlobalUomRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = GlobalUomRule
        fields = [
            "id",
            "from_uom",
            "to_uom",
            "multiplier",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class SystemDefaultFieldSerializer(serializers.ModelSerializer):
    field_type = serializers.ChoiceField(choices=DefaultFieldType.choices)

    class Meta:
        model = SystemDefaultField
        fields = [
            "id",
            "code",
            "label",
            "field_type",
            "default_value",
            "required",
            "is_system",
            "created_at",
        ]
        read_only_fields = ["id", "is_system", "created_at"]

from rest_framework import serializers
from .models import UoMCategory, UoM, Item, ItemPolicy
from .models import PackageSpec
from .models import ConversionRule

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


class UoMCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = UoMCategory
        fields = ["id", "code", "name"]

class UoMSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(queryset=UoMCategory.objects.all())

    class Meta:
        model = UoM
        fields = ["id", "code", "name", "category", "factor_to_base", "precision"]

class ItemPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemPolicy
        fields = ["storage_uom", "posting_uom", "allow_fractional", "rounding_precision"]

class ItemSerializer(serializers.ModelSerializer):
    policy = ItemPolicySerializer()
    packages = PackageSpecSerializer(many=True, read_only=True)

    class Meta:
        model = Item
        fields = ["id", "sku", "name", "is_active", "policy", "packages"]

    def create(self, validated_data):
        policy_data = validated_data.pop("policy")
        item = Item.objects.create(**validated_data)
        ItemPolicy.objects.create(item=item, **policy_data)
        return item

    def update(self, instance, validated_data):
        policy_data = validated_data.pop("policy", None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()

        if policy_data is not None:
            policy, _ = ItemPolicy.objects.get_or_create(item=instance, defaults=policy_data)
            for k, v in policy_data.items():
                setattr(policy, k, v)
            policy.save()

        return instance

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
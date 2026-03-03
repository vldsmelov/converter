from rest_framework import serializers
from .models import UoMCategory, UoM, Item, ItemPolicy

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

    class Meta:
        model = Item
        fields = ["id", "sku", "name", "is_active", "policy"]

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
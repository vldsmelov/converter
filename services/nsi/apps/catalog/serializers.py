from rest_framework import serializers

from .models import CategoryPackageSpec, ItemCategory


class ItemCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemCategory
        fields = [
            "id",
            "name",
            "default_uom",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class CategoryPackageSpecSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoryPackageSpec
        fields = [
            "id",
            "category",
            "status",
            "package_uom",
            "content_qty",
            "content_uom",
            "supplier_code",
            "barcode",
            "effective_from",
            "effective_to",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

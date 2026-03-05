from django.contrib import admin

from .models import CategoryPackageSpec, ItemCategory


@admin.register(ItemCategory)
class ItemCategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "default_uom", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("name",)
    ordering = ("id",)


@admin.register(CategoryPackageSpec)
class CategoryPackageSpecAdmin(admin.ModelAdmin):
    list_display = ("id", "category", "status", "package_uom", "content_qty", "content_uom", "created_at")
    list_filter = ("status", "category")
    search_fields = ("category__name", "barcode", "supplier_code")
    ordering = ("-created_at", "-id")

from django.contrib import admin
from .models import UoMCategory, UoM, Item, ItemPolicy
from .models import PackageSpec
from .models import ConversionRule

class PackageSpecInline(admin.TabularInline):
    model = PackageSpec
    extra = 0
    autocomplete_fields = ("package_uom", "content_uom")
    fields = ("status", "package_uom", "content_qty", "content_uom", "supplier_code", "barcode", "effective_from", "effective_to")

@admin.register(ConversionRule)
class ConversionRuleAdmin(admin.ModelAdmin):
    list_display = ("id", "item", "rule_type", "from_category", "to_category", "status", "priority", "version", "logical_id", "effective_from", "effective_to", "created_at")
    list_filter = ("status", "rule_type", "from_category", "to_category")
    search_fields = ("item__sku", "item__name", "logical_id")
    autocomplete_fields = ("item", "from_category", "to_category", "supersedes")
    ordering = ("-created_at",)

class ConversionRuleInline(admin.TabularInline):
    model = ConversionRule
    extra = 0
    fields = ("status", "rule_type", "from_category", "to_category", "priority", "version", "logical_id")
    readonly_fields = ("version", "logical_id")
    show_change_link = True

@admin.register(UoMCategory)
class UoMCategoryAdmin(admin.ModelAdmin):
    list_display = ("code", "name")
    search_fields = ("code", "name")

@admin.register(UoM)
class UoMAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "category", "factor_to_base", "precision")
    list_filter = ("category",)
    search_fields = ("code", "name")

class ItemPolicyInline(admin.StackedInline):
    model = ItemPolicy
    can_delete = False
    extra = 0
    autocomplete_fields = ("storage_uom", "posting_uom")
    fields = ("storage_uom", "posting_uom", "allow_fractional", "rounding_precision")

@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ("sku", "name", "is_active")
    list_filter = ("is_active",)
    search_fields = ("sku", "name")
    inlines = [ItemPolicyInline, PackageSpecInline, ConversionRuleInline]
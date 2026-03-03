from rest_framework import viewsets
from apps.authn.role_permissions import RoleByMethodPermission
from .models import UoMCategory, UoM, Item
from .serializers import UoMCategorySerializer, UoMSerializer, ItemSerializer
from .models import PackageSpec
from .serializers import PackageSpecSerializer

class PackageSpecViewSet(viewsets.ModelViewSet):
    queryset = PackageSpec.objects.select_related("item", "package_uom", "content_uom").all().order_by("-created_at")
    serializer_class = PackageSpecSerializer
    permission_classes = [RoleByMethodPermission]
    read_role = "nsi.package.read"
    write_role = "nsi.package.write"
    
class UoMCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = UoMCategory.objects.all().order_by("code")
    serializer_class = UoMCategorySerializer
    permission_classes = [RoleByMethodPermission]
    read_role = "nsi.uom.read"

class UoMViewSet(viewsets.ModelViewSet):
    queryset = UoM.objects.select_related("category").all().order_by("code")
    serializer_class = UoMSerializer
    permission_classes = [RoleByMethodPermission]
    read_role = "nsi.uom.read"
    write_role = "nsi.uom.write"

class ItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.select_related("policy", "policy__storage_uom", "policy__posting_uom").all().order_by("sku")
    serializer_class = ItemSerializer
    permission_classes = [RoleByMethodPermission]
    read_role = "nsi.item.read"
    write_role = "nsi.item.write"
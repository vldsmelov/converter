from rest_framework import viewsets
from apps.authn.role_permissions import RoleByMethodPermission
from .models import UoMCategory, UoM, Item
from .serializers import UoMCategorySerializer, UoMSerializer, ItemSerializer

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
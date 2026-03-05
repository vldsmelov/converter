from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.authn.role_permissions import RoleByMethodPermission

from .models import CategoryPackageSpec, ItemCategory
from .serializers import CategoryPackageSpecSerializer, ItemCategorySerializer


class ItemCategoryViewSet(viewsets.ModelViewSet):
    queryset = ItemCategory.objects.all().select_related("default_uom").order_by("name", "id")
    serializer_class = ItemCategorySerializer
    permission_classes = [IsAuthenticated]


class CategoryPackageSpecViewSet(viewsets.ModelViewSet):
    queryset = CategoryPackageSpec.objects.select_related("category", "package_uom", "content_uom").all()
    serializer_class = CategoryPackageSpecSerializer
    permission_classes = [RoleByMethodPermission]
    read_role = "nsi.package.read"
    write_role = "nsi.package.write"

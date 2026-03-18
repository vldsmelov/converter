from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminResetDefaultsView,
    ConversionRuleViewSet,
    GlobalUomRuleViewSet,
    ItemViewSet,
    MatchRuleView,
    PackageSpecViewSet,
    UoMCategoryViewSet,
    UoMViewSet,
)
from .admin_views import (
    AdminIamRolesView,
    AdminIamUsersView,
    AdminIamUserRolesView,
    AdminSystemDefaultFieldView,
    SystemDefaultFieldViewSet,
)

router = DefaultRouter()
router.register(r"uom-categories", UoMCategoryViewSet, basename="uom-category")
router.register(r"uoms", UoMViewSet, basename="uom")
router.register(r"items", ItemViewSet, basename="item")
router.register(r"packages", PackageSpecViewSet, basename="package")
router.register(r"rules", ConversionRuleViewSet, basename="rule")
router.register(r"global-uom-rules", GlobalUomRuleViewSet, basename="global-uom-rule")
router.register(r"default-fields", SystemDefaultFieldViewSet, basename="default-field")

urlpatterns = [
    path("", include(router.urls)),
    path("rules/match", MatchRuleView.as_view(), name="rule-match"),
    path("admin/reset-defaults/", AdminResetDefaultsView.as_view(), name="admin-reset-defaults"),
    path("admin/iam/roles/", AdminIamRolesView.as_view(), name="admin-iam-roles"),
    path("admin/iam/users/", AdminIamUsersView.as_view(), name="admin-iam-users"),
    path("admin/iam/users/<str:user_id>/roles/", AdminIamUserRolesView.as_view(), name="admin-iam-user-roles"),
    path("admin/default-fields/", AdminSystemDefaultFieldView.as_view(), name="admin-default-fields"),
]

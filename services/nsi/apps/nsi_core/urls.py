from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ConversionRuleViewSet,
    GlobalUomRuleViewSet,
    ItemViewSet,
    MatchRuleView,
    PackageSpecViewSet,
    UoMCategoryViewSet,
    UoMViewSet,
)

router = DefaultRouter()
router.register(r"uom-categories", UoMCategoryViewSet, basename="uom-category")
router.register(r"uoms", UoMViewSet, basename="uom")
router.register(r"items", ItemViewSet, basename="item")
router.register(r"packages", PackageSpecViewSet, basename="package")
router.register(r"rules", ConversionRuleViewSet, basename="rule")
router.register(r"global-uom-rules", GlobalUomRuleViewSet, basename="global-uom-rule")

urlpatterns = [
    path("", include(router.urls)),
    path("rules/match", MatchRuleView.as_view(), name="rule-match"),
]

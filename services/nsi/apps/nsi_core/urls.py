from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import UoMCategoryViewSet, UoMViewSet, ItemViewSet, PackageSpecViewSet
from .views import ConversionRuleViewSet, MatchRuleView

router = DefaultRouter()
router.register(r"uom-categories", UoMCategoryViewSet, basename="uom-categories")
router.register(r"uoms", UoMViewSet, basename="uoms")
router.register(r"items", ItemViewSet, basename="items")
router.register(r"packages", PackageSpecViewSet, basename="packages")
router.register(r"rules", ConversionRuleViewSet, basename="rules")

urlpatterns = [
    path("rules/match/", MatchRuleView.as_view(), name="rules-match"),
] + router.urls
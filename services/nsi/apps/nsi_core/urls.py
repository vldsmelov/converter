from rest_framework.routers import DefaultRouter
from .views import UoMCategoryViewSet, UoMViewSet, ItemViewSet, PackageSpecViewSet

router = DefaultRouter()
router.register(r"uom-categories", UoMCategoryViewSet, basename="uom-categories")
router.register(r"uoms", UoMViewSet, basename="uoms")
router.register(r"items", ItemViewSet, basename="items")
router.register(r"packages", PackageSpecViewSet, basename="packages")

urlpatterns = router.urls
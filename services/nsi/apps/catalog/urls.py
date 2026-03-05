from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CategoryPackageSpecViewSet, ItemCategoryViewSet

router = DefaultRouter()
router.register(r"item-categories", ItemCategoryViewSet, basename="item-category")
router.register(r"category-packages", CategoryPackageSpecViewSet, basename="category-package")

urlpatterns = [
    path("", include(router.urls)),
]

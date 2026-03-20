from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import AdminResetDefaultsView, FeedbackViewSet, InvoiceViewSet

router = DefaultRouter()
router.register(r"invoices", InvoiceViewSet, basename="invoices")
router.register(r"feedback", FeedbackViewSet, basename="feedback")

urlpatterns = [
    *router.urls,
    path("admin/reset-defaults/", AdminResetDefaultsView.as_view(), name="admin-reset-defaults"),
]

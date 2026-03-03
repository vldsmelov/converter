
from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include
from apps.health.secure_views import SecurePingView

def healthz(_request):
    return JsonResponse({"status": "ok", "service": "nsi"})

urlpatterns = [
    path("admin/", admin.site.urls),
    path("healthz", healthz),
    path("api/v1/secure-ping", SecurePingView.as_view()),
    path("api/v1/", include("apps.nsi_core.urls")),
]

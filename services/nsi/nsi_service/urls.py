from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include

from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.permissions import AllowAny

from apps.health.secure_views import SecurePingView


def healthz(_request):
    return JsonResponse({"status": "ok", "service": "nsi"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("healthz", healthz),

    path("api/schema/", SpectacularAPIView.as_view(permission_classes=[AllowAny]), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema", permission_classes=[AllowAny]), name="swagger-ui"),

    path("api/v1/secure-ping", SecurePingView.as_view()),
    path("api/v1/", include("apps.nsi_core.urls")),
]

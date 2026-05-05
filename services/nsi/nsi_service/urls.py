from django.contrib import admin
from django.conf import settings
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.permissions import AllowAny
from apps.health.secure_views import SecurePingView


def healthz(_request):
    return JsonResponse({"status": "ok", "service": "nsi"})

urlpatterns = [
    path("admin/", admin.site.urls),
    path("healthz", healthz),

    # API
    path("api/v1/", include("apps.nsi_core.urls")),
    path("api/v1/", include("apps.catalog.urls")),
    path("api/v1/secure-ping", SecurePingView.as_view(), name="secure-ping"),
]

if settings.OPENAPI_PUBLIC_ENABLED:
    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(permission_classes=[AllowAny]), name="schema"),
        path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema", permission_classes=[AllowAny]), name="swagger-ui"),
    ]

from django.contrib import admin
from django.conf import settings
from django.http import JsonResponse
from django.urls import path, include

from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.permissions import AllowAny


def healthz(_request):
    return JsonResponse({"status": "ok", "service": "documents"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("healthz", healthz),

    path("api/v1/", include("apps.documents_core.urls")),
]

if settings.OPENAPI_PUBLIC_ENABLED:
    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(permission_classes=[AllowAny]), name="schema"),
        path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema", permission_classes=[AllowAny]), name="swagger-ui"),
    ]

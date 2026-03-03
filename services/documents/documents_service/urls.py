from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include

def healthz(_request):
    return JsonResponse({"status": "ok", "service": "documents"})

urlpatterns = [
    path("admin/", admin.site.urls),
    path("healthz", healthz),
    path("api/v1/", include("apps.documents_core.urls")),
]
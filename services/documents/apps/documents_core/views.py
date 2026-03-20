from django.http import FileResponse, Http404
from django.db.models import Count
from django.db import transaction
from rest_framework import mixins, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authn.role_permissions import RoleByMethodPermission

from .models import FeedbackMessage, Invoice, InvoiceFile
from .serializers import (
    FeedbackAdminSerializer,
    FeedbackCreateSerializer,
    InvoiceListSerializer,
    InvoiceSerializer,
)
from .tasks import calculate_invoice, generate_invoice_outputs
from .storage import get_minio_client, get_bucket, MinioStream


def _realm_roles(request) -> set[str]:
    return set((getattr(request.user, "claims", {}).get("realm_access") or {}).get("roles") or [])


class InvoiceViewSet(viewsets.ModelViewSet):
    serializer_class = InvoiceSerializer
    permission_classes = [RoleByMethodPermission]

    read_role = "documents.invoice.read"
    write_role = "documents.invoice.write"

    def get_queryset(self):
        # Optimize list endpoint: avoid heavy nested serialization (lines/files/presigned urls).
        if self.action == "list":
            return (
                Invoice.objects
                .all()
                .annotate(line_count=Count("lines"))
                .order_by("-created_at")
            )
        return (
            Invoice.objects.prefetch_related("lines", "lines__converted", "files")
            .all()
            .order_by("-created_at")
        )

    def get_serializer_class(self):
        if self.action == "list":
            return InvoiceListSerializer
        return InvoiceSerializer

    @action(detail=True, methods=["post"], url_path="calculate")
    def calculate(self, request, pk=None):
        roles = _realm_roles(request)
        if "documents.invoice.calculate" not in roles:
            return Response(
                {"error": "Missing role: documents.invoice.calculate"},
                status=status.HTTP_403_FORBIDDEN,
            )

        inv = self.get_object()
        if inv.status in ("calculating", "generating"):
            return Response(
                {"error": f"Invoice is busy (status={inv.status})"},
                status=status.HTTP_409_CONFLICT,
            )

        task = calculate_invoice.delay(inv.id)
        return Response({"ok": True, "invoice_id": inv.id, "task_id": task.id})

    @action(detail=True, methods=["post"], url_path="generate")
    def generate(self, request, pk=None):
        roles = _realm_roles(request)
        if "documents.invoice.generate" not in roles:
            return Response(
                {"error": "Missing role: documents.invoice.generate"},
                status=status.HTTP_403_FORBIDDEN,
            )

        inv = self.get_object()
        if inv.status != "calculated":
            return Response(
                {"error": f"Invoice must be CALCULATED (now status={inv.status})"},
                status=status.HTTP_409_CONFLICT,
            )

        task = generate_invoice_outputs.delay(inv.id)
        return Response({"ok": True, "invoice_id": inv.id, "task_id": task.id})

    @action(detail=True, methods=["get"], url_path=r"files/(?P<file_id>\d+)/download")
    def download_file(self, request, pk=None, file_id=None):
        inv = self.get_object()
        try:
            f = inv.files.get(id=int(file_id))
        except (InvoiceFile.DoesNotExist, ValueError):
            raise Http404("File not found")

        client = get_minio_client()
        bucket = get_bucket()

        resp = client.get_object(bucket, f.object_key)
        stream = MinioStream(resp)

        response = FileResponse(
            stream,
            as_attachment=True,
            filename=f.file_name,
            content_type=f.content_type,
        )
        if f.size:
            response["Content-Length"] = str(f.size)
        return response


class FeedbackViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = FeedbackMessage.objects.all().order_by("-created_at")
    permission_classes = [RoleByMethodPermission]

    read_role = ["documents.feedback.read", "system.admin"]
    write_role = ["documents.feedback.write", "system.admin"]
    allow_anonymous_write_methods = {"POST"}
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return FeedbackCreateSerializer
        return FeedbackAdminSerializer


class AdminResetDefaultsView(APIView):
    permission_classes = [RoleByMethodPermission]
    write_role = "system.admin"

    def post(self, request):
        object_keys = list(
            InvoiceFile.objects.exclude(object_key="").values_list("object_key", flat=True)
        )
        deleted_invoices = Invoice.objects.count()
        deleted_files = InvoiceFile.objects.count()
        deleted_feedback = FeedbackMessage.objects.count()

        with transaction.atomic():
            Invoice.objects.all().delete()
            FeedbackMessage.objects.all().delete()

        removed_objects = 0
        storage_errors: list[str] = []
        if object_keys:
            try:
                client = get_minio_client()
                bucket = get_bucket()
                for key in object_keys:
                    try:
                        client.remove_object(bucket, key)
                        removed_objects += 1
                    except Exception as e:
                        storage_errors.append(f"{key}: {e}")
            except Exception as e:
                storage_errors.append(str(e))

        return Response(
            {
                "ok": True,
                "summary": {
                    "deleted": {
                        "invoices": deleted_invoices,
                        "invoice_files": deleted_files,
                        "feedback_messages": deleted_feedback,
                    },
                    "storage": {
                        "requested_objects": len(object_keys),
                        "removed_objects": removed_objects,
                        "errors_count": len(storage_errors),
                    },
                },
            }
        )

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status

from apps.authn.role_permissions import RoleByMethodPermission
from .models import Invoice
from .serializers import InvoiceSerializer
from .tasks import calculate_invoice

class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.prefetch_related("lines", "lines__converted").all().order_by("-created_at")
    serializer_class = InvoiceSerializer
    permission_classes = [RoleByMethodPermission]
    read_role = "documents.invoice.read"
    write_role = "documents.invoice.write"

    @action(detail=True, methods=["post"], url_path="calculate")
    def calculate(self, request, pk=None):
        # отдельная роль на запуск расчёта
        roles = set((getattr(request.user, "claims", {}).get("realm_access") or {}).get("roles") or [])
        if "documents.invoice.calculate" not in roles:
            return Response({"error": "Missing role: documents.invoice.calculate"}, status=status.HTTP_403_FORBIDDEN)

        inv = self.get_object()

        # достаём bearer token из заголовка
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return Response({"error": "Missing bearer token"}, status=status.HTTP_401_UNAUTHORIZED)
        token = auth[len("Bearer "):].strip()

        task = calculate_invoice.delay(inv.id)
        return Response({"ok": True, "invoice_id": inv.id, "task_id": task.id})
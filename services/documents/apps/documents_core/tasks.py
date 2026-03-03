import os
import httpx
from celery import shared_task
from django.db import transaction
from .models import Invoice, InvoiceStatus, ConvertedLine
from .s2s_token import get_service_token

CONVERSION_BASE_URL = os.environ["CONVERSION_BASE_URL"].rstrip("/")

@shared_task(bind=True)
def calculate_invoice(self, invoice_id: int):
    # ВАЖНО: на старте проксируем user token. Позже заменим на service-account token.
    inv = Invoice.objects.get(id=invoice_id)
    inv.status = InvoiceStatus.CALCULATING
    inv.error = ""
    inv.save(update_fields=["status", "error"])
    token = get_service_token()

    try:
        with httpx.Client(timeout=20) as client:
            for line in inv.lines.all().order_by("line_no"):
                payload = {
                    "item_id": line.item_id,
                    "qty": str(line.qty),
                    "from_uom": line.uom_code,
                    "context": line.context or {},
                    "barcode": line.barcode or None,
                    "supplier_code": line.supplier_code or None,
                }
                r = client.post(
                    f"{CONVERSION_BASE_URL}/api/v1/convert",
                    json=payload,
                    headers={"Authorization": f"Bearer {token}"},
                )
                if r.status_code >= 400:
                    raise RuntimeError(f"Conversion failed for line {line.line_no}: {r.status_code} {r.text}")

                data = r.json()
                to = data["to"]
                steps = data.get("steps", [])
                warnings = data.get("warnings", [])

                ConvertedLine.objects.update_or_create(
                    line=line,
                    defaults={
                        "posting_qty": to["qty"],
                        "posting_uom_code": to["uom"],
                        "steps": steps,
                        "warnings": warnings,
                    },
                )

        inv.status = InvoiceStatus.CALCULATED
        inv.save(update_fields=["status"])
        return {"ok": True, "invoice_id": invoice_id}
    except Exception as e:
        inv.status = InvoiceStatus.FAILED
        inv.error = str(e)
        inv.save(update_fields=["status", "error"])
        raise
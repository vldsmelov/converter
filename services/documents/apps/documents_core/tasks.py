import os
from io import BytesIO
from uuid import uuid4

import httpx
from celery import shared_task

from .models import (
    Invoice,
    InvoiceStatus,
    ConvertedLine,
    InvoiceFile,
    InvoiceFileType,
)
from .s2s_token import get_service_token
from .storage import get_minio_client, get_bucket, ensure_bucket
from .rendering import render_invoice_xlsx, render_invoice_pdf

CONVERSION_BASE_URL = os.environ["CONVERSION_BASE_URL"].rstrip("/")


@shared_task(bind=True)
def calculate_invoice(self, invoice_id: int):
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
                    raise RuntimeError(
                        f"Conversion failed for line {line.line_no}: {r.status_code} {r.text}"
                    )

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


@shared_task(bind=True)
def generate_invoice_outputs(self, invoice_id: int):
    inv = (
        Invoice.objects
        .prefetch_related("lines", "lines__converted", "files")
        .get(id=invoice_id)
    )

    if inv.status != InvoiceStatus.CALCULATED:
        raise RuntimeError(
            f"Invoice {invoice_id} must be CALCULATED to generate outputs (now: {inv.status})"
        )

    inv.status = InvoiceStatus.GENERATING
    inv.error = ""
    inv.save(update_fields=["status", "error"])

    try:
        xlsx_bytes, xlsx_name, xlsx_ct = render_invoice_xlsx(inv)
        pdf_bytes, pdf_name, pdf_ct = render_invoice_pdf(inv)

        client = get_minio_client()
        bucket = get_bucket()
        ensure_bucket(client, bucket)

        base = f"invoices/{invoice_id}/{uuid4().hex}"

        # XLSX
        xlsx_key = f"{base}.xlsx"
        client.put_object(
            bucket,
            xlsx_key,
            data=BytesIO(xlsx_bytes),
            length=len(xlsx_bytes),
            content_type=xlsx_ct,
        )
        InvoiceFile.objects.update_or_create(
            invoice=inv,
            file_type=InvoiceFileType.XLSX,
            defaults={
                "object_key": xlsx_key,
                "file_name": xlsx_name,
                "content_type": xlsx_ct,
                "size": len(xlsx_bytes),
            },
        )

        # PDF
        pdf_key = f"{base}.pdf"
        client.put_object(
            bucket,
            pdf_key,
            data=BytesIO(pdf_bytes),
            length=len(pdf_bytes),
            content_type=pdf_ct,
        )
        InvoiceFile.objects.update_or_create(
            invoice=inv,
            file_type=InvoiceFileType.PDF,
            defaults={
                "object_key": pdf_key,
                "file_name": pdf_name,
                "content_type": pdf_ct,
                "size": len(pdf_bytes),
            },
        )

        inv.status = InvoiceStatus.GENERATED
        inv.save(update_fields=["status"])

        return {
            "ok": True,
            "invoice_id": invoice_id,
            "files": [
                {"type": "xlsx", "key": xlsx_key, "name": xlsx_name},
                {"type": "pdf", "key": pdf_key, "name": pdf_name},
            ],
        }

    except Exception as e:
        inv.status = InvoiceStatus.FAILED
        inv.error = str(e)
        inv.save(update_fields=["status", "error"])
        raise

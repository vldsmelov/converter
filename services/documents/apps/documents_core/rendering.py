from __future__ import annotations

from io import BytesIO

from openpyxl import Workbook
from openpyxl.utils import get_column_letter
from fpdf import FPDF

from .models import Invoice


def render_invoice_xlsx(inv: Invoice) -> tuple[bytes, str, str]:
    wb = Workbook()
    ws = wb.active
    ws.title = "Invoice"

    ws.append(["Invoice Number", inv.number])
    ws.append(["Supplier", inv.supplier])
    ws.append(["Doc Date", inv.doc_date.isoformat() if inv.doc_date else ""])
    ws.append([])
    ws.append(["Line", "Item ID", "Qty", "UoM", "Posting Qty", "Posting UoM", "Warnings"])

    for line in inv.lines.all().order_by("line_no"):
        conv = getattr(line, "converted", None)
        ws.append([
            line.line_no,
            line.item_id,
            str(line.qty),
            line.uom_code,
            str(conv.posting_qty) if conv else "",
            conv.posting_uom_code if conv else "",
            ", ".join((conv.warnings or [])) if conv else "",
        ])

    for col in range(1, 8):
        ws.column_dimensions[get_column_letter(col)].width = 18

    bio = BytesIO()
    wb.save(bio)
    data = bio.getvalue()

    filename = f"invoice_{inv.id}_{inv.number}.xlsx"
    return data, filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def render_invoice_pdf(inv: Invoice) -> tuple[bytes, str, str]:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=12)

    pdf.cell(0, 8, f"Invoice: {inv.number}", ln=1)
    if inv.supplier:
        pdf.cell(0, 8, f"Supplier: {inv.supplier}", ln=1)
    if inv.doc_date:
        pdf.cell(0, 8, f"Doc date: {inv.doc_date.isoformat()}", ln=1)

    pdf.ln(4)
    pdf.set_font("Helvetica", size=10)

    headers = ["Line", "Item", "Qty", "UoM", "Posting Qty", "Posting UoM"]
    col_w = [12, 18, 22, 18, 26, 22]

    for i, h in enumerate(headers):
        pdf.cell(col_w[i], 7, h, border=1)
    pdf.ln()

    for line in inv.lines.all().order_by("line_no"):
        conv = getattr(line, "converted", None)
        row = [
            str(line.line_no),
            str(line.item_id),
            str(line.qty),
            line.uom_code,
            str(conv.posting_qty) if conv else "",
            conv.posting_uom_code if conv else "",
        ]
        for i, val in enumerate(row):
            pdf.cell(col_w[i], 7, val, border=1)
        pdf.ln()

    out = pdf.output(dest="S")
    data = out if isinstance(out, (bytes, bytearray)) else out.encode("latin-1")

    filename = f"invoice_{inv.id}_{inv.number}.pdf"
    return data, filename, "application/pdf"

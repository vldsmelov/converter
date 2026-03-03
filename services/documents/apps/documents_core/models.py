from django.db import models

class InvoiceStatus(models.TextChoices):
    NEW = "new", "New"
    CALCULATING = "calculating", "Calculating"
    CALCULATED = "calculated", "Calculated"
    FAILED = "failed", "Failed"

class Invoice(models.Model):
    number = models.CharField(max_length=64)
    supplier = models.CharField(max_length=256, blank=True, default="")
    doc_date = models.DateField(null=True, blank=True)

    status = models.CharField(max_length=16, choices=InvoiceStatus.choices, default=InvoiceStatus.NEW)
    error = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["status", "created_at"])]

    def __str__(self):
        return f"Invoice {self.number} ({self.status})"

class InvoiceLine(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()

    item_id = models.IntegerField()          # ссылка на NSI item (храним ID, чтобы не тащить FK межсервисно)
    qty = models.DecimalField(max_digits=18, decimal_places=6)
    uom_code = models.CharField(max_length=32)  # "BAG", "KG", "TON" и т.п.
    context = models.JSONField(default=dict, blank=True)

    barcode = models.CharField(max_length=64, blank=True, default="")
    supplier_code = models.CharField(max_length=64, blank=True, default="")

    class Meta:
        unique_together = [("invoice", "line_no")]
        indexes = [models.Index(fields=["invoice", "line_no"])]

    def __str__(self):
        return f"{self.invoice.number} line {self.line_no}"

class ConvertedLine(models.Model):
    line = models.OneToOneField(InvoiceLine, on_delete=models.CASCADE, related_name="converted")

    posting_qty = models.DecimalField(max_digits=18, decimal_places=6)
    posting_uom_code = models.CharField(max_length=32)

    steps = models.JSONField(default=list, blank=True)
    warnings = models.JSONField(default=list, blank=True)

    calculated_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Converted {self.line_id}"
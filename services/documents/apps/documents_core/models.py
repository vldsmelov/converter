from django.db import models


class InvoiceStatus(models.TextChoices):
    NEW = "new", "New"
    CALCULATING = "calculating", "Calculating"
    CALCULATED = "calculated", "Calculated"
    GENERATING = "generating", "Generating"
    GENERATED = "generated", "Generated"
    FAILED = "failed", "Failed"


class Invoice(models.Model):
    number = models.CharField(max_length=64)
    supplier = models.CharField(max_length=256, blank=True, default="")
    doc_date = models.DateField(null=True, blank=True)

    status = models.CharField(
        max_length=16,
        choices=InvoiceStatus.choices,
        default=InvoiceStatus.NEW,
    )
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

    item_id = models.IntegerField()  # ссылка на NSI item (ID, без FK межсервисно)
    qty = models.DecimalField(max_digits=18, decimal_places=6)
    uom_code = models.CharField(max_length=32)  # "BAG", "KG", "TON" и т.п.
    to_uom_code = models.CharField(max_length=32, blank=True, default="")  # target UOM, optional

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


class InvoiceFileType(models.TextChoices):
    XLSX = "xlsx", "XLSX"
    PDF = "pdf", "PDF"


class InvoiceFile(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="files")

    file_type = models.CharField(max_length=8, choices=InvoiceFileType.choices)
    object_key = models.CharField(max_length=512)

    file_name = models.CharField(max_length=256)
    content_type = models.CharField(max_length=128)
    size = models.BigIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("invoice", "file_type")]
        indexes = [
            models.Index(fields=["invoice", "file_type"]),
        ]

    def __str__(self):
        return f"{self.invoice_id}:{self.file_type} -> {self.object_key}"


class FeedbackKind(models.TextChoices):
    BUG = "bug", "Bug"
    SUGGESTION = "suggestion", "Suggestion"
    QUESTION = "question", "Question"
    OTHER = "other", "Other"


class FeedbackStatus(models.TextChoices):
    NEW = "new", "New"
    IN_PROGRESS = "in_progress", "In Progress"
    DONE = "done", "Done"


class FeedbackMessage(models.Model):
    kind = models.CharField(max_length=16, choices=FeedbackKind.choices, default=FeedbackKind.OTHER)
    title = models.CharField(max_length=200)
    message = models.TextField()
    page_path = models.CharField(max_length=300, blank=True, default="")

    sender_name = models.CharField(max_length=120, blank=True, default="")
    sender_email = models.EmailField(blank=True, default="")

    status = models.CharField(max_length=16, choices=FeedbackStatus.choices, default=FeedbackStatus.NEW)
    admin_note = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["kind", "created_at"]),
        ]

    def __str__(self):
        return f"Feedback #{self.id} ({self.kind}, {self.status})"

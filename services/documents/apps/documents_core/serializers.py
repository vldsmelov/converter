from rest_framework import serializers

from .models import Invoice, InvoiceLine, ConvertedLine, InvoiceFile


class ConvertedLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConvertedLine
        fields = ["posting_qty", "posting_uom_code", "steps", "warnings", "calculated_at"]


class InvoiceLineSerializer(serializers.ModelSerializer):
    converted = ConvertedLineSerializer(read_only=True)

    class Meta:
        model = InvoiceLine
        fields = [
            "line_no",
            "item_id",
            "qty",
            "uom_code",
            "context",
            "barcode",
            "supplier_code",
            "converted",
        ]


class InvoiceFileSerializer(serializers.ModelSerializer):
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = InvoiceFile
        fields = [
            "id",
            "file_type",
            "file_name",
            "content_type",
            "size",
            "created_at",
            "download_url",
        ]

    def get_download_url(self, obj: InvoiceFile) -> str:
        request = self.context.get("request")
        path = f"/api/v1/invoices/{obj.invoice_id}/files/{obj.id}/download"
        return request.build_absolute_uri(path) if request else path


class InvoiceSerializer(serializers.ModelSerializer):
    lines = InvoiceLineSerializer(many=True)
    files = InvoiceFileSerializer(many=True, read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "id",
            "number",
            "supplier",
            "doc_date",
            "status",
            "error",
            "created_at",
            "updated_at",
            "lines",
            "files",
        ]
        read_only_fields = ["status", "error", "created_at", "updated_at", "files"]

    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        invoice = Invoice.objects.create(**validated_data)
        for i, ld in enumerate(lines_data, start=1):
            # ld может содержать line_no, поэтому аккуратно вытаскиваем
            line_no = ld.pop("line_no", None) or i
            InvoiceLine.objects.create(invoice=invoice, line_no=line_no, **ld)
        return invoice

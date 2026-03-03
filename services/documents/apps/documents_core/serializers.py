from rest_framework import serializers
from .models import Invoice, InvoiceLine, ConvertedLine

class ConvertedLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConvertedLine
        fields = ["posting_qty", "posting_uom_code", "steps", "warnings", "calculated_at"]

class InvoiceLineSerializer(serializers.ModelSerializer):
    converted = ConvertedLineSerializer(read_only=True)

    class Meta:
        model = InvoiceLine
        fields = ["line_no", "item_id", "qty", "uom_code", "context", "barcode", "supplier_code", "converted"]

class InvoiceSerializer(serializers.ModelSerializer):
    lines = InvoiceLineSerializer(many=True)

    class Meta:
        model = Invoice
        fields = ["id", "number", "supplier", "doc_date", "status", "error", "created_at", "updated_at", "lines"]
        read_only_fields = ["status", "error", "created_at", "updated_at"]

    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        invoice = Invoice.objects.create(**validated_data)

        for i, ld in enumerate(lines_data, start=1):
            # ld уже содержит line_no, поэтому аккуратно вытаскиваем
            line_no = ld.pop("line_no", None) or i
            InvoiceLine.objects.create(invoice=invoice, line_no=line_no, **ld)

        return invoice
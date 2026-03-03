from django.db import models
from datetime import date
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from apps.authn.role_permissions import RoleByMethodPermission
from .models import UoMCategory, UoM, Item, ConversionRule
from .serializers import UoMCategorySerializer, UoMSerializer, ItemSerializer
from .models import PackageSpec
from .serializers import PackageSpecSerializer, ConversionRuleSerializer


class PackageSpecViewSet(viewsets.ModelViewSet):
    queryset = PackageSpec.objects.select_related("item", "package_uom", "content_uom").all().order_by("-created_at")
    serializer_class = PackageSpecSerializer
    permission_classes = [RoleByMethodPermission]
    read_role = "nsi.package.read"
    write_role = "nsi.package.write"
    
class UoMCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = UoMCategory.objects.all().order_by("code")
    serializer_class = UoMCategorySerializer
    permission_classes = [RoleByMethodPermission]
    read_role = "nsi.uom.read"

class UoMViewSet(viewsets.ModelViewSet):
    queryset = UoM.objects.select_related("category").all().order_by("code")
    serializer_class = UoMSerializer
    permission_classes = [RoleByMethodPermission]
    read_role = "nsi.uom.read"
    write_role = "nsi.uom.write"

class ItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.select_related("policy", "policy__storage_uom", "policy__posting_uom").all().order_by("sku")
    serializer_class = ItemSerializer
    permission_classes = [RoleByMethodPermission]
    read_role = "nsi.item.read"
    write_role = "nsi.item.write"

class ConversionRuleViewSet(viewsets.ModelViewSet):
    queryset = ConversionRule.objects.select_related("item", "from_category", "to_category", "supersedes").all().order_by("-created_at")
    serializer_class = ConversionRuleSerializer
    permission_classes = [RoleByMethodPermission]
    read_role = "nsi.rule.read"
    write_role = "nsi.rule.write"

def _date_in_range(d: date, start, end) -> bool:
    if start and d < start:
        return False
    if end and d > end:
        return False
    return True

def _conditions_match(conditions: dict, context: dict) -> bool:
    # простое равенство key=value
    for k, v in (conditions or {}).items():
        if k not in context:
            return False
        if context[k] != v:
            return False
    return True

class MatchRuleView(APIView):
    """
    POST /api/v1/rules/match
    body: { item: <id|null>, from_category: "MASS", to_category: "LENGTH", context: {...}, on_date: "YYYY-MM-DD" }
    """
    permission_classes = [RoleByMethodPermission]
    read_role = "nsi.rule.read"  # считаем match как read

    def post(self, request):
        item_id = request.data.get("item")
        from_code = request.data.get("from_category")
        to_code = request.data.get("to_category")
        context = request.data.get("context") or {}
        on_date_str = request.data.get("on_date")
        on_date = date.fromisoformat(on_date_str) if on_date_str else date.today()

        if not from_code or not to_code:
            return Response({"error": "from_category and to_category are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from_cat = UoMCategory.objects.get(code=from_code)
            to_cat = UoMCategory.objects.get(code=to_code)
        except UoMCategory.DoesNotExist:
            return Response({"error": "Unknown category code"}, status=status.HTTP_400_BAD_REQUEST)

        qs = ConversionRule.objects.filter(status="active")
        # item-specific first + allow GLOBAL rules (item is null)
        if item_id is not None:
            qs = qs.filter(models.Q(item_id=item_id) | models.Q(item__isnull=True))
        else:
            qs = qs.filter(item__isnull=True)

        # category pair is unordered (rule works both directions)
        qs = qs.filter(
            models.Q(from_category=from_cat, to_category=to_cat) |
            models.Q(from_category=to_cat, to_category=from_cat)
        )

        # date range filter + conditions match
        candidates = []
        for r in qs:
            if not _date_in_range(on_date, r.effective_from, r.effective_to):
                continue
            if not _conditions_match(r.conditions, context):
                continue
            specificity = len(r.conditions or {})
            # item-specific beats global, so add a big bonus
            scope_bonus = 1000 if (item_id is not None and r.item_id == item_id) else 0
            score = scope_bonus + specificity
            candidates.append((score, r.priority, r.version, r.created_at, r))

        if not candidates:
            return Response({"error": "No matching rule"}, status=status.HTTP_404_NOT_FOUND)

        # sort: score desc, priority desc, version desc, created_at desc
        candidates.sort(key=lambda x: (x[0], x[1], x[2], x[3]), reverse=True)
        best = candidates[0]

        # check ambiguity: if second has same tuple (score, priority, version) then ambiguous
        if len(candidates) > 1:
            second = candidates[1]
            if (best[0], best[1], best[2]) == (second[0], second[1], second[2]):
                return Response(
                    {"error": "Ambiguous rules", "rule_ids": [best[4].id, second[4].id]},
                    status=status.HTTP_409_CONFLICT
                )

        data = ConversionRuleSerializer(best[4]).data
        return Response({"rule": data})
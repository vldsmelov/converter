from __future__ import annotations

from typing import Any

from rest_framework import mixins, serializers, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authn.keycloak_admin import KeycloakAdminClient, KeycloakAdminError
from apps.authn.role_permissions import RoleByMethodPermission

from .models import SystemDefaultField
from .serializers import SystemDefaultFieldSerializer

REQUIRED_PERMISSION_ROLES: dict[str, str] = {
    "documents.feedback.read": "Read feedback inbox",
    "documents.feedback.write": "Manage feedback inbox entries",
}


def _normalize_bundle_name(name: str) -> str:
    s = (name or "").strip().replace(" ", ".").lower()
    if not s:
        return ""
    return s if s.startswith("bundle.") else f"bundle.{s}"


def _is_builtin_role(name: str) -> bool:
    return name in {"offline_access", "uma_authorization"} or name.startswith("default-roles-")


def _is_bundle_role(role: dict[str, Any]) -> bool:
    attrs = role.get("attributes") or {}
    if isinstance(attrs, dict):
        vals = attrs.get("app.bundle")
        if isinstance(vals, list):
            return "1" in vals or "true" in vals
    return str(role.get("name", "")).startswith("bundle.")


def _ensure_required_permission_roles(kc: KeycloakAdminClient) -> None:
    role_names = {str(r.get("name")) for r in kc.list_roles() if r.get("name")}
    for role_name, description in REQUIRED_PERMISSION_ROLES.items():
        if role_name in role_names:
            continue
        kc.create_role(name=role_name, description=description)


class _BundleCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    permissions = serializers.ListField(
        child=serializers.CharField(max_length=128),
        allow_empty=False,
    )


class _UserCreateSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=64)
    password = serializers.CharField(max_length=128, write_only=True)
    enabled = serializers.BooleanField(default=True)
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    first_name = serializers.CharField(required=False, allow_blank=True, default="")
    last_name = serializers.CharField(required=False, allow_blank=True, default="")
    roles = serializers.ListField(
        child=serializers.CharField(max_length=128),
        allow_empty=True,
        required=False,
        default=list,
    )


class _UserRolesSerializer(serializers.Serializer):
    roles = serializers.ListField(
        child=serializers.CharField(max_length=128),
        allow_empty=True,
        required=True,
    )


class AdminIamRolesView(APIView):
    permission_classes = [RoleByMethodPermission]
    read_role = "system.admin"
    write_role = "system.admin"

    def get(self, request):
        try:
            kc = KeycloakAdminClient()
            _ensure_required_permission_roles(kc)
            roles = kc.list_roles()
            permission_roles: list[str] = []
            bundles: list[dict[str, Any]] = []

            for r in roles:
                name = str(r.get("name") or "")
                if not name or _is_builtin_role(name):
                    continue
                if _is_bundle_role(r):
                    composites = kc.get_role_composites(name)
                    bundles.append(
                        {
                            "name": name,
                            "description": r.get("description") or "",
                            "permissions": sorted(
                                [str(c.get("name")) for c in composites if c.get("name") and not _is_builtin_role(str(c.get("name")))]
                            ),
                        }
                    )
                else:
                    permission_roles.append(name)

            return Response(
                {
                    "permissions": sorted(permission_roles),
                    "bundles": sorted(bundles, key=lambda x: x["name"]),
                }
            )
        except KeycloakAdminError as e:
            return Response({"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY)

    def post(self, request):
        ser = _BundleCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        payload = ser.validated_data

        name = _normalize_bundle_name(payload["name"])
        if not name:
            return Response({"error": "name is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            kc = KeycloakAdminClient()
            role_names = {r.get("name") for r in kc.list_roles() if r.get("name")}
            if name in role_names:
                return Response({"error": f"Role already exists: {name}"}, status=status.HTTP_409_CONFLICT)

            unknown = sorted([p for p in payload["permissions"] if p not in role_names])
            if unknown:
                return Response(
                    {"error": f"Unknown permissions: {', '.join(unknown)}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            kc.create_role(
                name=name,
                description=payload.get("description", ""),
                attributes={"app.bundle": ["1"]},
            )
            kc.set_role_composites(name, payload["permissions"])
            return Response(
                {
                    "ok": True,
                    "role": {
                        "name": name,
                        "description": payload.get("description", ""),
                        "permissions": sorted(payload["permissions"]),
                    },
                },
                status=status.HTTP_201_CREATED,
            )
        except KeycloakAdminError as e:
            return Response({"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


class AdminIamUsersView(APIView):
    permission_classes = [RoleByMethodPermission]
    read_role = "system.admin"
    write_role = "system.admin"

    def get(self, request):
        try:
            kc = KeycloakAdminClient()
            users = kc.list_users()
            rows: list[dict[str, Any]] = []
            for u in users:
                user_id = str(u.get("id") or "")
                if not user_id:
                    continue
                roles = sorted([str(r.get("name")) for r in kc.user_roles(user_id) if r.get("name") and not _is_builtin_role(str(r.get("name")))])
                rows.append(
                    {
                        "id": user_id,
                        "username": u.get("username") or "",
                        "enabled": bool(u.get("enabled")),
                        "email": u.get("email") or "",
                        "first_name": u.get("firstName") or "",
                        "last_name": u.get("lastName") or "",
                        "roles": roles,
                    }
                )
            rows.sort(key=lambda x: x["username"])
            return Response(rows)
        except KeycloakAdminError as e:
            return Response({"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY)

    def post(self, request):
        ser = _UserCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        payload = ser.validated_data

        try:
            kc = KeycloakAdminClient()
            user_id = kc.create_user(
                username=payload["username"],
                password=payload["password"],
                enabled=payload.get("enabled", True),
                email=payload.get("email", ""),
                first_name=payload.get("first_name", ""),
                last_name=payload.get("last_name", ""),
            )
            kc.set_user_roles(user_id, payload.get("roles", []))
            roles = sorted(payload.get("roles", []))
            return Response(
                {
                    "id": user_id,
                    "username": payload["username"],
                    "enabled": payload.get("enabled", True),
                    "email": payload.get("email", ""),
                    "first_name": payload.get("first_name", ""),
                    "last_name": payload.get("last_name", ""),
                    "roles": roles,
                },
                status=status.HTTP_201_CREATED,
            )
        except KeycloakAdminError as e:
            return Response({"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


class AdminIamUserRolesView(APIView):
    permission_classes = [RoleByMethodPermission]
    read_role = "system.admin"
    write_role = "system.admin"

    def put(self, request, user_id: str):
        ser = _UserRolesSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        roles = ser.validated_data["roles"]
        try:
            kc = KeycloakAdminClient()
            kc.set_user_roles(user_id, roles)
            return Response({"ok": True, "user_id": user_id, "roles": sorted(roles)})
        except KeycloakAdminError as e:
            return Response({"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


class SystemDefaultFieldViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = SystemDefaultField.objects.all()
    serializer_class = SystemDefaultFieldSerializer
    permission_classes = [RoleByMethodPermission]
    read_role = "nsi.item.read"
    write_role = ["nsi.default_field.write", "system.admin"]


class AdminSystemDefaultFieldView(APIView):
    permission_classes = [RoleByMethodPermission]
    read_role = "system.admin"
    write_role = "system.admin"

    def get(self, request):
        rows = SystemDefaultField.objects.all()
        return Response(SystemDefaultFieldSerializer(rows, many=True).data)

    def post(self, request):
        ser = SystemDefaultFieldSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        row = ser.save()
        return Response(SystemDefaultFieldSerializer(row).data, status=status.HTTP_201_CREATED)

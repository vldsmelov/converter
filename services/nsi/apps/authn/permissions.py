from rest_framework.permissions import BasePermission
from .authentication import get_realm_roles

class HasRealmRole(BasePermission):
    """
    View должен иметь атрибут required_role = "role.name"
    """
    def has_permission(self, request, view):
        required = getattr(view, "required_role", None)
        if not required:
            return True
        claims = getattr(request.user, "claims", {}) if hasattr(request, "user") else {}
        return required in get_realm_roles(claims)
from rest_framework.permissions import BasePermission, SAFE_METHODS
from .authentication import get_realm_roles

class RoleByMethodPermission(BasePermission):
    """
    View должен иметь:
      read_role = "nsi.xxx.read"
      write_role = "nsi.xxx.write"
    """
    def has_permission(self, request, view):
        if not getattr(request, "user", None) or not getattr(request.user, "is_authenticated", False):
            return False

        roles = get_realm_roles(getattr(request.user, "claims", {}))
        if request.method in SAFE_METHODS:
            required = getattr(view, "read_role", None)
        else:
            required = getattr(view, "write_role", None)

        if not required:
            return True
        if isinstance(required, (list, tuple, set)):
            return any(r in roles for r in required)
        return required in roles

from rest_framework.views import APIView
from rest_framework.response import Response
from apps.authn.permissions import HasRealmRole

class SecurePingView(APIView):
    required_role = "nsi.ping"
    permission_classes = [HasRealmRole]

    def get(self, request):
        return Response({"ok": True, "service": "nsi", "user": request.user.username})
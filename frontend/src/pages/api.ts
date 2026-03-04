import { createDocumentsClient, createNsiClient } from "../api/clients";
import { useAuth } from "../auth/AuthProvider";

export function useApi() {
  const { token } = useAuth();

  const docs = createDocumentsClient({
    baseUrl: import.meta.env.VITE_DOCS_BASE_URL,
    token: () => token ?? "",
  });

  const nsi = createNsiClient({
    baseUrl: import.meta.env.VITE_NSI_BASE_URL,
    token: () => token ?? "",
  });

  return { docs, nsi };
}

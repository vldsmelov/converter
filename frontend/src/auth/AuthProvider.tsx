import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type Keycloak from "keycloak-js";
import { initKeycloak, keycloak, ensureFreshToken } from "./keycloak";

type AuthState = {
  ready: boolean;
  authenticated: boolean;
  token?: string;
  keycloak: Keycloak;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | undefined>(undefined);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    (async () => {
      const ok = await initKeycloak();
      setAuthenticated(ok);
      setToken(keycloak.token ?? undefined);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const t = setInterval(async () => {
      const tok = await ensureFreshToken(30);
      if (tok) setToken(tok);
      setAuthenticated(!!keycloak.authenticated);
    }, 10_000);
    return () => clearInterval(t);
  }, [ready]);

  const value = useMemo<AuthState>(
    () => ({ ready, authenticated, token, keycloak }),
    [ready, authenticated, token]
  );

  if (!ready) return <div style={{ padding: 16 }}>Авторизация…</div>;

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}

import createClient from "openapi-fetch";

import type { paths as DocumentsPaths } from "./generated/documents";
import type { paths as NsiPaths } from "./generated/nsi";

type TokenProvider = string | (() => string | Promise<string>);

async function resolveToken(tp?: TokenProvider): Promise<string | undefined> {
  if (!tp) return undefined;
  if (typeof tp === "string") return tp;
  return await tp();
}

function normalizeContentType(v: string | null): string {
  return (v ?? "").split(";")[0].trim().toLowerCase();
}

function withAuth(tp?: TokenProvider) {
  return async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const token = await resolveToken(tp);

    const headers = new Headers(init.headers);

    // IMPORTANT FIX:
    // If body is present and Content-Type becomes text/plain (browser default for string bodies),
    // Django REST Framework rejects it. Force application/json for non-special bodies.
    const hasBody = init.body !== undefined && init.body !== null;

    const ct = normalizeContentType(headers.get("content-type"));
    const isTextPlain = ct === "text/plain";
    const isMissing = !ct;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bodyAny: any = init.body;

    const isSpecialBody =
      (typeof FormData !== "undefined" && bodyAny instanceof FormData) ||
      (typeof Blob !== "undefined" && bodyAny instanceof Blob) ||
      (typeof URLSearchParams !== "undefined" && bodyAny instanceof URLSearchParams);

    if (hasBody && !isSpecialBody && (isMissing || isTextPlain)) {
      headers.set("Content-Type", "application/json");
    }

    if (token) headers.set("Authorization", `Bearer ${token}`);

    return fetch(input, { ...init, headers });
  };
}

export function createDocumentsClient(opts: { baseUrl: string; token?: TokenProvider }) {
  return createClient<DocumentsPaths>({
    baseUrl: opts.baseUrl,
    fetch: withAuth(opts.token),
  });
}

export function createNsiClient(opts: { baseUrl: string; token?: TokenProvider }) {
  return createClient<NsiPaths>({
    baseUrl: opts.baseUrl,
    fetch: withAuth(opts.token),
  });
}

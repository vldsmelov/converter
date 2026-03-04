type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

export class ApiError extends Error {
  status: number;
  bodyText: string;

  constructor(status: number, bodyText: string) {
    super(`HTTP ${status}: ${bodyText}`);
    this.status = status;
    this.bodyText = bodyText;
  }
}

export async function requestJson<T = Json>(opts: {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  token?: string;
  body?: unknown;
}): Promise<T> {
  const headers: Record<string, string> = {
    "Accept": "application/json",
  };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  let body: BodyInit | undefined = undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(opts.url, { method: opts.method, headers, body });
  const text = await res.text();

  if (!res.ok) throw new ApiError(res.status, text || res.statusText);

  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    // some endpoints might return plain text
    return text as unknown as T;
  }
}

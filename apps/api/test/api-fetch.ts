import { SELF } from "cloudflare:test";
import { withClientApiKeyHeaders, withClientApiQuery } from "./client-api-key.ts";

export function apiFetch(input: string | Request, init: RequestInit = {}): Promise<Response> {
  if (typeof input === "string") {
    const headers =
      init.headers instanceof Headers
        ? Object.fromEntries(init.headers.entries())
        : Array.isArray(init.headers)
          ? Object.fromEntries(init.headers)
          : { ...((init.headers as Record<string, string> | undefined) ?? {}) };
    return SELF.fetch(withClientApiQuery(input), {
      ...init,
      headers: withClientApiKeyHeaders(headers),
    });
  }

  const headers = withClientApiKeyHeaders(Object.fromEntries(input.headers.entries()));
  return SELF.fetch(withClientApiQuery(input.url), {
    method: input.method,
    headers,
    body: input.body,
    redirect: input.redirect,
    duplex: input.body ? "half" : undefined,
  });
}

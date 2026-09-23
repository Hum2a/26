import { clientApiKeyHeader, clientApiKeyQueryParam } from "@26/shared";
import { timingSafeEqual } from "node:crypto";
import { presentBinding } from "../auth/bindings.ts";

export function requiresClientApiKey(path: string): boolean {
  if (path === "/api/health" || path === "/api/auth" || path.startsWith("/api/auth/")) {
    return false;
  }
  return path.startsWith("/api/") || path.startsWith("/ws/") || path === "/ws";
}

export function readClientApiKey(request: Request): string | undefined {
  const header = request.headers.get(clientApiKeyHeader)?.trim();
  if (header) {
    return header;
  }
  const query = new URL(request.url).searchParams.get(clientApiKeyQueryParam)?.trim();
  return query || undefined;
}

/** Returns true when the request should be rejected. */
export function rejectUnlessClientApiKey(request: Request, env: Env): boolean {
  const configured = presentBinding(env.CLIENT_API_KEY);
  if (!configured) {
    return env.APP_ENV !== "local";
  }
  const provided = readClientApiKey(request);
  if (!provided) {
    return true;
  }
  return !clientApiKeysMatch(provided, configured);
}

function clientApiKeysMatch(provided: string, configured: string): boolean {
  const actual = Buffer.from(provided);
  const expected = Buffer.from(configured);
  if (actual.length !== expected.length) {
    timingSafeEqual(actual, actual);
    return false;
  }
  return timingSafeEqual(actual, expected);
}

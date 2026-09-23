import { authFailureSchema, type AuthFailure } from "@26/shared";

const messages: Record<AuthFailure["error"], string> = {
  unauthenticated: "Sign in as the administrator to continue.",
  forbidden: "This credential cannot do that.",
  misconfigured: "Authentication is not configured for this environment.",
  invalid: "That request was not accepted.",
  expired: "This room credential has expired.",
};

export function authFailure(error: AuthFailure["error"], status: number): Response {
  const body = authFailureSchema.parse({ error, message: messages[error] });
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export function jsonData(
  body: unknown,
  status = 200,
  extraHeaders?: Headers,
): Response {
  const headers = new Headers({
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  if (extraHeaders) {
    for (const cookie of extraHeaders.getSetCookie()) {
      headers.append("set-cookie", cookie);
    }
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export function copyCookies(from: Response): Headers {
  const headers = new Headers();
  for (const cookie of from.headers.getSetCookie()) {
    headers.append("set-cookie", cookie);
  }
  return headers;
}

export function logAuthFailure(error: unknown): void {
  if (!(error instanceof Error)) {
    console.error("Auth failed");
    return;
  }
  const message = error.message.toLowerCase();
  if (
    message.includes("://") ||
    message.includes("password") ||
    message.includes("secret")
  ) {
    console.error("Auth failed", error.name);
    return;
  }
  console.error("Auth failed", error.name, error.message);
}

import {
  adminSessionSchema,
  authFailureSchema,
  devInboxSchema,
  magicLinkAcceptanceSchema,
  type AdminSession,
  type DevInbox,
  type MagicLinkAcceptance,
} from "@26/shared";
import { clientApiHeaders } from "../api/client-key.ts";

/** `transient` means the server was not reached; trying again may succeed. */
type Failure = { error: string; transient?: true };

// Bound every auth request, including response decoding, so the UI can recover.
async function authRequest(
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; body: unknown } | Failure> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
      headers: clientApiHeaders(
        body === undefined ? {} : { "content-type": "application/json" },
      ),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { ok: response.ok, body: await response.json() };
  } catch {
    return {
      error: "We couldn’t reach sign-in. Check your connection and try again.",
      transient: true,
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchAdminSession(): Promise<AdminSession | Failure> {
  const result = await authRequest("/api/admin/session");
  if ("error" in result) return result;
  if (!result.ok) return { error: failureMessage(result.body) };
  const parsed = adminSessionSchema.safeParse(result.body);
  return parsed.success
    ? parsed.data
    : { error: "We couldn’t check your session. Try again." };
}

export async function requestMagicLink(
  email: string,
): Promise<MagicLinkAcceptance | Failure> {
  const result = await authRequest("/api/admin/magic-link", { email });
  if ("error" in result) return result;
  if (!result.ok) return { error: failureMessage(result.body) };
  const parsed = magicLinkAcceptanceSchema.safeParse(result.body);
  return parsed.success
    ? parsed.data
    : { error: "The sign-in request was not accepted. Try again." };
}

export async function confirmMagicLink(token: string): Promise<AdminSession | Failure> {
  const result = await authRequest("/api/admin/magic-link/verify", { token });
  if ("error" in result) return result;
  if (!result.ok) return { error: "This sign-in link is invalid or has expired." };
  const parsed = adminSessionSchema.safeParse(result.body);
  return parsed.success
    ? parsed.data
    : { error: "We couldn’t confirm sign-in. Try again." };
}

export async function confirmEmailCode(
  email: string,
  code: string,
): Promise<AdminSession | Failure> {
  const result = await authRequest("/api/admin/email-code/verify", { email, code });
  if ("error" in result) return result;
  if (!result.ok)
    return {
      error:
        "That code is incorrect or has expired. Try again, or request a new email.",
    };
  const parsed = adminSessionSchema.safeParse(result.body);
  return parsed.success && parsed.data.signedIn
    ? parsed.data
    : { error: "We couldn’t confirm sign-in. Try again." };
}

export async function signOutAdmin(): Promise<Failure | undefined> {
  const result = await authRequest("/api/admin/sign-out", {});
  if ("error" in result) return result;
  if (!result.ok) return { error: failureMessage(result.body) };
}

export async function fetchLocalInbox(): Promise<DevInbox["messages"]> {
  // Text only: the sign-in page needs the code and link, not the rendered email.
  const result = await authRequest("/api/dev/inbox?format=text");
  if ("error" in result || !result.ok) return [];
  const parsed = devInboxSchema.safeParse(result.body);
  return parsed.success ? parsed.data.messages : [];
}

export function confirmPath(text: string): string | undefined {
  const match = text.match(/https?:\/\/\S+/);
  if (!match) return undefined;
  try {
    const url = new URL(match[0]);
    return url.pathname === "/admin/confirm"
      ? `${url.pathname}${url.search}`
      : undefined;
  } catch {
    return undefined;
  }
}

function failureMessage(body: unknown): string {
  const parsed = authFailureSchema.safeParse(body);
  return parsed.success
    ? parsed.data.message
    : "Authentication is not available. Try again.";
}

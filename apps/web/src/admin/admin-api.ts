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

export async function fetchAdminSession(): Promise<AdminSession | { error: string }> {
  const response = await fetch("/api/admin/session", { headers: clientApiHeaders() });
  const body: unknown = await response.json();
  if (!response.ok) {
    return { error: failureMessage(body) };
  }
  return adminSessionSchema.parse(body);
}

export async function requestMagicLink(
  email: string,
): Promise<MagicLinkAcceptance | { error: string }> {
  const response = await fetch("/api/admin/magic-link", {
    method: "POST",
    headers: clientApiHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ email }),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    return { error: failureMessage(body) };
  }
  return magicLinkAcceptanceSchema.parse(body);
}

export async function confirmMagicLink(
  token: string,
): Promise<AdminSession | { error: string }> {
  const response = await fetch("/api/admin/magic-link/verify", {
    method: "POST",
    headers: clientApiHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ token }),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    return { error: "This sign-in link is invalid or has expired." };
  }
  return adminSessionSchema.parse(body);
}

export async function signOutAdmin(): Promise<void> {
  await fetch("/api/admin/sign-out", { method: "POST", headers: clientApiHeaders() });
}

export async function fetchLocalInbox(): Promise<DevInbox["messages"]> {
  const response = await fetch("/api/dev/inbox", { headers: clientApiHeaders() });
  if (!response.ok) {
    return [];
  }
  return devInboxSchema.parse(await response.json()).messages;
}

export function confirmPath(text: string): string | undefined {
  const match = text.match(/https?:\/\/\S+/);
  if (!match) {
    return undefined;
  }
  try {
    const url = new URL(match[0]);
    if (url.pathname !== "/admin/confirm") {
      return undefined;
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return undefined;
  }
}

function failureMessage(body: unknown): string {
  const parsed = authFailureSchema.safeParse(body);
  return parsed.success ? parsed.data.message : "Authentication is not available.";
}

import type { RoomCredentialRole } from "@26/shared";

export function credentialCookieName(role: RoomCredentialRole): string {
  return role === "control" ? "26_room_control" : "26_room_presentation";
}

export function credentialCookiePath(role: RoomCredentialRole): string {
  // Both roles use the site root so the browser sends them on /api and /ws.
  return role === "control" || role === "presentation" ? "/" : "/";
}

export function serializeCredentialCookie(input: {
  role: RoomCredentialRole;
  credentialId: string;
  secret: string;
  maxAgeSeconds: number;
}): string {
  const value = `${input.credentialId}.${input.secret}`;
  const parts = [
    `${credentialCookieName(input.role)}=${value}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    `Path=${credentialCookiePath(input.role)}`,
    `Max-Age=${input.maxAgeSeconds}`,
  ];
  return parts.join("; ");
}

export function readCredentialCookie(
  cookieHeader: string | undefined,
  role: RoomCredentialRole,
): { credentialId: string; secret: string } | undefined {
  if (!cookieHeader) {
    return undefined;
  }
  const name = credentialCookieName(role);
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    if (key !== name) {
      continue;
    }
    const value = part.slice(separator + 1).trim();
    const dot = value.indexOf(".");
    if (dot <= 0 || dot === value.length - 1) {
      return undefined;
    }
    return {
      credentialId: value.slice(0, dot),
      secret: value.slice(dot + 1),
    };
  }
  return undefined;
}

export const guestCookieName = "26_guest";

export function serializeGuestCookie(input: {
  gameId: string;
  playerId: string;
  secret: string;
  maxAgeSeconds: number;
  secure?: boolean;
}): string {
  const value = `${input.gameId}.${input.playerId}.${input.secret}`;
  return [
    `${guestCookieName}=${value}`,
    "HttpOnly",
    ...(input.secure === false ? [] : ["Secure"]),
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${input.maxAgeSeconds}`,
  ].join("; ");
}

export function readGuestCookie(
  cookieHeader: string | undefined,
): { gameId: string; playerId: string; secret: string } | undefined {
  if (!cookieHeader) {
    return undefined;
  }
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    if (key !== guestCookieName) {
      continue;
    }
    const value = part.slice(separator + 1).trim();
    const parts = value.split(".");
    if (parts.length !== 3 || parts.some((item) => item.length === 0)) {
      return undefined;
    }
    return { gameId: parts[0] ?? "", playerId: parts[1] ?? "", secret: parts[2] ?? "" };
  }
  return undefined;
}

export function sameOriginRejection(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return true;
  }
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return true;
  }
  return false;
}

/**
 * A same-origin GET often omits Origin. The control cookie is host-only and
 * SameSite=Strict, so a missing Origin is accepted. A present Origin must
 * still match, and a cross-site fetch is still rejected.
 */
export function sameOriginReadRejection(request: Request): boolean {
  if (!request.headers.get("origin")) {
    const site = request.headers.get("sec-fetch-site");
    return Boolean(site && site !== "same-origin" && site !== "none");
  }
  return sameOriginRejection(request);
}

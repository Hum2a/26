import { timingSafeEqual } from "node:crypto";
import type { RoomCredentialRole } from "@26/shared";
import type { RoomCredentialRecord } from "./types.ts";

/**
 * Room credentials last a whole party night. Every host command also needs a
 * valid admin session, so the control credential is never the only check.
 * A 15-minute control credential made host commands fail mid-show until the
 * room was reopened, which also revoked the live desk's own connection.
 */
export const controlCredentialTtlMs = 12 * 60 * 60 * 1000;
export const presentationCredentialTtlMs = 14 * 60 * 60 * 1000;
export const guestCredentialTtlMs = 12 * 60 * 60 * 1000;

export function credentialLifetimeMs(role: RoomCredentialRole): number {
  return role === "control" ? controlCredentialTtlMs : presentationCredentialTtlMs;
}

export type CredentialCheck =
  | { ok: true }
  | {
      ok: false;
      reason: "mismatch" | "expired" | "revoked" | "wrong_role" | "wrong_room";
    };

/**
 * Pure check against a verifier record already loaded by the caller.
 * It does not open a database.
 */
export async function verifyRoomCredential(input: {
  credentialId: string;
  secret: string;
  record: RoomCredentialRecord;
  now: Date;
  roomId: string;
  role: RoomCredentialRole;
}): Promise<CredentialCheck> {
  if (input.record.revokedAt) {
    return { ok: false, reason: "revoked" };
  }
  if (Date.parse(input.record.expiresAt) <= input.now.getTime()) {
    return { ok: false, reason: "expired" };
  }
  const matches = await hashesMatch(input.secret, input.record.secretHash);
  if (!matches || input.credentialId !== input.record.id) {
    return { ok: false, reason: "mismatch" };
  }
  if (input.record.role !== input.role) {
    return { ok: false, reason: "wrong_role" };
  }
  if (input.record.roomId !== input.roomId) {
    return { ok: false, reason: "wrong_room" };
  }
  return { ok: true };
}

/** Guest recovery uses the same hash comparison. The shared role enum stays control and presentation. */
export async function verifyGuestSecret(input: {
  secret: string;
  secretHash: string;
  expiresAt: string;
  revokedAt: string | null;
  now: Date;
}): Promise<CredentialCheck> {
  if (input.revokedAt) {
    return { ok: false, reason: "revoked" };
  }
  if (Date.parse(input.expiresAt) <= input.now.getTime()) {
    return { ok: false, reason: "expired" };
  }
  const matches = await hashesMatch(input.secret, input.secretHash);
  if (!matches) {
    return { ok: false, reason: "mismatch" };
  }
  return { ok: true };
}

export async function hashCredentialSecret(secret: string): Promise<string> {
  const digest = await sha256(secret);
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createCredentialSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function hashesMatch(secret: string, expectedHash: string): Promise<boolean> {
  const actual = await sha256(secret);
  const expected = hexToBytes(expectedHash);
  if (expected.length !== actual.length) {
    timingSafeEqual(actual, actual);
    return false;
  }
  return timingSafeEqual(actual, expected);
}

async function sha256(value: string): Promise<Uint8Array<ArrayBuffer>> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return new Uint8Array(digest);
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length % 2 !== 0) {
    return new Uint8Array(0);
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    const pair = hex.slice(index * 2, index * 2 + 2);
    const value = Number.parseInt(pair, 16);
    if (Number.isNaN(value)) {
      return new Uint8Array(0);
    }
    bytes[index] = value;
  }
  return bytes;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

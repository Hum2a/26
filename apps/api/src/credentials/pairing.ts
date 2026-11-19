import type { RateLimit } from "@26/shared";
import { hashCredentialSecret } from "./verify.ts";

/**
 * Projector pairing: Humza shows a short code in Live controls and the
 * projector laptop types it to receive the room's ordinary presentation
 * credential, so that laptop never needs an admin login.
 *
 * A code is single-use, lasts ten minutes and pairs one room's projector only.
 * Only its hash is stored. Issuing a new code voids any code still open, and
 * too many wrong guesses void the open code as well.
 */
export const pairingCodeTtlMs = 10 * 60 * 1000;
export const pairingCodeLength = 8;
/** Wrong guesses a room accepts before the open code is voided. */
export const maxPairingFailures = 10;
/** Redeem attempts per room. A rejected attempt costs no storage write. */
export const pairingRedeemRateLimit: RateLimit = {
  capacity: 5,
  refillPerSecond: 1 / 12,
};
/** Codes issued per room. */
export const pairingIssueRateLimit: RateLimit = {
  capacity: 5,
  refillPerSecond: 1 / 30,
};

/** No I, O, 0 or 1, so a code read off a phone is easy to type. */
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const pairingInvalidMessage =
  "That pairing code was not accepted. Check the code in Live controls.";
export const pairingUsedMessage =
  "That pairing code has already been used. Show a new code in Live controls.";
export const pairingExpiredMessage =
  "That pairing code has expired. Show a new code in Live controls.";
export const pairingRateMessage = "Too many attempts. Wait a minute, then try again.";

export function createPairingCode(): string {
  const bytes = new Uint8Array(pairingCodeLength);
  crypto.getRandomValues(bytes);
  let code = "";
  // 256 is a multiple of 32, so the modulo is unbiased.
  for (const byte of bytes) code += alphabet[byte % alphabet.length] ?? "";
  return code;
}

/** Accepts lower case, spaces and the hyphen the screen shows. */
export function normalisePairingCode(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 32) return undefined;
  const code = value.replace(/[\s-]/g, "").toUpperCase();
  if (code.length !== pairingCodeLength) return undefined;
  for (const character of code) if (!alphabet.includes(character)) return undefined;
  return code;
}

export function hashPairingCode(code: string): Promise<string> {
  return hashCredentialSecret(`pairing:${code}`);
}

/**
 * Created on first use so existing rooms need no schema version change. The
 * table stays tiny: one row per issued code.
 */
function ensurePairingTable(sql: SqlStorage): void {
  sql.exec(`CREATE TABLE IF NOT EXISTS projector_pairing (
    code_hash TEXT PRIMARY KEY,
    issued_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    consumed_at TEXT,
    failures INTEGER NOT NULL DEFAULT 0
  )`);
}

/** Runs inside the caller's transaction. Voids any open code first. */
export function storePairingCode(
  sql: SqlStorage,
  input: { codeHash: string; now: string; expiresAt: string },
): void {
  ensurePairingTable(sql);
  sql.exec(
    `UPDATE projector_pairing SET consumed_at = ? WHERE consumed_at IS NULL`,
    input.now,
  );
  sql.exec(
    `INSERT INTO projector_pairing (code_hash, issued_at, expires_at, consumed_at, failures)
     VALUES (?, ?, ?, NULL, 0)`,
    input.codeHash,
    input.now,
    input.expiresAt,
  );
}

export type PairingClaim =
  { ok: true } | { ok: false; reason: "invalid" | "used" | "expired" };

/**
 * Runs inside the caller's transaction. A matching open code is consumed.
 * A wrong code counts against the open code, which is voided at the limit.
 */
export function claimPairingCode(
  sql: SqlStorage,
  input: { codeHash: string; now: string },
): PairingClaim {
  ensurePairingTable(sql);
  const row = sql
    .exec<{ expires_at: string; consumed_at: string | null }>(
      `SELECT expires_at, consumed_at FROM projector_pairing WHERE code_hash = ?`,
      input.codeHash,
    )
    .toArray()[0];
  if (!row) {
    sql.exec(
      `UPDATE projector_pairing SET failures = failures + 1 WHERE consumed_at IS NULL`,
    );
    sql.exec(
      `UPDATE projector_pairing SET consumed_at = ?
       WHERE consumed_at IS NULL AND failures >= ?`,
      input.now,
      maxPairingFailures,
    );
    return { ok: false, reason: "invalid" };
  }
  if (row.consumed_at) return { ok: false, reason: "used" };
  if (Date.parse(row.expires_at) <= Date.parse(input.now)) {
    return { ok: false, reason: "expired" };
  }
  sql.exec(
    `UPDATE projector_pairing SET consumed_at = ? WHERE code_hash = ?`,
    input.now,
    input.codeHash,
  );
  return { ok: true };
}

export function pairingMessage(reason: "invalid" | "used" | "expired"): string {
  return reason === "used"
    ? pairingUsedMessage
    : reason === "expired"
      ? pairingExpiredMessage
      : pairingInvalidMessage;
}

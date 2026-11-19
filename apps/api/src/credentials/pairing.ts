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
/** Used, voided by a newer code, or voided after too many wrong guesses. */
export const pairingUsedMessage =
  "That pairing code is no longer valid. Show a new code in Live controls.";
/** What a retried issue request gets once its code is no longer open. */
export const pairingSpentMessage =
  "That pairing code is no longer open. Show a new code.";
/** Receipt principal for issued codes; spent codes are scrubbed from it. */
export const pairingIssuePrincipal = "projector-pairing-issue";
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
    failures INTEGER NOT NULL DEFAULT 0,
    issue_request_id TEXT
  )`);
}

/**
 * The issue receipt keeps the plain code only while that code is open, so a
 * retried request can show it again. Once the code is used, voided or
 * expired, its receipt is replaced with a refusal and only the hash remains.
 */
function scrubSpentReceipts(sql: SqlStorage, now: string): void {
  const spent = sql
    .exec<{ issue_request_id: string }>(
      `SELECT issue_request_id FROM projector_pairing
       WHERE issue_request_id IS NOT NULL AND (consumed_at IS NOT NULL OR expires_at <= ?)`,
      now,
    )
    .toArray();
  if (spent.length === 0) return;
  const refusal = JSON.stringify({
    ok: false,
    error: "invalid",
    message: pairingSpentMessage,
  });
  for (const row of spent) {
    sql.exec(
      `UPDATE receipt SET result_json = ? WHERE principal = ? AND request_id = ?`,
      refusal,
      pairingIssuePrincipal,
      row.issue_request_id,
    );
  }
  sql.exec(
    `UPDATE projector_pairing SET issue_request_id = NULL
     WHERE issue_request_id IS NOT NULL AND (consumed_at IS NOT NULL OR expires_at <= ?)`,
    now,
  );
}

/** Runs inside the caller's transaction. Voids any open code first. */
export function storePairingCode(
  sql: SqlStorage,
  input: { codeHash: string; now: string; expiresAt: string; requestId: string },
): void {
  ensurePairingTable(sql);
  sql.exec(
    `UPDATE projector_pairing SET consumed_at = ? WHERE consumed_at IS NULL`,
    input.now,
  );
  scrubSpentReceipts(sql, input.now);
  sql.exec(
    `INSERT INTO projector_pairing
       (code_hash, issued_at, expires_at, consumed_at, failures, issue_request_id)
     VALUES (?, ?, ?, NULL, 0, ?)`,
    input.codeHash,
    input.now,
    input.expiresAt,
    input.requestId,
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
  const claim = consumeOrCount(sql, input);
  scrubSpentReceipts(sql, input.now);
  return claim;
}

function consumeOrCount(
  sql: SqlStorage,
  input: { codeHash: string; now: string },
): PairingClaim {
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

import type { SqlQuery } from "../auth/create-database.ts";
import type { DeliveryJob, DeliveryStore, EmailGrant } from "./delivery.ts";

export function postgresDelivery(query: SqlQuery): DeliveryStore {
  return {
    async getJob(jobId) {
      const rows = await query(
        `SELECT job_id, game_id, player_id, purpose, recipient, idempotency_key,
                status, attempts, subject, body_text
         FROM archive_delivery_job WHERE job_id = $1`,
        [jobId],
      );
      return rows[0] ? mapJob(rows[0]) : null;
    },
    async insertJob(job) {
      const rows = await query(
        `INSERT INTO archive_delivery_job (
           job_id, game_id, player_id, purpose, recipient, idempotency_key,
           status, attempts, body_text, subject, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
         ON CONFLICT (job_id) DO NOTHING
         RETURNING job_id`,
        [
          job.jobId,
          job.gameId,
          job.playerId,
          job.purpose,
          job.recipient,
          job.idempotencyKey,
          job.status,
          job.attempts,
          job.bodyText,
          job.subject,
          new Date().toISOString(),
        ],
      );
      return rows.length > 0 ? "stored" : "present";
    },
    async saveJob(job, nowIso) {
      await query(
        `UPDATE archive_delivery_job
         SET idempotency_key = $2, status = $3, attempts = $4, body_text = $5,
             subject = $6, updated_at = $7
         WHERE job_id = $1`,
        [
          job.jobId,
          job.idempotencyKey,
          job.status,
          job.attempts,
          job.bodyText,
          job.subject,
          nowIso,
        ],
      );
    },
    async upsertGrant(grant) {
      await query(
        `DELETE FROM archive_email_grant
         WHERE game_id = $1 AND player_id = $2 AND purpose = $3 AND recipient = $4`,
        [grant.gameId, grant.playerId, grant.purpose, grant.recipient],
      );
      await query(
        `INSERT INTO archive_email_grant (
           grant_id, game_id, player_id, recipient, purpose, token_hash,
           expires_at, used_at, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          grant.grantId,
          grant.gameId,
          grant.playerId,
          grant.recipient,
          grant.purpose,
          grant.tokenHash,
          grant.expiresAt,
          grant.usedAt,
          new Date().toISOString(),
        ],
      );
    },
    async findGrantByHash(tokenHash) {
      const rows = await query(
        `SELECT grant_id, game_id, player_id, recipient, purpose, token_hash,
                expires_at, used_at
         FROM archive_email_grant WHERE token_hash = $1`,
        [tokenHash],
      );
      return rows[0] ? mapGrant(rows[0]) : null;
    },
    async findGrant(input) {
      const rows = await query(
        `SELECT grant_id, game_id, player_id, recipient, purpose, token_hash,
                expires_at, used_at
         FROM archive_email_grant
         WHERE game_id = $1 AND player_id = $2 AND purpose = $3 AND recipient = $4
         ORDER BY created_at DESC
         LIMIT 1`,
        [input.gameId, input.playerId, input.purpose, input.recipient],
      );
      return rows[0] ? mapGrant(rows[0]) : null;
    },
    async summarise(gameId) {
      const counts = { pending: 0, uncertain: 0, failed: 0, sent: 0 };
      const rows = await query(
        `SELECT status, COUNT(*)::int AS total
         FROM archive_delivery_job WHERE game_id = $1 GROUP BY status`,
        [gameId],
      );
      for (const row of rows) {
        const status = String(row.status);
        const total = Number(row.total);
        if (
          status === "pending" ||
          status === "uncertain" ||
          status === "failed" ||
          status === "sent"
        ) {
          counts[status] = total;
        }
      }
      return counts;
    },
    async listRetryable(gameId) {
      const rows = await query(
        `SELECT job_id, game_id, player_id, purpose, recipient, idempotency_key,
                status, attempts, subject, body_text
         FROM archive_delivery_job
         WHERE game_id = $1 AND status IN ('failed', 'uncertain') AND attempts < 8
         ORDER BY created_at ASC
         LIMIT 20`,
        [gameId],
      );
      return rows.map((row) => mapJob(row));
    },
    async markGrantUsed(grantId, nowIso) {
      await query(`UPDATE archive_email_grant SET used_at = $2 WHERE grant_id = $1`, [
        grantId,
        nowIso,
      ]);
    },
  };
}

function mapJob(row: Record<string, unknown>): DeliveryJob {
  const status = String(row.status);
  return {
    jobId: String(row.job_id),
    gameId: String(row.game_id),
    playerId: String(row.player_id),
    purpose: row.purpose === "results" ? "results" : "verify",
    recipient: String(row.recipient),
    idempotencyKey: String(row.idempotency_key),
    status:
      status === "sent" || status === "uncertain" || status === "failed"
        ? status
        : "pending",
    attempts: Number(row.attempts),
    subject: row.subject == null ? null : String(row.subject),
    bodyText: row.body_text == null ? null : String(row.body_text),
  };
}

function mapGrant(row: Record<string, unknown>): EmailGrant {
  return {
    grantId: String(row.grant_id),
    gameId: String(row.game_id),
    playerId: String(row.player_id),
    recipient: String(row.recipient),
    purpose: row.purpose === "results" ? "results" : "verify",
    tokenHash: String(row.token_hash),
    expiresAt: new Date(String(row.expires_at)).toISOString(),
    usedAt: row.used_at == null ? null : new Date(String(row.used_at)).toISOString(),
  };
}

import type { EmailSender } from "../auth/create-email.ts";
import type { DeliveryJob, DeliveryStore, EmailGrant } from "./delivery.ts";

export function sqliteDelivery(sql: SqlStorage): DeliveryStore {
  ensureDelivery(sql);
  return {
    async getJob(jobId) {
      const row = sql
        .exec<JobRow>(
          `SELECT job_id, game_id, player_id, purpose, recipient, idempotency_key,
                  status, attempts, subject, body_text
           FROM dev_delivery_job WHERE job_id = ?`,
          jobId,
        )
        .toArray()[0];
      return row ? mapJob(row) : null;
    },
    async insertJob(job) {
      const existing = sql
        .exec(`SELECT job_id FROM dev_delivery_job WHERE job_id = ?`, job.jobId)
        .toArray()[0];
      if (existing) {
        return "present";
      }
      const now = new Date().toISOString();
      sql.exec(
        `INSERT INTO dev_delivery_job (
           job_id, game_id, player_id, purpose, recipient, idempotency_key,
           status, attempts, body_text, subject, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        now,
        now,
      );
      return "stored";
    },
    async saveJob(job, nowIso) {
      sql.exec(
        `UPDATE dev_delivery_job
         SET idempotency_key = ?, status = ?, attempts = ?, body_text = ?, subject = ?, updated_at = ?
         WHERE job_id = ?`,
        job.idempotencyKey,
        job.status,
        job.attempts,
        job.bodyText,
        job.subject,
        nowIso,
        job.jobId,
      );
    },
    async upsertGrant(grant) {
      sql.exec(
        `DELETE FROM dev_email_grant
         WHERE game_id = ? AND player_id = ? AND purpose = ? AND recipient = ?`,
        grant.gameId,
        grant.playerId,
        grant.purpose,
        grant.recipient,
      );
      sql.exec(
        `INSERT INTO dev_email_grant (
           grant_id, game_id, player_id, recipient, purpose, token_hash,
           expires_at, used_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        grant.grantId,
        grant.gameId,
        grant.playerId,
        grant.recipient,
        grant.purpose,
        grant.tokenHash,
        grant.expiresAt,
        grant.usedAt,
        new Date().toISOString(),
      );
    },
    async findGrantByHash(tokenHash) {
      const row = sql
        .exec<GrantRow>(
          `SELECT grant_id, game_id, player_id, recipient, purpose, token_hash, expires_at, used_at
           FROM dev_email_grant WHERE token_hash = ?`,
          tokenHash,
        )
        .toArray()[0];
      return row ? mapGrant(row) : null;
    },
    async findGrant(input) {
      const row = sql
        .exec<GrantRow>(
          `SELECT grant_id, game_id, player_id, recipient, purpose, token_hash, expires_at, used_at
           FROM dev_email_grant
           WHERE game_id = ? AND player_id = ? AND purpose = ? AND recipient = ?
           ORDER BY created_at DESC
           LIMIT 1`,
          input.gameId,
          input.playerId,
          input.purpose,
          input.recipient,
        )
        .toArray()[0];
      return row ? mapGrant(row) : null;
    },
    async summarise(gameId) {
      const counts = { pending: 0, uncertain: 0, failed: 0, sent: 0 };
      const rows = sql
        .exec<{ status: string; total: number }>(
          `SELECT status, COUNT(*) AS total FROM dev_delivery_job WHERE game_id = ? GROUP BY status`,
          gameId,
        )
        .toArray();
      for (const row of rows) {
        if (
          row.status === "pending" ||
          row.status === "uncertain" ||
          row.status === "failed" ||
          row.status === "sent"
        ) {
          counts[row.status] = row.total;
        }
      }
      return counts;
    },
    async listRetryable(gameId) {
      return sql
        .exec<JobRow>(
          `SELECT job_id, game_id, player_id, purpose, recipient, idempotency_key,
                  status, attempts, subject, body_text
           FROM dev_delivery_job
           WHERE game_id = ? AND status IN ('failed', 'uncertain') AND attempts < 8
           ORDER BY created_at ASC
           LIMIT 20`,
          gameId,
        )
        .toArray()
        .map(mapJob);
    },
    async markGrantUsed(grantId, nowIso) {
      sql.exec(
        `UPDATE dev_email_grant SET used_at = ? WHERE grant_id = ?`,
        nowIso,
        grantId,
      );
    },
  };
}

export function sqliteOutbox(sql: SqlStorage): EmailSender {
  ensureDelivery(sql);
  return {
    kind: "local-inbox",
    async send(message) {
      if (message.idempotencyKey) {
        const existing = sql
          .exec(
            `SELECT id FROM dev_email_outbox WHERE idempotency_key = ?`,
            message.idempotencyKey,
          )
          .toArray()[0];
        if (existing) {
          return;
        }
      }
      sql.exec(
        `INSERT INTO dev_email_outbox (id, recipient, subject, body, idempotency_key, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        crypto.randomUUID(),
        message.to,
        message.subject,
        message.text,
        message.idempotencyKey ?? null,
        new Date().toISOString(),
      );
    },
  };
}

export function listSqliteOutbox(sql: SqlStorage): {
  recipient: string;
  subject: string;
  text: string;
  idempotencyKey: string | null;
}[] {
  ensureDelivery(sql);
  return sql
    .exec<{
      recipient: string;
      subject: string;
      body: string;
      idempotency_key: string | null;
    }>(
      `SELECT recipient, subject, body, idempotency_key FROM dev_email_outbox ORDER BY created_at`,
    )
    .toArray()
    .map((row) => ({
      recipient: row.recipient,
      subject: row.subject,
      text: row.body,
      idempotencyKey: row.idempotency_key,
    }));
}

function ensureDelivery(sql: SqlStorage): void {
  sql.exec(
    `CREATE TABLE IF NOT EXISTS dev_delivery_job (
      job_id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      recipient TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL,
      body_text TEXT,
      subject TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  );
  sql.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS dev_delivery_job_recipient
      ON dev_delivery_job (game_id, player_id, purpose, recipient)`,
  );
  sql.exec(
    `CREATE TABLE IF NOT EXISTS dev_email_grant (
      grant_id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      recipient TEXT NOT NULL,
      purpose TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    )`,
  );
  sql.exec(
    `CREATE TABLE IF NOT EXISTS dev_email_outbox (
      id TEXT PRIMARY KEY,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      idempotency_key TEXT UNIQUE,
      created_at TEXT NOT NULL
    )`,
  );
}

type JobRow = {
  job_id: string;
  game_id: string;
  player_id: string;
  purpose: string;
  recipient: string;
  idempotency_key: string;
  status: string;
  attempts: number;
  subject: string | null;
  body_text: string | null;
};

type GrantRow = {
  grant_id: string;
  game_id: string;
  player_id: string;
  recipient: string;
  purpose: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
};

function mapJob(row: JobRow): DeliveryJob {
  const status = row.status;
  return {
    jobId: row.job_id,
    gameId: row.game_id,
    playerId: row.player_id,
    purpose: row.purpose === "results" ? "results" : "verify",
    recipient: row.recipient,
    idempotencyKey: row.idempotency_key,
    status:
      status === "sent" || status === "uncertain" || status === "failed"
        ? status
        : "pending",
    attempts: row.attempts,
    subject: row.subject,
    bodyText: row.body_text,
  };
}

function mapGrant(row: GrantRow): EmailGrant {
  return {
    grantId: row.grant_id,
    gameId: row.game_id,
    playerId: row.player_id,
    recipient: row.recipient,
    purpose: row.purpose === "results" ? "results" : "verify",
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
  };
}

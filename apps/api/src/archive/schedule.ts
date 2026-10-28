import {
  archiveExportJobId,
  archiveExportPayload,
  archiveRetainJobId,
  archiveRetainPayload,
  type ScheduledJob,
} from "../room/lifecycle.ts";
import { createSqlStore } from "../room/sql-store.ts";
import type { ArchiveKind } from "./document.ts";

export const maxArchiveAttempts = 8;

export type RoomArchiveRow = {
  finalRevision: number;
  targetRevision: number;
  verifiedRevision: number | null;
  status: "pending" | "failed" | "completed";
  attempts: number;
  lastError: string | null;
  kind: ArchiveKind;
};

export function queueFinalExport(sql: SqlStorage, now: number): void {
  if (sql.exec(`SELECT id FROM developer_rehearsal WHERE id=1`).toArray().length)
    return;
  if (readRoomArchive(sql)) {
    return;
  }
  const revision = readStateVersion(sql);
  sql.exec(
    `INSERT INTO room_archive (
       id, final_revision, target_revision, verified_revision, status, attempts, last_error, kind
     ) VALUES (1, ?, ?, NULL, 'pending', 0, NULL, 'final')`,
    revision,
    revision,
  );
  armExport(sql, now, 0);
}

/**
 * A hide or a score correction after the podium queues a new revision.
 * It does not change a publication that has already been verified.
 */
export function noteArchiveCorrection(sql: SqlStorage, now: number): void {
  const row = readRoomArchive(sql);
  if (!row) {
    return;
  }
  const revision = readStateVersion(sql);
  if (row.verifiedRevision === null) {
    if (revision === row.targetRevision && row.status === "pending") {
      return;
    }
    sql.exec(
      `UPDATE room_archive
       SET target_revision = ?, status = 'pending', kind = 'final', last_error = NULL
       WHERE id = 1`,
      revision,
    );
    if (row.status === "failed") {
      sql.exec(`UPDATE room_archive SET attempts = 0 WHERE id = 1`);
      armExport(sql, now, 0);
    }
    return;
  }
  if (revision <= row.verifiedRevision) {
    return;
  }
  if (row.status === "pending" && revision === row.targetRevision) {
    return;
  }
  sql.exec(
    `UPDATE room_archive
     SET target_revision = ?, status = 'pending', attempts = 0, last_error = NULL, kind = 'correction'
     WHERE id = 1`,
    revision,
  );
  armExport(sql, now, 0);
}

export function requeueFailedArchive(sql: SqlStorage, now: number): boolean {
  const row = readRoomArchive(sql);
  if (!row || row.status !== "failed") {
    return false;
  }
  sql.exec(
    `UPDATE room_archive
     SET status = 'pending', attempts = 0, last_error = NULL
     WHERE id = 1`,
  );
  armExport(sql, now, 0);
  return true;
}

export function readRoomArchive(sql: SqlStorage): RoomArchiveRow | null {
  const row = sql
    .exec<{
      final_revision: number;
      target_revision: number;
      verified_revision: number | null;
      status: string;
      attempts: number;
      last_error: string | null;
      kind: string;
    }>(
      `SELECT final_revision, target_revision, verified_revision, status, attempts, last_error, kind
       FROM room_archive WHERE id = 1`,
    )
    .toArray()[0];
  if (!row) {
    return null;
  }
  return {
    finalRevision: row.final_revision,
    targetRevision: row.target_revision,
    verifiedRevision: row.verified_revision,
    status:
      row.status === "failed" || row.status === "completed" ? row.status : "pending",
    attempts: row.attempts,
    lastError: row.last_error,
    kind: row.kind === "correction" ? "correction" : "final",
  };
}

export function markArchiveStored(
  sql: SqlStorage,
  revision: number,
  now: number,
): void {
  const row = readRoomArchive(sql);
  if (!row) {
    return;
  }
  const caughtUp = row.targetRevision <= revision;
  sql.exec(
    `UPDATE room_archive
     SET verified_revision = ?,
         status = ?,
         attempts = 0,
         last_error = NULL,
         kind = ?
     WHERE id = 1`,
    revision,
    caughtUp ? "completed" : "pending",
    caughtUp ? row.kind : "correction",
  );
  if (caughtUp) {
    finishJob(sql, archiveExportJobId);
    armRetain(sql, now);
    return;
  }
  armExport(sql, now, 0);
}

export function markArchiveRetry(sql: SqlStorage, now: number): "pending" | "failed" {
  const row = readRoomArchive(sql);
  const attempts = (row?.attempts ?? 0) + 1;
  if (attempts >= maxArchiveAttempts) {
    sql.exec(
      `UPDATE room_archive SET status = 'failed', attempts = ?, last_error = 'unavailable' WHERE id = 1`,
      attempts,
    );
    const job = findJob(sql, archiveExportJobId);
    if (job) {
      createSqlStore(sql).saveJob({
        ...job,
        status: "failed",
        dueAt: null,
        retryCount: attempts,
      });
    }
    return "failed";
  }
  const due = now + archiveDelayMs(attempts);
  sql.exec(
    `UPDATE room_archive SET status = 'pending', attempts = ?, last_error = 'unavailable' WHERE id = 1`,
    attempts,
  );
  const job = findJob(sql, archiveExportJobId);
  if (job) {
    createSqlStore(sql).saveJob({
      ...job,
      status: "pending",
      dueAt: due,
      retryCount: attempts,
    });
  }
  return "pending";
}

export function markRetainDone(sql: SqlStorage): void {
  finishJob(sql, archiveRetainJobId);
}

export function markRetainRetry(sql: SqlStorage, now: number): void {
  const job = findJob(sql, archiveRetainJobId);
  if (!job) {
    return;
  }
  const retryCount = job.retryCount + 1;
  if (retryCount >= maxArchiveAttempts) {
    createSqlStore(sql).saveJob({
      ...job,
      status: "failed",
      dueAt: null,
      retryCount,
    });
    return;
  }
  createSqlStore(sql).saveJob({
    ...job,
    status: "pending",
    dueAt: now + archiveDelayMs(retryCount),
    retryCount,
  });
}

export function archiveJobDue(sql: SqlStorage, jobId: string, now: number): boolean {
  const job = findJob(sql, jobId);
  return job?.status === "pending" && job.dueAt !== null && job.dueAt <= now;
}

export function archiveDelayMs(attempt: number): number {
  return Math.min(15 * 60_000, 5_000 * 2 ** Math.max(0, attempt - 1));
}

function armExport(sql: SqlStorage, now: number, retryCount: number): void {
  const room = createSqlStore(sql).readRoom();
  const current = findJob(sql, archiveExportJobId);
  const job: ScheduledJob = {
    jobId: archiveExportJobId,
    jobType: "background",
    dueAt: now,
    remainingMs: null,
    scopeGeneration: room.scopeGeneration,
    phaseGeneration: room.phaseGeneration,
    phase: null,
    status: "pending",
    retryCount,
    payload: archiveExportPayload,
    createdAt: current?.createdAt ?? now,
  };
  createSqlStore(sql).saveJob(job);
}

function armRetain(sql: SqlStorage, now: number): void {
  if (findJob(sql, archiveRetainJobId)) {
    return;
  }
  const earliest = sql
    .exec<{ context_id: string }>(`SELECT context_id FROM device_context LIMIT 1`)
    .toArray();
  const room = sql
    .exec<{ created_at: string; days: number }>(
      `SELECT created_at, telemetry_retention_days AS days FROM room`,
    )
    .toArray()[0];
  if (!room || earliest.length === 0) {
    return;
  }
  const due = Date.parse(room.created_at) + room.days * 24 * 60 * 60 * 1000;
  const clock = createSqlStore(sql).readRoom();
  createSqlStore(sql).saveJob({
    jobId: archiveRetainJobId,
    jobType: "background",
    dueAt: Math.max(now, due),
    remainingMs: null,
    scopeGeneration: clock.scopeGeneration,
    phaseGeneration: clock.phaseGeneration,
    phase: null,
    status: "pending",
    retryCount: 0,
    payload: archiveRetainPayload,
    createdAt: now,
  });
}

function finishJob(sql: SqlStorage, jobId: string): void {
  const job = findJob(sql, jobId);
  if (!job) {
    return;
  }
  createSqlStore(sql).saveJob({ ...job, status: "done", dueAt: null });
}

function findJob(sql: SqlStorage, jobId: string): ScheduledJob | undefined {
  return createSqlStore(sql)
    .jobs()
    .find((job) => job.jobId === jobId);
}

function readStateVersion(sql: SqlStorage): number {
  const row = sql
    .exec<{ state_version: number }>(`SELECT state_version FROM room`)
    .toArray()[0];
  return row?.state_version ?? 0;
}

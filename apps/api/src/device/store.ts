import {
  detailedTelemetryRetentionDays,
  deviceContextGapMs,
  materialHash,
  maxDeviceContextsPerPlayer,
  normaliseDeviceReport,
  reconnectCap,
  retryCap,
  rttSampleCap,
  telemetryRetentionJobId,
  type NormalisedDeviceReport,
} from "@26/shared";
import type { ScheduledJob } from "../room/lifecycle.ts";
import { createSqlStore } from "../room/sql-store.ts";

const contextValueSql = "(SELECT device_context_id FROM player WHERE player_id = ?)";

export function linkedContextSql(): string {
  return contextValueSql;
}

export function ensureTelemetryRetention(sql: SqlStorage, now: number): void {
  const room = sql
    .exec<{ created_at: string; days: number }>(
      `SELECT created_at, telemetry_retention_days AS days FROM room`,
    )
    .toArray()[0];
  if (!room) {
    return;
  }
  const existing = sql
    .exec(`SELECT job_id FROM schedule_job WHERE job_id = ?`, telemetryRetentionJobId)
    .toArray()[0];
  if (existing) {
    return;
  }
  saveRetentionJob(sql, retentionDue(room.created_at, room.days, now), now);
}

export function configureTelemetryRetention(
  sql: SqlStorage,
  days: number,
  now: number,
): void {
  const stored = Math.max(0, Math.min(3650, Math.round(days)));
  sql.exec(`UPDATE room SET telemetry_retention_days = ?`, stored);
  const room = sql
    .exec<{ created_at: string }>(`SELECT created_at FROM room`)
    .toArray()[0];
  if (!room) {
    return;
  }
  const due = retentionDue(room.created_at, stored, now);
  const store = createSqlStore(sql);
  const current = store.jobs().find((job) => job.jobId === telemetryRetentionJobId);
  if (!current) {
    saveRetentionJob(sql, due, now);
    return;
  }
  store.saveJob({
    ...current,
    dueAt: due,
    status: "pending",
    payload: "telemetry-retention",
  });
}

export function acceptDeviceReport(
  sql: SqlStorage,
  playerId: string,
  report: unknown,
  reason: string,
  now: number,
): { stored: boolean; contextId: string | null } {
  const normalised = normaliseDeviceReport(report);
  if (!normalised) {
    return { stored: false, contextId: currentContextId(sql, playerId) };
  }
  const player = sql
    .exec<{ device_context_id: string | null }>(
      `SELECT device_context_id FROM player WHERE player_id = ? AND revoked_at IS NULL`,
      playerId,
    )
    .toArray()[0];
  if (!player) {
    return { stored: false, contextId: null };
  }
  const hash = materialHash(normalised);
  const latest = latestContext(sql, playerId);
  const phaseGeneration = readPhaseGeneration(sql);
  const pointerMissing = player.device_context_id === null;
  if (!latest || pointerMissing) {
    if (countContexts(sql, playerId) >= maxDeviceContextsPerPlayer) {
      return { stored: false, contextId: null };
    }
    return {
      stored: true,
      contextId: insertContext(sql, playerId, normalised, hash, phaseGeneration, now),
    };
  }
  if (latest.material_hash === hash) {
    return { stored: false, contextId: latest.context_id };
  }
  if (
    reason === "phase" &&
    latest.phase_generation !== null &&
    latest.phase_generation === phaseGeneration
  ) {
    return { stored: false, contextId: latest.context_id };
  }
  if (reason !== "phase" && now - latest.updated_at < deviceContextGapMs) {
    return { stored: false, contextId: latest.context_id };
  }
  if (countContexts(sql, playerId) >= maxDeviceContextsPerPlayer) {
    return { stored: false, contextId: latest.context_id };
  }
  return {
    stored: true,
    contextId: insertContext(sql, playerId, normalised, hash, phaseGeneration, now),
  };
}

export function noteGuestSocket(sql: SqlStorage, playerId: string): void {
  const row = sql
    .exec<{ socket_opens: number; reconnects: number }>(
      `SELECT socket_opens, reconnects FROM connection_summary WHERE player_id = ?`,
      playerId,
    )
    .toArray()[0];
  if (!row) {
    sql.exec(
      `INSERT INTO connection_summary (
         player_id, socket_opens, reconnects, rtt_count, rtt_samples_json,
         rtt_median_ms, rtt_upper_ms, submission_retries, upload_attempts,
         upload_failures, upload_duration_ms, upload_duration_count
       ) VALUES (?, 1, 0, 0, '[]', NULL, NULL, 0, 0, 0, 0, 0)`,
      playerId,
    );
    return;
  }
  sql.exec(
    `UPDATE connection_summary
     SET socket_opens = socket_opens + 1, reconnects = ?
     WHERE player_id = ?`,
    Math.min(reconnectCap, row.reconnects + 1),
    playerId,
  );
}

export function mergeConnectionSummary(
  sql: SqlStorage,
  playerId: string,
  input: {
    rttMs: unknown;
    submissionRetries: unknown;
    uploadAttempts: unknown;
    uploadFailures: unknown;
    uploadDurationMs: unknown;
    scriptErrors?: unknown;
    lastScriptError?: unknown;
  },
): void {
  ensureConnectionRow(sql, playerId);
  const errors = boundedDelta(input.scriptErrors);
  if (errors > 0) {
    sql.exec(
      `UPDATE connection_summary
       SET script_errors = MIN(?, script_errors + ?),
           last_script_error = COALESCE(?, last_script_error),
           last_script_error_at = ?
       WHERE player_id = ?`,
      retryCap,
      errors,
      scriptErrorText(input.lastScriptError),
      new Date().toISOString(),
      playerId,
    );
  }
  const row = sql
    .exec<{
      rtt_count: number;
      rtt_samples_json: string;
      submission_retries: number;
      upload_attempts: number;
      upload_failures: number;
      upload_duration_ms: number;
      upload_duration_count: number;
    }>(
      `SELECT rtt_count, rtt_samples_json, submission_retries, upload_attempts,
              upload_failures, upload_duration_ms, upload_duration_count
       FROM connection_summary WHERE player_id = ?`,
      playerId,
    )
    .toArray()[0];
  if (!row) {
    return;
  }
  const samples = readSamples(row.rtt_samples_json);
  for (const sample of boundedSamples(input.rttMs)) {
    samples.push(sample);
    while (samples.length > rttSampleCap) {
      samples.shift();
    }
  }
  const added = boundedSamples(input.rttMs).length;
  const stats = sampleStats(samples);
  sql.exec(
    `UPDATE connection_summary
     SET rtt_count = ?, rtt_samples_json = ?, rtt_median_ms = ?, rtt_upper_ms = ?,
         submission_retries = ?, upload_attempts = ?, upload_failures = ?,
         upload_duration_ms = ?, upload_duration_count = ?
     WHERE player_id = ?`,
    row.rtt_count + added,
    JSON.stringify(samples),
    stats.median,
    stats.upper,
    Math.min(retryCap, row.submission_retries + boundedDelta(input.submissionRetries)),
    Math.min(retryCap, row.upload_attempts + boundedDelta(input.uploadAttempts)),
    Math.min(retryCap, row.upload_failures + boundedDelta(input.uploadFailures)),
    row.upload_duration_ms + boundedDuration(input.uploadDurationMs),
    row.upload_duration_count + (boundedDuration(input.uploadDurationMs) > 0 ? 1 : 0),
    playerId,
  );
}

/** A short error line for the host. Addresses and long tokens are removed. */
function scriptErrorText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const cleaned = value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]")
    .replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : null;
}

/** Phones that reported a script error, newest first, for room health. */
export function recentScriptErrors(sql: SqlStorage): {
  total: number;
  recent: { nickname: string; message: string; count: number }[];
} {
  const total =
    sql
      .exec<{ total: number | null }>(
        `SELECT SUM(script_errors) AS total FROM connection_summary`,
      )
      .toArray()[0]?.total ?? 0;
  const recent = sql
    .exec<{ nickname: string; message: string | null; count: number }>(
      `SELECT player.nickname AS nickname, connection_summary.last_script_error AS message,
              connection_summary.script_errors AS count
       FROM connection_summary
       JOIN player ON player.player_id = connection_summary.player_id
       WHERE connection_summary.script_errors > 0
       ORDER BY connection_summary.last_script_error_at DESC
       LIMIT 5`,
    )
    .toArray()
    .map((row) => ({
      nickname: row.nickname,
      message: row.message ?? "An error with no message.",
      count: row.count,
    }));
  return { total, recent };
}

export function clearCurrentContext(sql: SqlStorage, playerId: string): void {
  sql.exec(`UPDATE player SET device_context_id = NULL WHERE player_id = ?`, playerId);
}

export function purgeDetailedTelemetry(sql: SqlStorage, now: number): boolean {
  const room = sql
    .exec<{ created_at: string; days: number }>(
      `SELECT created_at, telemetry_retention_days AS days FROM room`,
    )
    .toArray()[0];
  if (!room || now < retentionDue(room.created_at, room.days, now)) {
    return false;
  }
  const already = sql
    .exec(`SELECT id FROM telemetry_aggregate WHERE id = 1`)
    .toArray()[0];
  if (!already) {
    const counts: Record<string, number> = {};
    let unknown = 0;
    let players = 0;
    for (const row of sql
      .exec<{ report_json: string }>(
        `SELECT report_json FROM device_context WHERE participating = 1`,
      )
      .toArray()) {
      players += 1;
      const family = readFamily(row.report_json);
      if (family === "unknown") {
        unknown += 1;
      }
      counts[family] = (counts[family] ?? 0) + 1;
    }
    sql.exec(
      `INSERT INTO telemetry_aggregate (
         id, policy_version, retention_days, computed_at, family_counts_json,
         player_count, unknown_count
       ) VALUES (1, 1, ?, ?, ?, ?, ?)`,
      room.days,
      now,
      JSON.stringify(counts),
      players,
      unknown,
    );
  }
  for (const row of sql
    .exec<{ player_id: string; rtt_samples_json: string }>(
      `SELECT player_id, rtt_samples_json FROM connection_summary`,
    )
    .toArray()) {
    const stats = sampleStats(readSamples(row.rtt_samples_json));
    sql.exec(
      `UPDATE connection_summary
       SET rtt_samples_json = '[]', rtt_median_ms = ?, rtt_upper_ms = ?
       WHERE player_id = ?`,
      stats.median,
      stats.upper,
      row.player_id,
    );
  }
  sql.exec(`DELETE FROM device_context`);
  sql.exec(`UPDATE player SET device_context_id = NULL`);
  return true;
}

export function readTelemetry(sql: SqlStorage, playerId: string) {
  const contexts = sql
    .exec<{
      context_id: string;
      participating: number;
      report_json: string;
    }>(
      `SELECT context_id, participating, report_json
       FROM device_context WHERE player_id = ? ORDER BY created_at`,
      playerId,
    )
    .toArray()
    .map((row) => ({
      contextId: row.context_id,
      participating: row.participating === 1,
      report: JSON.parse(row.report_json) as NormalisedDeviceReport,
    }));
  const connection = sql
    .exec<{
      socket_opens: number;
      reconnects: number;
      rtt_count: number;
      rtt_samples_json: string;
      rtt_median_ms: number | null;
      rtt_upper_ms: number | null;
      submission_retries: number;
      upload_attempts: number;
      upload_failures: number;
    }>(
      `SELECT socket_opens, reconnects, rtt_count, rtt_samples_json, rtt_median_ms,
              rtt_upper_ms, submission_retries, upload_attempts, upload_failures
       FROM connection_summary WHERE player_id = ?`,
      playerId,
    )
    .toArray()[0];
  const answers = [
    "choice_answer",
    "round_response",
    "text_response",
    "vote_ballot",
    "duel_answer",
    "duel_prediction",
  ].flatMap((table) =>
    sql
      .exec<{ question_id: string; device_context_id: string | null }>(
        `SELECT question_id, device_context_id FROM ${table} WHERE player_id = ?`,
        playerId,
      )
      .toArray()
      .map((row) => ({
        questionId: row.question_id,
        contextId: row.device_context_id,
      })),
  );
  const retention = sql
    .exec<{ due_at: number | null; status: string; days: number }>(
      `SELECT job.due_at, job.status, room.telemetry_retention_days AS days
       FROM room, schedule_job AS job
       WHERE job.job_id = ?`,
      telemetryRetentionJobId,
    )
    .toArray()[0];
  return {
    contexts,
    connection: connection
      ? {
          socketOpens: connection.socket_opens,
          reconnects: connection.reconnects,
          rttCount: connection.rtt_count,
          samples: readSamples(connection.rtt_samples_json),
          medianMs: connection.rtt_median_ms,
          upperMs: connection.rtt_upper_ms,
          submissionRetries: connection.submission_retries,
          uploadAttempts: connection.upload_attempts,
          uploadFailures: connection.upload_failures,
        }
      : null,
    answers,
    scores: sql
      .exec<{ question_id: string; points: number }>(
        `SELECT question_id, points FROM score_ledger WHERE player_id = ?`,
        playerId,
      )
      .toArray()
      .map((row) => ({ questionId: row.question_id, points: row.points })),
    answerCount:
      sql
        .exec<{ total: number }>(`SELECT COUNT(*) AS total FROM choice_answer`)
        .toArray()[0]?.total ?? 0,
    mediaCount:
      sql
        .exec<{ total: number }>(`SELECT COUNT(*) AS total FROM media_upload`)
        .toArray()[0]?.total ?? 0,
    scoreCount:
      sql
        .exec<{ total: number }>(`SELECT COUNT(*) AS total FROM score_ledger`)
        .toArray()[0]?.total ?? 0,
    playerCount:
      sql
        .exec<{ total: number }>(
          `SELECT COUNT(*) AS total FROM player WHERE revoked_at IS NULL`,
        )
        .toArray()[0]?.total ?? 0,
    retention: retention
      ? { dueAt: retention.due_at, status: retention.status, days: retention.days }
      : null,
    aggregate:
      sql
        .exec<{
          family_counts_json: string;
          player_count: number;
          unknown_count: number;
        }>(
          `SELECT family_counts_json, player_count, unknown_count FROM telemetry_aggregate WHERE id = 1`,
        )
        .toArray()[0] ?? null,
  };
}

function ensureConnectionRow(sql: SqlStorage, playerId: string): void {
  const row = sql
    .exec(`SELECT player_id FROM connection_summary WHERE player_id = ?`, playerId)
    .toArray()[0];
  if (row) {
    return;
  }
  sql.exec(
    `INSERT INTO connection_summary (
       player_id, socket_opens, reconnects, rtt_count, rtt_samples_json,
       rtt_median_ms, rtt_upper_ms, submission_retries, upload_attempts,
       upload_failures, upload_duration_ms, upload_duration_count
     ) VALUES (?, 0, 0, 0, '[]', NULL, NULL, 0, 0, 0, 0, 0)`,
    playerId,
  );
}

function saveRetentionJob(sql: SqlStorage, dueAt: number, now: number): void {
  const room = createSqlStore(sql).readRoom();
  const job: ScheduledJob = {
    jobId: telemetryRetentionJobId,
    jobType: "background",
    dueAt,
    remainingMs: null,
    scopeGeneration: room.scopeGeneration,
    phaseGeneration: room.phaseGeneration,
    phase: null,
    status: "pending",
    retryCount: 0,
    payload: "telemetry-retention",
    createdAt: now,
  };
  createSqlStore(sql).saveJob(job);
}

function insertContext(
  sql: SqlStorage,
  playerId: string,
  report: NormalisedDeviceReport,
  hash: string,
  phaseGeneration: number | null,
  now: number,
): string {
  const contextId = crypto.randomUUID();
  const participating = countContexts(sql, playerId) === 0 ? 1 : 0;
  sql.exec(
    `INSERT INTO device_context (
       context_id, player_id, collector_version, participating, material_hash,
       phase_generation, report_json, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    contextId,
    playerId,
    report.parserVersion,
    participating,
    hash,
    phaseGeneration,
    JSON.stringify(report),
    now,
    now,
  );
  sql.exec(
    `UPDATE player SET device_context_id = ?, device_context_version = ? WHERE player_id = ?`,
    contextId,
    report.parserVersion,
    playerId,
  );
  return contextId;
}

function latestContext(sql: SqlStorage, playerId: string) {
  return sql
    .exec<{
      context_id: string;
      material_hash: string;
      phase_generation: number | null;
      updated_at: number;
    }>(
      `SELECT context_id, material_hash, phase_generation, updated_at
       FROM device_context WHERE player_id = ?
       ORDER BY created_at DESC LIMIT 1`,
      playerId,
    )
    .toArray()[0];
}

function countContexts(sql: SqlStorage, playerId: string): number {
  return (
    sql
      .exec<{ total: number }>(
        `SELECT COUNT(*) AS total FROM device_context WHERE player_id = ?`,
        playerId,
      )
      .toArray()[0]?.total ?? 0
  );
}

function currentContextId(sql: SqlStorage, playerId: string): string | null {
  return (
    sql
      .exec<{ device_context_id: string | null }>(
        `SELECT device_context_id FROM player WHERE player_id = ?`,
        playerId,
      )
      .toArray()[0]?.device_context_id ?? null
  );
}

function readPhaseGeneration(sql: SqlStorage): number | null {
  return (
    sql
      .exec<{ phase_generation: number }>(`SELECT phase_generation FROM room`)
      .toArray()[0]?.phase_generation ?? null
  );
}

function retentionDue(createdAt: string, days: number, now: number): number {
  const created = Date.parse(createdAt);
  const span =
    (Number.isInteger(days) ? days : detailedTelemetryRetentionDays) * 86_400_000;
  const base = Number.isFinite(created) ? created : now;
  return base + span;
}

function boundedSamples(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const samples: number[] = [];
  for (const item of value) {
    if (typeof item !== "number" || !Number.isFinite(item)) {
      continue;
    }
    const rounded = Math.round(item);
    if (rounded < 0 || rounded > 60_000) {
      continue;
    }
    samples.push(rounded);
    if (samples.length === 8) {
      break;
    }
  }
  return samples;
}

function boundedDelta(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(5, Math.round(value)));
}

function boundedDuration(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(600_000, Math.round(value)));
}

function readSamples(value: string): number[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "number" && item >= 0 && item <= 60_000)
      : [];
  } catch {
    return [];
  }
}

function sampleStats(samples: number[]): {
  median: number | null;
  upper: number | null;
} {
  if (samples.length === 0) {
    return { median: null, upper: null };
  }
  const sorted = [...samples].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1
      ? (sorted[mid] ?? null)
      : Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
  const upperIndex = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.9) - 1);
  return { median, upper: sorted[Math.max(0, upperIndex)] ?? null };
}

function readFamily(reportJson: string): string {
  try {
    const parsed: unknown = JSON.parse(reportJson);
    if (!parsed || typeof parsed !== "object" || !("deviceFamily" in parsed)) {
      return "unknown";
    }
    const family = (parsed as { deviceFamily?: unknown }).deviceFamily;
    return typeof family === "string" ? family : "unknown";
  } catch {
    return "unknown";
  }
}

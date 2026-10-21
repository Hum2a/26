import { roomDiagnosticsSchema, type RoomDiagnostics } from "@26/shared";
import { questionFor } from "../questions/registry.ts";
import { recentScriptErrors } from "../device/store.ts";

export function readRoomDiagnostics(
  sql: SqlStorage,
  input: {
    alarmAt: number | null;
    connections: { guests: number; stage: number; control: number };
    delivery: RoomDiagnostics["delivery"];
    realtime?: RoomDiagnostics["realtime"];
  },
): RoomDiagnostics {
  const room = sql
    .exec<{
      game_id: string;
      phase: string;
      paused: number;
      hold: string | null;
      question_index: number;
      question_count: number;
      question_set_version: string;
      scoring_version: string;
    }>(
      `SELECT game_id, phase, paused, hold, question_index, question_count,
              question_set_version, scoring_version
       FROM room`,
    )
    .toArray()[0];
  if (!room) {
    throw new Error("This room does not exist.");
  }
  const players =
    sql
      .exec<{ total: number }>(
        `SELECT COUNT(*) AS total FROM player
         WHERE revoked_at IS NULL AND (client_class = 'guest' OR client_class IS NULL)`,
      )
      .toArray()[0]?.total ?? 0;
  const jobRows = sql
    .exec<{
      job_type: string;
      status: string;
      due_at: number | null;
      phase: string | null;
      retry_count: number;
    }>(
      `SELECT job_type, status, due_at, phase, retry_count
       FROM schedule_job
       WHERE status IN ('pending', 'failed')
       ORDER BY due_at ASC
       LIMIT 12`,
    )
    .toArray();
  const pending =
    sql
      .exec<{ total: number }>(
        `SELECT COUNT(*) AS total FROM schedule_job WHERE status = 'pending'`,
      )
      .toArray()[0]?.total ?? 0;
  const failed =
    sql
      .exec<{ total: number }>(
        `SELECT COUNT(*) AS total FROM schedule_job WHERE status = 'failed'`,
      )
      .toArray()[0]?.total ?? 0;
  const mediaCounts = {
    open: 0,
    leased: 0,
    staged: 0,
    accepted: 0,
    rejected: 0,
    expired: 0,
    cancelled: 0,
  };
  for (const row of sql
    .exec<{ status: string; total: number }>(
      `SELECT status, COUNT(*) AS total FROM media_upload GROUP BY status`,
    )
    .toArray()) {
    if (row.status in mediaCounts) {
      mediaCounts[row.status as keyof typeof mediaCounts] = row.total;
    }
  }
  const attention = sql
    .exec<{ status: string; nickname: string; failure: string | null }>(
      `SELECT media_upload.status, player.nickname, media_upload.failure
       FROM media_upload
       JOIN player ON player.player_id = media_upload.player_id
       WHERE media_upload.status IN ('rejected', 'expired', 'cancelled', 'leased')
       ORDER BY media_upload.created_at DESC
       LIMIT 12`,
    )
    .toArray()
    .map((row) => ({
      status: row.status,
      nickname: row.nickname,
      failure: redact(row.failure) ?? "Needs another look.",
    }));
  const archiveRow = sql
    .exec<{
      status: string;
      target_revision: number;
      verified_revision: number | null;
      attempts: number;
      last_error: string | null;
    }>(
      `SELECT status, target_revision, verified_revision, attempts, last_error
       FROM room_archive WHERE id = 1`,
    )
    .toArray()[0];
  const questionId =
    room.question_count > 0
      ? (questionFor({
          questionSetVersion: room.question_set_version,
          questionIndex: room.question_index,
        })?.id ?? null)
      : null;
  return roomDiagnosticsSchema.parse({
    gameId: room.game_id,
    phase: room.phase,
    paused: room.paused === 1,
    held: room.hold !== null,
    questionId,
    questionIndex: room.question_index,
    questionSetVersion: room.question_set_version,
    scoringVersion: room.scoring_version,
    players,
    connections: input.connections,
    scheduler: {
      alarmAt: input.alarmAt,
      pending,
      failed,
      jobs: jobRows.map((job) => ({
        jobType: job.job_type,
        status: job.status,
        dueAt: job.due_at,
        phase: job.phase,
        retryCount: job.retry_count,
      })),
    },
    media: { ...mediaCounts, attention },
    archive: archiveRow
      ? {
          status:
            archiveRow.status === "failed" || archiveRow.status === "completed"
              ? archiveRow.status
              : "pending",
          targetRevision: archiveRow.target_revision,
          verifiedRevision: archiveRow.verified_revision,
          attempts: archiveRow.attempts,
          lastError: redact(archiveRow.last_error),
        }
      : null,
    delivery: input.delivery,
    ...(input.realtime ? { realtime: input.realtime } : {}),
    scriptErrors: recentScriptErrors(sql),
  });
}

function redact(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const cleaned = value
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  return cleaned.length > 0 ? cleaned : null;
}

import {
  roomPhases,
  type GameStore,
  type RoomClock,
  type RoomPhase,
  type RoundResource,
  type ScheduledJob,
} from "./lifecycle.ts";

type RoomRecord = {
  phase: string;
  phase_generation: number;
  scope_generation: number;
  paused: number;
  controller_present: number;
  stage_present: number;
  hold: string | null;
  round_id: string | null;
  phases_json: string;
  durations_json: string;
  fault: string | null;
  question_index: number;
  question_count: number;
  collect_windows_json: string;
  finish_after: number;
};

type JobRecord = {
  job_id: string;
  job_type: string;
  due_at: number | null;
  remaining_ms: number | null;
  scope_generation: number;
  phase_generation: number;
  phase: string | null;
  status: string;
  retry_count: number;
  payload: string;
  created_at: number;
};

export function createSqlStore(sql: SqlStorage): GameStore {
  return {
    readRoom: () => readRoom(sql),
    writeRoom: (room) => writeRoom(sql, room, false),
    casRoom: (expected, next) => writeRoom(sql, next, true, expected),
    jobs: () => readJobs(sql),
    saveJob: (job) => saveJob(sql, job),
    resources: () => readResources(sql),
    saveResource: (resource) => saveResource(sql, resource),
    hasAnswer: (playerId, phaseGeneration) => hasAnswer(sql, playerId, phaseGeneration),
    saveAnswer: (playerId, phaseGeneration, at) => {
      sql.exec(
        `INSERT INTO fixture_answer (
           player_id, phase_generation, submitted_at, device_context_id
         ) VALUES (?, ?, ?, (SELECT device_context_id FROM player WHERE player_id = ?))`,
        playerId,
        phaseGeneration,
        at,
        playerId,
      );
    },
  };
}

export function earliestDueAt(sql: SqlStorage): number | null {
  const row = sql
    .exec<{ due: number | null }>(
      `SELECT MIN(due_at) AS due FROM schedule_job
       WHERE status = 'pending' AND due_at IS NOT NULL`,
    )
    .toArray()[0];
  return row?.due ?? null;
}

function readRoom(sql: SqlStorage): RoomClock {
  const row = sql
    .exec<RoomRecord>(
      `SELECT phase, phase_generation, scope_generation, paused, controller_present,
              stage_present, hold, round_id, phases_json, durations_json, fault,
              question_index, question_count, collect_windows_json, finish_after
       FROM room`,
    )
    .toArray()[0];
  if (!row) {
    throw new Error("This room does not exist.");
  }
  return {
    phase: phaseOf(row.phase),
    phaseGeneration: row.phase_generation,
    scopeGeneration: row.scope_generation,
    paused: row.paused === 1,
    controllerPresent: row.controller_present === 1,
    stagePresent: row.stage_present === 1,
    hold: row.hold === "controller" ? "controller" : null,
    roundId: row.round_id,
    phases: phasesOf(row.phases_json),
    durations: durationsOf(row.durations_json),
    fault: row.fault === "enter" ? "enter" : null,
    questionIndex: row.question_index,
    questionCount: row.question_count,
    collectWindows: windowsOf(row.collect_windows_json),
    finishAfterRound: row.finish_after === 1,
  };
}

function writeRoom(
  sql: SqlStorage,
  room: RoomClock,
  compare: boolean,
  expectedGeneration = room.phaseGeneration,
): boolean {
  const cursor = sql.exec(
    `UPDATE room SET
       phase = ?,
       phase_generation = ?,
       scope_generation = ?,
       paused = ?,
       controller_present = ?,
       stage_present = ?,
       hold = ?,
       round_id = ?,
       phases_json = ?,
       durations_json = ?,
       fault = ?,
       question_index = ?,
       question_count = ?,
       collect_windows_json = ?,
       finish_after = ?,
       state_version = state_version + 1
     ${compare ? "WHERE phase_generation = ?" : ""}`,
    room.phase,
    room.phaseGeneration,
    room.scopeGeneration,
    room.paused ? 1 : 0,
    room.controllerPresent ? 1 : 0,
    room.stagePresent ? 1 : 0,
    room.hold,
    room.roundId,
    JSON.stringify(room.phases),
    JSON.stringify(room.durations),
    room.fault,
    room.questionIndex,
    room.questionCount,
    JSON.stringify(room.collectWindows),
    room.finishAfterRound ? 1 : 0,
    ...(compare ? [expectedGeneration] : []),
  );
  return cursor.rowsWritten > 0;
}

function readJobs(sql: SqlStorage): ScheduledJob[] {
  return sql
    .exec<JobRecord>(
      `SELECT job_id, job_type, due_at, remaining_ms, scope_generation, phase_generation,
              phase, status, retry_count, payload, created_at
       FROM schedule_job`,
    )
    .toArray()
    .map((row) => ({
      jobId: row.job_id,
      jobType: row.job_type === "background" ? "background" : "gameplay",
      dueAt: row.due_at,
      remainingMs: row.remaining_ms,
      scopeGeneration: row.scope_generation,
      phaseGeneration: row.phase_generation,
      phase: row.phase ? phaseOf(row.phase) : null,
      status: statusOf(row.status),
      retryCount: row.retry_count,
      payload: row.payload,
      createdAt: row.created_at,
    }));
}

function saveJob(sql: SqlStorage, job: ScheduledJob): void {
  sql.exec(
    `INSERT INTO schedule_job (
       job_id, job_type, due_at, remaining_ms, scope_generation, phase_generation,
       phase, status, retry_count, payload, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (job_id) DO UPDATE SET
       job_type = excluded.job_type,
       due_at = excluded.due_at,
       remaining_ms = excluded.remaining_ms,
       scope_generation = excluded.scope_generation,
       phase_generation = excluded.phase_generation,
       phase = excluded.phase,
       status = excluded.status,
       retry_count = excluded.retry_count,
       payload = excluded.payload`,
    job.jobId,
    job.jobType,
    job.dueAt,
    job.remainingMs,
    job.scopeGeneration,
    job.phaseGeneration,
    job.phase,
    job.status,
    job.retryCount,
    job.payload,
    job.createdAt,
  );
}

function readResources(sql: SqlStorage): RoundResource[] {
  return sql
    .exec<{
      resource_id: string;
      round_id: string;
      phase_generation: number;
      released_at: number | null;
    }>(
      `SELECT resource_id, round_id, phase_generation, released_at FROM round_resource`,
    )
    .toArray()
    .map((row) => ({
      resourceId: row.resource_id,
      roundId: row.round_id,
      phaseGeneration: row.phase_generation,
      releasedAt: row.released_at,
    }));
}

function saveResource(sql: SqlStorage, resource: RoundResource): void {
  sql.exec(
    `INSERT INTO round_resource (resource_id, round_id, phase_generation, released_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (resource_id) DO UPDATE SET released_at = excluded.released_at`,
    resource.resourceId,
    resource.roundId,
    resource.phaseGeneration,
    resource.releasedAt,
  );
}

function hasAnswer(
  sql: SqlStorage,
  playerId: string,
  phaseGeneration: number,
): boolean {
  return (
    sql
      .exec(
        `SELECT player_id FROM fixture_answer WHERE player_id = ? AND phase_generation = ?`,
        playerId,
        phaseGeneration,
      )
      .toArray().length > 0
  );
}

function phaseOf(value: string): RoomPhase {
  const phase = roomPhases.find((item) => item === value);
  if (!phase) {
    throw new Error("This room is in an unknown phase.");
  }
  return phase;
}

function phasesOf(json: string): RoomPhase[] {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter((item): item is RoomPhase =>
    roomPhases.some((phase) => phase === item),
  );
}

function windowsOf(json: string): number[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is number => Number.isInteger(item) && item >= 0);
  } catch {
    return [];
  }
}

function durationsOf(json: string): Partial<Record<RoomPhase, number>> {
  const parsed: unknown = JSON.parse(json);
  if (!parsed || typeof parsed !== "object") {
    return {};
  }
  const durations: Partial<Record<RoomPhase, number>> = {};
  for (const phase of roomPhases) {
    const value = (parsed as Record<string, unknown>)[phase];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      durations[phase] = value;
    }
  }
  return durations;
}

function statusOf(value: string): ScheduledJob["status"] {
  if (
    value === "done" ||
    value === "cancelled" ||
    value === "failed" ||
    value === "pending"
  ) {
    return value;
  }
  return "failed";
}

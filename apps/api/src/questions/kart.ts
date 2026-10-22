import {
  kartInputSchema,
  kartLimitMs,
  kartTickMs,
  createKartRace,
  reduceKart,
  reduceKartTimeline,
  projectKartRace,
  kartStandings,
  type KartRace,
  type KartInput,
  type KartRaceView,
} from "@26/shared";
import {
  advance,
  type GameStore,
  type ScheduledJob,
  type RoomClock,
} from "../room/lifecycle.ts";
import { readRoundState, writeRoundState } from "./round-state.ts";
import type { KartQuestion } from "./definition.ts";
import { publicQuestionCore } from "./project.ts";
import { createSqlStore } from "../room/sql-store.ts";
import { questionFor } from "./registry.ts";

const key = "kart-race";
export const readKart = (sql: SqlStorage, id: string) =>
  readRoundState<KartRace>(sql, id, key);
const write = (sql: SqlStorage, id: string, race: KartRace) =>
  writeRoundState(sql, id, key, race);

export function changeKartCourse(sql: SqlStorage, enabled: boolean, now: number) {
  if (typeof enabled !== "boolean" || !Number.isSafeInteger(now) || now < 0)
    throw new Error("Choose a valid course setting.");
  const store = createSqlStore(sql);
  const room = store.readRoom();
  const q = questionFor(room);
  if (q?.kind !== "kart" || !["intro", "collect"].includes(room.phase))
    throw new Error("Course controls need an open kart round.");
  const race = catchUp(sql, store, q, now);
  if (!race || race.ended || race.courseEnabled === undefined)
    throw new Error("This race does not support course features.");
  race.courseEnabled = enabled;
  race.courseHistory = [
    ...(race.courseHistory ?? []),
    { atMs: Math.floor(now), enabled },
  ].slice(-20);
  if (!enabled)
    for (const driver of race.drivers)
      if (driver.physics) {
        // Turning off a course lands every kart and removes its outstanding course effects.
        driver.physics = {
          ...driver.physics,
          height: 0,
          verticalSpeed: 0,
          boostMs: 0,
          boostLevel: 0,
          featureCooldowns: {},
        };
        driver.boostMs = 0;
      }
  write(sql, q.id, race);
}

export function enterKart(
  sql: SqlStorage,
  store: GameStore,
  q: KartQuestion,
  now: number,
): void {
  const room = store.readRoom();
  if (room.phase === "intro" && !readKart(sql, q.id)) {
    const players = sql
      .exec<{ player_id: string; nickname: string; points: number }>(
        `SELECT player_id, nickname,
        COALESCE((SELECT SUM(points) FROM score_ledger WHERE player_id = player.player_id), 0) +
        COALESCE((SELECT SUM(points) FROM score_adjustment WHERE player_id = player.player_id), 0) AS points
        FROM player WHERE revoked_at IS NULL ORDER BY rowid`,
      )
      .toArray();
    const gameId = sql
      .exec<{ game_id: string }>("SELECT game_id FROM room")
      .toArray()[0]!.game_id;
    const raceId = `${gameId}:${q.id}:${room.phaseGeneration}`;
    write(
      sql,
      q.id,
      createKartRace(
        raceId,
        players.map((p) => ({ playerId: p.player_id, name: p.nickname, points: p.points })),
        { seedGrid: true },
      ),
    );
    writeRoundState(sql, q.id, "kart-session", {
      raceId,
      players: players.map((p) => p.player_id),
    });
  }
  if (room.phase === "collect") scheduleTick(store, now, 0);
}

type CollectDue = { due_at: number | null; remaining_ms: number | null } | undefined;

function collectDue(sql: SqlStorage, store: GameStore): CollectDue {
  const room = store.readRoom();
  return sql
    .exec<{ due_at: number | null; remaining_ms: number | null }>(
      "SELECT due_at, remaining_ms FROM schedule_job WHERE payload = 'collect' AND status = 'pending' AND phase_generation = ? AND scope_generation = ? LIMIT 1",
      room.phaseGeneration,
      room.scopeGeneration,
    )
    .toArray()[0];
}

function elapsedAt(job: CollectDue, paused: boolean, now: number): number {
  const remaining = paused
    ? job?.remaining_ms
    : job?.due_at == null
      ? undefined
      : job.due_at - now;
  return remaining == null
    ? 0
    : Math.floor(Math.max(0, Math.min(kartLimitMs, kartLimitMs - remaining)));
}

function elapsed(sql: SqlStorage, store: GameStore, now: number): number {
  return elapsedAt(collectDue(sql, store), store.readRoom().paused, now);
}

function catchUp(
  sql: SqlStorage,
  store: GameStore,
  q: KartQuestion,
  now: number,
): KartRace | undefined {
  const race = readKart(sql, q.id);
  if (!race) return undefined;
  const target = elapsed(sql, store, now);
  const events = sql
    .exec<{ payload: string }>(
      "SELECT payload FROM round_state WHERE question_id = ? AND state_key LIKE 'kart-input:%'",
      q.id,
    )
    .toArray()
    .flatMap((row) => (JSON.parse(row.payload) as InputQueue).pending)
    .filter((e) => e.elapsed <= target)
    .sort((a, b) => a.elapsed - b.elapsed || a.input.sequence - b.input.sequence);
  const next = reduceKartTimeline(race, events, target);
  write(sql, q.id, next);
  return next;
}

type InputQueue = {
  at: number;
  lastSequence: number;
  pending: { playerId: string; elapsed: number; input: KartInput }[];
};

export function acceptKartInput(
  sql: SqlStorage,
  store: GameStore,
  playerId: string,
  raw: unknown,
  q: KartQuestion,
  now: number,
): boolean {
  return acceptKartInputs(sql, store, [{ playerId, raw, at: now }], q)[0] === true;
}

export type KartArrival = { playerId: string; raw: unknown; at: number };

/** Transient, unacknowledged controls: one driver cannot evict another's inputs. */
export class KartInputBuffer {
  private drivers = new Map<string, KartArrival[]>();

  push(playerId: string, raw: unknown, at: number): void {
    const parsed = kartInputSchema.safeParse(raw);
    if (!parsed.success || !Number.isFinite(at)) return;
    const queue = this.drivers.get(playerId) ?? [];
    const previous = queue.at(-1);
    if (previous) {
      const input = previous.raw as KartInput;
      if (
        parsed.data.raceId !== input.raceId ||
        parsed.data.sequence <= input.sequence ||
        at - previous.at < 80
      )
        return;
    }
    if (!this.drivers.has(playerId) && this.drivers.size >= 80) return;
    this.drivers.set(
      playerId,
      [...queue, { playerId, raw: parsed.data, at }].slice(-4),
    );
  }

  drain(): KartArrival[] {
    const arrivals = [...this.drivers.values()].flat();
    this.drivers.clear();
    return arrivals;
  }
  discard(playerId: string): void {
    this.drivers.delete(playerId);
  }
}

export function useKartItem(
  sql: SqlStorage,
  store: GameStore,
  q: KartQuestion,
  playerId: string,
  raceId: string,
  now: number,
): { ok: true } | { ok: false; message: string } {
  const room = store.readRoom(),
    saved = readKart(sql, q.id);
  if (
    room.phase !== "collect" ||
    room.paused ||
    room.hold ||
    !saved ||
    saved.raceId !== raceId ||
    saved.ended ||
    !saved.drivers.some((d) => d.playerId === playerId && d.status === "RACING") ||
    !sql
      .exec("SELECT 1 FROM player WHERE player_id = ? AND revoked_at IS NULL", playerId)
      .toArray().length
  )
    return {
      ok: false,
      message: "Items are available only to a racing phone in the current race.",
    };
  const race = catchUp(sql, store, q, now)!;
  const next = reduceKart(race, { type: "use-power", playerId });
  if (next === race) return { ok: false, message: "Drive through an item box first." };
  write(sql, q.id, next);
  sql.exec("UPDATE room SET state_version = state_version + 1");
  return { ok: true };
}

export function recoverKart(
  sql: SqlStorage,
  store: GameStore,
  q: KartQuestion,
  playerId: string,
  raceId: string,
  now: number,
): { ok: true } | { ok: false; message: string } {
  const room = store.readRoom();
  if (room.phase !== "collect" || room.paused || room.hold)
    return {
      ok: false,
      message: "Recovery is available only while the race is running.",
    };
  const saved = readKart(sql, q.id);
  if (
    !saved ||
    saved.raceId !== raceId ||
    saved.ended ||
    !saved.drivers.some((d) => d.playerId === playerId && d.status === "RACING") ||
    !sql
      .exec("SELECT 1 FROM player WHERE player_id = ? AND revoked_at IS NULL", playerId)
      .toArray().length
  )
    return { ok: false, message: "This phone cannot recover in that race." };
  const race = catchUp(sql, store, q, now)!;
  const next = reduceKart(race, { type: "recover", playerId });
  if (next === race)
    return {
      ok: false,
      message:
        "Wait two race seconds before recovering again, or watch the stage if you have finished.",
    };
  const queue = readRoundState<InputQueue>(sql, q.id, `kart-input:${playerId}`);
  if (queue)
    writeRoundState(sql, q.id, `kart-input:${playerId}`, {
      ...queue,
      at: now,
      pending: [],
    });
  write(sql, q.id, next);
  sql.exec("UPDATE room SET state_version = state_version + 1");
  return { ok: true };
}

/** Freeze at the pause boundary and prevent old throttle/drift resuming later. */
export function releaseKartInputs(
  sql: SqlStorage,
  store: GameStore,
  q: KartQuestion,
  now: number,
): void {
  const room = store.readRoom();
  if (room.phase !== "collect" || room.paused || room.hold) return;
  const race = catchUp(sql, store, q, now);
  if (!race) return;
  write(sql, q.id, reduceKart(race, { type: "release" }));
  for (const row of sql
    .exec<{ state_key: string; payload: string }>(
      "SELECT state_key, payload FROM round_state WHERE question_id = ? AND state_key LIKE 'kart-input:%'",
      q.id,
    )
    .toArray()) {
    const queue = JSON.parse(row.payload) as InputQueue;
    writeRoundState(sql, q.id, row.state_key, { ...queue, pending: [] });
  }
}

/**
 * Validates and stores controls in arrival order, each stamped with its own
 * arrival time. The room calls this once per tick for everything that arrived
 * since the last tick, so queues are durable before the tick reads them.
 * Room, session and player reads happen once per batch, not once per control.
 */
export function acceptKartInputs(
  sql: SqlStorage,
  store: GameStore,
  arrivals: readonly KartArrival[],
  q: KartQuestion,
): boolean[] {
  const room = store.readRoom();
  if (arrivals.length === 0) return [];
  if (room.phase !== "collect" || room.paused || room.hold)
    return arrivals.map(() => false);
  const session = readRoundState<{ raceId: string; players: string[] }>(
    sql,
    q.id,
    "kart-session",
  );
  if (!session) return arrivals.map(() => false);
  const active = new Set(
    sql
      .exec<{ player_id: string }>(
        "SELECT player_id FROM player WHERE revoked_at IS NULL",
      )
      .toArray()
      .map((row) => row.player_id),
  );
  const drivers = new Set(session.players);
  const due = collectDue(sql, store);
  const queues = new Map<string, InputQueue | undefined>();
  const changed = new Set<string>();
  const results = arrivals.map(({ playerId, raw, at: now }) => {
    const parsed = kartInputSchema.safeParse(raw);
    if (
      !parsed.success ||
      session.raceId !== parsed.data.raceId ||
      !drivers.has(playerId) ||
      !active.has(playerId)
    )
      return false;
    const stateKey = `kart-input:${playerId}`;
    if (!queues.has(playerId))
      queues.set(playerId, readRoundState<InputQueue>(sql, q.id, stateKey));
    const previous = queues.get(playerId);
    if (
      previous &&
      (now - previous.at < 80 || parsed.data.sequence <= previous.lastSequence)
    )
      return false;
    const at = elapsedAt(due, room.paused, now);
    if (at >= kartLimitMs) return false;
    queues.set(playerId, {
      at: now,
      lastSequence: parsed.data.sequence,
      pending: [
        ...(previous?.pending ?? []),
        { playerId, elapsed: at, input: parsed.data },
      ].slice(-4),
    });
    changed.add(playerId);
    return true;
  });
  for (const playerId of changed)
    writeRoundState(sql, q.id, `kart-input:${playerId}`, queues.get(playerId));
  return results;
}

function scheduleTick(store: GameStore, now: number, step: number): void {
  const room = store.readRoom();
  if (room.phase !== "collect" || room.paused || room.hold) return;
  store.saveJob({
    jobId: `kart:${room.scopeGeneration}:${room.phaseGeneration}:${step}`,
    jobType: "gameplay",
    dueAt: now + kartTickMs,
    remainingMs: null,
    scopeGeneration: room.scopeGeneration,
    phaseGeneration: room.phaseGeneration,
    phase: "collect",
    status: "pending",
    retryCount: 0,
    payload: "kart-tick",
    createdAt: now,
  });
}

export function tickKart(
  sql: SqlStorage,
  store: GameStore,
  q: KartQuestion,
  job: ScheduledJob,
  now: number,
): void {
  // A finished tick has no further use. Keeping 225 rows a race would make every
  // later alarm read them all.
  sql.exec(
    "DELETE FROM schedule_job WHERE job_id = ? AND payload = 'kart-tick'",
    job.jobId,
  );
  const room = store.readRoom();
  if (
    room.phase !== "collect" ||
    room.paused ||
    room.hold ||
    job.phaseGeneration !== room.phaseGeneration ||
    job.scopeGeneration !== room.scopeGeneration
  )
    return;
  const next = catchUp(sql, store, q, now);
  if (!next) return;
  sql.exec("UPDATE room SET state_version = state_version + 1");
  if (next.ended) advance(store, now);
  else scheduleTick(store, now, Number(job.jobId.split(":").at(-1)) + 1);
}

export function kartScores(
  sql: SqlStorage,
  store: GameStore,
  q: KartQuestion,
  now: number,
): void {
  const race = readKart(sql, q.id);
  if (!race) return;
  const deadline = store
    .jobs()
    .filter((j) => j.payload === "collect" && j.status === "pending")
    .sort((a, b) => b.phaseGeneration - a.phaseGeneration)[0]?.dueAt;
  const collectRoom = {
    ...store.readRoom(),
    phase: "collect" as const,
    phaseGeneration: store.readRoom().phaseGeneration - 1,
  };
  const caught =
    deadline == null
      ? race
      : (catchUp(sql, { ...store, readRoom: () => collectRoom }, q, now) ?? race);
  const final = reduceKart(caught, { type: "end" });
  write(sql, q.id, final);
  for (const row of kartStandings(final, q.points)) {
    sql.exec(
      "INSERT OR IGNORE INTO score_ledger (question_id, player_id, points, detail, created_at) SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM player WHERE player_id = ? AND revoked_at IS NULL)",
      q.id,
      row.playerId,
      row.points,
      row.finished ? `kart:finished:${row.timeMs}` : "kart:dnf",
      now,
      row.playerId,
    );
  }
}

export function projectKart(
  sql: SqlStorage,
  q: KartQuestion,
  room: RoomClock,
  selfPlayerId: string | undefined,
) {
  const race = readKart(sql, q.id);
  const scored = ["reveal", "scores", "final", "podium"].includes(room.phase);
  const queue = selfPlayerId
    ? readRoundState<InputQueue>(sql, q.id, `kart-input:${selfPlayerId}`)
    : undefined;
  const fullRace = race ? projectKartRace(race, null, q.points) : undefined;
  const publicRace =
    fullRace && selfPlayerId
      ? phoneRaceView(race!, fullRace, selfPlayerId, queue?.lastSequence)
      : fullRace;
  const selfPoints =
    scored && selfPlayerId
      ? (sql
          .exec<{ points: number }>(
            "SELECT points FROM score_ledger WHERE question_id = ? AND player_id = ?",
            q.id,
            selfPlayerId,
          )
          .toArray()[0]?.points ?? 0)
      : null;
  return {
    question: {
      ...publicQuestionCore(q, room.questionIndex + 1, room.questionCount),
      kind: "kart" as const,
      trackId: q.trackId,
      timeLimitMs: q.timeLimitMs,
    },
    ...(publicRace ? { kart: publicRace } : {}),
    submissionCount: race?.drivers.filter((d) => d.status !== "RACING").length ?? 0,
    selfAnswer: null,
    selfBallot: null,
    ballot: null,
    duel: null,
    reveal: null,
    selfAward: selfPoints,
    selfStanding: null,
    standings: null,
    liveSample: null,
    attributions: null,
  };
}

/** A phone sees its own kart and the top eight plus its own place. */
function phoneRaceView(
  race: KartRace,
  full: KartRaceView,
  selfPlayerId: string,
  lastSequence: number | undefined,
): KartRaceView {
  return {
    ...full,
    selfPlayerId,
    ...(full.powers
      ? {
          powers: {
            ...full.powers,
            selfItem:
              race.drivers.find((d) => d.playerId === selfPlayerId)?.power?.item ??
              null,
            boxes: full.powers.boxes.map((b) => ({
              ...b,
              available:
                (race.drivers.find((d) => d.playerId === selfPlayerId)?.power
                  ?.cooldowns[b.id] ?? 0) <= race.elapsedMs,
            })),
            effects: full.powers.effects.filter((e) => e.playerId === selfPlayerId),
          },
        }
      : {}),
    inputCursor:
      lastSequence ??
      Math.max(0, race.drivers.find((d) => d.playerId === selfPlayerId)?.sequence ?? 0),
    participants: full.participants.filter((d) => d.playerId === selfPlayerId),
    leaderboard: full.leaderboard.filter(
      (d, i) => i < 8 || d.playerId === selfPlayerId,
    ),
  };
}

/**
 * One race projection per tick for every screen. The room sends these frames
 * instead of a full snapshot when a tick changes nothing but the race.
 */
export function kartFrames(sql: SqlStorage, q: KartQuestion) {
  const race = readKart(sql, q.id);
  if (!race) return undefined;
  const full = projectKartRace(race, null, q.points);
  const cursors = new Map<string, number>();
  for (const row of sql
    .exec<{ state_key: string; payload: string }>(
      "SELECT state_key, payload FROM round_state WHERE question_id = ? AND state_key LIKE 'kart-input:%'",
      q.id,
    )
    .toArray()) {
    cursors.set(
      row.state_key.slice("kart-input:".length),
      (JSON.parse(row.payload) as InputQueue).lastSequence,
    );
  }
  return {
    full,
    submissionCount: race.drivers.filter((d) => d.status !== "RACING").length,
    forPhone: (playerId: string) =>
      phoneRaceView(race, full, playerId, cursors.get(playerId)),
  };
}

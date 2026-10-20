import {
  kartInputSchema,
  kartLimitMs,
  kartTickMs,
  createKartRace,
  reduceKart,
  projectKartRace,
  kartStandings,
  type KartRace,
  type KartInput,
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

const key = "kart-race";
export const readKart = (sql: SqlStorage, id: string) =>
  readRoundState<KartRace>(sql, id, key);
const write = (sql: SqlStorage, id: string, race: KartRace) =>
  writeRoundState(sql, id, key, race);

export function enterKart(
  sql: SqlStorage,
  store: GameStore,
  q: KartQuestion,
  now: number,
): void {
  const room = store.readRoom();
  if (room.phase === "intro" && !readKart(sql, q.id)) {
    const players = sql
      .exec<{ player_id: string; nickname: string }>(
        "SELECT player_id, nickname FROM player WHERE revoked_at IS NULL ORDER BY rowid",
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
        players.map((p) => ({ playerId: p.player_id, name: p.nickname })),
      ),
    );
    writeRoundState(sql, q.id, "kart-session", {
      raceId,
      players: players.map((p) => p.player_id),
    });
  }
  if (room.phase === "collect") scheduleTick(store, now, 0);
}

function elapsed(sql: SqlStorage, store: GameStore, now: number): number {
  const room = store.readRoom();
  const job = sql
    .exec<{ due_at: number | null; remaining_ms: number | null }>(
      "SELECT due_at, remaining_ms FROM schedule_job WHERE payload = 'collect' AND status = 'pending' AND phase_generation = ? AND scope_generation = ? LIMIT 1",
      room.phaseGeneration,
      room.scopeGeneration,
    )
    .toArray()[0];
  const remaining = room.paused
    ? job?.remaining_ms
    : job?.due_at == null
      ? undefined
      : job.due_at - now;
  return remaining == null
    ? 0
    : Math.floor(Math.max(0, Math.min(kartLimitMs, kartLimitMs - remaining)));
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
  let next = race;
  const events = sql
    .exec<{ payload: string }>(
      "SELECT payload FROM round_state WHERE question_id = ? AND state_key LIKE 'kart-input:%'",
      q.id,
    )
    .toArray()
    .flatMap((row) => (JSON.parse(row.payload) as InputQueue).pending)
    .filter((e) => e.elapsed <= target)
    .sort((a, b) => a.elapsed - b.elapsed || a.input.sequence - b.input.sequence);
  for (const event of events) {
    const driver = next.drivers.find((d) => d.playerId === event.playerId);
    if (!driver || event.input.sequence <= driver.sequence) continue;
    next = reduceKart(next, { type: "tick", elapsedMs: event.elapsed });
    next = reduceKart(next, {
      type: "input",
      playerId: event.playerId,
      value: event.input,
    });
  }
  next = reduceKart(next, { type: "tick", elapsedMs: target });
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
  const parsed = kartInputSchema.safeParse(raw),
    room = store.readRoom();
  if (!parsed.success || room.phase !== "collect" || room.paused || room.hold)
    return false;
  const session = readRoundState<{ raceId: string; players: string[] }>(
    sql,
    q.id,
    "kart-session",
  );
  if (
    !session ||
    session.raceId !== parsed.data.raceId ||
    !session.players.includes(playerId)
  )
    return false;
  const player = sql
    .exec<{ revoked_at: string | null }>(
      "SELECT revoked_at FROM player WHERE player_id = ?",
      playerId,
    )
    .toArray()[0];
  if (!player || player.revoked_at !== null) return false;
  const stateKey = `kart-input:${playerId}`;
  const previous = readRoundState<InputQueue>(sql, q.id, stateKey);
  if (
    previous &&
    (now - previous.at < 80 || parsed.data.sequence <= previous.lastSequence)
  )
    return false;
  const at = elapsed(sql, store, now);
  if (at >= kartLimitMs) return false;
  const pending = [
    ...(previous?.pending ?? []),
    { playerId, elapsed: at, input: parsed.data },
  ].slice(-4);
  writeRoundState(sql, q.id, stateKey, {
    at: now,
    lastSequence: parsed.data.sequence,
    pending,
  } satisfies InputQueue);
  return true;
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
  const publicRace = race
    ? projectKartRace(race, selfPlayerId ?? null, q.points)
    : undefined;
  if (publicRace && selfPlayerId) {
    publicRace.participants = publicRace.participants.filter(
      (d) => d.playerId === selfPlayerId,
    );
    publicRace.leaderboard = publicRace.leaderboard.filter(
      (d, i) => i < 8 || d.playerId === selfPlayerId,
    );
    if (queue) publicRace.inputCursor = queue.lastSequence;
  }
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

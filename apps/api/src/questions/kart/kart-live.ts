import type { KartInput, KartRace } from "@26/shared";

/**
 * Live kart races stay in the Durable Object's memory. SQLite holds a
 * checkpoint, not every pose or control. Before this, each 100 ms tick rewrote
 * the race row and one input row per driver: about 150,000 rows for a
 * three-minute race with 80 phones.
 *
 * SQLite remains the source of truth after a restart or a rolled-back
 * transaction. Each cached race remembers the payload it was loaded from or
 * last saved as. A later read that sees a different stored row reloads.
 * Unacknowledged controls never go to SQLite; each tick folds them into the
 * race, which is checkpointed.
 */

/** At most this many 100 ms ticks stay unsaved: two seconds of racing. */
export const kartCheckpointWrites = 20;

/** Controls waiting for the next race tick. Kart inputs are never acknowledged. */
export type InputQueue = {
  at: number;
  lastSequence: number;
  pending: { playerId: string; elapsed: number; input: KartInput }[];
};

type LiveRace = {
  race: KartRace;
  /** The payload SQLite currently holds for this race. */
  saved: string;
  /** Revisions made since `saved`. */
  deferred: number;
  /** `race` as JSON, computed once per revision for readers that need a copy. */
  json?: string;
};

type LiveRoom = {
  races: Map<string, LiveRace>;
  queues: Map<string, { raceId: string; drivers: Map<string, InputQueue> }>;
};

// One entry per room object. A restarted object has a new storage handle, so
// it starts empty and reloads from the last checkpoint.
const rooms = new WeakMap<SqlStorage, LiveRoom>();

function roomFor(sql: SqlStorage): LiveRoom {
  let room = rooms.get(sql);
  if (!room) {
    room = { races: new Map(), queues: new Map() };
    rooms.set(sql, room);
  }
  return room;
}

function storedPayload(sql: SqlStorage, questionId: string): string | undefined {
  return sql
    .exec<{ payload: string }>(
      "SELECT payload FROM round_state WHERE question_id = ? AND state_key = 'kart-race'",
      questionId,
    )
    .toArray()[0]?.payload;
}

function persist(sql: SqlStorage, questionId: string, payload: string): void {
  sql.exec(
    "INSERT INTO round_state (question_id, state_key, payload) VALUES (?, 'kart-race', ?) ON CONFLICT(question_id, state_key) DO UPDATE SET payload = excluded.payload",
    questionId,
    payload,
  );
}

/**
 * The live race object. Callers on the tick path read it without copying and
 * must not change it unless they save the result with `saveLiveKart`.
 */
export function liveKart(sql: SqlStorage, questionId: string): KartRace | undefined {
  const room = roomFor(sql);
  const payload = storedPayload(sql, questionId);
  if (payload === undefined) {
    room.races.delete(questionId);
    room.queues.delete(questionId);
    return undefined;
  }
  const cached = room.races.get(questionId);
  if (cached && cached.saved === payload) return cached.race;
  const race = JSON.parse(payload) as KartRace;
  const running = !race.ended;
  if (running) {
    // Restored from a checkpoint: unsaved ticks may already have sent phones
    // revisions up to `kartCheckpointWrites - 1` above it. Skip past them so a
    // phone never ignores the restored race as stale, and save the next write.
    race.checkpointRevision = (race.checkpointRevision ?? 0) + kartCheckpointWrites;
  }
  room.races.set(questionId, {
    race,
    saved: payload,
    deferred: running ? kartCheckpointWrites : 0,
  });
  return race;
}

/** A private copy, with the same shape the stored JSON had. */
export function copyLiveKart(
  sql: SqlStorage,
  questionId: string,
): KartRace | undefined {
  const race = liveKart(sql, questionId);
  if (!race) return undefined;
  const entry = roomFor(sql).races.get(questionId)!;
  entry.json ??= entry.deferred === 0 ? entry.saved : JSON.stringify(race);
  return JSON.parse(entry.json) as KartRace;
}

/**
 * Records the next race revision. `durable` saves it now, inside the caller's
 * transaction. Otherwise it is saved when `kartCheckpointWrites` revisions are
 * pending, or by the next `checkpointLiveKarts`.
 */
export function saveLiveKart(
  sql: SqlStorage,
  questionId: string,
  race: KartRace,
  durable: boolean,
): void {
  race.checkpointRevision = (race.checkpointRevision ?? 0) + 1;
  const room = roomFor(sql);
  const cached = room.races.get(questionId);
  if (durable || !cached || cached.deferred + 1 >= kartCheckpointWrites) {
    const payload = JSON.stringify(race);
    persist(sql, questionId, payload);
    room.races.set(questionId, { race, saved: payload, deferred: 0, json: payload });
    return;
  }
  room.races.set(questionId, {
    race,
    saved: cached.saved,
    deferred: cached.deferred + 1,
  });
}

/**
 * Saves every race with unsaved ticks. Runs before host commands and when
 * phones connect or leave, so a restart after any of those recovers that point.
 * A race whose stored row changed underneath (a rollback or a reset) is dropped
 * from memory instead of overwriting the row.
 */
export function checkpointLiveKarts(sql: SqlStorage): number {
  const room = rooms.get(sql);
  if (!room) return 0;
  let saved = 0;
  for (const [questionId, entry] of room.races) {
    if (entry.deferred === 0) continue;
    if (storedPayload(sql, questionId) !== entry.saved) {
      room.races.delete(questionId);
      continue;
    }
    const payload = JSON.stringify(entry.race);
    persist(sql, questionId, payload);
    room.races.set(questionId, {
      ...entry,
      saved: payload,
      deferred: 0,
      json: payload,
    });
    saved += 1;
  }
  return saved;
}

/**
 * Forgets race revisions that were never saved, so the next read reloads the
 * last committed checkpoint. Called when a room transaction fails: a later
 * checkpoint must not persist state from work that rolled back.
 */
export function discardUnsavedKarts(sql: SqlStorage): void {
  const room = rooms.get(sql);
  if (!room) return;
  for (const [questionId, entry] of room.races)
    if (entry.deferred > 0) room.races.delete(questionId);
}

/** This race's control queues. A new race id starts empty ones. */
export function kartQueues(
  sql: SqlStorage,
  questionId: string,
  raceId: string,
): Map<string, InputQueue> {
  const room = roomFor(sql);
  const current = room.queues.get(questionId);
  if (current?.raceId === raceId) return current.drivers;
  const drivers = new Map<string, InputQueue>();
  room.queues.set(questionId, { raceId, drivers });
  return drivers;
}

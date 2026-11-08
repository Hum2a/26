import {
  kartCpuCountSchema,
  kartLapsSchema,
  kartLobbySchema,
  kartRaceSchema,
  kartTrackCatalogue,
  contentVersionSchema,
  type KartTrackId,
} from "@26/shared";
import { freezeBirthdayOrder } from "../questions/birthday-order.ts";
import { readRoundState, writeRoundState } from "../questions/round-state.ts";
import { createSqlStore } from "./sql-store.ts";

/** A room-owned copy only. Released question files and underway races never change. */
export function chooseKartLobbyTrack(
  sql: SqlStorage,
  value: unknown,
  now: number,
  lapsValue: unknown = 1,
  cpuValue: unknown = 0,
) {
  const trackId = kartRaceSchema.shape.trackId.parse(value);
  const laps = kartLapsSchema.parse(lapsValue);
  const cpu = kartCpuCountSchema.parse(cpuValue);
  const lobby = readKartLobby(sql),
    room = createSqlStore(sql).readRoom();
  const script = room.questionScript;
  if (
    !lobby ||
    room.phase !== "lobby" ||
    !script ||
    script.version !== room.questionSetVersion ||
    script.questions.length !== 1 ||
    script.questions[0]?.kind !== "kart"
  )
    throw new Error("Choose the course in a fresh kart-only lobby before starting.");
  if (!Number.isSafeInteger(now) || now < 0)
    throw new Error("Invalid course selection time.");
  const track = kartTrackCatalogue.tracks.find((track) => track.id === trackId)!;
  const sourceVersion = lobby.sourceVersion ?? script.version;
  const sourceHash = sourceVersion.match(/([a-f0-9]{20})$/)?.[1];
  if (!sourceHash) throw new Error("This room has no supported frozen course source.");
  const codes: Record<KartTrackId, string> = {
    "mario-circuit-v1": "m1",
    "party-ring-v1": "r1",
    "26-park-v1": "p1",
  };
  const version = contentVersionSchema.parse(
    `kart-course-${sourceHash}-${codes[trackId]}${laps > 1 ? `l${laps}` : ""}${cpu ? `c${cpu}` : ""}`,
  );
  // More laps get a proportionally longer window, so slower guests still finish.
  const windowMs = track.raceLimitMs * laps;
  const lapWords = ["One lap", "Two laps", "Three laps"][laps - 1]!;
  const base: Record<string, unknown> = { ...script.questions[0] };
  delete base.laps;
  delete base.cpuRacers;
  const question = {
    ...(base as (typeof script.questions)[0]),
    trackId,
    collectMs: windowMs,
    timeLimitMs: windowMs,
    ...(laps > 1 ? { laps } : {}),
    ...(cpu ? { cpuRacers: cpu } : {}),
    // One-lap wording is unchanged from before laps existed.
    prompt:
      laps === 1
        ? `One lap. ${track.raceLimitMs / 1000} seconds. Race on ${track.name}.`
        : `${lapWords}. ${raceWindowWords(windowMs)}. Race on ${track.name}.`,
    notes:
      laps === 1
        ? `Room course: ${track.name}. The server owns driving, checkpoints, lap times and the ${track.raceLimitMs / 1000}-second cutoff. The starting grid and existing finisher-only points remain unchanged.`
        : `Room course: ${track.name}, ${lapWords.toLowerCase()}. The server owns driving, checkpoints, lap times and the ${windowMs / 1000}-second cutoff. The finish time is the whole race. The starting grid and existing finisher-only points remain unchanged.`,
  };
  writeRoundState(sql, "__pack", "birthday-script", {
    ...script,
    version,
    questions: [question],
  });
  sql.exec("UPDATE room SET question_set_version = ?", version);
  writeRoundState(
    sql,
    "__room",
    "kart-lobby",
    kartLobbySchema.parse({
      ...lobby,
      sourceVersion,
      trackId,
      laps: laps > 1 ? laps : undefined,
      cpu: cpu || undefined,
      history: [
        ...(lobby.history ?? []),
        {
          atMs: now,
          trackId,
          ...(laps > 1 ? { laps } : {}),
          ...(cpu ? { cpu } : {}),
          source: "host",
        },
      ].slice(-20),
    }),
  );
}

/** "45 seconds", "3 minutes", "9 minutes". */
export function raceWindowWords(ms: number) {
  return ms < 120_000 ? `${ms / 1000} seconds` : `${Math.round(ms / 60_000)} minutes`;
}

/** Freeze just the existing race; never edit the saved birthday order. */
export async function freezeKartLobby() {
  const script = await freezeBirthdayOrder({
    revision: 0,
    ids: ["kart-sprint"],
    updatedAt: null,
    history: [],
  });
  return { ...script, version: `kart-${script.version}` };
}

export function readKartLobby(sql: SqlStorage) {
  const stored = readRoundState<unknown>(sql, "__room", "kart-lobby");
  return stored === undefined ? undefined : kartLobbySchema.parse(stored);
}

export function assertKartLobbyAction(sql: SqlStorage, action: string) {
  if (
    readKartLobby(sql) &&
    [
      "start-demo",
      "start-birthday",
      "start-kart-rehearsal",
      "start-fixture",
      "developer-configure",
    ].includes(action)
  )
    throw new Error("This is a kart-only lobby. Use Start kart race.");
}

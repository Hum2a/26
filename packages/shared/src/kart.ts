import { z } from "zod";

export const kartTrackId = "party-ring-v1" as const;
export const kartLimitMs = 45_000;
export const kartTickMs = 200;
export const kartNeutral = { steer: 0, gas: false, brake: false, drift: false };
export const kartControlsSchema = z
  .object({
    steer: z.number().finite().min(-1).max(1),
    gas: z.boolean(),
    brake: z.boolean(),
    drift: z.boolean(),
  })
  .strict();
export type KartControls = z.infer<typeof kartControlsSchema>;
export const kartInputSchema = kartControlsSchema
  .extend({
    raceId: z.string().min(1).max(120),
    sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();
export type KartInput = z.infer<typeof kartInputSchema>;
export const kartDriverSchema = z
  .object({
    playerId: z.string(),
    name: z.string().min(1).max(24),
    number: z.number().int().positive(),
    x: z.number().finite(),
    z: z.number().finite(),
    heading: z.number().finite(),
    speed: z.number().finite(),
    progress: z.number().min(0).max(1),
    checkpoint: z.number().int().min(0).max(8),
    status: z.enum(["RACING", "FINISHED", "DNF"]),
    lapTimeMs: z.number().int().nonnegative().nullable(),
  })
  .strict();
export type KartDriver = z.infer<typeof kartDriverSchema>;
export const kartRaceSchema = z
  .object({
    raceId: z.string(),
    trackId: z.literal(kartTrackId),
    timeLimitMs: z.literal(kartLimitMs),
    elapsedMs: z.number().int().min(0).max(kartLimitMs),
    ended: z.boolean(),
    selfPlayerId: z.string().nullable(),
    inputCursor: z.number().int().nonnegative().nullable(),
    participants: z.array(kartDriverSchema).max(80),
    leaderboard: z
      .array(
        z
          .object({
            playerId: z.string(),
            name: z.string(),
            timeMs: z.number().int().nullable(),
            finished: z.boolean(),
            place: z.number().int().positive(),
            points: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .max(80),
  })
  .strict();
export type KartRaceView = z.infer<typeof kartRaceSchema>;
export type KartCompletion = {
  playerId: string;
  lapTimeMs: number | null;
  status: "FINISHED" | "DNF";
};

type Driver = KartDriver & {
  sequence: number;
  input: KartControls;
  inputUntil: number;
  turn: number;
  angle: number;
  distance: number;
  driftMs: number;
  boostMs: number;
  wasDrifting: boolean;
};
export type KartRace = {
  raceId: string;
  elapsedMs: number;
  ended: boolean;
  drivers: Driver[];
};

export function createKartRace(
  raceId: string,
  players: readonly { playerId: string; name: string }[],
): KartRace {
  return {
    raceId,
    elapsedMs: 0,
    ended: false,
    drivers: players.map((p, i) => ({
      ...p,
      number: i + 1,
      x: 42 + ((i % 5) - 2) * 1.5,
      z: 0,
      heading: Math.PI / 2,
      speed: 0,
      progress: 0,
      checkpoint: 0,
      status: "RACING",
      lapTimeMs: null,
      sequence: -1,
      input: { ...kartNeutral },
      inputUntil: 0,
      turn: 0,
      angle: 0,
      distance: 0,
      driftMs: 0,
      boostMs: 0,
      wasDrifting: false,
    })),
  };
}

/** Pure server reducer: a phone supplies controls, never position, time, checkpoints or points. */
export function reduceKart(
  race: KartRace,
  event:
    | { type: "input"; playerId: string; value: KartInput }
    | { type: "tick"; elapsedMs: number }
    | { type: "end" },
): KartRace {
  if (race.ended) return race;
  const next: KartRace = {
    ...race,
    drivers: race.drivers.map((d) => ({ ...d, input: { ...d.input } })),
  };
  if (event.type === "input") {
    const d = next.drivers.find((d) => d.playerId === event.playerId);
    if (
      !d ||
      d.status !== "RACING" ||
      event.value.raceId !== race.raceId ||
      event.value.sequence <= d.sequence
    )
      return race;
    d.sequence = event.value.sequence;
    d.input = {
      steer: event.value.steer,
      gas: event.value.gas,
      brake: event.value.brake,
      drift: event.value.drift,
    };
    d.inputUntil = race.elapsedMs + 400;
    return next;
  }
  const target =
    event.type === "end"
      ? race.elapsedMs
      : Math.min(kartLimitMs, Math.max(race.elapsedMs, Math.floor(event.elapsedMs)));
  for (let t = race.elapsedMs; t < target; t += 50) {
    const ms = Math.min(50, target - t);
    for (const d of next.drivers) if (d.status === "RACING") stepDriver(d, t + ms, ms);
  }
  next.elapsedMs = target;
  if (
    event.type === "end" ||
    target >= kartLimitMs ||
    next.drivers.every((d) => d.status !== "RACING")
  ) {
    next.ended = true;
    for (const d of next.drivers)
      if (d.status === "RACING") {
        d.status = "DNF";
        d.speed = 0;
      }
  }
  return next;
}

const tau = 2 * Math.PI;
const damp = (a: number, b: number, rate: number, dt: number) =>
  b + (a - b) * Math.exp(-rate * dt);

/** Port of mario-kart-js speed damping / turn damping / release-to-boost, retuned for this 1-lap circuit.
 * Provenance and upstream permission notice: docs/kart-minigame.md and THIRD_PARTY_NOTICES.md.
 */
function stepDriver(d: Driver, elapsed: number, ms: number): void {
  const dt = ms / 1000;
  const input = elapsed <= d.inputUntil ? d.input : kartNeutral;
  const drifting = input.drift && Math.abs(input.steer) > 0.15 && d.speed > 5;
  if (d.wasDrifting && !drifting && d.driftMs >= 700)
    d.boostMs = Math.min(1200, d.driftMs / 2);
  d.driftMs = drifting ? d.driftMs + ms : 0;
  d.wasDrifting = drifting;
  d.boostMs = Math.max(0, d.boostMs - ms);
  const maxSpeed = d.boostMs > 0 ? 14 : 11;
  const targetSpeed = input.brake ? -3 : input.gas ? maxSpeed : 0;
  d.speed = damp(d.speed, targetSpeed, 2.5, dt);
  d.turn = damp(d.turn, input.steer * (drifting ? 1.45 : 1.1), 6, dt);
  d.heading += d.turn * (d.speed / 11) * dt;
  d.x += Math.cos(d.heading) * d.speed * dt;
  d.z += Math.sin(d.heading) * d.speed * dt;
  const radius = Math.hypot(d.x, d.z);
  const clamped = Math.max(34, Math.min(50, radius));
  if (radius !== clamped) {
    d.x *= clamped / radius;
    d.z *= clamped / radius;
    d.speed *= 0.95;
  }
  const angle = Math.atan2(d.z, d.x);
  let change = angle - d.angle;
  if (change > Math.PI) change -= tau;
  if (change < -Math.PI) change += tau;
  d.angle = angle;
  // Net clockwise travel, including reverse travel. Starting on the line cannot finish a lap.
  d.distance = Math.max(-tau, d.distance + change);
  const nextCheckpoint = ((d.checkpoint + 1) * tau) / 8;
  if (change > 0 && d.distance >= nextCheckpoint && d.checkpoint < 8) d.checkpoint += 1;
  d.progress = Math.min(1, Math.max(0, d.distance / tau));
  if (d.checkpoint === 8 && d.distance >= tau) {
    d.status = "FINISHED";
    d.lapTimeMs = elapsed;
    d.speed = 0;
  }
}

export function kartStandings(race: KartRace, points: number) {
  const sorted = [...race.drivers].sort((a, b) => {
    if (a.status === "FINISHED" && b.status !== "FINISHED") return -1;
    if (b.status === "FINISHED" && a.status !== "FINISHED") return 1;
    return a.status === "FINISHED"
      ? a.lapTimeMs! - b.lapTimeMs!
      : b.progress - a.progress;
  });
  let place = 1;
  return sorted.map((d, i) => {
    const previous = sorted[i - 1];
    if (
      previous &&
      (d.status !== previous.status ||
        d.lapTimeMs !== previous.lapTimeMs ||
        (d.status !== "FINISHED" && d.progress !== previous.progress))
    )
      place = i + 1;
    return {
      playerId: d.playerId,
      name: d.name,
      timeMs: d.lapTimeMs,
      finished: d.status === "FINISHED",
      place,
      points:
        d.status === "FINISHED"
          ? Math.round((points * (sorted.length - place + 1)) / sorted.length)
          : 0,
    };
  });
}

export function projectKartRace(
  race: KartRace,
  selfPlayerId: string | null,
  points: number,
): KartRaceView {
  return kartRaceSchema.parse({
    raceId: race.raceId,
    trackId: kartTrackId,
    timeLimitMs: kartLimitMs,
    elapsedMs: race.elapsedMs,
    ended: race.ended,
    selfPlayerId,
    inputCursor: selfPlayerId
      ? Math.max(
          0,
          race.drivers.find((d) => d.playerId === selfPlayerId)?.sequence ?? 0,
        )
      : null,
    participants: race.drivers.map(
      ({
        playerId,
        name,
        number,
        x,
        z,
        heading,
        speed,
        progress,
        checkpoint,
        status,
        lapTimeMs,
      }) => ({
        playerId,
        name,
        number,
        x,
        z,
        heading,
        speed,
        progress,
        checkpoint,
        status,
        lapTimeMs,
      }),
    ),
    leaderboard: kartStandings(race, race.ended ? points : 0),
  });
}

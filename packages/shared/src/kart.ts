import { ringCourse } from "./kart-course.ts";
import {
  createKartPowers,
  stepKartPowers,
  useKartPower,
  powerDrivingBody,
  ringItemBoxes,
  kartPowerViewSchema,
  type KartPowers,
  type OilSlick,
} from "./kart-powers.ts";
import { z } from "zod";
import {
  clearOfWalls,
  createDrivingBody,
  stepDriving,
  drivingDriftLevel,
  ringDriving,
  ringWalls,
  indexWalls,
  type DrivingBody,
} from "./kart-driving.ts";

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
    // Defaults accept older stored/public snapshots during a rolling update.
    driftCharge: z.number().min(0).max(1).default(0),
    driftChargeMs: z.number().min(0).max(2400).optional(),
    boostRemainingMs: z.number().int().min(0).max(1200).default(0),
    drifting: z.boolean().default(false),
    driftLevel: z.number().int().min(0).max(3).optional(),
    boostLevel: z.number().int().min(0).max(3).optional(),
    height: z.number().min(0).max(20).optional(),
    wrongWay: z.boolean().default(false),
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
    // Frozen race size; phone leaderboards intentionally contain only a shortlist.
    participantCount: z.number().int().min(0).max(80).optional(),
    powers: kartPowerViewSchema.optional(),
    courseEnabled: z.boolean().optional(),
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
/** A race tick sent instead of a full snapshot. The client merges it into its last snapshot. */
export const kartFrameSchema = z.object({
  kind: z.literal("kart"),
  scope: z.literal("public"),
  stateVersion: z.number().int().nonnegative(),
  serverNow: z.number().int(),
  submissionCount: z.number().int().nonnegative(),
  kart: kartRaceSchema,
});
export type KartFrame = z.infer<typeof kartFrameSchema>;
export type KartCompletion = {
  playerId: string;
  lapTimeMs: number | null;
  status: "FINISHED" | "DNF";
};

type Driver = Omit<
  KartDriver,
  "driftCharge" | "boostRemainingMs" | "drifting" | "wrongWay"
> & {
  sequence: number;
  input: KartControls;
  inputUntil: number;
  turn: number;
  angle: number;
  distance: number;
  driftMs: number;
  boostMs: number;
  wasDrifting: boolean;
  power?: KartPowers;
  physics?: DrivingBody;
  lastSafe?: {
    x: number;
    z: number;
    heading: number;
    angle: number;
    distance: number;
    checkpoint: number;
    progress: number;
  };
  lastRecoveryAt?: number;
};
export type KartRace = {
  raceId: string;
  elapsedMs: number;
  ended: boolean;
  drivers: Driver[];
  powerUpVersion?: 1;
  oils?: OilSlick[];
  physicsVersion?: "arcade-v2";
  courseEnabled?: boolean;
  courseHistory?: { atMs: number; enabled: boolean }[];
};

export function createKartRace(
  raceId: string,
  players: readonly { playerId: string; name: string }[],
): KartRace {
  return {
    raceId,
    physicsVersion: "arcade-v2",
    courseEnabled: false,
    courseHistory: [],
    powerUpVersion: 1,
    oils: [],
    elapsedMs: 0,
    ended: false,
    drivers: players.map((p, i) => ({
      ...p,
      number: i + 1,
      power: createKartPowers(),
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

function copyRace(race: KartRace): KartRace {
  return {
    ...race,
    oils: race.oils?.map((o) => ({ ...o })),
    drivers: race.drivers.map((d) => ({
      ...d,
      power: d.power && {
        ...d.power,
        cooldowns: { ...d.power.cooldowns },
        hits: [...d.power.hits],
      },
      input: { ...d.input },
      physics: d.physics && { ...d.physics },
      lastSafe: d.lastSafe && { ...d.lastSafe },
    })),
  };
}
function applyInput(
  driver: Driver,
  raceId: string,
  input: KartInput,
  elapsed: number,
): boolean {
  if (
    driver.status !== "RACING" ||
    input.raceId !== raceId ||
    input.sequence <= driver.sequence
  )
    return false;
  driver.sequence = input.sequence;
  driver.input = {
    steer: input.steer,
    gas: input.gas,
    brake: input.brake,
    drift: input.drift,
  };
  driver.inputUntil = elapsed + 400;
  return true;
}
function advanceDriver(
  driver: Driver,
  from: number,
  target: number,
  version?: "arcade-v2",
  oils?: readonly OilSlick[],
  courseEnabled = false,
): void {
  const step = version ? 20 : 50;
  for (let t = from; t < target && driver.status === "RACING"; t += step) {
    const ms = Math.min(step, target - t);
    stepDriver(driver, t + ms, ms, version, oils, courseEnabled);
  }
}
function settleRace(race: KartRace, force = false): KartRace {
  if (
    force ||
    race.elapsedMs >= kartLimitMs ||
    race.drivers.every((d) => d.status !== "RACING")
  ) {
    race.ended = true;
    for (const d of race.drivers) {
      if (d.status === "RACING") {
        d.status = "DNF";
        d.speed = 0;
      }
      d.driftMs = d.boostMs = 0;
      d.wasDrifting = false;
    }
  }
  return race;
}

export type KartTimedInput = { playerId: string; elapsed: number; input: KartInput };

/** Replays persisted server-stamped input independently for each ghost kart.
 * One clone per tick; another driver's 10Hz inputs do not subdivide everyone's physics.
 * There is deliberately no browser timestamp or lap result in this interface.
 */
export function reduceKartTimeline(
  race: KartRace,
  events: readonly KartTimedInput[],
  elapsedMs: number,
): KartRace {
  if (race.ended || !Number.isFinite(elapsedMs)) return race;
  const target = Math.min(kartLimitMs, Math.max(race.elapsedMs, Math.floor(elapsedMs)));
  const next = copyRace(race);
  const byPlayer = new Map<string, KartTimedInput[]>();
  for (const event of events) {
    if (
      !Number.isFinite(event.elapsed) ||
      event.elapsed < race.elapsedMs ||
      event.elapsed > target
    )
      continue;
    const pending = byPlayer.get(event.playerId) ?? [];
    pending.push(event);
    byPlayer.set(event.playerId, pending);
  }
  for (const driver of next.drivers) {
    let cursor = race.elapsedMs;
    const pending = byPlayer.get(driver.playerId) ?? [];
    pending.sort(
      (a, b) => a.elapsed - b.elapsed || a.input.sequence - b.input.sequence,
    );
    for (const event of pending) {
      if (event.input.raceId !== race.raceId || event.input.sequence <= driver.sequence)
        continue;
      advanceDriver(
        driver,
        cursor,
        event.elapsed,
        race.physicsVersion,
        race.powerUpVersion ? (race.oils ?? []) : undefined,
        race.courseEnabled,
      );
      cursor = event.elapsed;
      applyInput(driver, race.raceId, event.input, event.elapsed);
    }
    advanceDriver(
      driver,
      cursor,
      target,
      race.physicsVersion,
      race.powerUpVersion ? (race.oils ?? []) : undefined,
      race.courseEnabled,
    );
  }
  next.elapsedMs = target;
  if (next.oils) next.oils = next.oils.filter((o) => o.expiresAt > target);
  return settleRace(next);
}

/** Pure server reducer: phones supply controls, never positions, times or points. */
export function reduceKart(
  race: KartRace,
  event:
    | { type: "input"; playerId: string; value: KartInput }
    | { type: "tick"; elapsedMs: number }
    | { type: "release" }
    | { type: "recover"; playerId: string }
    | { type: "use-power"; playerId: string }
    | { type: "end" },
): KartRace {
  if (race.ended) return race;
  if (event.type === "tick") return reduceKartTimeline(race, [], event.elapsedMs);
  const next = copyRace(race);
  if (event.type === "end") return settleRace(next, true);
  if (event.type === "release") {
    for (const driver of next.drivers) {
      driver.input = { ...kartNeutral };
      driver.inputUntil = race.elapsedMs;
      driver.driftMs = 0;
      driver.wasDrifting = false;
      if (driver.physics)
        driver.physics = { ...driver.physics, driftMs: 0, wasDrifting: false };
    }
    return next;
  }
  const driver = next.drivers.find((d) => d.playerId === event.playerId);
  if (event.type === "use-power") {
    if (!race.powerUpVersion || !driver || driver.status !== "RACING") return race;
    const used = useKartPower(
      driver.power ?? createKartPowers(),
      driver.playerId,
      driver,
      race.elapsedMs,
    );
    if (!used) return race;
    driver.power = used.powers;
    if (used.oil) next.oils = [...(next.oils ?? []), used.oil].slice(-64);
    return next;
  }
  if (event.type === "recover") {
    if (
      !driver ||
      driver.status !== "RACING" ||
      race.elapsedMs - (driver.lastRecoveryAt ?? -2000) < 2000
    )
      return race;
    const safe = driver.lastSafe ?? {
      x: 42 + (((driver.number - 1) % 5) - 2) * 1.5,
      z: 0,
      heading: Math.PI / 2,
      angle: 0,
      distance: 0,
      checkpoint: 0,
      progress: 0,
    };
    if (driver.power)
      driver.power = { ...driver.power, turboUntil: 0, shieldUntil: 0, slowedUntil: 0 };
    Object.assign(driver, safe, {
      speed: 0,
      turn: 0,
      driftMs: 0,
      boostMs: 0,
      wasDrifting: false,
      input: { ...kartNeutral },
      inputUntil: race.elapsedMs,
      lastRecoveryAt: race.elapsedMs,
      physics: createDrivingBody(safe.x, safe.z, safe.heading),
    });
    return next;
  }
  return driver && applyInput(driver, race.raceId, event.value, race.elapsedMs)
    ? next
    : race;
}

const nearbyRingWalls = indexWalls(ringWalls);
const tau = 2 * Math.PI;
const damp = (a: number, b: number, rate: number, dt: number) =>
  b + (a - b) * Math.exp(-rate * dt);

/** Port of mario-kart-js speed damping / turn damping / release-to-boost, retuned for this 1-lap circuit.
 * Provenance and upstream permission notice: docs/kart-minigame.md and THIRD_PARTY_NOTICES.md.
 */
function stepDriver(
  d: Driver,
  elapsed: number,
  ms: number,
  version?: "arcade-v2",
  oils?: readonly OilSlick[],
  courseEnabled = false,
): void {
  const dt = ms / 1000;
  const fresh = elapsed <= d.inputUntil;
  const input = fresh ? d.input : kartNeutral;
  if (version === "arcade-v2") {
    let body = d.physics ?? createDrivingBody(d.x, d.z, d.heading);
    body = { ...body, courseMs: elapsed - ms };
    if (oils) {
      d.power ??= createKartPowers();
      body = powerDrivingBody(body, d.power, elapsed);
    }
    const next = stepDriving(
      body,
      input,
      ms,
      ringDriving,
      nearbyRingWalls(
        body.x,
        body.z,
        ringDriving.radius + Math.hypot(body.vx, body.vz) * 0.02,
      ),
      Boolean(d.power && d.power.slowedUntil > elapsed),
      fresh,
      courseEnabled ? ringCourse : [],
    );
    if (oils && d.power) {
      const effect = stepKartPowers(
        d.power,
        d.playerId,
        body,
        next,
        (next.height ?? 0) > 0 ? [] : ringItemBoxes,
        (next.height ?? 0) > 0 ? [] : oils,
        elapsed,
        d.playerId,
      );
      d.power = effect.powers;
      if (effect.hit) {
        next.vx *= 0.35;
        next.vz *= 0.35;
        next.boostMs = 0;
        next.driftMs = 0;
        next.wasDrifting = false;
      }
    }
    d.physics = next;
    d.x = next.x;
    d.z = next.z;
    d.heading = next.heading;
    d.speed = next.vx * Math.cos(next.heading) + next.vz * Math.sin(next.heading);
    d.turn = next.turn;
    d.driftMs = next.driftMs;
    d.boostMs = next.boostMs;
    d.wasDrifting = next.wasDrifting;
  } else {
    const drifting = input.drift && Math.abs(input.steer) > 0.15 && d.speed > 5;
    // A stale/disconnected controller or braking must never cash in a drift.
    if (
      d.wasDrifting &&
      !drifting &&
      fresh &&
      !input.drift &&
      input.gas &&
      !input.brake &&
      d.driftMs >= 700
    )
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
  if (
    version === "arcade-v2" &&
    !d.physics?.contact &&
    !(d.physics?.height ?? 0) &&
    clearOfWalls(d.x, d.z, nearbyRingWalls(d.x, d.z, 3), ringDriving.radius + 2)
  )
    d.lastSafe = {
      x: d.x,
      z: d.z,
      heading: d.heading,
      angle: d.angle,
      distance: d.distance,
      checkpoint: d.checkpoint,
      progress: d.progress,
    };
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

function round(value: number, places: number): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

export function projectKartRace(
  race: KartRace,
  selfPlayerId: string | null,
  points: number,
): KartRaceView {
  return kartRaceSchema.parse({
    raceId: race.raceId,
    courseEnabled: race.courseEnabled ?? false,
    trackId: kartTrackId,
    timeLimitMs: kartLimitMs,
    elapsedMs: race.elapsedMs,
    ended: race.ended,
    selfPlayerId,
    participantCount: race.drivers.length,
    inputCursor: selfPlayerId
      ? Math.max(
          0,
          race.drivers.find((d) => d.playerId === selfPlayerId)?.sequence ?? 0,
        )
      : null,
    ...(race.powerUpVersion
      ? {
          powers: {
            selfItem:
              race.drivers.find((d) => d.playerId === selfPlayerId)?.power?.item ??
              null,
            boxes: ringItemBoxes.map((box) => ({
              ...box,
              available:
                (race.drivers.find((d) => d.playerId === selfPlayerId)?.power
                  ?.cooldowns[box.id] ?? 0) <= race.elapsedMs,
            })),
            oils: race.oils ?? [],
            effects: race.drivers.map((d) => ({
              playerId: d.playerId,
              shieldMs: Math.max(0, (d.power?.shieldUntil ?? 0) - race.elapsedMs),
              slowedMs: Math.max(0, (d.power?.slowedUntil ?? 0) - race.elapsedMs),
              turboMs: Math.max(0, (d.power?.turboUntil ?? 0) - race.elapsedMs),
            })),
          },
        }
      : {}),
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
        driftMs,
        boostMs,
        wasDrifting,
        physics,
      }) => ({
        playerId,
        name,
        number,
        // Millimetre and milliradian precision is far below what a screen shows,
        // and keeps an 80-kart frame small.
        x: round(x, 3),
        z: round(z, 3),
        heading: round(heading, 3),
        speed: round(speed, 3),
        progress,
        checkpoint,
        status,
        lapTimeMs,
        driftCharge: status === "RACING" ? Math.min(1, driftMs / 700) : 0,
        driftChargeMs: status === "RACING" ? Math.min(2400, driftMs) : 0,
        boostRemainingMs: status === "RACING" ? Math.floor(boostMs) : 0,
        drifting: status === "RACING" && wasDrifting,
        driftLevel: status === "RACING" ? drivingDriftLevel(driftMs) : 0,
        boostLevel: status === "RACING" && boostMs > 0 ? physics?.boostLevel || 1 : 0,
        height: round(physics?.height ?? 0, 3),
        wrongWay:
          status === "RACING" &&
          wrongWayVelocity(
            x,
            z,
            physics?.vx ?? Math.cos(heading) * speed,
            physics?.vz ?? Math.sin(heading) * speed,
          ),
      }),
    ),
    leaderboard: kartStandings(race, race.ended ? points : 0),
  });
}

function wrongWayVelocity(x: number, z: number, vx: number, vz: number): boolean {
  const speed = Math.hypot(vx, vz);
  return (
    speed > 0.5 && (-z * vx + x * vz) / (Math.max(1, Math.hypot(x, z)) * speed) < -0.25
  );
}

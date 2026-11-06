import {
  kartSettingsSchema,
  type KartSettings,
  type KartSettingHistory,
} from "./kart-settings.ts";
import {
  importedTrackId,
  importedTrackLimitMs,
  importedLapLength,
  importedTrackProgress,
  nearbyImportedWalls,
  importedSurfaceAt,
} from "./kart-track.ts";
import { ringCourse, soloCourse } from "./kart-course.ts";
import {
  createKartPowers,
  stepKartPowers,
  useKartPower,
  powerDrivingBody,
  ringItemBoxes,
  soloItemBoxes as importedBoxes,
  kartPowerViewSchema,
  legacyKartItem,
  type KartPowers,
  type OilSlick,
} from "./kart-powers.ts";
import { z } from "zod";
import {
  allowedKartItems,
  kartItemRulesSchema,
  type KartItemRules,
} from "./kart-item-rules.ts";
import {
  createKartProjectiles,
  copyKartProjectiles,
  noteKartItemEvent,
  launchKartProjectile,
  stepKartProjectiles,
  clearKartProjectiles,
  setKartProjectileSpawning,
  type KartProjectileWorld,
} from "./kart-projectiles.ts";
import { selectKartTarget } from "./kart-targeting.ts";
import { type KartHandling } from "./kart-handling.ts";
import { advanceKartLap } from "./kart-laps.ts";
import { kartRaceRecap, type KartEndReason } from "./kart-recap.ts";
import {
  kartPresentationSchema,
  kartFinishPresentation,
  kartContactPresentation,
  kartItemsPresentation,
} from "./kart-events.ts";
import {
  appendKartContactHistory,
  type KartContactHistoryEntry,
  type KartContactEvent,
} from "./kart-contacts.ts";
import { selectNearbyNumbers } from "./kart-nearby.ts";
import {
  kartSpectatorSchema,
  kartSpectatorView,
  type KartStageMode,
} from "./kart-spectator.ts";
import {
  clearOfWalls,
  createDrivingBody,
  stepDriving,
  drivingDriftLevel,
  ringDriving,
  soloDriving,
  ringWalls,
  indexWalls,
  type DrivingBody,
} from "./kart-driving.ts";

export const kartTrackId = "party-ring-v1" as const;
export const kartLimitMs = 45_000;
export type KartTrackId = typeof kartTrackId | typeof importedTrackId;
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
/** Optional host presentation choice; absence preserves the legacy renderer. */
export const kartLookNameSchema = z.enum([
  "off",
  "daylight",
  "warm",
  "crisp",
  "cool",
  "race",
]);
export type KartLookName = z.infer<typeof kartLookNameSchema>;
export const kartLookHistorySchema = z
  .array(
    z
      .object({
        atMs: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
        preset: kartLookNameSchema,
      })
      .strict(),
  )
  .max(20);
export type KartLookHistory = z.infer<typeof kartLookHistorySchema>;
export const kartDriverSchema = z
  .object({
    playerId: z.string(),
    name: z.string().min(1).max(24),
    number: z.number().int().positive(),
    gridPosition: z.number().int().min(1).max(100).optional(),
    x: z.number().finite(),
    z: z.number().finite(),
    heading: z.number().finite(),
    speed: z.number().finite(),
    turnRate: z.number().finite().min(-10).max(10).optional(),
    contact: z.boolean().optional(),
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
    trackId: z.enum([kartTrackId, importedTrackId]),
    timeLimitMs: z.union([z.literal(kartLimitMs), z.literal(importedTrackLimitMs)]),
    elapsedMs: z.number().int().min(0).max(importedTrackLimitMs),
    ended: z.boolean(),
    selfPlayerId: z.string().nullable(),
    inputCursor: z.number().int().nonnegative().nullable(),
    // Frozen race size; phone leaderboards intentionally contain only a shortlist.
    participantCount: z.number().int().min(0).max(100).optional(),
    powers: kartPowerViewSchema.optional(),
    courseEnabled: z.boolean().optional(),
    opponentsEnabled: z.boolean().optional(),
    effectsEnabled: z.boolean().optional(),
    look: kartLookNameSchema.optional().catch(undefined),
    // Host driving-feel choices; absent means the defaults in kart-settings.ts.
    settings: kartSettingsSchema.optional(),
    spectator: kartSpectatorSchema.optional().catch(undefined),
    // Unsupported cosmetic metadata must not invalidate authoritative driving state.
    presentation: kartPresentationSchema.optional().catch(undefined),
    participants: z.array(kartDriverSchema).max(100),
    nearby: z
      .array(kartDriverSchema)
      .max(8)
      .refine(
        (drivers) => new Set(drivers.map((d) => d.playerId)).size === drivers.length,
      )
      .optional()
      .catch(undefined),
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
      .max(100),
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
  lastImpact?: KartContactEvent;
  lap?: { crossingsMs: (number | null)[]; recoveries: number };
};
export type KartRace = {
  raceId: string;
  elapsedMs: number;
  ended: boolean;
  drivers: Driver[];
  recapVersion?: 1;
  endReason?: KartEndReason;
  powerUpVersion?: 1;
  itemRules?: KartItemRules;
  itemsWorld?: KartProjectileWorld;
  oils?: OilSlick[];
  physicsVersion?: "arcade-v2";
  handling?: KartHandling;
  contactVersion?: 1;
  contactHistory?: KartContactHistoryEntry[];
  trackId?: KartTrackId;
  timeLimitMs?: 45000 | 180000;
  courseEnabled?: boolean;
  courseHistory?: { atMs: number; enabled: boolean }[];
  opponentsEnabled?: boolean;
  effectsEnabled?: boolean;
  look?: KartLookName;
  lookHistory?: KartLookHistory;
  /** Host driving-feel choices for phones and the stage; never race rules. */
  settings?: KartSettings;
  settingsHistory?: KartSettingHistory;
  effectsHistory?: { atMs: number; enabled: boolean }[];
  nearbyNumbers?: number[][];
  opponentHistory?: { atMs: number; enabled: boolean }[];
  stageMode?: KartStageMode;
  stageRevision?: number;
  stageHistory?: { atMs: number; mode: KartStageMode }[];
};

export function createKartRace(
  raceId: string,
  players: readonly { playerId: string; name: string; points?: number }[],
  options: {
    seedGrid?: boolean;
    trackId?: KartTrackId;
    handling?: KartHandling;
    itemRules?: KartItemRules;
  } = {},
): KartRace {
  if (
    players.length > 100 ||
    new Set(players.map((p) => p.playerId)).size !== players.length
  )
    throw new Error("A race supports at most 100 different players.");
  const roster = options.seedGrid
    ? players
        .map((p, index) => ({ ...p, index }))
        .sort((a, b) => (b.points ?? 0) - (a.points ?? 0) || a.index - b.index)
    : players;
  return {
    raceId,
    trackId: options.trackId ?? kartTrackId,
    timeLimitMs:
      options.trackId === importedTrackId ? importedTrackLimitMs : kartLimitMs,
    physicsVersion: "arcade-v2",
    ...(options.handling ? { handling: options.handling } : {}),
    contactVersion: 1,
    contactHistory: [],
    courseEnabled: options.trackId === importedTrackId,
    courseHistory: [],
    powerUpVersion: 1,
    ...(options.itemRules
      ? { itemRules: kartItemRulesSchema.parse(options.itemRules) }
      : {}),
    itemsWorld: createKartProjectiles(),
    oils: [],
    elapsedMs: 0,
    ended: false,
    recapVersion: 1,
    drivers: roster.map((p, i) => ({
      playerId: p.playerId,
      name: p.name,
      number: i + 1,
      ...(options.seedGrid ? { gridPosition: i + 1 } : {}),
      power: createKartPowers(),
      ...(options.seedGrid || options.trackId === importedTrackId
        ? gridSlot(i, options.trackId ?? kartTrackId)
        : { x: 42 + ((i % 5) - 2) * 1.5, z: 0, heading: Math.PI / 2 }),
      ...(options.seedGrid || options.trackId === importedTrackId
        ? {
            lastSafe: {
              ...gridSlot(i, options.trackId ?? kartTrackId),
              checkpoint: 0,
              progress: 0,
            },
          }
        : {}),
      speed: 0,
      progress: 0,
      checkpoint: 0,
      status: "RACING",
      lap: { crossingsMs: [], recoveries: 0 },
      lapTimeMs: null,
      sequence: -1,
      input: { ...kartNeutral },
      inputUntil: 0,
      turn: 0,
      angle:
        options.seedGrid || options.trackId === importedTrackId
          ? gridSlot(i, options.trackId ?? kartTrackId).angle
          : 0,
      distance:
        options.seedGrid || options.trackId === importedTrackId
          ? gridSlot(i, options.trackId ?? kartTrackId).distance
          : 0,
      driftMs: 0,
      boostMs: 0,
      wasDrifting: false,
    })),
  };
}

function copyRace(race: KartRace): KartRace {
  return {
    ...race,
    itemsWorld: race.itemsWorld && copyKartProjectiles(race.itemsWorld),
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
      lap: d.lap && {
        crossingsMs: [...d.lap.crossingsMs],
        recoveries: d.lap.recoveries,
      },
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
  trackId: KartTrackId = kartTrackId,
  race?: KartRace,
): void {
  const step = version ? 20 : 50;
  for (let t = from; t < target && driver.status === "RACING"; t += step) {
    const ms = Math.min(step, target - t);
    stepDriver(driver, t + ms, ms, version, oils, courseEnabled, trackId, race);
  }
}
function settleRace(race: KartRace, force = false): KartRace {
  if (
    force ||
    race.elapsedMs >= (race.timeLimitMs ?? kartLimitMs) ||
    race.drivers.every((d) => d.status !== "RACING")
  ) {
    race.ended = true;
    if (race.itemsWorld) race.itemsWorld = clearKartProjectiles(race.itemsWorld);
    if (race.itemRules?.version === 2) race.oils = [];
    if (race.recapVersion === 1)
      race.endReason ??=
        race.elapsedMs >= (race.timeLimitMs ?? kartLimitMs)
          ? "time-limit"
          : force
            ? "host-ended"
            : race.drivers.every((driver) => driver.status === "FINISHED")
              ? "all-finished"
              : "race-ended";
    for (const d of race.drivers) {
      if (d.status === "RACING") {
        d.status = "DNF";
        d.speed = 0;
      }
      d.driftMs = d.boostMs = 0;
      d.wasDrifting = false;
    }
  }
  if (race.opponentsEnabled)
    race.nearbyNumbers = race.drivers.map((driver, index) =>
      selectNearbyNumbers(race.drivers, driver.playerId, race.nearbyNumbers?.[index]),
    );
  else race.nearbyNumbers = undefined;
  return race;
}

export type KartTimedInput = { playerId: string; elapsed: number; input: KartInput };

function itemActors(race: KartRace) {
  return race.drivers.map((driver) => ({
    playerId: driver.playerId,
    number: driver.number,
    status: driver.status,
    progress: driver.progress,
    x: driver.x,
    z: driver.z,
    heading: driver.heading,
    height: driver.physics?.height ?? 0,
    power: driver.power ?? createKartPowers(),
  }));
}
function itemContext(race: KartRace) {
  return {
    trackId: race.trackId ?? kartTrackId,
    walls: race.trackId === importedTrackId ? nearbyImportedWalls : nearbyRingWalls,
  };
}
export function configureKartItems(race: KartRace, value: unknown): KartRace {
  const rules = kartItemRulesSchema.parse(value);
  if (race.ended || race.elapsedMs > 0)
    throw new Error("Choose item rules before the race starts.");
  const next = copyRace(race);
  next.itemRules = rules;
  next.itemsWorld ??= createKartProjectiles();
  return next;
}
export function kartItemRefusal(race: KartRace, playerId: string): string | undefined {
  const driver = race.drivers.find((row) => row.playerId === playerId),
    item = driver?.power?.item;
  if (race.ended || driver?.status !== "RACING")
    return "This race has ended for your kart.";
  if (!item) return "Drive through an item box first.";
  const hazard =
    item === "oil" || item === "tennis" || item === "bomb" || item === "homing";
  if (hazard && race.itemsWorld?.spawning === false)
    return "The host has paused new track hazards. Your item is kept.";
  if (race.itemRules?.version === 2 && item === "oil" && (race.oils?.length ?? 0) >= 64)
    return "The oil pool is full. Your item is kept.";
  if (
    race.itemRules?.version === 2 &&
    (item === "tennis" || item === "bomb" || item === "homing")
  ) {
    const actors = itemActors(race),
      owner = actors.find((row) => row.playerId === playerId)!;
    if (item === "homing" && !selectKartTarget(owner, actors)) return undefined;
    const result = launchKartProjectile(
      race.itemsWorld!,
      item,
      owner,
      actors,
      itemContext(race),
    );
    if (!result.accepted)
      return result.reason === "capacity"
        ? "The projectile pool is full. Your item is kept."
        : "A barrier blocks this launch. Your item is kept.";
  }
  return undefined;
}
function expandedTimeline(
  next: KartRace,
  byPlayer: Map<string, KartTimedInput[]>,
  target: number,
) {
  if (!next.itemsWorld)
    throw new Error("Expanded items require their saved simulation state.");
  for (const pending of byPlayer.values())
    pending.sort(
      (a, b) => a.elapsed - b.elapsed || a.input.sequence - b.input.sequence,
    );
  const positions = new Map<string, number>();
  // A flush can carry fresh controls at exactly the persisted clock (for example
  // a use-item intent immediately after an input). Accept them without advancing time.
  if (target === next.elapsedMs)
    for (const driver of next.drivers)
      for (const event of byPlayer.get(driver.playerId) ?? [])
        applyInput(driver, next.raceId, event.input, event.elapsed);
  for (let from = next.elapsedMs; from < target;) {
    const end = Math.min(target, from + 20);
    const previous = new Map(
      next.drivers.map((driver) => [
        driver.playerId,
        { x: driver.x, z: driver.z, height: driver.physics?.height ?? 0 },
      ]),
    );
    for (const driver of next.drivers) {
      const pending = byPlayer.get(driver.playerId) ?? [];
      let index = positions.get(driver.playerId) ?? 0,
        cursor = from;
      while (index < pending.length && pending[index]!.elapsed <= end) {
        const event = pending[index++]!;
        if (
          event.input.raceId !== next.raceId ||
          event.input.sequence <= driver.sequence
        )
          continue;
        advanceDriver(
          driver,
          cursor,
          event.elapsed,
          next.physicsVersion,
          next.oils,
          next.courseEnabled,
          next.trackId,
          next,
        );
        cursor = event.elapsed;
        applyInput(driver, next.raceId, event.input, event.elapsed);
      }
      positions.set(driver.playerId, index);
      advanceDriver(
        driver,
        cursor,
        end,
        next.physicsVersion,
        next.oils,
        next.courseEnabled,
        next.trackId,
        next,
      );
    }
    const actors = itemActors(next).map((actor) => ({
      ...actor,
      previous: previous.get(actor.playerId)!,
    }));
    const result = stepKartProjectiles(next.itemsWorld, actors, end, itemContext(next));
    next.itemsWorld = result.world;
    for (const actor of result.actors)
      next.drivers.find((driver) => driver.playerId === actor.playerId)!.power =
        actor.power;
    for (const hit of result.hits)
      if (hit.kind === "hit") {
        const driver = next.drivers.find((row) => row.playerId === hit.playerId)!;
        if (driver.physics) {
          driver.physics = {
            ...driver.physics,
            vx: driver.physics.vx * 0.35,
            vz: driver.physics.vz * 0.35,
            boostMs: 0,
            driftMs: 0,
            wasDrifting: false,
          };
          driver.speed =
            driver.physics.vx * Math.cos(driver.heading) +
            driver.physics.vz * Math.sin(driver.heading);
        }
        driver.boostMs = driver.driftMs = 0;
        driver.wasDrifting = false;
      }
    if (next.oils) next.oils = next.oils.filter((oil) => oil.expiresAt > end);
    from = end;
  }
  next.elapsedMs = target;
  return settleRace(next);
}

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
  const target = Math.min(
    race.timeLimitMs ?? kartLimitMs,
    Math.max(race.elapsedMs, Math.floor(elapsedMs)),
  );
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
  if (next.itemRules?.version === 2) return expandedTimeline(next, byPlayer, target);
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
        race.trackId,
        next,
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
      race.trackId,
      next,
    );
  }
  next.elapsedMs = target;
  if (next.itemsWorld) next.itemsWorld.elapsedMs = target;
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
    | { type: "end" }
    | { type: "items-spawning"; enabled: boolean }
    | { type: "clear-items" },
): KartRace {
  if (race.ended && event.type !== "clear-items" && event.type !== "items-spawning")
    return race;
  if (event.type === "tick") return reduceKartTimeline(race, [], event.elapsedMs);
  const next = copyRace(race);
  if (event.type === "end") return settleRace(next, true);
  if (event.type === "items-spawning" || event.type === "clear-items") {
    next.itemsWorld ??= { ...createKartProjectiles(), elapsedMs: race.elapsedMs };
    if (event.type === "items-spawning") {
      if (typeof event.enabled !== "boolean") throw new Error("Choose item spawning.");
      next.itemsWorld = setKartProjectileSpawning(next.itemsWorld, event.enabled);
      next.itemsWorld = noteKartItemEvent(next.itemsWorld, {
        kind: "spawning",
        atMs: race.elapsedMs,
        projectileId: "all",
      });
    } else {
      const hadProjectiles = next.itemsWorld.projectiles.length > 0;
      next.itemsWorld = clearKartProjectiles(next.itemsWorld);
      if (!hadProjectiles)
        next.itemsWorld = noteKartItemEvent(next.itemsWorld, {
          kind: "clear",
          atMs: race.elapsedMs,
          projectileId: "all",
        });
      next.oils = [];
    }
    return next;
  }
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
    if (kartItemRefusal(race, event.playerId)) return race;
    const item = driver.power?.item;
    if (!item) return race;
    if (
      next.itemRules?.version === 2 &&
      (item === "tennis" || item === "bomb" || item === "homing")
    ) {
      const actors = itemActors(next),
        owner = actors.find((row) => row.playerId === event.playerId)!;
      if (item === "homing" && !selectKartTarget(owner, actors)) {
        driver.power = useKartPower(
          { ...owner.power, item: "treat" },
          driver.playerId,
          driver,
          race.elapsedMs,
        )!.powers;
        next.itemsWorld = noteKartItemEvent(next.itemsWorld!, {
          kind: "use",
          item,
          playerId: driver.playerId,
          atMs: race.elapsedMs,
          projectileId: "all",
        });
        return next;
      }
      const launched = launchKartProjectile(
        next.itemsWorld!,
        item,
        owner,
        actors,
        itemContext(next),
      );
      if (!launched.accepted) return race;
      next.itemsWorld = launched.world;
      driver.power = { ...owner.power, item: null };
      return next;
    }
    const used = useKartPower(
      driver.power ?? createKartPowers(),
      driver.playerId,
      driver,
      race.elapsedMs,
    );
    if (!used) return race;
    driver.power = used.powers;
    if (used.oil) next.oils = [...(next.oils ?? []), used.oil].slice(-64);
    if (next.itemsWorld)
      next.itemsWorld = noteKartItemEvent(next.itemsWorld, {
        kind: "use",
        item,
        playerId: driver.playerId,
        atMs: race.elapsedMs,
        projectileId: "all",
      });
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
    if (next.recapVersion === 1)
      driver.lap = {
        crossingsMs: (driver.lap?.crossingsMs ?? []).slice(0, safe.checkpoint),
        recoveries: (driver.lap?.recoveries ?? 0) + 1,
      };
    if (next.contactVersion === 1)
      next.contactHistory = appendKartContactHistory(next.contactHistory, {
        eventId: next.elapsedMs * 100 + driver.number,
        atMs: next.elapsedMs,
        playerId: driver.playerId,
        number: driver.number,
        kind: "recovery",
        x: driver.x,
        z: driver.z,
        speed: 0,
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
  trackId: KartTrackId = kartTrackId,
  race?: KartRace,
): void {
  const dt = ms / 1000;
  const imported = trackId === importedTrackId;
  const profile = imported ? soloDriving : ringDriving;
  const nearbyWalls = imported ? nearbyImportedWalls : nearbyRingWalls;
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
      profile,
      nearbyWalls(body.x, body.z, profile.radius + Math.hypot(body.vx, body.vz) * 0.02),
      Boolean(d.power && d.power.slowedUntil > elapsed) ||
        (imported && importedSurfaceAt(body.x, body.z) !== "road"),
      fresh,
      courseEnabled ? (imported ? soloCourse : ringCourse) : [],
      race?.handling,
    );
    if (
      race?.contactVersion === 1 &&
      next.contact &&
      !body.contact &&
      elapsed - (d.lastImpact?.atMs ?? -400) >= 400
    ) {
      const atMs = Math.floor(elapsed);
      const accepted = { eventId: atMs * 100 + d.number, atMs, playerId: d.playerId };
      d.lastImpact = accepted;
      race.contactHistory = appendKartContactHistory(race.contactHistory, {
        ...accepted,
        kind: "impact",
        number: d.number,
        x: next.x,
        z: next.z,
        speed: Math.min(1000, Math.hypot(body.vx, body.vz)),
      });
    }
    if (oils && d.power) {
      const before = d.power;
      const effect = stepKartPowers(
        d.power,
        d.playerId,
        body,
        next,
        (next.height ?? 0) > 0 || race?.itemsWorld?.spawning === false
          ? []
          : imported
            ? importedBoxes
            : ringItemBoxes,
        (next.height ?? 0) > 0 ? [] : oils,
        elapsed,
        d.playerId,
        race?.itemRules?.version === 2
          ? { allowed: allowedKartItems(race.itemRules), damageGrace: true }
          : undefined,
      );
      d.power = effect.powers;
      if (race?.itemsWorld) {
        const base = { atMs: elapsed, projectileId: "all", playerId: d.playerId };
        if (d.power.collections > before.collections)
          race.itemsWorld = noteKartItemEvent(race.itemsWorld, {
            ...base,
            kind: "collect",
            item: d.power.item ?? undefined,
          });
        if (effect.hit)
          race.itemsWorld = noteKartItemEvent(race.itemsWorld, {
            ...base,
            kind: "hit",
            item: "oil",
          });
        else if (before.shieldUntil > elapsed && d.power.shieldUntil === 0)
          race.itemsWorld = noteKartItemEvent(race.itemsWorld, {
            ...base,
            kind: "shield",
            item: "oil",
          });
      }
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
  const projection = imported ? importedTrackProgress(d.x, d.z) : undefined;
  const lapLength = imported ? importedLapLength : tau;
  const angle = projection?.along ?? Math.atan2(d.z, d.x);
  const lap = advanceKartLap(d, {
    along: angle,
    lapLength,
    speed: d.speed,
    stepMs: ms,
    ...(projection ? { routeDistance: projection.distance } : {}),
  });
  if (race?.recapVersion === 1 && lap.checkpoint > d.checkpoint)
    d.lap = {
      crossingsMs: Array.from({ length: lap.checkpoint }, (_, index) =>
        index === lap.checkpoint - 1 ? elapsed : (d.lap?.crossingsMs[index] ?? null),
      ),
      recoveries: d.lap?.recoveries ?? 0,
    };
  d.angle = lap.angle;
  d.distance = lap.distance;
  d.checkpoint = lap.checkpoint;
  d.progress = lap.progress;
  if (
    version === "arcade-v2" &&
    lap.safeProgress &&
    !d.physics?.contact &&
    !(d.physics?.height ?? 0) &&
    (!imported || importedSurfaceAt(d.x, d.z) === "road") &&
    clearOfWalls(d.x, d.z, nearbyWalls(d.x, d.z, 3), profile.radius + 2)
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
  if (lap.finished) {
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
  const originalFinish = kartFinishPresentation(race);
  const recap = race.ended ? kartRaceRecap(race) : undefined;
  const finish =
    originalFinish?.version === 1 && recap
      ? { ...originalFinish, recap }
      : originalFinish;
  return kartRaceSchema.parse({
    raceId: race.raceId,
    courseEnabled: race.courseEnabled ?? false,
    ...(race.opponentsEnabled ? { opponentsEnabled: true } : {}),
    ...(race.settings && Object.keys(race.settings).length > 0
      ? { settings: race.settings }
      : {}),
    ...(race.effectsEnabled !== undefined
      ? { effectsEnabled: race.effectsEnabled }
      : {}),
    ...(race.look !== undefined ? { look: race.look } : {}),
    ...(race.stageMode
      ? {
          spectator: {
            ...kartSpectatorView(race.stageMode, race.drivers, race.elapsedMs),
            revision: race.stageRevision ?? 0,
          },
        }
      : {}),
    presentation: kartItemsPresentation(
      race,
      selfPlayerId,
      kartContactPresentation(race, selfPlayerId, finish),
    ),
    trackId: race.trackId ?? kartTrackId,
    timeLimitMs: race.timeLimitMs ?? kartLimitMs,
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
            selfItem: legacyKartItem(
              race.drivers.find((d) => d.playerId === selfPlayerId)?.power?.item,
            ),
            boxes: (race.trackId === importedTrackId
              ? importedBoxes
              : ringItemBoxes
            ).map((box) => ({
              ...box,
              available:
                race.itemsWorld?.spawning !== false &&
                allowedKartItems(race.itemRules).length > 0 &&
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
        gridPosition,
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
        turn,
        physics,
      }) => ({
        playerId,
        name,
        number,
        ...(gridPosition ? { gridPosition } : {}),
        // Millimetre and milliradian precision is far below what a screen shows,
        // and keeps an 80-kart frame small.
        x: round(x, 3),
        z: round(z, 3),
        heading: round(heading, 3),
        speed: round(speed, 3),
        turnRate: round(Math.max(-10, Math.min(10, physics?.turn ?? turn)), 3),
        ...(physics?.contact ? { contact: true } : {}),
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
          (race.trackId === importedTrackId ? importedWrongWay : wrongWayVelocity)(
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

function importedWrongWay(x: number, z: number, vx: number, vz: number) {
  const p = importedTrackProgress(x, z);
  return (
    Math.hypot(vx, vz) > 0.5 &&
    vx * Math.cos(p.heading) + vz * Math.sin(p.heading) < -0.5
  );
}
function gridSlot(i: number, track: KartTrackId) {
  const behind = 1.5 + Math.floor(i / 5) * 3;
  if (track === importedTrackId) {
    const x = ((i % 5) - 2) * 4,
      z = behind;
    return {
      x,
      z,
      heading: -Math.PI / 2,
      angle: importedTrackProgress(x, z).along,
      distance: -behind,
    };
  }
  const angle = -behind / 42,
    radius = 42 + ((i % 5) - 2) * 2.5;
  return {
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius,
    heading: Math.PI / 2 + angle,
    angle,
    distance: angle,
  };
}

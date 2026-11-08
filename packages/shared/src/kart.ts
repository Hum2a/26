import { type KartSettings, type KartSettingHistory } from "./kart-settings.ts";
import {
  parkTrackId,
  parkRoute,
  parkLanePoint,
  nearbyParkWalls,
  parkSurfaceAt,
  parkCourse,
  parkItemBoxes,
} from "./kart-park.ts";
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
  legacyKartItem,
  type KartPowers,
  type OilSlick,
} from "./kart-powers.ts";
import {
  kartLimitMs,
  kartNeutral,
  kartRaceSchema,
  kartTrackId,
  type KartControls,
  type KartInput,
  type KartDriver,
  type KartLookHistory,
  type KartLookName,
  type KartLaps,
  type KartRaceView,
  type KartTrackId,
} from "./kart-race-schema.ts";
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
  slipstreamPhase,
  slipstreamTuning,
  stepSlipstream,
} from "./kart-slipstream.ts";
import {
  isKartCpuId,
  kartCpuInput,
  kartCpuMax,
  kartCpuNames,
  kartCpuPlayerId,
  kartCpuSkill,
} from "./kart-cpu.ts";
import { kartSpectatorView, type KartStageMode } from "./kart-spectator.ts";
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

export * from "./kart-race-schema.ts";
export type KartCompletion = {
  playerId: string;
  lapTimeMs: number | null;
  status: "FINISHED" | "DNF";
};

// The public lap number, lap times and slipstream are derived in projection;
// `lap` here is the stored recap record.
type Driver = Omit<
  KartDriver,
  | "driftCharge"
  | "boostRemainingMs"
  | "drifting"
  | "wrongWay"
  | "lap"
  | "lapsMs"
  | "slipstream"
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
  /** Multi-lap races: laps already completed, and the race time each ended. */
  lapsDone?: number;
  lapTimes?: number[];
  /** Slipstream: draft charge and the remaining reduced-drag time. */
  draftMs?: number;
  slipstreamMs?: number;
  /** CPU racers: driven by the room, placed on track, never scored. */
  cpu?: true;
  skill?: number;
  stuckMs?: number;
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
  /** The course window × laps. */
  timeLimitMs?: number;
  /** Absent for a one-lap race. */
  laps?: KartLaps;
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
    laps?: KartLaps;
    /** CPU racers to add behind the guests (0–7). */
    cpu?: number;
  } = {},
): KartRace {
  const laps = options.laps ?? 1;
  if (![1, 2, 3].includes(laps)) throw new Error("A race has one, two or three laps.");
  const cpu = options.cpu ?? 0;
  if (!Number.isInteger(cpu) || cpu < 0 || cpu > kartCpuMax)
    throw new Error(`Choose between 0 and ${kartCpuMax} CPU racers.`);
  if (players.length + cpu > 100)
    throw new Error("A race supports at most 100 karts, CPU racers included.");
  if (players.some((p) => isKartCpuId(p.playerId)))
    throw new Error("Guest ids cannot look like CPU racers.");
  if (
    players.length > 100 ||
    new Set(players.map((p) => p.playerId)).size !== players.length
  )
    throw new Error("A race supports at most 100 different players.");
  const guests: { playerId: string; name: string; points?: number; cpu?: true; skill?: number }[] =
    options.seedGrid
      ? players
          .map((p, index) => ({ ...p, index }))
          .sort((a, b) => (b.points ?? 0) - (a.points ?? 0) || a.index - b.index)
      : [...players];
  // CPU racers start behind every guest.
  const roster = [
    ...guests,
    ...Array.from({ length: cpu }, (_, i) => ({
      playerId: kartCpuPlayerId(i),
      name: kartCpuNames[i]!,
      cpu: true as const,
      skill: kartCpuSkill(i),
    })),
  ];
  const seeded =
    options.seedGrid ||
    options.trackId === importedTrackId ||
    options.trackId === parkTrackId;
  return {
    raceId,
    trackId: options.trackId ?? kartTrackId,
    timeLimitMs:
      (options.trackId === importedTrackId || options.trackId === parkTrackId
        ? importedTrackLimitMs
        : kartLimitMs) * laps,
    ...(laps > 1 ? { laps } : {}),
    physicsVersion: "arcade-v2",
    ...(options.handling ? { handling: options.handling } : {}),
    contactVersion: 1,
    contactHistory: [],
    courseEnabled:
      options.trackId === importedTrackId || options.trackId === parkTrackId,
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
      ...(p.cpu ? { cpu: true as const, skill: p.skill } : {}),
      number: i + 1,
      ...(options.seedGrid ? { gridPosition: i + 1 } : {}),
      power: createKartPowers(),
      ...(seeded
        ? gridSlot(i, options.trackId ?? kartTrackId)
        : { x: 42 + ((i % 5) - 2) * 1.5, z: 0, heading: Math.PI / 2 }),
      ...(seeded
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
      angle: seeded ? gridSlot(i, options.trackId ?? kartTrackId).angle : 0,
      distance: seeded ? gridSlot(i, options.trackId ?? kartTrackId).distance : 0,
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
      lapTimes: d.lapTimes && [...d.lapTimes],
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
/** Guests decide when a race is over; CPU karts never hold it open. */
const decidingDrivers = (race: KartRace) => {
  const guests = race.drivers.filter((d) => !d.cpu);
  return guests.length ? guests : race.drivers;
};
function settleRace(race: KartRace, force = false): KartRace {
  if (
    force ||
    race.elapsedMs >= (race.timeLimitMs ?? kartLimitMs) ||
    decidingDrivers(race).every((d) => d.status !== "RACING")
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
            : decidingDrivers(race).every((driver) => driver.status === "FINISHED")
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
    walls:
      race.trackId === parkTrackId
        ? nearbyParkWalls
        : race.trackId === importedTrackId
          ? nearbyImportedWalls
          : nearbyRingWalls,
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
  const park = trackId === parkTrackId;
  const polyline = imported || park;
  const surfaceAt = park ? parkSurfaceAt : importedSurfaceAt;
  const profile = polyline ? soloDriving : ringDriving;
  const nearbyWalls = park
    ? nearbyParkWalls
    : imported
      ? nearbyImportedWalls
      : nearbyRingWalls;
  if (d.cpu && d.status === "RACING") {
    // The room drives CPU karts from the route, step by step.
    d.input = kartCpuInput(d, trackId, d.skill ?? 0.88, elapsed, d.number);
    d.inputUntil = elapsed + 400;
    // A CPU kart stuck against a barrier goes back to its last safe point.
    d.stuckMs = Math.abs(d.speed) < 1.5 ? (d.stuckMs ?? 0) + ms : 0;
    if (d.stuckMs > 2500 && d.lastSafe) {
      Object.assign(d, d.lastSafe, {
        speed: 0,
        turn: 0,
        driftMs: 0,
        boostMs: 0,
        wasDrifting: false,
        stuckMs: 0,
        physics: createDrivingBody(d.lastSafe.x, d.lastSafe.z, d.lastSafe.heading),
      });
    }
  }
  const fresh = elapsed <= d.inputUntil;
  const input = fresh ? d.input : kartNeutral;
  if (version === "arcade-v2") {
    let body = d.physics ?? createDrivingBody(d.x, d.z, d.heading);
    body = { ...body, courseMs: elapsed - ms };
    if (oils) {
      d.power ??= createKartPowers();
      body = powerDrivingBody(body, d.power, elapsed);
    }
    // Slipstream lowers drag, which lifts top speed without extra thrust.
    const slipping = (d.slipstreamMs ?? 0) > 0;
    const next = stepDriving(
      body,
      input,
      ms,
      slipping
        ? { ...profile, drag: profile.drag * slipstreamTuning.dragScale }
        : profile,
      nearbyWalls(body.x, body.z, profile.radius + Math.hypot(body.vx, body.vz) * 0.02),
      Boolean(d.power && d.power.slowedUntil > elapsed) ||
        (polyline && surfaceAt(body.x, body.z) !== "road"),
      fresh,
      courseEnabled ? (park ? parkCourse : imported ? soloCourse : ringCourse) : [],
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
        // CPU karts drive through item boxes without collecting.
        d.cpu || (next.height ?? 0) > 0 || race?.itemsWorld?.spawning === false
          ? []
          : park
            ? parkItemBoxes
            : imported
              ? importedBoxes
              : ringItemBoxes,
        (next.height ?? 0) > 0 ? [] : oils,
        elapsed,
        d.playerId,
        race?.itemRules?.version === 2 || race?.itemRules?.luck === "position"
          ? {
              allowed: allowedKartItems(race.itemRules),
              damageGrace: race.itemRules.version === 2,
              ...(race.itemRules.luck === "position"
                ? { standing: () => kartStanding(race, d) }
                : {}),
            }
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
    // Drivers already carry the fields a wake needs, so nothing is allocated
    // per step; finished and DNF karts are stopped and leave no wake.
    if (race && race.drivers.length > 1) {
      const draft = stepSlipstream(
        { draftMs: d.draftMs ?? 0, slipstreamMs: d.slipstreamMs ?? 0 },
        d,
        race.drivers,
        ms,
      );
      // Zero is stored as absent, so a kart that never drafts keeps its old shape.
      d.draftMs = draft.draftMs || undefined;
      d.slipstreamMs = draft.slipstreamMs || undefined;
    }
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
  const projection = park
    ? parkRoute.progress(d.x, d.z)
    : imported
      ? importedTrackProgress(d.x, d.z)
      : undefined;
  const lapLength = park ? parkRoute.lapLength : imported ? importedLapLength : tau;
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
  const laps = race?.laps ?? 1,
    done = d.lapsDone ?? 0;
  d.angle = lap.angle;
  d.distance = lap.distance;
  d.checkpoint = lap.checkpoint;
  // Whole-race progress, so standings, homing and nearby karts compare across laps.
  d.progress = (done + lap.progress) / laps;
  if (
    version === "arcade-v2" &&
    lap.safeProgress &&
    !d.physics?.contact &&
    !(d.physics?.height ?? 0) &&
    (!polyline || surfaceAt(d.x, d.z) === "road") &&
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
  if (lap.finished && done + 1 < laps) {
    // A new lap: gates start again and recovery restarts from this line,
    // so returning to an earlier safe point can never count the lap twice.
    d.lapsDone = done + 1;
    d.lapTimes = [...(d.lapTimes ?? []), elapsed];
    d.checkpoint = 0;
    d.distance = lap.distance - lapLength;
    d.progress = d.lapsDone / laps;
    if (race?.recapVersion === 1)
      d.lap = { crossingsMs: [], recoveries: d.lap?.recoveries ?? 0 };
    d.lastSafe = {
      x: d.x,
      z: d.z,
      heading: d.heading,
      angle: d.angle,
      distance: d.distance,
      checkpoint: 0,
      progress: d.progress,
    };
  } else if (lap.finished) {
    d.status = "FINISHED";
    // The finish time is the whole race.
    d.lapTimeMs = elapsed;
    d.speed = 0;
    if (laps > 1) d.lapTimes = [...(d.lapTimes ?? []), elapsed];
  }
}

/** 0 for the leader, 1 for last, by whole-race progress among karts still racing. */
function kartStanding(race: KartRace, driver: Driver): number {
  const racing = race.drivers.filter((d) => d.status === "RACING");
  if (racing.length < 2) return 0;
  const ahead =
    race.drivers.filter((d) => d.status === "FINISHED").length +
    racing.filter((d) => d !== driver && d.progress > driver.progress).length;
  return Math.min(1, ahead / (race.drivers.length - 1));
}

export function kartStandings(race: KartRace, points: number) {
  const sorted = [...race.drivers].sort((a, b) => {
    if (a.status === "FINISHED" && b.status !== "FINISHED") return -1;
    if (b.status === "FINISHED" && a.status !== "FINISHED") return 1;
    return a.status === "FINISHED"
      ? a.lapTimeMs! - b.lapTimeMs!
      : b.progress - a.progress;
  });
  const tied = (a: Driver, b: Driver) =>
    a.status === b.status &&
    a.lapTimeMs === b.lapTimeMs &&
    (a.status === "FINISHED" || a.progress === b.progress);
  // CPU karts take places on the track; points are shared by guest rank only.
  const guests = sorted.filter((d) => !d.cpu);
  const guestPlace = new Map<string, number>();
  guests.forEach((d, i) => {
    const previous = guests[i - 1];
    guestPlace.set(
      d.playerId,
      previous && tied(d, previous) ? guestPlace.get(previous.playerId)! : i + 1,
    );
  });
  let place = 1;
  return sorted.map((d, i) => {
    const previous = sorted[i - 1];
    if (previous && !tied(d, previous)) place = i + 1;
    return {
      playerId: d.playerId,
      name: d.name,
      timeMs: d.lapTimeMs,
      finished: d.status === "FINISHED",
      place,
      points:
        d.status === "FINISHED" && !d.cpu
          ? Math.round(
              (points * (guests.length - guestPlace.get(d.playerId)! + 1)) /
                guests.length,
            )
          : 0,
      ...(d.cpu ? { cpu: true as const } : {}),
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
    ...(race.laps && race.laps > 1 ? { laps: race.laps } : {}),
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
            boxes: (race.trackId === parkTrackId
              ? parkItemBoxes
              : race.trackId === importedTrackId
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
        lapsDone,
        lapTimes,
        draftMs,
        slipstreamMs,
        cpu,
      }) => ({
        playerId,
        name,
        ...(cpu ? { cpu: true as const } : {}),
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
        ...(race.laps && race.laps > 1
          ? {
              lap: Math.min(race.laps, (lapsDone ?? 0) + 1),
              ...(lapTimes?.length ? { lapsMs: lapTimes } : {}),
            }
          : {}),
        ...(status === "RACING" &&
        slipstreamPhase({
          draftMs: draftMs ?? 0,
          slipstreamMs: slipstreamMs ?? 0,
        })
          ? {
              slipstream: slipstreamPhase({
                draftMs: draftMs ?? 0,
                slipstreamMs: slipstreamMs ?? 0,
              }),
            }
          : {}),
        driftCharge: status === "RACING" ? Math.min(1, driftMs / 700) : 0,
        driftChargeMs: status === "RACING" ? Math.min(2400, driftMs) : 0,
        boostRemainingMs: status === "RACING" ? Math.floor(boostMs) : 0,
        drifting: status === "RACING" && wasDrifting,
        driftLevel: status === "RACING" ? drivingDriftLevel(driftMs) : 0,
        boostLevel: status === "RACING" && boostMs > 0 ? physics?.boostLevel || 1 : 0,
        height: round(physics?.height ?? 0, 3),
        wrongWay:
          status === "RACING" &&
          (race.trackId === parkTrackId
            ? parkWrongWay
            : race.trackId === importedTrackId
              ? importedWrongWay
              : wrongWayVelocity)(
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
function parkWrongWay(x: number, z: number, vx: number, vz: number) {
  const p = parkRoute.progress(x, z);
  return (
    Math.hypot(vx, vz) > 0.5 &&
    vx * Math.cos(p.heading) + vz * Math.sin(p.heading) < -0.5
  );
}
function gridSlot(i: number, track: KartTrackId) {
  const behind = 1.5 + Math.floor(i / 5) * 3;
  if (track === parkTrackId) {
    const pose = parkLanePoint(-behind, ((i % 5) - 2) * 4);
    return {
      ...pose,
      angle: parkRoute.progress(pose.x, pose.z).along,
      distance: -behind,
    };
  }
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

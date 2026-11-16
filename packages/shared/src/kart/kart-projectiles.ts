import { sweepKartWall, type Wall } from "./kart-driving.ts";
import {
  applyKartItemHit,
  kartItemSchema,
  kartProjectileKinds,
  type KartPowers,
} from "./kart-powers.ts";
import { selectKartTarget, type KartTarget } from "./kart-targeting.ts";
import { importedTrackPoint, importedTrackProgress } from "./kart-route.ts";
import { parkRoute, parkTrackId } from "./kart-park.ts";
import { z } from "zod";

export const kartProjectileKindSchema = z.enum(kartProjectileKinds);
export type KartProjectileKind = z.infer<typeof kartProjectileKindSchema>;
export const kartProjectileTuning = {
  capacity: 64,
  history: 20,
  stepMs: 20,
  tennisSpeed: 35,
  homingSpeed: 28,
  radius: 0.6,
  lifeMs: 6000,
  ownerGraceMs: 750,
  bombArmMs: 500,
  bombFuseMs: 1500,
  blastRadius: 6,
  maxBounces: 4,
  heightClearance: 1.5,
} as const;
const actorIdSchema = z.string().min(1).max(120);
const projectileIdSchema = z.string().regex(/^projectile-[1-9][0-9]{0,15}$/);
const activeMsSchema = z.number().int().min(0).max(180000);
export const kartProjectileSchema = z
  .object({
    id: projectileIdSchema,
    kind: kartProjectileKindSchema,
    owner: actorIdSchema,
    x: z.number().finite(),
    z: z.number().finite(),
    vx: z.number().finite(),
    vz: z.number().finite(),
    height: z.number().finite().nonnegative(),
    createdAt: activeMsSchema,
    expiresAt: z.number().int().min(1).max(186000),
    armedAt: z.number().int().min(0).max(180500),
    bounces: z.number().int().min(0).max(kartProjectileTuning.maxBounces),
    hitPlayers: z.array(actorIdSchema).max(100),
    targetId: actorIdSchema.optional(),
  })
  .strict();
export const kartProjectilePoseSchema = kartProjectileSchema.pick({
  id: true,
  kind: true,
  x: true,
  z: true,
  height: true,
  createdAt: true,
});
export type KartProjectile = z.infer<typeof kartProjectileSchema>;
export type KartProjectilePose = z.infer<typeof kartProjectilePoseSchema>;
export const kartProjectileEventSchema = z
  .object({
    eventId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    kind: z.enum([
      "launch",
      "bounce",
      "hit",
      "shield",
      "explode",
      "expire",
      "clear",
      "use",
      "collect",
      "spawning",
    ]),
    atMs: activeMsSchema,
    projectileId: z.union([projectileIdSchema, z.literal("all")]),
    playerId: actorIdSchema.optional(),
    item: kartItemSchema.optional(),
  })
  .strict();
export type KartProjectileEvent = z.infer<typeof kartProjectileEventSchema>;
export const kartProjectileWorldSchema = z
  .object({
    version: z.literal(1),
    elapsedMs: activeMsSchema,
    sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    eventSequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    spawning: z.boolean(),
    projectiles: z.array(kartProjectileSchema).max(kartProjectileTuning.capacity),
    history: z.array(kartProjectileEventSchema).max(kartProjectileTuning.history),
  })
  .strict()
  .superRefine((world, ctx) => {
    const ids = new Set<string>();
    for (const item of world.projectiles) {
      if (
        ids.has(item.id) ||
        Number(item.id.slice(11)) > world.sequence ||
        item.createdAt > world.elapsedMs ||
        item.expiresAt <= item.createdAt ||
        item.armedAt < item.createdAt ||
        new Set(item.hitPlayers).size !== item.hitPlayers.length ||
        (item.kind === "homing" && !item.targetId)
      )
        ctx.addIssue({
          code: "custom",
          path: ["projectiles"],
          message: "Inconsistent saved projectile",
        });
      ids.add(item.id);
    }
    let eventId = 0;
    for (const event of world.history) {
      if (
        event.eventId <= eventId ||
        event.eventId > world.eventSequence ||
        event.atMs > world.elapsedMs
      )
        ctx.addIssue({
          code: "custom",
          path: ["history"],
          message: "Inconsistent saved item history",
        });
      eventId = event.eventId;
    }
  });
export type KartProjectileWorld = z.infer<typeof kartProjectileWorldSchema>;
/** Parse only at a restore/storage boundary, never in the 20ms simulation loop. */
export function restoreKartProjectiles(value: unknown): KartProjectileWorld {
  return kartProjectileWorldSchema.parse(value);
}
export function projectKartProjectiles(
  world: KartProjectileWorld,
): KartProjectilePose[] {
  return world.projectiles.map(({ id, kind, x, z, height, createdAt }) => ({
    id,
    kind,
    x,
    z,
    height,
    createdAt,
  }));
}
export type KartProjectileActor = KartTarget & {
  x: number;
  z: number;
  heading: number;
  height: number;
  power: KartPowers;
  previous?: { x: number; z: number; height: number };
};
export type KartProjectileContext = {
  trackId: "party-ring-v1" | "mario-circuit-v1" | typeof parkTrackId;
  walls: (x: number, z: number, padding: number) => readonly Wall[];
};
export const createKartProjectiles = (): KartProjectileWorld => ({
  version: 1,
  elapsedMs: 0,
  sequence: 0,
  eventSequence: 0,
  spawning: true,
  projectiles: [],
  history: [],
});
function record(
  world: KartProjectileWorld,
  event: Omit<KartProjectileEvent, "eventId">,
) {
  const accepted = { ...event, eventId: ++world.eventSequence };
  world.history = [...world.history, accepted].slice(-kartProjectileTuning.history);
  return accepted;
}
function copy(world: KartProjectileWorld): KartProjectileWorld {
  return {
    ...world,
    projectiles: world.projectiles.map((item) => ({
      ...item,
      hitPlayers: [...item.hitPlayers],
    })),
    history: [...world.history],
  };
}
export { copy as copyKartProjectiles };
export function noteKartItemEvent(
  world: KartProjectileWorld,
  event: Omit<KartProjectileEvent, "eventId">,
) {
  const next = { ...world, history: [...world.history] };
  record(next, event);
  return next;
}
function firstWall(
  from: { x: number; z: number },
  dx: number,
  dz: number,
  context: KartProjectileContext,
  radius: number,
) {
  let first: ReturnType<typeof sweepKartWall>;
  for (const wall of context.walls(from.x, from.z, Math.hypot(dx, dz) + radius)) {
    const hit = sweepKartWall(from.x, from.z, dx, dz, wall, radius);
    if (hit && (!first || hit.t < first.t)) first = hit;
  }
  return first;
}
export function launchKartProjectile(
  world: KartProjectileWorld,
  kind: KartProjectileKind,
  owner: KartProjectileActor,
  actors: readonly KartProjectileActor[],
  context: KartProjectileContext,
) {
  const refuse = (
    reason: "disabled" | "capacity" | "owner" | "target" | "blocked",
  ) => ({ world, accepted: false as const, reason });
  if (!world.spawning) return refuse("disabled");
  if (world.projectiles.length >= kartProjectileTuning.capacity)
    return refuse("capacity");
  if (
    !["tennis", "bomb", "homing"].includes(kind) ||
    owner.status !== "RACING" ||
    owner.height < 0 ||
    ![owner.x, owner.z, owner.heading, owner.height, owner.progress].every(
      Number.isFinite,
    ) ||
    actors.length > 100 ||
    !actors.some((actor) => actor.playerId === owner.playerId)
  )
    return refuse("owner");
  const targetId = kind === "homing" ? selectKartTarget(owner, actors) : undefined;
  if (kind === "homing" && !targetId) return refuse("target");
  const direction = kind === "bomb" ? -3 : 2;
  const dx = Math.cos(owner.heading) * direction,
    dz = Math.sin(owner.heading) * direction;
  if (firstWall(owner, dx, dz, context, kartProjectileTuning.radius))
    return refuse("blocked");
  const now = world.elapsedMs,
    next = copy(world),
    speed =
      kind === "bomb"
        ? 0
        : kind === "tennis"
          ? kartProjectileTuning.tennisSpeed
          : kartProjectileTuning.homingSpeed;
  const projectile: KartProjectile = {
    id: `projectile-${++next.sequence}`,
    kind,
    owner: owner.playerId,
    x: owner.x + dx,
    z: owner.z + dz,
    vx: Math.cos(owner.heading) * speed,
    vz: Math.sin(owner.heading) * speed,
    height: kind === "bomb" ? 0.7 : owner.height + 0.7,
    createdAt: now,
    expiresAt:
      now +
      (kind === "bomb"
        ? kartProjectileTuning.bombFuseMs + kartProjectileTuning.stepMs
        : kartProjectileTuning.lifeMs),
    armedAt: now + (kind === "bomb" ? kartProjectileTuning.bombArmMs : 0),
    bounces: 0,
    hitPlayers: [],
    ...(targetId ? { targetId } : {}),
  };
  next.projectiles.push(projectile);
  record(next, {
    kind: "launch",
    atMs: now,
    projectileId: projectile.id,
    playerId: owner.playerId,
    item: kind,
  });
  return { world: next, accepted: true as const, reason: undefined };
}
export function clearKartProjectiles(world: KartProjectileWorld) {
  if (!world.projectiles.length) return world;
  const next = { ...world, projectiles: [] };
  record(next, { kind: "clear", atMs: world.elapsedMs, projectileId: "all" });
  return next;
}
export function setKartProjectileSpawning(
  world: KartProjectileWorld,
  enabled: boolean,
) {
  if (typeof enabled !== "boolean") throw new TypeError("Choose item spawning");
  return enabled === world.spawning ? world : { ...world, spawning: enabled };
}
function hitTime(
  item: KartProjectile,
  from: { x: number; z: number },
  actor: KartProjectileActor,
) {
  const previous = actor.previous ?? actor;
  const x = from.x - previous.x,
    z = from.z - previous.z;
  if (Math.hypot(x, z) <= 1.6) return 0;
  return sweepKartWall(
    x,
    z,
    item.x - from.x - (actor.x - previous.x),
    item.z - from.z - (actor.z - previous.z),
    { ax: 0, az: 0, bx: 0, bz: 0 },
    1.6,
  )?.t;
}
function steerHoming(
  item: KartProjectile,
  target: KartProjectileActor,
  context: KartProjectileContext,
  dt: number,
) {
  let aim = { x: target.x, z: target.z };
  if (Math.hypot(target.x - item.x, target.z - item.z) > 10) {
    if (context.trackId === parkTrackId) {
      aim = parkRoute.point(parkRoute.progress(item.x, item.z).along + 8);
    } else if (context.trackId === "mario-circuit-v1") {
      const along = importedTrackProgress(item.x, item.z).along;
      aim = importedTrackPoint(along + 8);
    } else {
      const angle = Math.atan2(item.z, item.x) + 8 / 42;
      aim = { x: Math.cos(angle) * 42, z: Math.sin(angle) * 42 };
    }
  }
  const heading = Math.atan2(item.vz, item.vx),
    wanted = Math.atan2(aim.z - item.z, aim.x - item.x);
  const delta = Math.atan2(Math.sin(wanted - heading), Math.cos(wanted - heading));
  const next = heading + Math.max(-3 * dt, Math.min(3 * dt, delta));
  item.vx = Math.cos(next) * kartProjectileTuning.homingSpeed;
  item.vz = Math.sin(next) * kartProjectileTuning.homingSpeed;
}

/** One existing active simulation step. No wall clock, per-object timers or scores.
 * Returns updated powers for callers to merge into their existing driver state.
 */
export function stepKartProjectiles(
  world: KartProjectileWorld,
  actors: readonly KartProjectileActor[],
  toMs: number,
  context: KartProjectileContext,
) {
  if (
    !Number.isSafeInteger(toMs) ||
    toMs < world.elapsedMs ||
    toMs > 180000 ||
    toMs - world.elapsedMs > kartProjectileTuning.stepMs ||
    actors.length > 100
  )
    throw new RangeError("Items require one bounded active step");
  if (toMs === world.elapsedMs)
    return { world, actors, hits: [] as KartProjectileEvent[] };
  const next = copy(world),
    dt = (toMs - world.elapsedMs) / 1000;
  const updated = actors.map((actor) => ({ ...actor })),
    hits: KartProjectileEvent[] = [];
  next.elapsedMs = toMs;
  const affect = (item: KartProjectile, actor: KartProjectileActor) => {
    item.hitPlayers.push(actor.playerId);
    const outcome = applyKartItemHit(actor.power, toMs);
    actor.power = outcome.powers;
    if (outcome.hit || outcome.absorbed) {
      const event: Omit<KartProjectileEvent, "eventId"> = {
        kind: outcome.absorbed ? "shield" : "hit",
        atMs: toMs,
        projectileId: item.id,
        playerId: actor.playerId,
      };
      hits.push(record(next, event));
    }
  };
  next.projectiles = next.projectiles.filter((item) => {
    const eligible = (actor: KartProjectileActor) =>
      actor.status === "RACING" &&
      !item.hitPlayers.includes(actor.playerId) &&
      (actor.playerId !== item.owner ||
        toMs - item.createdAt >= kartProjectileTuning.ownerGraceMs);
    if (
      item.kind === "bomb" &&
      toMs >= item.createdAt + kartProjectileTuning.bombFuseMs
    ) {
      record(next, { kind: "explode", atMs: toMs, projectileId: item.id });
      for (const actor of updated)
        if (
          eligible(actor) &&
          Math.abs(actor.height + 0.7 - item.height) <=
            kartProjectileTuning.heightClearance &&
          Math.hypot(actor.x - item.x, actor.z - item.z) <=
            kartProjectileTuning.blastRadius &&
          !firstWall(item, actor.x - item.x, actor.z - item.z, context, 0.01)
        )
          affect(item, actor);
      return false;
    }
    if (item.expiresAt <= toMs) {
      record(next, { kind: "expire", atMs: toMs, projectileId: item.id });
      return false;
    }
    if (item.kind === "bomb") return true;
    if (item.kind === "homing") {
      const target = updated.find(
        (actor) => actor.playerId === item.targetId && actor.status === "RACING",
      );
      if (!target) {
        record(next, { kind: "expire", atMs: toMs, projectileId: item.id });
        return false;
      }
      steerHoming(item, target, context, dt);
    }
    const from = { x: item.x, z: item.z },
      dx = item.vx * dt,
      dz = item.vz * dt;
    const wall = firstWall(from, dx, dz, context, kartProjectileTuning.radius);
    const fraction = wall?.t ?? 1;
    item.x += dx * fraction;
    item.z += dz * fraction;
    const intended = { ...item, x: from.x + dx, z: from.z + dz };
    const candidates = updated
      .filter(eligible)
      .map((actor) => ({ actor, t: hitTime(intended, from, actor) }))
      .filter(
        (candidate): candidate is { actor: KartProjectileActor; t: number } =>
          candidate.t !== undefined &&
          candidate.t <= fraction &&
          (() => {
            const previous = candidate.actor.previous ?? candidate.actor,
              t = candidate.t;
            const at = { x: from.x + dx * t, z: from.z + dz * t };
            return (
              Math.abs(
                previous.height +
                  (candidate.actor.height - previous.height) * t +
                  0.7 -
                  item.height,
              ) <= kartProjectileTuning.heightClearance &&
              !firstWall(
                at,
                previous.x + (candidate.actor.x - previous.x) * t - at.x,
                previous.z + (candidate.actor.z - previous.z) * t - at.z,
                context,
                0.01,
              )
            );
          })(),
      )
      .sort((a, b) => a.t - b.t || a.actor.number - b.actor.number);
    for (const candidate of candidates) {
      affect(item, candidate.actor);
      if (item.kind === "homing") return false;
    }
    if (wall) {
      if (item.kind === "homing" || ++item.bounces > kartProjectileTuning.maxBounces) {
        record(next, { kind: "expire", atMs: toMs, projectileId: item.id });
        return false;
      }
      const dot = item.vx * wall.nx + item.vz * wall.nz;
      item.vx -= 2 * dot * wall.nx;
      item.vz -= 2 * dot * wall.nz;
      item.x += wall.nx * 0.001;
      item.z += wall.nz * 0.001;
      record(next, { kind: "bounce", atMs: toMs, projectileId: item.id });
    }
    return true;
  });
  return { world: next, actors: updated, hits };
}

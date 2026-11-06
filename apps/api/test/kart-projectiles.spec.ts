import { expect, it } from "vitest";
import {
  createKartProjectiles,
  launchKartProjectile,
  stepKartProjectiles,
  clearKartProjectiles,
  setKartProjectileSpawning,
  createKartPowers,
  applyKartItemHit,
  type KartProjectileActor,
  type KartProjectileContext,
  type KartProjectileWorld,
  type KartProjectileKind,
  restoreKartProjectiles,
  projectKartProjectiles,
  kartProjectilePoseSchema,
} from "@26/shared";
const empty: KartProjectileContext = { trackId: "party-ring-v1", walls: () => [] };
function actor(playerId = "a", x = 0, z = 0, number = 1): KartProjectileActor {
  return {
    playerId,
    number,
    status: "RACING",
    progress: number / 10,
    x,
    z,
    heading: 0,
    height: 0,
    power: createKartPowers(),
  };
}
function launch(
  kind: KartProjectileKind,
  actors: KartProjectileActor[],
  context = empty,
) {
  const result = launchKartProjectile(
    createKartProjectiles(),
    kind,
    actors[0]!,
    actors,
    context,
  );
  expect(result.accepted).toBe(true);
  return result.world;
}
function advance(
  world: KartProjectileWorld,
  actors: readonly KartProjectileActor[],
  target: number,
  context = empty,
) {
  let state = {
    world,
    actors,
    hits: [] as ReturnType<typeof stepKartProjectiles>["hits"],
  };
  while (state.world.elapsedMs < target) {
    const next = stepKartProjectiles(
      state.world,
      state.actors,
      Math.min(target, state.world.elapsedMs + 20),
      context,
    );
    state = { ...next, hits: [...state.hits, ...next.hits] };
  }
  return state;
}
it("caps spawning before any inventory/power change and bounds persisted history", () => {
  const actors = [actor()];
  let world = createKartProjectiles();
  for (let i = 0; i < 64; i++)
    world = launchKartProjectile(world, "tennis", actors[0]!, actors, empty).world;
  const full = launchKartProjectile(world, "bomb", actors[0]!, actors, empty);
  expect(full).toMatchObject({ accepted: false, reason: "capacity" });
  expect(full.world).toBe(world);
  expect(world.projectiles).toHaveLength(64);
  expect(world.history).toHaveLength(20);
  expect(new Set(world.history.map((event) => event.eventId)).size).toBe(20);
  expect(actors[0]!.power).toEqual(createKartPowers());
  expect(
    launchKartProjectile(
      setKartProjectileSpawning(world, false),
      "bomb",
      actors[0]!,
      actors,
      empty,
    ).reason,
  ).toBe("disabled");
  const cleared = clearKartProjectiles(world);
  expect(cleared.projectiles).toEqual([]);
  expect(cleared.history.at(-1)?.kind).toBe("clear");
  expect(world.projectiles).toHaveLength(64);
  expect(clearKartProjectiles(cleared)).toBe(cleared);
});
it("sweeps tennis hits once per target and keeps prior world/actors immutable", () => {
  const actors = [actor(), actor("b", 6, 0, 2)],
    world = launch("tennis", actors);
  const before = JSON.stringify({ world, actors });
  const next = advance(world, actors, 200);
  expect(next.hits.filter((hit) => hit.playerId === "b")).toHaveLength(1);
  expect(next.actors[1]!.power.slowedUntil).toBeGreaterThan(200);
  expect(next.world.projectiles[0]!.hitPlayers).toContain("b");
  expect(JSON.stringify({ world, actors })).toBe(before);
});
it("sweeps a moving target, checks height at impact and separates airborne racers", () => {
  const actors = [
    actor(),
    { ...actor("b", 2.4, 3, 2), previous: { x: 2.4, z: -3, height: 0 } },
  ];
  const world = launch("tennis", actors);
  expect(
    stepKartProjectiles(world, actors, 20, empty).hits.some(
      (hit) => hit.playerId === "b",
    ),
  ).toBe(true);
  const airborne = [
    actors[0]!,
    { ...actors[1]!, height: 4, previous: { x: 2.4, z: -3, height: 4 } },
  ];
  expect(stepKartProjectiles(world, airborne, 20, empty).hits).toEqual([]);
});
it("reuses swept walls for bounce, launch clearance and blast occlusion", () => {
  const context: KartProjectileContext = {
    ...empty,
    walls: () => [{ ax: 5, az: -20, bx: 5, bz: 20 }],
  };
  const actors = [actor(), actor("b", 6, 0, 2)];
  const next = advance(launch("tennis", actors, context), actors, 200, context);
  expect(next.world.history.some((event) => event.kind === "bounce")).toBe(true);
  expect(next.hits).toEqual([]);
  expect(next.world.projectiles[0]!.vx).toBeLessThan(0);
  expect(
    launchKartProjectile(createKartProjectiles(), "tennis", actors[0]!, actors, {
      ...empty,
      walls: () => [{ ax: 1, az: -5, bx: 1, bz: 5 }],
    }).reason,
  ).toBe("blocked");
  const bombActors = [actor(), actor("b", -6, 0, 2)];
  const wall: KartProjectileContext = {
    ...empty,
    walls: () => [{ ax: -4, az: -20, bx: -4, bz: 20 }],
  };
  const bomb = advance(launch("bomb", bombActors, wall), bombActors, 1500, wall);
  expect(bomb.hits.some((hit) => hit.playerId === "b")).toBe(false);
});
it("arms a visible bomb fuse on active time and resolves shields/simultaneous damage once", () => {
  const actors = [actor(), actor("b", -3, 0, 2)];
  actors[1]!.power.shieldUntil = 5000;
  let world = launch("bomb", actors);
  world = launchKartProjectile(world, "bomb", actors[0]!, actors, empty).world;
  const waiting = advance(world, actors, 1480);
  expect(waiting.hits).toEqual([]);
  expect(waiting.world.projectiles).toHaveLength(2);
  expect(waiting.world.projectiles[0]!.armedAt).toBe(500);
  const blast = advance(waiting.world, waiting.actors, 1500);
  expect(blast.world.projectiles).toEqual([]);
  expect(blast.hits.filter((hit) => hit.playerId === "b")).toEqual([
    expect.objectContaining({ kind: "shield" }),
  ]);
  expect(blast.actors[1]!.power.shieldUntil).toBe(0);
  expect(blast.actors[1]!.power.slowedUntil).toBe(0);
});
it("enforces owner grace, finished-target refusal and departure cleanup", () => {
  const actors = [actor(), actor("b", 12, 0, 2)];
  const world = launch("tennis", actors);
  world.projectiles[0]!.x = 0;
  world.projectiles[0]!.vx = 0;
  expect(advance(world, actors, 740).hits).toEqual([]);
  expect(
    advance(world, actors, 760).hits.filter((hit) => hit.playerId === "a"),
  ).toHaveLength(1);
  const homing = launch("homing", actors);
  expect(homing.projectiles[0]!.targetId).toBe("b");
  expect(
    stepKartProjectiles(homing, [actors[0]!], 20, empty).world.projectiles,
  ).toEqual([]);
  const finished = [actors[0]!, { ...actors[1]!, status: "FINISHED" as const }];
  expect(stepKartProjectiles(homing, finished, 20, empty).hits).toEqual([]);
  expect(
    launchKartProjectile(createKartProjectiles(), "homing", actors[0]!, finished, empty)
      .reason,
  ).toBe("target");
});
it("steers homing along both public routes at bounded speed and stops at barriers", () => {
  const actors = [actor(), actor("b", 6, 0, 2)];
  const wall: KartProjectileContext = {
    ...empty,
    walls: () => [{ ax: 5, az: -20, bx: 5, bz: 20 }],
  };
  const stopped = advance(launch("homing", actors, wall), actors, 200, wall);
  expect(stopped.world.projectiles).toEqual([]);
  expect(stopped.hits).toEqual([]);
  for (const trackId of ["party-ring-v1", "mario-circuit-v1"] as const) {
    const owner = {
      ...actor(),
      x: trackId === "party-ring-v1" ? 42 : 0,
      heading: trackId === "party-ring-v1" ? Math.PI / 2 : -Math.PI / 2,
    };
    const target = { ...actor("b", trackId === "party-ring-v1" ? -42 : 175, -69, 2) };
    const context = { ...empty, trackId };
    const world = launch("homing", [owner, target], context);
    const next = stepKartProjectiles(world, [owner, target], 20, context).world
      .projectiles[0]!;
    expect(Math.hypot(next.vx, next.vz)).toBeCloseTo(28, 8);
    const change = Math.atan2(
      Math.sin(Math.atan2(next.vz, next.vx) - owner.heading),
      Math.cos(Math.atan2(next.vz, next.vx) - owner.heading),
    );
    expect(Math.abs(change)).toBeLessThanOrEqual(0.060000001);
    expect(
      trackId === "party-ring-v1"
        ? next.z > world.projectiles[0]!.z
        : next.z < world.projectiles[0]!.z,
    ).toBe(true);
  }
});
it("replays pause/serialisation exactly, expires objects and refuses oversized simulation steps", () => {
  const actors = [actor(), actor("b", 42, 30, 2)],
    world = launch("tennis", actors);
  expect(stepKartProjectiles(world, actors, 0, empty).world).toBe(world);
  expect(advance(world, actors, 200)).toEqual(
    advance(JSON.parse(JSON.stringify(world)), JSON.parse(JSON.stringify(actors)), 200),
  );
  expect(advance(world, actors, 6000).world.projectiles).toEqual([]);
  expect(() => stepKartProjectiles(world, actors, 21, empty)).toThrow(RangeError);
  expect(() => stepKartProjectiles(world, actors, NaN, empty)).toThrow(RangeError);
});
it("validates saved worlds and resumes the same simulation without exposing private fields", () => {
  const actors = [actor(), actor("b", 12, 0, 2)];
  const state = advance(launch("homing", actors), actors, 200);
  const restored = restoreKartProjectiles(JSON.parse(JSON.stringify(state.world)));
  expect(advance(restored, state.actors, 400)).toEqual(
    advance(state.world, state.actors, 400),
  );
  const poses = projectKartProjectiles(restored);
  expect(poses).toHaveLength(restored.projectiles.length);
  expect(kartProjectilePoseSchema.parse(poses[0])).toEqual(poses[0]);
  for (const pose of poses) {
    expect(pose).not.toHaveProperty("owner");
    expect(pose).not.toHaveProperty("targetId");
    expect(pose).not.toHaveProperty("hitPlayers");
  }
  expect(kartProjectilePoseSchema.safeParse(restored.projectiles[0]).success).toBe(
    false,
  );
});
it("refuses oversized, corrupt, duplicate and incompatible saved worlds", () => {
  const actors = [actor(), actor("b", 12, 0, 2)],
    world = launch("tennis", actors);
  const invalid = [
    { ...world, version: 2 },
    { ...world, secret: "unexpected" },
    { ...world, elapsedMs: 180001 },
    {
      ...world,
      sequence: 65,
      projectiles: Array.from({ length: 65 }, (_, i) => ({
        ...world.projectiles[0]!,
        id: `projectile-${i + 1}`,
      })),
    },
    {
      ...world,
      eventSequence: 21,
      history: Array.from({ length: 21 }, (_, i) => ({
        ...world.history[0]!,
        eventId: i + 1,
      })),
    },
    { ...world, projectiles: [world.projectiles[0], world.projectiles[0]] },
    { ...world, history: [...world.history, ...world.history] },
    { ...world, eventSequence: 0 },
    { ...world, sequence: 0 },
    { ...world, projectiles: [{ ...world.projectiles[0]!, x: Infinity }] },
    { ...world, projectiles: [{ ...world.projectiles[0]!, hitPlayers: ["b", "b"] }] },
    {
      ...world,
      projectiles: [
        {
          ...world.projectiles[0]!,
          hitPlayers: Array.from({ length: 101 }, (_, i) => String(i)),
        },
      ],
    },
    { ...world, projectiles: [{ ...world.projectiles[0]!, owner: "x".repeat(121) }] },
  ];
  for (const value of invalid) expect(() => restoreKartProjectiles(value)).toThrow();
  const negative = { ...actors[0]!, height: -1 };
  expect(
    launchKartProjectile(createKartProjectiles(), "tennis", negative, [negative], empty)
      .accepted,
  ).toBe(false);
});
it("centralises short damage immunity without altering original powers by default", () => {
  const original = createKartPowers();
  original.turboUntil = 4000;
  const hit = applyKartItemHit(original, 1000);
  expect(hit.hit).toBe(true);
  expect(hit.powers.turboUntil).toBe(0);
  expect(applyKartItemHit(hit.powers, 1200).immune).toBe(true);
  expect(applyKartItemHit(hit.powers, 1300).hit).toBe(true);
  expect(original.turboUntil).toBe(4000);
  expect(original.damageUntil).toBeUndefined();
});

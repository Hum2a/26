import { expect, it } from "vitest";
import {
  createKartRace,
  createDrivingBody,
  createKartPowers,
  reduceKart,
  reduceKartTimeline,
  projectKartRace,
  kartItemRefusal,
  configureKartItems,
  kartItemRulesSchema,
  kartRaceSchema,
  kartPresentationV1Schema,
  launchKartProjectile,
  restoreKartProjectiles,
  kartNeutral,
  type KartRace,
  type KartItem,
} from "@26/shared";
function fixture() {
  const race = createKartRace(
    "expanded",
    [
      { playerId: "a", name: "Amina" },
      { playerId: "b", name: "Bilal" },
    ],
    {
      itemRules: {
        version: 2,
        allowed: ["turbo", "shield", "oil", "tennis", "bomb", "homing", "treat"],
      },
    },
  );
  race.drivers.forEach((d, index) => {
    Object.assign(d, {
      x: 42,
      z: index ? 8 : -8,
      heading: Math.PI / 2,
      angle: Math.atan2(index ? 8 : -8, 42),
      distance: (index ? 0.2 : 0.1) * Math.PI * 2,
      progress: index ? 0.2 : 0.1,
      checkpoint: index ? 1 : 0,
      power: createKartPowers(),
    });
    d.physics = createDrivingBody(d.x, d.z, d.heading);
  });
  return race;
}
function held(race: KartRace, item: KartItem) {
  race.drivers[0]!.power!.item = item;
  return reduceKart(race, { type: "use-power", playerId: "a" });
}
it("accepts fresh controls at the saved clock without moving or losing them before a later step", () => {
  const race = fixture();
  const input = { ...kartNeutral, raceId: race.raceId, sequence: 1, gas: true };
  const accepted = reduceKartTimeline(race, [{ playerId: "a", input, elapsed: 0 }], 0);
  expect(accepted.drivers[0]!.sequence).toBe(1);
  expect(accepted.drivers[0]!.input.gas).toBe(true);
  expect(accepted.drivers[0]!.z).toBe(race.drivers[0]!.z);
  expect(accepted.elapsedMs).toBe(0);
  expect(reduceKartTimeline(accepted, [], 200).drivers[0]!.z).toBeGreaterThan(
    accepted.drivers[0]!.z,
  );
});
it("uses personal treats once for600ms without dropping a collectible or changing score rules", () => {
  const race = fixture(),
    used = held(race, "treat");
  expect(used.drivers[0]!.power).toMatchObject({ item: null, turboUntil: 600 });
  expect(used.itemsWorld!.projectiles).toEqual([]);
  expect(used.oils).toEqual([]);
  expect(used.itemsWorld!.history.at(-1)).toMatchObject({
    kind: "use",
    item: "treat",
    playerId: "a",
  });
  expect(reduceKart(used, { type: "use-power", playerId: "a" })).toBe(used);
  expect(race.drivers[0]!.power!.item).toBe("treat");
});
it("advances authoritative projectile hits and existing driver powers on one active clock", () => {
  const race = fixture(),
    used = held(race, "tennis");
  expect(used.drivers[0]!.power!.item).toBeNull();
  expect(used.itemsWorld!.projectiles).toHaveLength(1);
  const next = reduceKartTimeline(used, [], 600);
  expect(next.drivers[1]!.power!.slowedUntil).toBeGreaterThan(600);
  expect(
    next.itemsWorld!.history.some((e) => e.kind === "hit" && e.playerId === "b"),
  ).toBe(true);
  expect(next.itemsWorld!.elapsedMs).toBe(next.elapsedMs);
  expect(restoreKartProjectiles(next.itemsWorld)).toEqual(next.itemsWorld);
});
it("does not consume hazards at capacity or when host spawning is off; personal effects remain usable", () => {
  let race = fixture();
  const actors = race.drivers.map((d) => ({
    playerId: d.playerId,
    number: d.number,
    status: d.status,
    progress: d.progress,
    x: d.x,
    z: d.z,
    heading: d.heading,
    height: 0,
    power: d.power!,
  }));
  for (let i = 0; i < 64; i++)
    race.itemsWorld = launchKartProjectile(
      race.itemsWorld!,
      "tennis",
      actors[0]!,
      actors,
      { trackId: "party-ring-v1", walls: () => [] },
    ).world;
  race.drivers[0]!.power!.item = "bomb";
  expect(kartItemRefusal(race, "a")).toMatch(/pool is full/);
  expect(reduceKart(race, { type: "use-power", playerId: "a" })).toBe(race);
  race = reduceKart(race, { type: "items-spawning", enabled: false });
  expect(kartItemRefusal(race, "a")).toMatch(/host has paused/);
  race = held(race, "treat");
  expect(race.drivers[0]!.power!.turboUntil).toBe(600);
  const clean = reduceKart(race, { type: "clear-items" });
  expect(clean.itemsWorld!.projectiles).toEqual([]);
  expect(clean.itemsWorld!.spawning).toBe(false);
});
it("keeps a homing item useful when nobody is ahead and respects active shields", () => {
  const alone = fixture();
  alone.drivers[1]!.status = "FINISHED";
  const boost = held(alone, "homing");
  expect(boost.drivers[0]!.power!.turboUntil).toBe(600);
  expect(boost.itemsWorld!.projectiles).toEqual([]);
  const shielded = fixture();
  shielded.drivers[1]!.power!.shieldUntil = 5000;
  const hit = reduceKartTimeline(held(shielded, "tennis"), [], 600);
  expect(hit.drivers[1]!.power!.shieldUntil).toBe(0);
  expect(hit.drivers[1]!.power!.slowedUntil).toBe(0);
});
it("preserves pause, serialisation and batched input replay without trusting late or foreign inputs", () => {
  const race = held(fixture(), "bomb");
  const events = [
    {
      playerId: "a",
      elapsed: 40,
      input: { ...kartNeutral, gas: true, raceId: race.raceId, sequence: 1 },
    },
  ];
  const first = reduceKartTimeline(race, events, 200);
  const released = reduceKart(first, { type: "release" });
  expect(released.itemsWorld!.elapsedMs).toBe(200);
  expect(released.itemsWorld!.projectiles[0]!.createdAt).toBe(0);
  expect(reduceKartTimeline(JSON.parse(JSON.stringify(first)), [], 400)).toEqual(
    reduceKartTimeline(race, events, 400),
  );
  expect(reduceKartTimeline(first, [{ ...events[0]!, elapsed: 100 }], 400)).toEqual(
    reduceKartTimeline(first, [], 400),
  );
});
it("projects only own expanded inventory and public poses while a legacy reader retains the base race", () => {
  const race = held(fixture(), "homing");
  race.drivers[0]!.power!.item = "treat";
  race.drivers[1]!.power!.item = "bomb";
  const phone = projectKartRace(race, "a", 100),
    stage = projectKartRace(race, null, 100);
  expect(phone.powers!.selfItem).toBeNull();
  expect(phone.presentation?.version).toBe(3);
  if (phone.presentation?.version !== 3 || stage.presentation?.version !== 3)
    throw new Error("Expanded presentation required");
  expect(phone.presentation.items.heldItem).toBe("treat");
  expect(stage.presentation.items.heldItem).toBeNull();
  const pose = phone.presentation.items.projectiles[0]!;
  for (const key of ["owner", "targetId", "hitPlayers"])
    expect(pose).not.toHaveProperty(key);
  const old = kartRaceSchema
    .omit({ presentation: true })
    .extend({ presentation: kartPresentationV1Schema.optional().catch(undefined) })
    .parse(phone);
  expect(old.presentation).toBeUndefined();
  expect(old.participants).toEqual(phone.participants);
});
it("validates frozen configuration and keeps original rules as the default", () => {
  expect(
    kartItemRulesSchema.safeParse({ version: 2, allowed: ["bomb", "bomb"] }).success,
  ).toBe(false);
  expect(
    kartItemRulesSchema.safeParse({ version: 2, allowed: ["invented"] }).success,
  ).toBe(false);
  const race = fixture(),
    configured = configureKartItems(race, { version: 2, allowed: [] });
  expect(configured.itemRules).toEqual({ version: 2, allowed: [] });
  expect(race.itemRules).not.toEqual(configured.itemRules);
  expect(() =>
    configureKartItems(reduceKartTimeline(race, [], 20), { version: 1 }),
  ).toThrow(/before/);
  const original = createKartRace("old", [{ playerId: "a", name: "Amina" }]);
  expect(original.itemRules).toBeUndefined();
  expect(projectKartRace(original, "a", 100).presentation?.version).not.toBe(3);
});

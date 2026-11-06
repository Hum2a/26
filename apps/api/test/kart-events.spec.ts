import { expect, it } from "vitest";
import {
  createKartRace,
  projectKartRace,
  readFreshKartEvents,
  kartPresentationSchema,
  kartRaceSchema,
  createDrivingBody,
  kartLookHistorySchema,
  kartContactHistorySchema,
  kartPresentationV1Schema,
  reduceKart,
  appendKartContactHistory,
  kartHandlingControlSchema,
  kartHandlingHistorySchema,
} from "@26/shared";

it("bounds optional handling metadata and private history while retaining original public driving contracts", () => {
  const race = createKartRace("handling-schema", [{ playerId: "a", name: "Amina" }], {
    handling: "bounce-v1",
  });
  race.drivers[0]!.physics = {
    ...createDrivingBody(),
    stunMs: 999,
    impactCooldownMs: 999,
  };
  const view = projectKartRace(race, "a", 100);
  if (view.presentation?.version !== 2)
    throw new Error("Self prediction metadata required");
  expect(view.presentation.handling).toEqual({
    preset: "bounce-v1",
    stunMs: 180,
    cooldownMs: 600,
  });
  for (const handling of [
    { preset: "unknown", stunMs: 0, cooldownMs: 0 },
    { preset: "bounce-v1", stunMs: 181, cooldownMs: 0 },
    { preset: "bounce-v1", stunMs: 0, cooldownMs: -1 },
    { preset: "bounce-v1", stunMs: 0, cooldownMs: 601 },
  ]) {
    const parsed = kartRaceSchema.parse({
      ...view,
      presentation: { ...view.presentation, handling },
    });
    expect(parsed.presentation).toBeUndefined();
    expect(parsed.participants).toEqual(view.participants);
  }
  expect(
    kartHandlingHistorySchema.safeParse(Array(21).fill({ atMs: 1, preset: "slide-v1" }))
      .success,
  ).toBe(false);
  expect(
    kartHandlingHistorySchema.safeParse([
      { atMs: 1, preset: "bounce-v1", secret: "no" },
    ]).success,
  ).toBe(false);
  expect(
    kartHandlingControlSchema.safeParse({
      next: "bounce-v1",
      current: "slide-v1",
      frozen: true,
    }).success,
  ).toBe(true);
  expect(
    kartHandlingControlSchema.safeParse({ next: "unknown", frozen: false }).success,
  ).toBe(false);
  const original = projectKartRace(
    createKartRace("original", [{ playerId: "a", name: "Amina" }]),
    "a",
    100,
  ).presentation;
  expect(original?.version === 2 && original.handling).toBeUndefined();
});
it("caps and sorts private history, preserves every driver's latest impact and bounds repeated wall pressure", () => {
  const race = createKartRace(
    "busy-contacts",
    Array.from({ length: 80 }, (_, i) => ({ playerId: `p${i}`, name: `Driver ${i}` })),
  );
  for (const driver of race.drivers) {
    driver.x = 49;
    driver.z = 0;
    driver.heading = 0;
    driver.physics = { ...createDrivingBody(49, 0, 0), vx: 100 };
  }
  const next = reduceKart(race, { type: "tick", elapsedMs: 200 });
  expect(next.contactHistory).toHaveLength(20);
  expect(next.contactHistory![0]!.number).toBe(61);
  expect(next.drivers.every((driver) => driver.lastImpact?.atMs === 20)).toBe(true);
  const own = projectKartRace(next, "p0", 100).presentation;
  expect(own?.version === 2 && own.contacts[0]?.playerId).toBe("p0");
  const entry = next.contactHistory![0]!;
  expect(appendKartContactHistory(next.contactHistory, entry)).toEqual(
    next.contactHistory,
  );
  const prepare = (state: typeof next) => {
    const driver = state.drivers[0]!;
    driver.x = 49;
    driver.z = 0;
    driver.heading = 0;
    driver.physics = { ...createDrivingBody(49, 0, 0), vx: 100 };
  };
  prepare(next);
  const early = reduceKart(next, { type: "tick", elapsedMs: 400 });
  expect(early.drivers[0]!.lastImpact?.atMs).toBe(20);
  prepare(early);
  const later = reduceKart(early, { type: "tick", elapsedMs: 600 });
  expect(later.drivers[0]!.lastImpact?.atMs).toBe(420);
  expect(later.contactHistory?.at(-1)?.atMs).toBe(420);
});
it("retains a short accepted impact after the contact flag clears, with bounded private history and self-only cosmetic metadata", () => {
  const race = createKartRace("short-impact", [
    { playerId: "a", name: "Driver" },
    { playerId: "b", name: "Other driver" },
  ]);
  const driver = race.drivers[0]!;
  driver.x = 49;
  driver.z = 0;
  driver.heading = 0;
  driver.physics = { ...createDrivingBody(49, 0, 0), vx: 100 };
  const before = structuredClone(race);
  const next = reduceKart(race, { type: "tick", elapsedMs: 200 });
  expect(race).toEqual(before);
  expect(next.drivers[0]!.physics!.contact).toBe(false);
  expect(next.contactHistory).toHaveLength(1);
  expect(next.contactHistory![0]).toMatchObject({
    playerId: "a",
    kind: "impact",
    atMs: 20,
  });
  const self = projectKartRace(next, "a", 100);
  expect(self.presentation?.version).toBe(2);
  if (self.presentation?.version !== 2) throw new Error("Contact metadata required");
  expect(self.presentation.contacts).toEqual([
    { eventId: 2001, atMs: 20, playerId: "a" },
  ]);
  expect(kartPresentationV1Schema.safeParse(self.presentation).success).toBe(false);
  expect(
    kartRaceSchema.parse({ ...self, presentation: { version: 999 } }).participants,
  ).toEqual(self.participants);
  const peer = projectKartRace(next, "b", 100);
  expect(peer.presentation?.version === 2 && peer.presentation.contacts).toEqual([]);
  expect(projectKartRace(next, null, 100).presentation).toBeUndefined();
  expect(JSON.stringify(self.presentation)).not.toMatch(
    /speed|history|physics|input|lastSafe|"x"|"z"/,
  );
  expect(
    kartContactHistorySchema.safeParse(Array(20).fill(next.contactHistory![0])).success,
  ).toBe(true);
  expect(
    kartContactHistorySchema.safeParse(Array(21).fill(next.contactHistory![0])).success,
  ).toBe(false);
  expect(
    kartContactHistorySchema.safeParse([{ ...next.contactHistory![0], secret: "no" }])
      .success,
  ).toBe(false);
  expect(reduceKart(next, { type: "tick", elapsedMs: 200 }).contactHistory).toEqual(
    next.contactHistory,
  );
  const recovered = reduceKart(next, { type: "recover", playerId: "a" });
  expect(recovered.contactHistory?.at(-1)?.kind).toBe("recovery");
  expect(reduceKart(recovered, { type: "recover", playerId: "a" })).toBe(recovered);
  const legacy = structuredClone(before);
  delete legacy.contactVersion;
  delete legacy.contactHistory;
  const old = reduceKart(legacy, { type: "tick", elapsedMs: 200 });
  expect(old.contactHistory).toBeUndefined();
  expect(projectKartRace(old, "a", 100).presentation).toBeUndefined();
});
it("projects only an optional accepted contact flag, while legacy public snapshots remain valid", () => {
  const race = createKartRace("contact", [{ playerId: "p", name: "Stand-in" }]);
  const old = projectKartRace(race, "p", 100);
  expect(old.participants[0]!.contact).toBeUndefined();
  expect(kartRaceSchema.parse(old)).toEqual(old);
  race.drivers[0]!.physics = { ...createDrivingBody(0, 0, 0), contact: true };
  const view = projectKartRace(race, "p", 100);
  expect(view.participants[0]!.contact).toBe(true);
  expect(JSON.stringify(view.participants[0])).not.toMatch(
    /inputUntil|sequence|lastSafe|credential/,
  );
});

it("keeps legacy looks absent, projects only a named choice and bounds private history", () => {
  const race = createKartRace("look", [{ playerId: "p", name: "Driver" }]);
  const legacy = projectKartRace(race, "p", 100);
  expect(legacy).not.toHaveProperty("look");
  expect(kartRaceSchema.parse(legacy)).toEqual(legacy);
  race.look = "race";
  race.lookHistory = [{ atMs: 1000, preset: "race" }];
  for (const player of ["p", null]) {
    const view = projectKartRace(race, player, 100);
    expect(view.look).toBe("race");
    expect(view).not.toHaveProperty("lookHistory");
    expect(JSON.stringify(view)).not.toContain('"atMs":1000');
    const future = kartRaceSchema.parse({ ...view, look: "future-look-v2" });
    expect(future.look).toBeUndefined();
    expect(future.participants).toEqual(view.participants);
  }
  expect(
    kartLookHistorySchema.safeParse(Array(20).fill(race.lookHistory[0])).success,
  ).toBe(true);
  expect(
    kartLookHistorySchema.safeParse(Array(21).fill(race.lookHistory[0])).success,
  ).toBe(false);
  for (const entry of [
    { atMs: -1, preset: "off" },
    { atMs: 1.5, preset: "off" },
    { atMs: Infinity, preset: "off" },
    { atMs: 1, preset: "unknown" },
    { atMs: 1, preset: "off", actorSecret: "private" },
  ])
    expect(kartLookHistorySchema.safeParse([entry]).success).toBe(false);
});

it("bounds public finish events and excludes inputs, inventories, credentials and personal data", () => {
  const race = createKartRace(
    "events",
    Array.from({ length: 80 }, (_, i) => ({ playerId: "p" + i, name: "Driver " + i })),
  );
  race.elapsedMs = 1000;
  race.ended = true;
  for (const driver of race.drivers) driver.status = "DNF";
  const view = projectKartRace(race, "p0", 100);
  expect(view.presentation?.events).toHaveLength(32);
  expect(Object.keys(view.presentation!.events[0]!).sort()).toEqual([
    "atMs",
    "eventId",
    "kind",
    "playerId",
    "status",
  ]);
  expect(JSON.stringify(view.presentation)).not.toMatch(
    /input|power|credential|secret|face|email/,
  );
  expect(projectKartRace(race, null, 100).presentation).toEqual(view.presentation);
});
it("rejects stale/unknown/oversize event contracts and deduplicates repeated and out-of-order frames", () => {
  const frame = (eventId: number) => ({
    version: 1,
    assetVersion: "kart-assets-v1",
    events: [{ eventId, atMs: 1, kind: "finish", playerId: "p", status: "FINISHED" }],
  });
  const first = readFreshKartEvents("race", frame(1), null);
  const empty = readFreshKartEvents("race", undefined, null);
  expect(readFreshKartEvents("race", frame(1), empty.cursor).events).toHaveLength(1);
  expect(first.events).toEqual([]);
  const next = readFreshKartEvents("race", frame(2), first.cursor);
  expect(next.events).toHaveLength(1);
  expect(readFreshKartEvents("race", frame(2), next.cursor).events).toEqual([]);
  expect(readFreshKartEvents("race", frame(1), next.cursor).cursor).toEqual(
    next.cursor,
  );
  expect(readFreshKartEvents("other", frame(3), next.cursor).events).toEqual([]);
  expect(
    readFreshKartEvents("race", { ...frame(3), version: 2 }, next.cursor).events,
  ).toEqual([]);
  expect(
    kartPresentationSchema.safeParse({
      ...frame(1),
      events: Array(33).fill(frame(1).events[0]),
    }).success,
  ).toBe(false);
  expect(kartPresentationSchema.safeParse({ ...frame(1), secret: "no" }).success).toBe(
    false,
  );
});

it("drops unsupported cosmetic metadata while preserving strict authoritative race validation", () => {
  const view = projectKartRace(
    createKartRace("legacy", [{ playerId: "p", name: "Driver" }]),
    "p",
    100,
  );
  const future = kartRaceSchema.parse({
    ...view,
    presentation: { version: 2, events: [] },
  });
  expect(future.presentation).toBeUndefined();
  expect(future.participants).toEqual(view.participants);
  expect(kartRaceSchema.safeParse({ ...view, elapsedMs: NaN }).success).toBe(false);
  expect(kartRaceSchema.safeParse({ ...view, privateControls: [] }).success).toBe(
    false,
  );
});

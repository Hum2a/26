import { expect, it } from "vitest";
import {
  createKartRace,
  projectKartRace,
  readFreshKartEvents,
  kartPresentationSchema,
  kartRaceSchema,
  createDrivingBody,
} from "@26/shared";
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

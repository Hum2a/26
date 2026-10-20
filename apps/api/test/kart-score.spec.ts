import { expect, it } from "vitest";
import {
  createKartRace,
  reduceKart,
  reduceKartTimeline,
  type KartTimedInput,
  kartStandings,
  projectKartRace,
  kartInputSchema,
  kartNeutral,
  type KartRace,
} from "@26/shared";
import { birthdayPack } from "../src/questions/packs/birthday/manifest.ts";
import { questionPreview } from "../src/room/question-preview.ts";
import { toPlayable } from "../src/questions/authoring.ts";
import { kartRehearsalVersion, questionFor } from "../src/questions/registry.ts";
import { validatePack } from "../src/questions/validate.ts";

const start = () =>
  createKartRace("race-1", [
    { playerId: "a", name: "Amina" },
    { playerId: "b", name: "Bilal" },
  ]);
function input(
  race: KartRace,
  id = "a",
  sequence = 1,
  controls = { ...kartNeutral, gas: true, steer: 0.2381 },
) {
  return reduceKart(race, {
    type: "input",
    playerId: id,
    value: { raceId: race.raceId, sequence, ...controls },
  });
}
it("requires finite normalised controls and rejects fabricated telemetry or identities", () => {
  const value = { raceId: "race-1", sequence: 1, ...kartNeutral };
  for (const patch of [
    { steer: NaN },
    { steer: 2 },
    { timeMs: 1 },
    { playerId: "b" },
    { checkpointHash: "win" },
  ])
    expect(kartInputSchema.safeParse({ ...value, ...patch }).success).toBe(false);
  const race = start(),
    first = input(race);
  expect(input(first, "a", 1, { ...kartNeutral, brake: true })).toBe(first);
  expect(input(race, "intruder")).toBe(race);
  expect(
    reduceKart(race, {
      type: "input",
      playerId: "a",
      value: { ...value, raceId: "old" },
    }),
  ).toBe(race);
  expect(race.drivers[0]!.speed).toBe(0);
});
it("finishes one clockwise lap through all gates, freezes its time and cuts off at 45 seconds", () => {
  let race = start();
  for (
    let elapsed = 0;
    elapsed < 45_000 && race.drivers[0]!.status === "RACING";
    elapsed += 100
  ) {
    race = input(race, "a", elapsed + 1);
    race = reduceKart(race, { type: "tick", elapsedMs: elapsed + 100 });
  }
  expect(race.drivers[0]!.status).toBe("FINISHED");
  expect(race.drivers[0]!.checkpoint).toBe(8);
  expect(race.drivers[0]!.lapTimeMs).toBeLessThanOrEqual(45_000);
  const time = race.drivers[0]!.lapTimeMs;
  race = reduceKart(race, { type: "tick", elapsedMs: 90_000 });
  expect(race.elapsedMs).toBe(45_000);
  expect(race.ended).toBe(true);
  expect(race.drivers[0]!.lapTimeMs).toBe(time);
  expect(race.drivers[1]!.status).toBe("DNF");
  expect(input(race)).toBe(race);
});
it("does not count the spawn line, reverse travel or a disconnected throttle as a completed lap", () => {
  let race = input(start(), "a", 1, { ...kartNeutral, brake: true });
  race = reduceKart(race, { type: "tick", elapsedMs: 45_000 });
  expect(race.drivers.every((d) => d.status === "DNF")).toBe(true);
  expect(race.drivers[0]!.checkpoint).toBe(0);
  const stopped = reduceKart(input(start()), { type: "tick", elapsedMs: 4000 });
  expect(Math.abs(stopped.drivers[0]!.speed)).toBeLessThan(0.01);
});
it("ranks finished times before DNFs, shares tied prizes and reveals no control internals", () => {
  const race = start();
  race.ended = true;
  race.drivers.forEach((d) => {
    d.status = "FINISHED";
    d.lapTimeMs = 30_000;
  });
  expect(kartStandings(race, 100).map((d) => [d.place, d.points])).toEqual([
    [1, 100],
    [1, 100],
  ]);
  race.drivers[1]!.status = "DNF";
  race.drivers[1]!.lapTimeMs = null;
  expect(kartStandings(race, 100)[1]).toMatchObject({ finished: false, points: 0 });
  const view = projectKartRace(race, "a", 100);
  for (const key of [
    "input",
    "sequence",
    "lastInputAt",
    "inputUntil",
    "distance",
    "turn",
  ])
    expect(view.participants[0]).not.toHaveProperty(key);
});
it("registers a ready 45-second kart round without releasing the birthday order or inventing a preview race", () => {
  const q = birthdayPack.catalogue.find((q) => q.id === "kart-sprint")!;
  expect(toPlayable(q)).toMatchObject({
    kind: "kart",
    collectMs: 45_000,
    timeLimitMs: 45_000,
    attribution: "live",
  });
  expect(questionPreview(birthdayPack, q)).toMatchObject({
    interactive: true,
    limitation: expect.stringContaining("Controller layout rehearsal only"),
  });
  expect(questionPreview(birthdayPack, q).question).not.toHaveProperty("kart");
  expect(validatePack(birthdayPack).filter((i) => i.level === "error")).toEqual([]);
  expect(birthdayPack.order).toEqual([]);
  expect(birthdayPack.release).toBe("draft");
});

it("keeps a consistent turn radius through intermittent throttle and a pause-shaped coast", () => {
  let race = createKartRace("variable-speed", [{ playerId: "a", name: "Amina" }]);
  for (let t = 0; t < 45_000 && !race.ended; t += 100) {
    const gas = t < 2000 || t > 4500;
    race = input(race, "a", t + 1, { ...kartNeutral, steer: 0.24, gas });
    race = reduceKart(race, { type: "tick", elapsedMs: t + 100 });
  }
  expect(race.drivers[0]!.status).toBe("FINISHED");
});

it("projects drift charge and boosts only a deliberate throttle-held release, never stale controls or braking", () => {
  let charged = start();
  for (let t = 0; t < 2500; t += 100) {
    charged = input(charged, "a", t + 1, {
      ...kartNeutral,
      gas: true,
      steer: 0.2,
      drift: true,
    });
    charged = reduceKart(charged, { type: "tick", elapsedMs: t + 100 });
  }
  expect(projectKartRace(charged, "a", 100).participants[0]).toMatchObject({
    driftCharge: 1,
    drifting: true,
    boostRemainingMs: 0,
    wrongWay: false,
  });
  const released = reduceKart(input(charged, "a", 3000), {
    type: "tick",
    elapsedMs: 2600,
  });
  expect(
    projectKartRace(released, "a", 100).participants[0]!.boostRemainingMs,
  ).toBeGreaterThan(0);
  const stale = reduceKart(charged, { type: "tick", elapsedMs: 3000 });
  expect(projectKartRace(stale, "a", 100).participants[0]).toMatchObject({
    driftCharge: 0,
    boostRemainingMs: 0,
    drifting: false,
  });
  const braking = reduceKart(
    input(charged, "a", 3000, { ...kartNeutral, brake: true }),
    { type: "tick", elapsedMs: 2600 },
  );
  expect(projectKartRace(braking, "a", 100).participants[0]!.boostRemainingMs).toBe(0);
  const final = projectKartRace(reduceKart(released, { type: "end" }), "a", 100);
  expect(final.participants[0]).toMatchObject({
    driftCharge: 0,
    boostRemainingMs: 0,
    drifting: false,
  });
});

it("reports wrong-way velocity for both forward and reverse driving without revealing private physics", () => {
  const race = start(),
    driver = race.drivers[0]!;
  driver.speed = 7;
  driver.heading = -Math.PI / 2;
  expect(projectKartRace(race, "a", 100).participants[0]!.wrongWay).toBe(true);
  driver.speed = -2;
  expect(projectKartRace(race, "a", 100).participants[0]!.wrongWay).toBe(false);
  driver.heading = Math.PI / 2;
  expect(projectKartRace(race, "a", 100).participants[0]!.wrongWay).toBe(true);
  driver.speed = 0;
  expect(projectKartRace(race, "a", 100).participants[0]!.wrongWay).toBe(false);
});

it("replays independent ghost-kart timelines deterministically at full-room size", () => {
  const players = Array.from({ length: 80 }, (_, i) => ({
    playerId: `p${i}`,
    name: `Driver ${i}`,
  }));
  let room = createKartRace("load", players);
  let solo = createKartRace("load", [players[0]!]);
  for (let tick = 0; tick < 50; tick++) {
    const events: KartTimedInput[] = players.flatMap((p, i) =>
      [0, 100].map((offset) => ({
        playerId: p.playerId,
        elapsed: tick * 200 + offset + (i % 10),
        input: {
          raceId: "load",
          sequence: tick * 2 + offset / 100 + 1,
          ...kartNeutral,
          gas: true,
          steer: 0.24,
        },
      })),
    );
    // Out-of-order transport queues must give the same race as sorted queues.
    room = reduceKartTimeline(room, [...events].reverse(), (tick + 1) * 200);
    solo = reduceKartTimeline(
      solo,
      events.filter((e) => e.playerId === "p0"),
      (tick + 1) * 200,
    );
  }
  expect(room.drivers[0]).toEqual(solo.drivers[0]);
  expect(
    room.drivers.every((d) => Number.isFinite(d.x) && Number.isFinite(d.speed)),
  ).toBe(true);
  expect(room.elapsedMs).toBe(10_000);
  const before = JSON.stringify(room);
  const newer = reduceKartTimeline(
    room,
    [
      {
        playerId: "p0",
        elapsed: 0,
        input: { raceId: "load", sequence: 999999, ...kartNeutral, brake: true },
      },
    ],
    10_200,
  );
  expect(newer.drivers[0]!.sequence).toBe(room.drivers[0]!.sequence); // No retroactive/stale throttle.
  expect(JSON.stringify(room)).toBe(before); // Original persisted state remains immutable.
  expect(reduceKartTimeline(room, [], NaN)).toBe(room);
});

it("updates new phone-driving rehearsals without rewriting the stored v1 content", () => {
  expect(kartRehearsalVersion).toBe("kart-rehearsal-v2");
  expect(
    questionFor({ questionSetVersion: "kart-rehearsal-v1", questionIndex: 1 })
      ?.instructions,
  ).toContain("Watch your numbered kart on the TV");
  expect(
    questionFor({ questionSetVersion: kartRehearsalVersion, questionIndex: 1 })
      ?.instructions,
  ).toContain("Race on your phone");
  expect(
    questionFor({ questionSetVersion: kartRehearsalVersion, questionIndex: 1 })?.prompt,
  ).toContain("follow the field on the big screen");
});

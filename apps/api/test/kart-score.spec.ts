import { expect, it } from "vitest";
import {
  createKartRace,
  reduceKart,
  kartStandings,
  projectKartRace,
  kartInputSchema,
  kartNeutral,
  type KartRace,
} from "@26/shared";
import { birthdayPack } from "../src/questions/packs/birthday/manifest.ts";
import { questionPreview } from "../src/room/question-preview.ts";
import { toPlayable } from "../src/questions/authoring.ts";
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

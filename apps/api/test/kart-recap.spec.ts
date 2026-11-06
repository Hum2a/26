import { expect, it } from "vitest";
import {
  createKartRace,
  reduceKart,
  projectKartRace,
  kartNeutral,
  kartRaceRecap,
  kartRecapSchema,
  kartRaceSchema,
  kartPresentationV1Schema,
  kartFinishPresentation,
  type KartRace,
} from "@26/shared";

function drive(count = 1, endAt = 45000) {
  let race = createKartRace(
    "recap",
    Array.from({ length: count }, (_, i) => ({
      playerId: `p${i}`,
      name: `Driver ${i}`,
    })),
  );
  for (let t = 0; t < endAt && !race.ended; t += 100) {
    race = reduceKart(race, {
      type: "input",
      playerId: "p0",
      value: {
        raceId: race.raceId,
        sequence: t + 1,
        ...kartNeutral,
        gas: true,
        steer: 0.2381,
      },
    });
    race = reduceKart(race, { type: "tick", elapsedMs: t + 100 });
  }
  return race;
}
it("records all eight accepted sector durations and the existing finish time without changing points", () => {
  const race = drive();
  const recap = kartRaceRecap(race)!;
  const row = recap.drivers[0]!;
  expect(recap.reason).toBe("all-finished");
  expect(row.status).toBe("FINISHED");
  expect(row.sectorsMs).toHaveLength(8);
  expect(row.sectorsMs.every((time) => time !== null && time > 0)).toBe(true);
  expect(row.sectorsMs.reduce<number>((sum, time) => sum + (time ?? 0), 0)).toBe(
    row.lapTimeMs,
  );
  expect(projectKartRace(race, null, 100).leaderboard[0]!.points).toBe(100);
});
it("distinguishes host early end and time limit and keeps the result frozen through replay/serialisation", () => {
  const live = drive(2, 3000);
  const ended = reduceKart(live, { type: "end" });
  expect(kartRaceRecap(ended)?.reason).toBe("host-ended");
  expect(live.ended).toBe(false);
  expect(reduceKart(ended, { type: "end" })).toBe(ended);
  expect(kartRaceRecap(JSON.parse(JSON.stringify(ended)))).toEqual(
    kartRaceRecap(ended),
  );
  expect(kartRaceRecap(drive(2))?.reason).toBe("time-limit");
});
it("keeps private accepted history stable between gates and never sends it in live public frames", () => {
  const race = createKartRace("stable", [{ playerId: "p", name: "Driver" }]);
  expect(kartRaceRecap(reduceKart(race, { type: "tick", elapsedMs: 500 }))).toEqual(
    kartRaceRecap(race),
  );
  const live = drive(2, 7000);
  expect(kartRaceRecap(live)!.drivers[0]!.checkpoint).toBeGreaterThan(0);
  for (const player of [null, "p0", "p1"]) {
    const view = projectKartRace(live, player, 100);
    expect(
      view.presentation?.version === 1 ? view.presentation.recap : undefined,
    ).toBeUndefined();
    expect(JSON.stringify(view)).not.toMatch(
      /crossingsMs|endReason|recapVersion|recoveries/,
    );
  }
});
it("retains legitimate recovery history, removes rolled-back splits and never mutates the previous race", () => {
  const race = drive(2, 8000);
  const driver = race.drivers[0]!;
  driver.checkpoint = 3;
  driver.lap = { crossingsMs: [1000, 2000, 3000], recoveries: 0 };
  driver.lastSafe = {
    x: 42,
    z: 0,
    heading: Math.PI / 2,
    angle: 1,
    distance: 1,
    checkpoint: 2,
    progress: 0.25,
  };
  const recovered = reduceKart(race, { type: "recover", playerId: "p0" });
  expect(recovered.drivers[0]!.lap).toEqual({
    crossingsMs: [1000, 2000],
    recoveries: 1,
  });
  expect(kartRaceRecap(recovered)!.drivers[0]).toMatchObject({
    checkpoint: 2,
    sectorsMs: [1000, 1000],
    recoveries: 1,
  });
  expect(driver.lap).toEqual({ crossingsMs: [1000, 2000, 3000], recoveries: 0 });
  expect(reduceKart(recovered, { type: "recover", playerId: "p0" })).toBe(recovered);
});
it("preserves older race projection and lets an older reader drop only the optional recap envelope", () => {
  const race = drive(2);
  const modern = projectKartRace(race, null, 100);
  expect(modern.presentation?.version === 1 && modern.presentation.recap).toBeTruthy();
  const olderReader = kartRaceSchema.extend({
    presentation: kartPresentationV1Schema
      .omit({ recap: true })
      .optional()
      .catch(undefined),
  });
  const older = olderReader.parse(modern);
  expect(older.presentation).toBeUndefined();
  expect(older.participants).toEqual(modern.participants);
  const legacy: KartRace = JSON.parse(JSON.stringify(race));
  delete legacy.recapVersion;
  delete legacy.endReason;
  for (const driver of legacy.drivers) delete driver.lap;
  expect(kartRaceRecap(legacy)).toBeUndefined();
  expect(projectKartRace(legacy, null, 100).presentation).toEqual(
    kartFinishPresentation(legacy),
  );
});
it("bounds history and marks unknown sector durations instead of inventing them", () => {
  const race = drive(2, 3000);
  race.drivers[0]!.checkpoint = 3;
  race.drivers[0]!.lap = { crossingsMs: [null, 1000, 2000], recoveries: 0 };
  const recap = kartRaceRecap(race)!;
  expect(recap.drivers[0]!.sectorsMs).toEqual([null, null, 1000]);
  expect(
    kartRecapSchema.safeParse({ ...recap, drivers: Array(101).fill(recap.drivers[0]) })
      .success,
  ).toBe(false);
  expect(
    kartRecapSchema.safeParse({
      ...recap,
      drivers: [{ ...recap.drivers[0], sectorsMs: Array(9).fill(1) }],
    }).success,
  ).toBe(false);
  expect(kartRecapSchema.safeParse({ ...recap, secret: "never" }).success).toBe(false);
});

it("never describes an early settled DNF as every driver finishing", () => {
  const race = createKartRace("settled-dnf", [{ playerId: "p", name: "Driver" }]);
  race.drivers[0]!.status = "DNF";
  const ended = reduceKart(race, { type: "tick", elapsedMs: 1 });
  expect(kartRaceRecap(ended)?.reason).toBe("race-ended");
});
it("releases controls without changing accepted split history or active history time", () => {
  const race = drive(2, 7000);
  expect(kartRaceRecap(reduceKart(race, { type: "release" }))).toEqual(
    kartRaceRecap(race),
  );
});

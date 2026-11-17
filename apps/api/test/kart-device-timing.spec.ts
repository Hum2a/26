import { expect, it } from "vitest";
import {
  createKartRace,
  reduceKart,
  kartStandings,
  kartFinishSchema,
  projectKartRace,
  createDrivingBody,
} from "@26/shared";
it("uses reported durations and ties in trusted races, without changing legacy races", () => {
  const initial = createKartRace("device", [
    { playerId: "a", name: "A" },
    { playerId: "b", name: "B" },
  ]);
  const device = { ...initial, timingMode: "device-v1" as const };
  const a = reduceKart(device, {
    type: "device-finish",
    playerId: "a",
    elapsedMs: 12345,
    lapsMs: [12345],
  });
  const b = reduceKart(a, {
    type: "device-finish",
    playerId: "b",
    elapsedMs: 12345,
    lapsMs: [12345],
  });
  expect(kartStandings(b, 100).map((r) => r.place)).toEqual([1, 1]);
  expect(initial.drivers[0]!.status).toBe("RACING");
  expect(
    reduceKart(initial, {
      type: "device-finish",
      playerId: "a",
      elapsedMs: 12345,
      lapsMs: [12345],
    }),
  ).toBe(initial);
  expect(
    reduceKart(b, { type: "device-finish", playerId: "a", elapsedMs: 1, lapsMs: [1] }),
  ).toBe(b);
});
it("rejects malformed and inconsistent device durations", () => {
  for (const elapsedMs of [-1, 0, NaN, Infinity, 540001])
    expect(
      kartFinishSchema.safeParse({ raceId: "r", elapsedMs, lapsMs: [elapsedMs] })
        .success,
    ).toBe(false);
  expect(
    kartFinishSchema.safeParse({ raceId: "r", elapsedMs: 100, lapsMs: [101, 100] })
      .success,
  ).toBe(false);
});

it("keeps simulated human finish lines provisional and refuses CPU reports", () => {
  const race = createKartRace("provisional", [
    { playerId: "a", name: "A" },
    { playerId: "cpu", name: "CPU" },
  ]);
  race.timingMode = "device-v1";
  const d = race.drivers[0]!;
  Object.assign(d, {
    x: 43,
    z: -0.04,
    heading: Math.PI / 2,
    speed: 10,
    angle: -0.001,
    distance: Math.PI * 2 - 0.001,
    checkpoint: 7,
    physics: { ...createDrivingBody(43, -0.04, Math.PI / 2), vz: 10 },
  });
  race.drivers[1]!.cpu = true;
  const after = reduceKart(race, { type: "tick", elapsedMs: 20 });
  expect(after.drivers[0]!.checkpoint).toBe(8);
  expect(after.drivers[0]!.status).toBe("RACING");
  expect(after.ended).toBe(false);
  expect(
    reduceKart(after, {
      type: "device-finish",
      playerId: "cpu",
      elapsedMs: 20,
      lapsMs: [20],
    }),
  ).toBe(after);
  expect(
    reduceKart(after, {
      type: "device-finish",
      playerId: "a",
      elapsedMs: 20,
      lapsMs: [20],
    }).drivers[0]!.lapTimeMs,
  ).toBe(20);
});

it("projects trusted cumulative splits beyond three minutes in a three-lap race", () => {
  const race = createKartRace("long-device", [{ playerId: "a", name: "A" }], {
    trackId: "mario-circuit-v1",
    laps: 3,
  });
  race.timingMode = "device-v1";
  const done = reduceKart(race, {
    type: "device-finish",
    playerId: "a",
    elapsedMs: 300000,
    lapsMs: [100000, 200000, 300000],
  });
  expect(projectKartRace(done, "a", 100).leaderboard[0]!.timeMs).toBe(300000);
});

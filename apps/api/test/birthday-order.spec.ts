import {
  importedTrackProgress,
  importedLapLength,
  importedRoute,
} from "../../../packages/shared/src/kart-route.ts";
import {
  importedSurfaceAt,
  nearbyImportedWalls,
} from "../../../packages/shared/src/kart-track.ts";
import { reduceKartTimeline, projectKartRace } from "@26/shared";
import { expect, it } from "vitest";
import { createKartRace, ringWalls, clearOfWalls } from "@26/shared";
import { birthdayPack } from "../src/questions/packs/birthday/manifest.ts";
import {
  freezeBirthdayOrder,
  validateBirthdayOrder,
} from "../src/questions/birthday-order.ts";
import { questionFor, unavailableContentMessage } from "../src/questions/registry.ts";

it("defaults to completed rounds with kart last, and refuses drafts, unknowns, duplicates and oversized orders", () => {
  expect(birthdayPack.order.at(-1)).toBe("kart-sprint");
  expect(validateBirthdayOrder(birthdayPack.order)).toHaveLength(
    birthdayPack.order.length,
  );
  for (const ids of [
    [],
    ["kart-sprint", "kart-sprint"],
    ["unknown"],
    ["tribunal-reddit"],
    Array(81).fill("kart-sprint"),
  ])
    expect(() => validateBirthdayOrder(ids)).toThrow();
});

it("freezes server questions under a deterministic content version without depending on the later catalogue", async () => {
  const order = {
    revision: 3,
    ids: ["car-name", "kart-sprint"],
    updatedAt: 1000,
    history: [],
  };
  const script = await freezeBirthdayOrder(order);
  expect(script).toEqual(await freezeBirthdayOrder(order));
  const room = {
    questionSetVersion: script.version,
    questionIndex: 1,
    questionScript: JSON.parse(JSON.stringify(script)),
    phase: "intro",
    questionCount: 2,
  };
  expect(questionFor(room)?.kind).toBe("kart");
  expect(unavailableContentMessage(room)).toBeUndefined();
  expect(questionFor({ ...room, questionScript: undefined })).toBeUndefined();
  expect(
    (await freezeBirthdayOrder({ ...order, ids: [...order.ids].reverse() })).version,
  ).not.toBe(script.version);
});

it("seeds eighty separate grid slots from descending scores with stable ties and refuses eighty-one", () => {
  const players = Array.from({ length: 80 }, (_, i) => ({
    playerId: `p${i}`,
    name: `Player ${i}`,
    points: Math.floor(i / 2) * 10,
  }));
  const race = createKartRace("grid", players, { seedGrid: true });
  expect(race.drivers.slice(0, 4).map((d) => d.playerId)).toEqual([
    "p78",
    "p79",
    "p76",
    "p77",
  ]);
  expect(race.drivers.map((d) => d.gridPosition)).toEqual(
    Array.from({ length: 80 }, (_, i) => i + 1),
  );
  expect(new Set(race.drivers.map((d) => `${d.x}:${d.z}`)).size).toBe(80);
  for (const d of race.drivers) {
    expect(d.progress).toBe(0);
    expect(d.distance).toBeLessThan(0);
    expect(clearOfWalls(d.x, d.z, ringWalls, 0.8)).toBe(true);
  }
  expect(() =>
    createKartRace("too-many", [...players, { playerId: "extra", name: "Extra" }], {
      seedGrid: true,
    }),
  ).toThrow(/80/);
});

it("uses eighty road-safe imported grid slots and restores the three-minute cutoff", () => {
  const race = createKartRace(
    "circuit",
    Array.from({ length: 80 }, (_, i) => ({
      playerId: `p${i}`,
      name: `Player ${i}`,
      points: i,
    })),
    { seedGrid: true, trackId: "mario-circuit-v1" },
  );
  for (const d of race.drivers) {
    expect(importedSurfaceAt(d.x, d.z)).toBe("road");
    expect(clearOfWalls(d.x, d.z, nearbyImportedWalls(d.x, d.z, 2), 0.8)).toBe(true);
  }
  expect(importedLapLength).toBeGreaterThan(1000);
  expect(importedTrackProgress(0, -50).along).toBeCloseTo(50);
  const ended = reduceKartTimeline(JSON.parse(JSON.stringify(race)), [], 180000);
  expect(ended.ended).toBe(true);
  expect(ended.elapsedMs).toBe(180000);
  expect(ended.drivers.every((d) => d.status === "DNF")).toBe(true);
  expect(projectKartRace(ended, null, 100)).toMatchObject({
    trackId: "mario-circuit-v1",
    timeLimitMs: 180000,
    participantCount: 80,
  });
});

it("completes every imported circuit sector using only authoritative driving inputs", () => {
  let race = createKartRace("lap", [{ playerId: "driver", name: "Driver" }], {
    seedGrid: true,
    trackId: "mario-circuit-v1",
  });
  race.courseEnabled = false;
  const targetAt = (along: number) => {
    let remaining = (along + importedLapLength) % importedLapLength;
    for (let i = 1; i < importedRoute.length; i++) {
      const a = importedRoute[i - 1]!,
        b = importedRoute[i]!,
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (remaining <= len)
        return [
          a[0] + ((b[0] - a[0]) * remaining) / len,
          a[1] + ((b[1] - a[1]) * remaining) / len,
        ];
      remaining -= len;
    }
    return [0, 0];
  };
  for (let t = 0; t < 180000 && !race.ended; t += 100) {
    const d = race.drivers[0]!;
    const projection = importedTrackProgress(d.x, d.z);
    const target = targetAt(projection.along + 10);
    let error = Math.atan2(target[1]! - d.z, target[0]! - d.x) - d.heading;
    error = Math.atan2(Math.sin(error), Math.cos(error));
    const steer = Math.max(-1, Math.min(1, error * 3));
    const desired = Math.abs(error) > 0.2 ? 12 : 22;
    race = reduceKartTimeline(
      race,
      [
        {
          playerId: "driver",
          elapsed: t,
          input: {
            raceId: "lap",
            sequence: t / 100 + 1,
            steer,
            gas: d.speed < desired,
            brake: d.speed > desired + 1,
            drift: false,
          },
        },
      ],
      t + 100,
    );
  }
  expect(race.drivers[0], JSON.stringify(race.drivers[0])).toMatchObject({
    status: "FINISHED",
    checkpoint: 8,
    progress: 1,
  });
});

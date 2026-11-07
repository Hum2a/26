import { expect, it } from "vitest";
import {
  clearOfWalls,
  createDrivingBody,
  stepDriving,
  soloDriving,
  createKartRace,
  reduceKart,
  projectKartRace,
  advanceKartLap,
  publicQuestionSchema,
} from "@26/shared";
import {
  parkRoute,
  parkRibbon,
  parkWalls,
  parkSurfaceAt,
  parkItemBoxes,
  parkCourse,
  parkLanePoint,
} from "../../../packages/shared/src/kart-park.ts";
it("shares a closed original road strip with clear centreline, sectors, boxes and optional course features", () => {
  expect(parkRoute.lapLength).toBeGreaterThan(600);
  expect(parkRoute.lapLength).toBeLessThan(800);
  expect(parkWalls).toHaveLength(parkRibbon.length * 2);
  for (let along = 0; along < parkRoute.lapLength; along += 0.5) {
    const p = parkRoute.point(along);
    expect(parkSurfaceAt(p.x, p.z)).toBe("road");
    expect(clearOfWalls(p.x, p.z, parkWalls, soloDriving.radius + 2)).toBe(true);
    expect(parkRoute.progress(p.x, p.z).distance).toBeLessThan(0.00001);
  }
  for (const p of [...parkItemBoxes, ...parkCourse]) {
    expect(parkSurfaceAt(p.x, p.z)).toBe("road");
    expect(clearOfWalls(p.x, p.z, parkWalls, soloDriving.radius + 2)).toBe(true);
  }
  expect(parkItemBoxes).toHaveLength(18);
  expect(parkSurfaceAt(80, 0)).toBe("dirt");
});
it("uses the existing race reducer and recovery/public projection while keeping live question selection closed", () => {
  const race = createKartRace("park-drive", [{ playerId: "p", name: "Stand-in" }], {
    trackId: "26-park-v1",
    seedGrid: true,
  });
  let driven = race;
  for (let elapsedMs = 200; elapsedMs <= 3000; elapsedMs += 200) {
    driven = reduceKart(driven, {
      type: "input",
      playerId: "p",
      value: {
        raceId: race.raceId,
        sequence: elapsedMs,
        steer: 0,
        gas: true,
        brake: false,
        drift: false,
      },
    });
    driven = reduceKart(driven, { type: "tick", elapsedMs });
  }
  expect(driven.drivers[0]!.z).toBeLessThan(race.drivers[0]!.z - 20);
  const next = { type: "tick" as const, elapsedMs: 3200 };
  expect(reduceKart(JSON.parse(JSON.stringify(driven)), next)).toEqual(
    reduceKart(driven, next),
  );
  const damaged = structuredClone(driven);
  damaged.drivers[0]!.x = 10000;
  const recovered = reduceKart(damaged, { type: "recover", playerId: "p" }).drivers[0]!;
  expect(recovered.x).toBe(driven.drivers[0]!.lastSafe!.x);
  expect(recovered.z).toBe(driven.drivers[0]!.lastSafe!.z);
  expect(projectKartRace(driven, "p", 0).trackId).toBe("26-park-v1");
  expect(
    publicQuestionSchema.options[0].shape.trackId.safeParse("26-park-v1").success,
  ).toBe(false);
});
it("awards only actual ordered forward sectors on the new route and rejects a teleport", () => {
  let cursor = { angle: 0, distance: 0, checkpoint: 0 };
  expect(
    advanceKartLap(cursor, {
      along: parkRoute.lapLength / 4,
      lapLength: parkRoute.lapLength,
      speed: 30,
      stepMs: 20,
      routeDistance: 0,
    }).checkpoint,
  ).toBe(0);
  let finished = false;
  for (let along = 0.5; along <= Math.ceil(parkRoute.lapLength * 2) / 2; along += 0.5) {
    const next = advanceKartLap(cursor, {
      along: along % parkRoute.lapLength,
      lapLength: parkRoute.lapLength,
      speed: 30,
      stepMs: 20,
      routeDistance: 0,
    });
    cursor = next;
    finished = next.finished;
  }
  expect(cursor.checkpoint).toBe(8);
  expect(finished).toBe(true);
});
it("fits all80 five-column grid slots safely before the start line", () => {
  const poses = new Set<string>();
  for (let i = 0; i < 80; i++) {
    const p = parkLanePoint(-(1.5 + Math.floor(i / 5) * 3), ((i % 5) - 2) * 4);
    expect(parkSurfaceAt(p.x, p.z)).toBe("road");
    expect(clearOfWalls(p.x, p.z, parkWalls, soloDriving.radius + 2)).toBe(true);
    poses.add(`${p.x}:${p.z}`);
  }
  expect(poses.size).toBe(80);
});
it("uses the actual swept driving solver at the original road edge without tunnelling", () => {
  const body = { ...createDrivingBody(0, -20, 0), vx: 1000, vz: 0 };
  const next = stepDriving(
    body,
    { steer: 0, gas: false, brake: false, drift: false },
    20,
    soloDriving,
    parkWalls,
  );
  expect(next.contact).toBe(true);
  expect(next.x).toBeLessThan(12);
  expect(parkSurfaceAt(next.x, next.z)).toBe("road");
});
it("completes the original course through actual shared driving and all ordered gates", () => {
  let race = createKartRace("park-lap", [{ playerId: "p", name: "Stand-in" }], {
    trackId: "26-park-v1",
  });
  for (
    let elapsedMs = 100;
    elapsedMs <= 180000 && race.drivers[0]!.status === "RACING";
    elapsedMs += 100
  ) {
    const driver = race.drivers[0]!,
      along = parkRoute.progress(driver.x, driver.z).along;
    const target = parkRoute.point(along + 12),
      wanted = Math.atan2(target.z - driver.z, target.x - driver.x);
    const delta = Math.atan2(
      Math.sin(wanted - driver.heading),
      Math.cos(wanted - driver.heading),
    );
    race = reduceKart(race, {
      type: "input",
      playerId: "p",
      value: {
        raceId: race.raceId,
        sequence: elapsedMs,
        steer: Math.max(-1, Math.min(1, delta * 2.5)),
        gas: true,
        brake: false,
        drift: false,
      },
    });
    race = reduceKart(race, { type: "tick", elapsedMs });
  }
  expect(race.drivers[0]!.status).toBe("FINISHED");
  expect(race.drivers[0]!.checkpoint).toBe(8);
  expect(race.drivers[0]!.lapTimeMs).toBeGreaterThan(10000);
  expect(race.drivers[0]!.lap!.crossingsMs).toHaveLength(8);
});

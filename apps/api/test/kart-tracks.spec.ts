import { expect, it } from "vitest";
import {
  kartTrackCatalogue,
  kartTrackCatalogueSchema,
  createKartRace,
  reduceKart,
  clearOfWalls,
  importedWalls,
  ringWalls,
  parkTrackId,
  parkWalls,
  parkSurfaceAt,
} from "@26/shared";
import {
  importedSurfaceAt,
  importedTrackPoint,
  importedLapLength,
} from "../../../packages/shared/src/kart/kart-track.ts";
for (const track of kartTrackCatalogue.tracks)
  it(`${track.id}: every public grid/recovery slot uses actual clear driving geometry`, () => {
    const race = createKartRace(
      "geometry-check",
      Array.from({ length: 80 }, (_, i) => ({
        playerId: `p${i}`,
        name: `Stand-in ${i}`,
      })),
      { seedGrid: true, trackId: track.id },
    );
    const positions = new Set<string>();
    for (const driver of race.drivers) {
      expect(
        clearOfWalls(
          driver.x,
          driver.z,
          track.id === parkTrackId
            ? parkWalls
            : track.id === "mario-circuit-v1"
              ? importedWalls
              : ringWalls,
          track.collision.bodyRadius,
        ),
        `slot ${driver.number} wall clearance`,
      ).toBe(true);
      if (track.id === parkTrackId)
        expect(parkSurfaceAt(driver.x, driver.z)).toBe("road");
      else if (track.id === "mario-circuit-v1")
        expect(
          importedSurfaceAt(driver.x, driver.z),
          `slot ${driver.number} road`,
        ).toBe("road");
      else
        expect(Math.hypot(driver.x, driver.z)).toBeGreaterThan(
          34 + track.collision.bodyRadius,
        );
      positions.add(`${driver.x}:${driver.z}`);
      const source = structuredClone(race),
        damaged = source.drivers.find((d) => d.playerId === driver.playerId)!;
      damaged.x = 10000;
      damaged.z = 10000;
      damaged.speed = 10;
      const recovered = reduceKart(source, {
        type: "recover",
        playerId: driver.playerId,
      }).drivers.find((d) => d.playerId === driver.playerId)!;
      expect([
        recovered.x,
        recovered.z,
        recovered.heading,
        recovered.checkpoint,
        recovered.speed,
      ]).toEqual([driver.x, driver.z, driver.heading, 0, 0]);
    }
    expect(positions.size).toBe(80);
  });
it("keeps installed source geometry/counts and honest current mode availability versioned", () => {
  expect(kartTrackCatalogueSchema.parse(kartTrackCatalogue)).toEqual(
    kartTrackCatalogue,
  );
  const imported = kartTrackCatalogue.tracks.find(
    (track) => track.id === "mario-circuit-v1",
  )!;
  const original = kartTrackCatalogue.tracks.find(
    (track) => track.id === "party-ring-v1",
  )!;
  expect(imported.collision.segments).toBe(importedWalls.length);
  expect(original.collision.segments).toBe(ringWalls.length);
  expect(original.itemBoxes).toBe(18);
  expect(imported.itemBoxes).toBe(3);
  expect(original.modes.find((mode) => mode.id === "free-drive")?.available).toBe(
    false,
  );
  expect(imported.modes.every((mode) => mode.available)).toBe(true);
  const park = kartTrackCatalogue.tracks.find((track) => track.id === parkTrackId)!;
  expect(park.collision.segments).toBe(parkWalls.length);
  expect(park.modes.find((mode) => mode.id === "room-race")?.available).toBe(true);
  expect(
    park.modes
      .filter((mode) => mode.id !== "room-race")
      .every((mode) => !mode.available),
  ).toBe(true);
  expect(
    kartTrackCatalogueSchema.safeParse({
      ...kartTrackCatalogue,
      tracks: [imported, original, original],
    }).success,
  ).toBe(false);
  expect(
    kartTrackCatalogueSchema.safeParse({
      ...kartTrackCatalogue,
      tracks: [imported, imported],
    }).success,
  ).toBe(false);
});
it("keeps all eight original progress landmarks on supported ground and clear of baked walls", () => {
  const surfaces = [];
  for (let sector = 1; sector <= 8; sector++) {
    const pose = importedTrackPoint((importedLapLength * sector) / 8);
    expect(
      clearOfWalls(pose.x, pose.z, importedWalls, 0.85),
      `sector ${sector} wall clearance`,
    ).toBe(true);
    const surface = importedSurfaceAt(pose.x, pose.z);
    expect(surface, `sector ${sector} supported ground`).not.toBe("unsupported");
    surfaces.push(surface);
  }
  // The v1 progress polyline cuts the broad bends; do not pretend every landmark is road.
  expect(surfaces).toEqual([
    "road",
    "dirt",
    "dirt",
    "road",
    "road",
    "road",
    "road",
    "road",
  ]);
});

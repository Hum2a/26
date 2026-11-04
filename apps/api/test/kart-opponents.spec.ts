import { expect, it } from "vitest";
import {
  createKartRace,
  projectKartRace,
  reduceKart,
  selectNearbyNumbers,
} from "@26/shared";
import { phoneRaceView } from "../src/questions/kart";

const poses = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    playerId: "p" + i,
    number: i + 1,
    x: i,
    z: 0,
    progress: 0,
    status: "RACING" as "RACING" | "FINISHED" | "DNF",
  }));
it("selects at most eight nearby racers with stable frozen-roster tie breaks and route bounds", () => {
  const drivers = poses(80);
  expect(selectNearbyNumbers(drivers, "p0")).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  expect(selectNearbyNumbers(drivers, "absent")).toEqual([]);
  drivers[1]!.progress = 0.5;
  expect(selectNearbyNumbers(drivers, "p0")).not.toContain(2);
  drivers[1]!.progress = 0.99;
  expect(selectNearbyNumbers(drivers, "p0")).toContain(2);
});
it("retains a visible neighbour through modest boundary movement, but releases distant or finished ones", () => {
  const drivers = poses(2);
  drivers[1]!.x = 38;
  expect(selectNearbyNumbers(drivers, "p0")).toEqual([]);
  expect(selectNearbyNumbers(drivers, "p0", [2])).toEqual([2]);
  drivers[1]!.x = 45;
  expect(selectNearbyNumbers(drivers, "p0", [2])).toEqual([]);
  drivers[1]!.x = 2;
  drivers[1]!.status = "FINISHED";
  expect(selectNearbyNumbers(drivers, "p0", [2])).toEqual([]);
  drivers[1]!.status = "DNF";
  expect(selectNearbyNumbers(drivers, "p0", [2])).toEqual([]);
});
it("persists only bounded roster numbers and projects self plus public nearby poses without private controls", () => {
  const original = createKartRace(
    "nearby",
    poses(80).map((p) => ({ playerId: p.playerId, name: p.playerId })),
  );
  original.opponentsEnabled = true;
  original.drivers.forEach((d, i) => {
    d.x = i % 10;
    d.z = Math.floor(i / 10);
  });
  const race = reduceKart(original, { type: "tick", elapsedMs: 200 });
  expect(race.nearbyNumbers).toHaveLength(80);
  expect(race.nearbyNumbers!.every((numbers) => numbers.length <= 8)).toBe(true);
  const full = projectKartRace(race, null, 100);
  const phone = phoneRaceView(race, full, "p0", 1);
  expect(phone.participants.map((d) => d.playerId)).toEqual(["p0"]);
  expect(phone.nearby).toHaveLength(8);
  expect(phone.nearby!.some((d) => d.playerId === "p0")).toBe(false);
  expect(JSON.stringify(phone.nearby)).not.toMatch(
    /input|sequence|power|lastSafe|credential|secret/,
  );
  const restored = JSON.parse(JSON.stringify(race)) as typeof race;
  expect(
    phoneRaceView(restored, projectKartRace(restored, null, 100), "p0", 1).nearby,
  ).toEqual(phone.nearby);
  expect(full.participants).toHaveLength(80);
  race.opponentsEnabled = false;
  expect(phoneRaceView(race, full, "p0", 1).nearby).toBeUndefined();
});

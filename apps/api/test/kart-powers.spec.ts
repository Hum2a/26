import { expect, it } from "vitest";
import {
  createKartPowers,
  stepKartPowers,
  useKartPower,
  powerDrivingBody,
  createDrivingBody,
  createKartRace,
  reduceKart,
  projectKartRace,
} from "@26/shared";
const box = [{ id: "one", x: 5, z: 0 }],
  from = { x: 0, z: 0 },
  to = { x: 10, z: 0 };
it("sweeps item boxes, never overwrites a slot and applies per-driver recharge", () => {
  const empty = createKartPowers();
  const first = stepKartPowers(empty, "a", from, to, box, [], 100, "a").powers;
  expect(first.item).not.toBeNull();
  expect(empty.item).toBeNull();
  expect(
    stepKartPowers(first, "a", from, to, box, [], 200, "a").powers.collections,
  ).toBe(1);
  const used = useKartPower(first, "a", { ...to, heading: 0 }, 200)!;
  expect(
    stepKartPowers(used.powers, "a", from, to, box, [], 300, "a").powers.item,
  ).toBeNull();
  expect(
    stepKartPowers(used.powers, "a", from, to, box, [], 8200, "a").powers.item,
  ).not.toBeNull();
  expect(
    stepKartPowers(empty, "b", from, to, box, [], 300, "b").powers.item,
  ).not.toBeNull();
});
it("uses an item once and applies turbo only during active time", () => {
  const empty = createKartPowers();
  expect(useKartPower(empty, "a", { ...from, heading: 0 }, 0)).toBeUndefined();
  const used = useKartPower(
    { ...empty, item: "turbo" },
    "a",
    { ...from, heading: 0 },
    100,
  )!;
  expect(used.powers.item).toBeNull();
  expect(
    powerDrivingBody(createDrivingBody(), used.powers, 200).boostMs,
  ).toBeGreaterThan(0);
  expect(powerDrivingBody(createDrivingBody(), used.powers, 1300).boostMs).toBe(0);
});
it("a shield absorbs one slick; oil slows once, expires and has a brief owner grace period", () => {
  const oil = useKartPower(
    { ...createKartPowers(), item: "oil", collections: 1 },
    "a",
    { x: 8, z: 0, heading: 0 },
    100,
  )!.oil!;
  const shield = { ...createKartPowers(), shieldUntil: 5000 };
  const protectedHit = stepKartPowers(shield, "b", from, to, [], [oil], 200, "b");
  expect(protectedHit.hit).toBe(false);
  expect(protectedHit.powers.shieldUntil).toBe(0);
  expect(
    stepKartPowers(protectedHit.powers, "b", from, to, [], [oil], 300, "b").hit,
  ).toBe(false);
  expect(
    stepKartPowers(createKartPowers(), "a", from, to, [], [oil], 200, "a").hit,
  ).toBe(false);
  expect(
    stepKartPowers(createKartPowers(), "a", from, to, [], [oil], 1000, "a").hit,
  ).toBe(true);
  expect(
    stepKartPowers(createKartPowers(), "b", from, to, [], [oil], 8100, "b").hit,
  ).toBe(false);
});
it("projects only the phone's inventory, preserves progress and clock and rejects finished use", () => {
  const race = createKartRace("powers", [
    { playerId: "a", name: "Amina" },
    { playerId: "b", name: "Bilal" },
  ]);
  race.drivers[0]!.power!.item = "turbo";
  race.drivers[1]!.power!.item = "oil";
  expect(projectKartRace(race, "a", 100).powers!.selfItem).toBe("turbo");
  expect(projectKartRace(race, null, 100).powers!.selfItem).toBeNull();
  const used = reduceKart(race, { type: "use-power", playerId: "a" });
  expect(used.elapsedMs).toBe(race.elapsedMs);
  expect(used.drivers[0]!.progress).toBe(0);
  expect(race.drivers[0]!.power!.item).toBe("turbo");
  expect(reduceKart(used, { type: "use-power", playerId: "a" })).toBe(used);
  used.drivers[1]!.status = "DNF";
  expect(reduceKart(used, { type: "use-power", playerId: "b" })).toBe(used);
});

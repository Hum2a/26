import { expect, it } from "vitest";
import { createKartRace, createDrivingBody, ringWalls, clearOfWalls } from "@26/shared";
import { birthdayPack } from "../src/questions/packs/birthday/manifest.ts";
import { freezeBirthdayOrder, validateBirthdayOrder } from "../src/questions/birthday-order.ts";
import { questionFor, unavailableContentMessage } from "../src/questions/registry.ts";

it("defaults to completed rounds with kart last, and refuses drafts, unknowns, duplicates and oversized orders", () => {
  expect(birthdayPack.order.at(-1)).toBe("kart-sprint");
  expect(validateBirthdayOrder(birthdayPack.order)).toHaveLength(birthdayPack.order.length);
  for (const ids of [[], ["kart-sprint", "kart-sprint"], ["unknown"], ["tribunal-reddit"], Array(81).fill("kart-sprint")]) expect(() => validateBirthdayOrder(ids)).toThrow();
});

it("freezes server questions under a deterministic content version without depending on the later catalogue", async () => {
  const order = { revision: 3, ids: ["car-name", "kart-sprint"], updatedAt: 1000, history: [] };
  const script = await freezeBirthdayOrder(order);
  expect(script).toEqual(await freezeBirthdayOrder(order));
  const room = { questionSetVersion: script.version, questionIndex: 1, questionScript: JSON.parse(JSON.stringify(script)), phase: "intro", questionCount: 2 };
  expect(questionFor(room)?.kind).toBe("kart");
  expect(unavailableContentMessage(room)).toBeUndefined();
  expect(questionFor({ ...room, questionScript: undefined })).toBeUndefined();
  expect((await freezeBirthdayOrder({ ...order, ids: [...order.ids].reverse() })).version).not.toBe(script.version);
});

it("seeds eighty separate grid slots from descending scores with stable ties and refuses eighty-one", () => {
  const players = Array.from({ length: 80 }, (_, i) => ({ playerId: `p${i}`, name: `Player ${i}`, points: Math.floor(i / 2) * 10 }));
  const race = createKartRace("grid", players, { seedGrid: true });
  expect(race.drivers.slice(0, 4).map(d => d.playerId)).toEqual(["p78", "p79", "p76", "p77"]);
  expect(race.drivers.map(d => d.gridPosition)).toEqual(Array.from({ length: 80 }, (_, i) => i + 1));
  expect(new Set(race.drivers.map(d => `${d.x}:${d.z}`)).size).toBe(80);
  for (const d of race.drivers) { expect(d.progress).toBe(0); expect(d.distance).toBeLessThan(0); expect(clearOfWalls(d.x, d.z, ringWalls, 0.8)).toBe(true); }
  expect(() => createKartRace("too-many", [...players, { playerId: "extra", name: "Extra" }], { seedGrid: true })).toThrow(/80/);
  expect(createDrivingBody().boostMs).toBe(0);
});

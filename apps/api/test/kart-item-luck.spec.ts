import { expect, it } from "vitest";
import {
  createKartPowers,
  kartItemRulesSchema,
  kartItemWeight,
  pickKartItem,
  stepKartPowers,
  type KartItem,
} from "@26/shared";

const all: KartItem[] = ["turbo", "shield", "oil", "tennis", "bomb", "homing", "treat"];
const catchUp = new Set<KartItem>(["turbo", "homing", "bomb", "treat"]);

it("weights catch-up items towards the back and defensive items towards the front", () => {
  expect(kartItemWeight("turbo", 1)).toBeGreaterThan(kartItemWeight("turbo", 0));
  expect(kartItemWeight("homing", 1)).toBeGreaterThan(kartItemWeight("homing", 0) * 5);
  expect(kartItemWeight("shield", 0)).toBeGreaterThan(kartItemWeight("shield", 1));
  expect(kartItemWeight("oil", 0)).toBeGreaterThan(kartItemWeight("oil", 1));
  // Every item stays possible everywhere, and bad standings fall back to the middle.
  for (const item of all)
    for (const s of [0, 0.5, 1]) expect(kartItemWeight(item, s)).toBeGreaterThan(0);
  expect(kartItemWeight("turbo", Number.NaN)).toBe(kartItemWeight("turbo", 0.5));
});

it("picks deterministically and gives the back of the field far more catch-up items", () => {
  expect(pickKartItem(all, 1, 12345, 3)).toBe(pickKartItem(all, 1, 12345, 3));
  expect(pickKartItem([], 1, 1, 1)).toBeUndefined();
  expect(pickKartItem(["oil"], 1, 1, 1)).toBe("oil");
  const share = (standing: number) => {
    let hits = 0;
    for (let seed = 0; seed < 400; seed++)
      for (let n = 0; n < 5; n++)
        if (catchUp.has(pickKartItem(all, standing, seed * 7919, n)!)) hits++;
    return hits / 2000;
  };
  const leader = share(0),
    last = share(1);
  expect(last).toBeGreaterThan(0.75);
  expect(leader).toBeLessThan(0.35);
});

it("uses the standing only when a box is collected, and keeps the old rotation without it", () => {
  let asked = 0;
  const box = { id: "b", x: 0, z: 0 };
  const collect = (standing?: () => number) =>
    stepKartPowers(
      createKartPowers(),
      "p",
      { x: -3, z: 0 },
      { x: 3, z: 0 },
      [box],
      [],
      1000,
      "seed",
      { allowed: all, damageGrace: true, ...(standing ? { standing } : {}) },
    ).powers.item;
  const lucky = collect(() => {
    asked++;
    return 1;
  });
  expect(asked).toBe(1);
  expect(lucky).toBe(pickKartItem(all, 1, hashOf("seed"), 0));
  // Missing the box never asks for a standing.
  stepKartPowers(createKartPowers(), "p", { x: 10, z: 10 }, { x: 11, z: 10 }, [box], [], 1, "seed", {
    allowed: all,
    damageGrace: true,
    standing: () => {
      asked++;
      return 1;
    },
  });
  expect(asked).toBe(1);
  expect(collect()).toBe(all[hashOf("seed") % all.length]);
});

it("accepts position luck on original and expanded rules and refuses other luck", () => {
  expect(kartItemRulesSchema.parse({ version: 1, luck: "position" })).toEqual({
    version: 1,
    luck: "position",
  });
  expect(
    kartItemRulesSchema.parse({ version: 2, allowed: ["turbo"], luck: "position" }),
  ).toMatchObject({ luck: "position" });
  expect(kartItemRulesSchema.safeParse({ version: 1, luck: "random" }).success).toBe(
    false,
  );
});

function hashOf(seed: string) {
  let hash = 0;
  for (const c of seed) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0;
  return hash;
}

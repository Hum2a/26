import { expect, it } from "vitest";
import {
  formatShowLength,
  longestRun,
  seriesOf,
  suggestMixedOrder,
  totalSeconds,
} from "./running-order-plan";

const ids = [
  "warm-up",
  "council-a",
  "council-b",
  "council-c",
  "council-d",
  "trolley-a",
  "trolley-b",
  "trolley-c",
  "quiz-a",
  "kart-sprint",
];

it("finds series and the longest back-to-back run", () => {
  expect(seriesOf("council-blackbird-leys")).toBe("council");
  expect(longestRun(ids)).toEqual({ series: "council", length: 4 });
});

it("spreads series out, keeps their inner order and the kart race last", () => {
  const mixed = suggestMixedOrder(ids, (id) => id.startsWith("kart"));
  expect([...mixed].sort()).toEqual([...ids].sort());
  expect(mixed.at(-1)).toBe("kart-sprint");
  expect(longestRun(mixed).length).toBe(1);
  const councils = mixed.filter((id) => id.startsWith("council"));
  expect(councils).toEqual(["council-a", "council-b", "council-c", "council-d"]);
  // Deterministic: the same input gives the same suggestion.
  expect(suggestMixedOrder(ids, (id) => id.startsWith("kart"))).toEqual(mixed);
});

it("still places everything when one series dominates", () => {
  const heavy = ["who-1", "who-2", "who-3", "who-4", "other-1"];
  const mixed = suggestMixedOrder(heavy);
  expect([...mixed].sort()).toEqual([...heavy].sort());
  expect(longestRun(mixed).length).toBeLessThanOrEqual(3);
});

it("adds up and formats the show length", () => {
  expect(totalSeconds(["a", "b", "x"], (id) => ({ a: 60, b: 90 })[id])).toBe(150);
  expect(formatShowLength(150)).toBe("about 3 min");
  expect(formatShowLength(74 * 60)).toBe("about 1 h 14 min");
});

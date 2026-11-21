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

it("spreads series out, keeps their inner order and keeps kart then best dressed last", () => {
  const withFinale = [...ids, "best-dressed"];
  const mixed = suggestMixedOrder(withFinale, (id) =>
    id === "best-dressed" ? 2 : id.startsWith("kart") ? 1 : false,
  );
  expect([...mixed].sort()).toEqual([...withFinale].sort());
  expect(mixed.slice(-2)).toEqual(["kart-sprint", "best-dressed"]);
  expect(longestRun(mixed).length).toBe(1);
  const councils = mixed.filter((id) => id.startsWith("council"));
  expect(councils).toEqual(["council-a", "council-b", "council-c", "council-d"]);
  // Deterministic: the same input gives the same suggestion.
  expect(
    suggestMixedOrder(withFinale, (id) =>
      id === "best-dressed" ? 2 : id.startsWith("kart") ? 1 : false,
    ),
  ).toEqual(mixed);

  const reordered = suggestMixedOrder(
    ["best-dressed", "warm-up", "kart-sprint"],
    (id) => (id === "best-dressed" ? 2 : id.startsWith("kart") ? 1 : false),
  );
  expect(reordered).toEqual(["warm-up", "kart-sprint", "best-dressed"]);
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

import { expect, it } from "vitest";
import { createFrameProbe, graphicsTier } from "./graphics";

it("scales automatically at 16 and 21 racers and keeps manual choices", () => {
  expect(graphicsTier("auto", 15, "smooth")).toBe("high");
  expect(graphicsTier("auto", 16, "smooth")).toBe("balanced");
  expect(graphicsTier("auto", 20, "smooth")).toBe("balanced");
  expect(graphicsTier("auto", 21, "smooth")).toBe("low");
  expect(graphicsTier("auto", 2, "strained")).toBe("low");
  expect(graphicsTier("high", 80, "strained")).toBe("high");
  expect(graphicsTier("low", 1, "smooth")).toBe("low");
});

it("ignores warm-up and suspended time and measures sustained frame cadence", () => {
  const probe = createFrameProbe();
  for (let now = 1; now < 1900; now += 80) expect(probe.sample(now)).toBeUndefined();
  let result;
  for (let now = 1901; now < 15_000; now += 55) result = probe.sample(now) ?? result;
  expect(result).toBe("strained");
  expect(probe.sample(50_000)).toBeUndefined();
  result = undefined;
  for (let now = 50_001; now < 58_000; now += 16) result = probe.sample(now) ?? result;
  expect(result).toBe("smooth");
});

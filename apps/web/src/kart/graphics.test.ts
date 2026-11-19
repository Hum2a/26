import { expect, it } from "vitest";
import {
  createFrameProbe,
  displayPixelRatioLimit,
  graphicsTier,
  safeGraphicsProfile,
} from "./graphics";

it("caps graphics by actual capabilities and refuses unusable WebGL without changing manual preference", () => {
  expect(
    safeGraphicsProfile("high", {
      webgl: true,
      maxTextureSize: 1024,
      pixelRatioLimit: 3,
    }),
  ).toMatchObject({ tier: "low", pixelRatio: 0.75 });
  expect(
    safeGraphicsProfile("high", {
      webgl: true,
      maxTextureSize: 4096,
      pixelRatioLimit: 1,
    }),
  ).toMatchObject({ tier: "high", pixelRatio: 1 });
  expect(
    safeGraphicsProfile("low", {
      webgl: true,
      maxTextureSize: 4096,
      pixelRatioLimit: NaN,
    })?.pixelRatio,
  ).toBe(0.75);
  expect(
    safeGraphicsProfile("high", {
      webgl: false,
      maxTextureSize: 4096,
      pixelRatioLimit: 2,
    }),
  ).toBeNull();
  expect(
    safeGraphicsProfile("high", {
      webgl: true,
      maxTextureSize: NaN,
      pixelRatioLimit: 2,
    }),
  ).toBeNull();
});

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

it("draws a phone sharper on High than on Low for the same screen", () => {
  const high = displayPixelRatioLimit("high", true, 900, 700, 2);
  const low = displayPixelRatioLimit("low", true, 900, 700, 2);
  expect(high).toBeGreaterThan(low);
  expect(high).toBeLessThanOrEqual(1);
  expect(low).toBeGreaterThanOrEqual(0.35);
  expect(displayPixelRatioLimit("high", false, 900, 700, 2)).toBe(2);
});

it("draws a phone sharply when the guest picks High themselves", () => {
  const auto = displayPixelRatioLimit("high", true, 390, 844, 3);
  const chosen = displayPixelRatioLimit("high", true, 390, 844, 3, true);
  const low = displayPixelRatioLimit("low", true, 390, 844, 3, true);
  expect(auto).toBeLessThan(1);
  expect(chosen).toBeGreaterThanOrEqual(1);
  expect(chosen).toBeGreaterThan(auto * 1.5);
  expect(low).toBeLessThan(auto);
  // Never above the screen's own ratio, and capped by the High profile.
  expect(displayPixelRatioLimit("high", true, 390, 844, 1, true)).toBe(1);
  expect(
    safeGraphicsProfile("high", {
      webgl: true,
      maxTextureSize: 4096,
      pixelRatioLimit: chosen,
    })?.pixelRatio,
  ).toBe(1.5);
});

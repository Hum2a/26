import { expect, it } from "vitest";
import { createFrameProbe, graphicsTier, safeGraphicsProfile } from "./graphics";

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

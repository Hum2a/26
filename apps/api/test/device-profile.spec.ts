import { describe, expect, it } from "vitest";
import { normaliseDeviceReport } from "@26/shared";
import {
  deviceExtreme,
  deviceOddOneOut,
  deviceTally,
  devicesWhere,
  read,
  type PlayerDevice,
} from "../src/device/profile.ts";

const iphone =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Safari/604.1";
const android = "Mozilla/5.0 (Linux; Android 14) Chrome/128.0.0.0 Mobile Safari/537.36";

function device(
  nickname: string,
  userAgent: string,
  extra: Record<string, unknown> = {},
  medianRttMs: number | null = null,
): PlayerDevice {
  const report = normaliseDeviceReport({ userAgent, ...extra });
  if (!report) {
    throw new Error("report did not normalise");
  }
  return {
    playerId: crypto.randomUUID(),
    nickname,
    report,
    reportedAt: 0,
    connection: { medianRttMs, upperRttMs: null, reconnects: 0 },
  };
}

describe("device profile helpers", () => {
  const room = [
    device("Amina", iphone, { colorScheme: "dark" }, 40),
    device("Bilal", iphone, { colorScheme: "dark" }, 220),
    device("Chen", android, { colorScheme: "light" }, 90),
    device("Dee", iphone, { colorScheme: "dark" }),
  ];

  it("finds the odd one out", () => {
    expect(deviceOddOneOut(room, read.family)).toMatchObject({
      device: { nickname: "Chen" },
      value: "android",
      othersValue: "iphone",
    });
    expect(deviceOddOneOut(room, read.colorScheme)?.device.nickname).toBe("Chen");
  });

  it("refuses an odd one out with too few players or no single outlier", () => {
    expect(deviceOddOneOut(room.slice(2), read.family)).toBeNull();
    expect(deviceOddOneOut([...room, device("Eve", android)], read.family)).toBeNull();
  });

  it("picks extremes, skipping unknowns and refusing ties", () => {
    expect(deviceExtreme(room, read.rttMs, "highest")).toMatchObject({
      device: { nickname: "Bilal" },
      value: 220,
    });
    expect(deviceExtreme(room, read.rttMs, "lowest")?.device.nickname).toBe("Amina");
    expect(
      deviceExtreme(
        [device("A", iphone, {}, 50), device("B", iphone, {}, 50)],
        read.rttMs,
        "highest",
      ),
    ).toBeNull();
    expect(deviceExtreme([], read.rttMs, "highest")).toBeNull();
  });

  it("tallies and filters", () => {
    expect(deviceTally(room, read.family)).toEqual([
      { value: "iphone", count: 3, nicknames: ["Amina", "Bilal", "Dee"] },
      { value: "android", count: 1, nicknames: ["Chen"] },
    ]);
    expect(
      devicesWhere(room, (item) => read.colorScheme(item) === "light").map(
        (item) => item.nickname,
      ),
    ).toEqual(["Chen"]);
  });
});

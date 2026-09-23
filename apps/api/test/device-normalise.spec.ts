import { describe, expect, it } from "vitest";
import {
  detailedTelemetryPolicy,
  guarded,
  normaliseDeviceReport,
  reportedScreenGroup,
} from "@26/shared";

const secretUa =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) SECRET-UA-TOKEN";

describe("device report normalisation", () => {
  it("keeps absent APIs unknown and drops a raw user agent, an IP, and a model", () => {
    expect(normaliseDeviceReport(null)).toBeNull();
    const empty = normaliseDeviceReport({});
    expect(empty?.deviceFamily).toBe("unknown");
    expect(empty?.classification).toBe("unknown");
    expect(empty?.screen.width).toBeNull();
    expect(empty?.network.quality).toBe("unknown");
    expect(empty?.network.bearer).toBe("unknown");
    expect(empty?.physical).toEqual({ size: "unknown", model: "unknown" });
    const spoofed = normaliseDeviceReport({
      userAgent: secretUa,
      ip: "203.0.113.8",
      model: "iPhone 16 Pro",
      physicalSize: "large",
      screen: { width: 999_999, height: -4 },
      viewport: { width: 390, height: 844 },
      effectiveType: "4g",
      hardwareConcurrency: 10_000,
      languages: ["en-GB", "<script>", "fr"],
      timeZone: "Europe/London",
    });
    const stored = JSON.stringify(spoofed);
    expect(stored).not.toContain("SECRET-UA-TOKEN");
    expect(stored).not.toContain("203.0.113.8");
    expect(stored).not.toContain("iPhone 16 Pro");
    expect(spoofed?.deviceFamily).toBe("iphone");
    expect(spoofed?.classification).toBe("reported");
    expect(spoofed?.osMajor).toBe(17);
    expect(spoofed?.screen.width).toBeNull();
    expect(spoofed?.viewport).toEqual({ width: 390, height: 844 });
    expect(spoofed?.network.quality).toBe("4g");
    expect(spoofed?.network.bearer).toBe("unknown");
    expect(spoofed?.hardware.logicalProcessors).toBeNull();
    expect(spoofed?.locale.languages).toEqual(["en-GB", "fr"]);
    expect(spoofed?.locale.timeZone).toBe("Europe/London");
    expect(spoofed?.physical.model).toBe("unknown");
  });

  it("keeps an ambiguous iPad and an ambiguous iOS hint visible", () => {
    const ipad = normaliseDeviceReport({
      platform: "macOS",
      maxTouchPoints: 5,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    });
    expect(ipad?.deviceFamily).toBe("ipad");
    expect(ipad?.classification).toBe("ambiguous");
    const ios = normaliseDeviceReport({ platform: "iOS", mobile: true });
    expect(ios?.deviceFamily).toBe("iphone");
    expect(ios?.classification).toBe("ambiguous");
    expect(reportedScreenGroup(390)).toBe("narrower");
    expect(reportedScreenGroup(768)).toBe("wider");
    expect(reportedScreenGroup(null)).toBe("unknown");
  });

  it("turns a throwing reader into the fallback", () => {
    expect(
      guarded(() => {
        throw new Error("blocked");
      }, "unknown"),
    ).toBe("unknown");
    expect(detailedTelemetryPolicy.retentionDays).toBe(30);
    expect(detailedTelemetryPolicy.retains).toContain("media_upload");
    expect(detailedTelemetryPolicy.retains).toContain("score_ledger");
    expect(detailedTelemetryPolicy.removes).toContain("device_context");
  });
});

/**
 * Browser-reported context for end-of-game statistics.
 * Collector version 1. A report never authorises a player or changes a score.
 *
 * Checked against MDN on 23 September 2026:
 * userAgentData, deviceMemory, hardwareConcurrency, NetworkInformation.effectiveType,
 * and Screen.width. Screen width is CSS pixels. effectiveType "4g" is a quality
 * bucket, not a cellular bearer. deviceMemory is a coarse gigabyte estimate.
 * hardwareConcurrency can be lower than the machine's core count.
 * High-entropy model hints are not requested.
 */

export const collectorVersion = 1;

export const deviceContextGapMs = 30_000;

export const maxDeviceContextsPerPlayer = 8;

export const rttSampleCap = 16;

export const reconnectCap = 40;

export const retryCap = 40;

/** Chosen before any party results. CSS pixels on the short screen edge, not inches. */
export const screenGroupVersion = 1;

export const widerScreenShortEdge = 700;

export const detailedTelemetryRetentionDays = 30;

export const telemetryRetentionJobId = "telemetry-retention";

export const deviceFamilies = [
  "iphone",
  "ipad",
  "android",
  "desktop",
  "other",
  "unknown",
] as const;

export const deviceClassifications = ["reported", "ambiguous", "unknown"] as const;

export type DeviceFamily = (typeof deviceFamilies)[number];

export type DeviceClassification = (typeof deviceClassifications)[number];

export type NetworkQuality = "slow-2g" | "2g" | "3g" | "4g" | "unknown";

export type NormalisedDeviceReport = {
  parserVersion: 1;
  deviceFamily: DeviceFamily;
  classification: DeviceClassification;
  inference: "client-hints" | "user-agent" | "unknown";
  osFamily: string;
  osMajor: number | null;
  browserFamily: string;
  browserMajor: number | null;
  screen: { width: number | null; height: number | null; shortEdge: number | null };
  screenGroup: "narrower" | "wider" | "unknown";
  viewport: { width: number | null; height: number | null };
  pixelRatio: number | null;
  orientation: "portrait" | "landscape" | "unknown";
  input: {
    maxTouchPoints: number | null;
    pointer: "coarse" | "fine" | "unknown";
    hover: "hover" | "none" | "unknown";
  };
  hardware: { logicalProcessors: number | null; memoryGb: number | null };
  locale: { languages: string[]; timeZone: string | null };
  presentation: {
    colorScheme: "light" | "dark" | "unknown";
    reducedMotion: "reduce" | "no-preference" | "unknown";
    mediaDevices: boolean | null;
    webSocket: boolean | null;
  };
  network: {
    quality: NetworkQuality;
    downlinkMbps: number | null;
    rttMs: number | null;
    saveData: boolean | null;
    bearer: "unknown";
  };
  physical: { size: "unknown"; model: "unknown" };
};

/**
 * Detailed telemetry expires. Results, answers, scores, and media do not.
 * Prompt 15 can copy this policy onto the archive.
 */
export const detailedTelemetryPolicy = {
  policyVersion: 1 as const,
  retentionDays: detailedTelemetryRetentionDays,
  clock: "room.created_at" as const,
  removes: ["device_context", "connection_summary.rtt_samples_json"] as const,
  retains: [
    "player",
    "choice_answer",
    "round_response",
    "text_response",
    "vote_ballot",
    "duel_answer",
    "duel_prediction",
    "name_reaction",
    "troll_effect",
    "score_ledger",
    "media_upload",
    "telemetry_aggregate",
    "connection_summary aggregates",
  ] as const,
};

export function guarded<T>(read: () => T, fallback: T): T {
  try {
    const value = read();
    return value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

export function reportedScreenGroup(
  shortEdge: number | null,
): "narrower" | "wider" | "unknown" {
  if (shortEdge === null) {
    return "unknown";
  }
  return shortEdge >= widerScreenShortEdge ? "wider" : "narrower";
}

export function normaliseDeviceReport(input: unknown): NormalisedDeviceReport | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  const record = input as Record<string, unknown>;
  const identity = classify(record);
  const screen = readSize(record.screen);
  const viewport = readSize(record.viewport);
  const shortEdge =
    screen.width !== null && screen.height !== null
      ? Math.min(screen.width, screen.height)
      : null;
  const languages = readLanguages(record.languages);
  return {
    parserVersion: collectorVersion,
    deviceFamily: identity.deviceFamily,
    classification: identity.classification,
    inference: identity.inference,
    osFamily: identity.osFamily,
    osMajor: identity.osMajor,
    browserFamily: identity.browserFamily,
    browserMajor: identity.browserMajor,
    screen: { width: screen.width, height: screen.height, shortEdge },
    screenGroup: reportedScreenGroup(shortEdge),
    viewport,
    pixelRatio: readNumber(record.pixelRatio, 0.5, 8, 2),
    orientation: readOrientation(record.orientation),
    input: {
      maxTouchPoints: readInteger(record.maxTouchPoints, 0, 32),
      pointer: readEnum(record.pointer, ["coarse", "fine"], "unknown"),
      hover: readEnum(record.hover, ["hover", "none"], "unknown"),
    },
    hardware: {
      logicalProcessors: readInteger(record.hardwareConcurrency, 1, 64),
      memoryGb: readNumber(record.deviceMemory, 0.25, 64, 2),
    },
    locale: {
      languages,
      timeZone: readTimeZone(record.timeZone),
    },
    presentation: {
      colorScheme: readEnum(record.colorScheme, ["light", "dark"], "unknown"),
      reducedMotion: readEnum(
        record.reducedMotion,
        ["reduce", "no-preference"],
        "unknown",
      ),
      mediaDevices: readBoolean(record.mediaDevices),
      webSocket: readBoolean(record.webSocket),
    },
    network: {
      quality: readEnum(record.effectiveType, ["slow-2g", "2g", "3g", "4g"], "unknown"),
      downlinkMbps: readNumber(record.downlinkMbps, 0, 100, 2),
      rttMs: readInteger(record.rttMs, 0, 10_000),
      saveData: readBoolean(record.saveData),
      bearer: "unknown",
    },
    physical: { size: "unknown", model: "unknown" },
  };
}

export function materialHash(report: NormalisedDeviceReport): string {
  return JSON.stringify({
    deviceFamily: report.deviceFamily,
    classification: report.classification,
    osFamily: report.osFamily,
    browserFamily: report.browserFamily,
    screen: bucketSize(report.screen),
    viewport: bucketSize(report.viewport),
    orientation: report.orientation,
    pointer: report.input.pointer,
    hover: report.input.hover,
    quality: report.network.quality,
    saveData: report.network.saveData,
    colorScheme: report.presentation.colorScheme,
  });
}

function classify(record: Record<string, unknown>): {
  deviceFamily: DeviceFamily;
  classification: DeviceClassification;
  inference: "client-hints" | "user-agent" | "unknown";
  osFamily: string;
  osMajor: number | null;
  browserFamily: string;
  browserMajor: number | null;
} {
  const ua = clip(record.userAgent, 300);
  const platform = clip(record.platform, 40);
  const mobile = record.mobile === true;
  const touch = readInteger(record.maxTouchPoints, 0, 32) ?? 0;
  let deviceFamily: DeviceFamily = "unknown";
  let classification: DeviceClassification = "unknown";
  let inference: "client-hints" | "user-agent" | "unknown" = "unknown";
  let osFamily = "unknown";

  if (/iPhone/i.test(ua)) {
    deviceFamily = "iphone";
    classification = "reported";
    inference = "user-agent";
    osFamily = "iOS";
  } else if (/iPad/i.test(ua)) {
    deviceFamily = "ipad";
    classification = "reported";
    inference = "user-agent";
    osFamily = "iPadOS";
  } else if (platform === "Android" || /Android/i.test(ua)) {
    deviceFamily = "android";
    classification = "reported";
    inference = platform === "Android" ? "client-hints" : "user-agent";
    osFamily = "Android";
  } else if ((platform === "macOS" || /Macintosh/i.test(ua)) && touch > 1) {
    deviceFamily = "ipad";
    classification = "ambiguous";
    inference = platform === "macOS" ? "client-hints" : "user-agent";
    osFamily = "iPadOS";
  } else if (platform === "iOS") {
    deviceFamily = "iphone";
    classification = "ambiguous";
    inference = "client-hints";
    osFamily = "iOS";
  } else if (platform === "Windows" || /Windows/i.test(ua)) {
    deviceFamily = "desktop";
    classification = "reported";
    inference = platform === "Windows" ? "client-hints" : "user-agent";
    osFamily = "Windows";
  } else if (platform === "macOS" || /Macintosh/i.test(ua)) {
    deviceFamily = "desktop";
    classification = "reported";
    inference = platform === "macOS" ? "client-hints" : "user-agent";
    osFamily = "macOS";
  } else if (platform === "Chrome OS" || /CrOS/i.test(ua)) {
    deviceFamily = "desktop";
    classification = "reported";
    inference = platform === "Chrome OS" ? "client-hints" : "user-agent";
    osFamily = "ChromeOS";
  } else if (platform === "Linux" || /Linux/i.test(ua)) {
    deviceFamily = "desktop";
    classification = "reported";
    inference = platform === "Linux" ? "client-hints" : "user-agent";
    osFamily = "Linux";
  } else if (mobile) {
    deviceFamily = "unknown";
    classification = "unknown";
  }

  const browser = readBrowser(record, ua);
  return {
    deviceFamily,
    classification,
    inference,
    osFamily,
    osMajor: readOsMajor(ua, osFamily),
    browserFamily: browser.family,
    browserMajor: browser.major,
  };
}

function readBrowser(
  record: Record<string, unknown>,
  ua: string,
): { family: string; major: number | null } {
  const brands = Array.isArray(record.brands) ? record.brands : [];
  const named = brands
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const brand = clip((item as { brand?: unknown }).brand, 40);
      const version = clip((item as { version?: unknown }).version, 16);
      return { brand, version };
    })
    .filter((item): item is { brand: string; version: string } => item !== null);
  const preferred = ["Microsoft Edge", "Google Chrome", "Firefox", "Safari", "Opera"];
  const match = preferred
    .map((name) => named.find((item) => item.brand === name))
    .find((item) => item !== undefined);
  if (match) {
    return {
      family: browserName(match.brand),
      major: majorOf(match.version),
    };
  }
  const edge = /Edg\/(\d+)/.exec(ua);
  if (edge?.[1]) {
    return { family: "edge", major: Number(edge[1]) };
  }
  const chrome = /Chrome\/(\d+)/.exec(ua);
  if (chrome?.[1] && !/Edg\//.test(ua)) {
    return { family: "chrome", major: Number(chrome[1]) };
  }
  const firefox = /Firefox\/(\d+)/.exec(ua);
  if (firefox?.[1]) {
    return { family: "firefox", major: Number(firefox[1]) };
  }
  const safari = /Version\/(\d+).+Safari\//.exec(ua);
  if (safari?.[1]) {
    return { family: "safari", major: Number(safari[1]) };
  }
  return { family: "unknown", major: null };
}

function browserName(brand: string): string {
  if (brand === "Microsoft Edge") {
    return "edge";
  }
  if (brand === "Google Chrome") {
    return "chrome";
  }
  if (brand === "Firefox") {
    return "firefox";
  }
  if (brand === "Safari") {
    return "safari";
  }
  if (brand === "Opera") {
    return "opera";
  }
  return "other";
}

function readOsMajor(ua: string, osFamily: string): number | null {
  if (osFamily === "iOS" || osFamily === "iPadOS") {
    return majorOf(/OS (\d+)/.exec(ua)?.[1] ?? "");
  }
  if (osFamily === "Android") {
    return majorOf(/Android (\d+)/.exec(ua)?.[1] ?? "");
  }
  if (osFamily === "Windows") {
    return majorOf(/Windows NT (\d+)/.exec(ua)?.[1] ?? "");
  }
  if (osFamily === "macOS") {
    return majorOf(/Mac OS X (\d+)/.exec(ua)?.[1] ?? "");
  }
  return null;
}

function readSize(value: unknown): { width: number | null; height: number | null } {
  if (!value || typeof value !== "object") {
    return { width: null, height: null };
  }
  const record = value as { width?: unknown; height?: unknown };
  return {
    width: readInteger(record.width, 1, 8_000),
    height: readInteger(record.height, 1, 8_000),
  };
}

function readOrientation(value: unknown): "portrait" | "landscape" | "unknown" {
  if (value === "portrait" || value === "landscape") {
    return value;
  }
  if (typeof value === "string" && value.startsWith("portrait")) {
    return "portrait";
  }
  if (typeof value === "string" && value.startsWith("landscape")) {
    return "landscape";
  }
  return "unknown";
}

function readLanguages(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  for (const item of value) {
    if (
      typeof item !== "string" ||
      !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,2}$/.test(item)
    ) {
      continue;
    }
    seen.add(item);
    if (seen.size === 4) {
      break;
    }
  }
  return [...seen];
}

function readTimeZone(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 64) {
    return null;
  }
  if (!/^[A-Za-z0-9_+-]{1,32}(?:\/[A-Za-z0-9_+-]{1,32}){0,2}$/.test(value)) {
    return null;
  }
  return value;
}

function readEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readInteger(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) {
    return null;
  }
  return rounded;
}

function readNumber(
  value: unknown,
  min: number,
  max: number,
  places: number,
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    return null;
  }
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function majorOf(value: string): number | null {
  if (!/^\d{1,3}$/.test(value)) {
    return null;
  }
  return Number(value);
}

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function bucketSize(size: { width: number | null; height: number | null }): {
  width: number | null;
  height: number | null;
} {
  return { width: bucket(size.width), height: bucket(size.height) };
}

function bucket(value: number | null): number | null {
  if (value === null) {
    return null;
  }
  return Math.round(value / 20) * 20;
}

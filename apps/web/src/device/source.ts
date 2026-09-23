import { guarded } from "@26/shared";

type Brand = { brand?: string; version?: string };

type ClientHints = {
  mobile?: boolean;
  platform?: string;
  brands?: Brand[];
};

type NetworkHint = {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
};

/**
 * Allowlisted browser fields. Each read is feature-detected and caught.
 * High-entropy model hints are not requested. Missing APIs stay absent.
 */
export function readDeviceReport(): Record<string, unknown> {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  const hints = guarded(
    () => (nav as Navigator & { userAgentData?: ClientHints }).userAgentData ?? null,
    null,
  );
  const network = guarded(
    () => (nav as Navigator & { connection?: NetworkHint }).connection ?? null,
    null,
  );
  const screenSize = guarded(() => {
    if (typeof screen === "undefined") {
      return null;
    }
    return { width: screen.width, height: screen.height };
  }, null);
  const viewport = guarded(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return { width: window.innerWidth, height: window.innerHeight };
  }, null);
  return {
    userAgent: guarded(() => nav?.userAgent ?? "", ""),
    platform: guarded(() => hints?.platform ?? "", ""),
    mobile: guarded(() => hints?.mobile ?? null, null),
    brands: guarded(() => hints?.brands ?? [], []),
    maxTouchPoints: guarded(() => nav?.maxTouchPoints, undefined),
    hardwareConcurrency: guarded(() => nav?.hardwareConcurrency, undefined),
    deviceMemory: guarded(
      () => (nav as Navigator & { deviceMemory?: number }).deviceMemory,
      undefined,
    ),
    languages: guarded(() => nav?.languages ?? [], []),
    timeZone: guarded(
      () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
      null,
    ),
    screen: screenSize,
    viewport,
    pixelRatio: guarded(() => window.devicePixelRatio, undefined),
    orientation: guarded(() => readOrientation(), "unknown"),
    pointer: guarded(() => readPointer(), "unknown"),
    hover: guarded(() => readHover(), "unknown"),
    colorScheme: guarded(() => readColorScheme(), "unknown"),
    reducedMotion: guarded(() => readMotion(), "unknown"),
    effectiveType: guarded(() => network?.effectiveType, undefined),
    downlinkMbps: guarded(() => network?.downlink, undefined),
    rttMs: guarded(() => network?.rtt, undefined),
    saveData: guarded(() => network?.saveData, undefined),
    mediaDevices: guarded(
      () => typeof nav?.mediaDevices?.getUserMedia === "function",
      null,
    ),
    webSocket: guarded(() => typeof WebSocket === "function", null),
  };
}

function readOrientation(): string {
  const type = screen.orientation?.type;
  if (typeof type === "string" && type.length > 0) {
    return type;
  }
  if (window.matchMedia("(orientation: portrait)").matches) {
    return "portrait";
  }
  if (window.matchMedia("(orientation: landscape)").matches) {
    return "landscape";
  }
  return "unknown";
}

function readPointer(): "coarse" | "fine" | "unknown" {
  if (window.matchMedia("(pointer: coarse)").matches) {
    return "coarse";
  }
  if (window.matchMedia("(pointer: fine)").matches) {
    return "fine";
  }
  return "unknown";
}

function readHover(): "hover" | "none" | "unknown" {
  if (window.matchMedia("(hover: hover)").matches) {
    return "hover";
  }
  if (window.matchMedia("(hover: none)").matches) {
    return "none";
  }
  return "unknown";
}

function readColorScheme(): "light" | "dark" | "unknown" {
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  if (window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "light";
  }
  return "unknown";
}

function readMotion(): "reduce" | "no-preference" | "unknown" {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return "reduce";
  }
  if (window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
    return "no-preference";
  }
  return "unknown";
}

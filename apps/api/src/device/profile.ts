import type { NormalisedDeviceReport } from "@26/shared";

/**
 * Read-only queries over the existing device report for easter eggs.
 * Nothing new is collected here. A device is a playful comparison, never an
 * identity, a login or a score, and it stays off the projector unless an
 * easter egg deliberately shows a comparison.
 *
 * Readers take the room's `SqlStorage`. The helpers below them are pure and
 * work on any `PlayerDevice[]`, so easter egg logic can be unit tested.
 */
export type PlayerDevice = {
  playerId: string;
  nickname: string;
  /** The phone's latest report. A transfer to a new phone starts a new one. */
  report: NormalisedDeviceReport;
  reportedAt: number;
  connection: {
    medianRttMs: number | null;
    upperRttMs: number | null;
    reconnects: number;
  } | null;
};

/** The current device for one active player, or null before the phone reports. */
export function playerDevice(sql: SqlStorage, playerId: string): PlayerDevice | null {
  return readDevices(sql, playerId)[0] ?? null;
}

/** The current device for every active player who has reported, by nickname. */
export function roomDevices(sql: SqlStorage): PlayerDevice[] {
  return readDevices(sql, null);
}

/** Players whose device matches. */
export function devicesWhere(
  devices: readonly PlayerDevice[],
  test: (device: PlayerDevice) => boolean,
): PlayerDevice[] {
  return devices.filter(test);
}

/**
 * The single player with the highest or lowest value. Unknown values are
 * skipped. A tie returns null so an easter egg never picks someone arbitrarily.
 */
export function deviceExtreme(
  devices: readonly PlayerDevice[],
  read: (device: PlayerDevice) => number | null,
  direction: "highest" | "lowest",
): { device: PlayerDevice; value: number } | null {
  const known = devices.flatMap((device) => {
    const value = read(device);
    return value === null ? [] : [{ device, value }];
  });
  if (known.length === 0) {
    return null;
  }
  const sorted = known.sort((left, right) =>
    direction === "highest" ? right.value - left.value : left.value - right.value,
  );
  const [first, second] = sorted;
  if (!first || (second && second.value === first.value)) {
    return null;
  }
  return first;
}

/**
 * The only player whose value differs from everyone else, e.g. the one Android
 * in a room of iPhones. Needs at least three known values. Unknown is skipped.
 */
export function deviceOddOneOut(
  devices: readonly PlayerDevice[],
  read: (device: PlayerDevice) => string | null,
): { device: PlayerDevice; value: string; othersValue: string } | null {
  const known = devices.flatMap((device) => {
    const value = read(device);
    return value === null || value === "unknown" ? [] : [{ device, value }];
  });
  if (known.length < 3) {
    return null;
  }
  const counts = countBy(known.map((item) => item.value));
  if (counts.size !== 2) {
    return null;
  }
  const [[a, aCount], [b, bCount]] = [...counts] as [
    [string, number],
    [string, number],
  ];
  const odd = aCount === 1 ? a : bCount === 1 ? b : null;
  if (odd === null || aCount === bCount) {
    return null;
  }
  const match = known.find((item) => item.value === odd);
  return match
    ? { device: match.device, value: odd, othersValue: odd === a ? b : a }
    : null;
}

/** How many players share each value, most common first. Unknown is skipped. */
export function deviceTally(
  devices: readonly PlayerDevice[],
  read: (device: PlayerDevice) => string | null,
): { value: string; count: number; nicknames: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const device of devices) {
    const value = read(device);
    if (value === null || value === "unknown") {
      continue;
    }
    groups.set(value, [...(groups.get(value) ?? []), device.nickname]);
  }
  return [...groups]
    .map(([value, nicknames]) => ({ value, count: nicknames.length, nicknames }))
    .sort(
      (left, right) =>
        right.count - left.count || left.value.localeCompare(right.value),
    );
}

/** Ready-made readers so easter eggs do not dig through the report shape. */
export const read = {
  family: (device: PlayerDevice) => device.report.deviceFamily,
  os: (device: PlayerDevice) => device.report.osFamily,
  osMajor: (device: PlayerDevice) => device.report.osMajor,
  browser: (device: PlayerDevice) => device.report.browserFamily,
  browserMajor: (device: PlayerDevice) => device.report.browserMajor,
  colorScheme: (device: PlayerDevice) => device.report.presentation.colorScheme,
  reducedMotion: (device: PlayerDevice) => device.report.presentation.reducedMotion,
  orientation: (device: PlayerDevice) => device.report.orientation,
  screenGroup: (device: PlayerDevice) => device.report.screenGroup,
  screenShortEdge: (device: PlayerDevice) => device.report.screen.shortEdge,
  screenArea: (device: PlayerDevice) => {
    const { width, height } = device.report.screen;
    return width === null || height === null ? null : width * height;
  },
  viewportHeight: (device: PlayerDevice) => device.report.viewport.height,
  pixelRatio: (device: PlayerDevice) => device.report.pixelRatio,
  touch: (device: PlayerDevice) => device.report.input.maxTouchPoints,
  pointer: (device: PlayerDevice) => device.report.input.pointer,
  processors: (device: PlayerDevice) => device.report.hardware.logicalProcessors,
  memoryGb: (device: PlayerDevice) => device.report.hardware.memoryGb,
  timeZone: (device: PlayerDevice) => device.report.locale.timeZone,
  language: (device: PlayerDevice) => device.report.locale.languages[0] ?? null,
  networkQuality: (device: PlayerDevice) => device.report.network.quality,
  saveData: (device: PlayerDevice) =>
    device.report.network.saveData === null
      ? null
      : String(device.report.network.saveData),
  rttMs: (device: PlayerDevice) => device.connection?.medianRttMs ?? null,
  reconnects: (device: PlayerDevice) => device.connection?.reconnects ?? null,
};

function countBy(values: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function readDevices(sql: SqlStorage, playerId: string | null): PlayerDevice[] {
  const rows = sql
    .exec<{
      player_id: string;
      nickname: string;
      report_json: string;
      created_at: number;
      rtt_median_ms: number | null;
      rtt_upper_ms: number | null;
      reconnects: number | null;
    }>(
      `SELECT player.player_id, player.nickname, context.report_json, context.created_at,
              summary.rtt_median_ms, summary.rtt_upper_ms, summary.reconnects
       FROM player
       JOIN device_context AS context ON context.context_id = (
         SELECT latest.context_id FROM device_context AS latest
         WHERE latest.player_id = player.player_id
         ORDER BY latest.created_at DESC LIMIT 1
       )
       LEFT JOIN connection_summary AS summary ON summary.player_id = player.player_id
       WHERE player.revoked_at IS NULL AND (? IS NULL OR player.player_id = ?)
       ORDER BY player.nickname`,
      playerId,
      playerId,
    )
    .toArray();
  return rows.flatMap((row) => {
    const report = parseReport(row.report_json);
    if (!report) {
      return [];
    }
    return [
      {
        playerId: row.player_id,
        nickname: row.nickname,
        report,
        reportedAt: row.created_at,
        connection:
          row.reconnects === null
            ? null
            : {
                medianRttMs: row.rtt_median_ms,
                upperRttMs: row.rtt_upper_ms,
                reconnects: row.reconnects,
              },
      },
    ];
  });
}

function parseReport(json: string): NormalisedDeviceReport | null {
  try {
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === "object" && "deviceFamily" in parsed
      ? (parsed as NormalisedDeviceReport)
      : null;
  } catch {
    return null;
  }
}

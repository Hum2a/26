import { z } from "zod";
import { advanceKartLap, type KartLapCursor } from "./kart-laps.ts";
import { importedLapLength, importedTrackProgress } from "./kart-route.ts";
import { kartHandlingSchema } from "./kart-handling.ts";

export const kartTrialConfigSchema = z
  .object({
    version: z.literal(1),
    track: z.literal("mario-circuit-v1"),
    physics: z.literal("arcade-v2"),
    handling: kartHandlingSchema,
    laps: z.union([z.literal(1), z.literal(3)]),
    assists: z.literal("none"),
    items: z.boolean(),
    course: z
      .object({ boosts: z.boolean(), ramps: z.boolean(), hazards: z.boolean() })
      .strict(),
  })
  .strict();
export type KartTrialConfig = z.infer<typeof kartTrialConfigSchema>;
export type KartTrialQuality = "clean" | "assisted" | "invalid";
export type KartTrialLap = {
  timeMs: number;
  sectorsMs: number[];
  quality: KartTrialQuality;
};
export type KartTrial = {
  config: KartTrialConfig;
  cursor: KartLapCursor;
  observedMs: number;
  startedMs: number | null;
  lapStartedMs: number | null;
  elapsedMs: number;
  lapElapsedMs: number;
  sectorsMs: number[];
  laps: KartTrialLap[];
  quality: KartTrialQuality;
  notice: string;
  finished: boolean;
};

/** Practice only. The room never accepts a trial result or lap claim. */
export function createKartTrial(config: KartTrialConfig): KartTrial {
  const projection = importedTrackProgress(0, 8);
  return {
    config: kartTrialConfigSchema.parse(config),
    cursor: {
      angle: projection.along,
      distance: projection.along - importedLapLength,
      checkpoint: 0,
    },
    observedMs: 0,
    startedMs: null,
    lapStartedMs: null,
    elapsedMs: 0,
    lapElapsedMs: 0,
    sectorsMs: [],
    laps: [],
    quality: "clean",
    notice: "Cross the timing line ahead to start",
    finished: false,
  };
}

export function stepKartTrial(
  state: KartTrial,
  sample: { x: number; z: number; speed: number; stepMs: number; activeMs: number },
): KartTrial {
  if (state.finished || sample.activeMs <= state.observedMs) return state;
  const projection = importedTrackProgress(sample.x, sample.z);
  const cursor = advanceKartLap(state.cursor, {
    along: projection.along,
    routeDistance: projection.distance,
    lapLength: importedLapLength,
    speed: sample.speed,
    stepMs: sample.stepMs,
  });
  if (state.startedMs === null) {
    const crossed =
      cursor.safeProgress &&
      state.cursor.distance < 0 &&
      cursor.distance >= 0 &&
      state.cursor.angle > importedLapLength / 2 &&
      projection.along < importedLapLength / 2;
    return {
      ...state,
      cursor,
      observedMs: sample.activeMs,
      ...(crossed
        ? {
            startedMs: sample.activeMs,
            lapStartedMs: sample.activeMs,
            notice: "Trial started — follow all eight sectors",
          }
        : {}),
    };
  }
  const elapsedMs = sample.activeMs - state.startedMs;
  const lapElapsedMs = sample.activeMs - state.lapStartedMs!;
  const quality = cursor.safeProgress ? state.quality : "invalid";
  const notice = cursor.safeProgress
    ? state.notice
    : "Lap invalid — return to the route or restart for a clean run";
  const sectorsMs =
    cursor.checkpoint > state.cursor.checkpoint
      ? [
          ...state.sectorsMs,
          lapElapsedMs - state.sectorsMs.reduce((sum, value) => sum + value, 0),
        ]
      : state.sectorsMs;
  if (!cursor.finished)
    return {
      ...state,
      cursor,
      observedMs: sample.activeMs,
      elapsedMs,
      lapElapsedMs,
      sectorsMs,
      quality,
      notice,
    };
  const laps = [...state.laps, { timeMs: lapElapsedMs, sectorsMs, quality }];
  const finished = laps.length === state.config.laps;
  return {
    ...state,
    cursor: finished
      ? cursor
      : {
          angle: cursor.angle,
          distance: cursor.distance - importedLapLength,
          checkpoint: 0,
        },
    observedMs: sample.activeMs,
    elapsedMs,
    lapElapsedMs: finished ? lapElapsedMs : 0,
    lapStartedMs: sample.activeMs,
    laps,
    sectorsMs: finished ? sectorsMs : [],
    quality: finished ? quality : "clean",
    finished,
    notice: finished ? "Trial complete" : `Lap ${laps.length + 1} — keep going`,
  };
}

export function recoverKartTrial(state: KartTrial, cursor: KartLapCursor): KartTrial {
  if (state.finished) return state;
  return {
    ...state,
    cursor: { ...cursor },
    sectorsMs: state.sectorsMs.slice(0, cursor.checkpoint),
    quality:
      state.startedMs === null
        ? state.quality
        : state.quality === "invalid"
          ? "invalid"
          : "assisted",
    notice:
      state.startedMs === null
        ? "Cross the timing line ahead to start"
        : state.quality === "invalid"
          ? "Recovery used — this lap remains invalid"
          : "Recovery used — this lap is assisted",
  };
}

export function kartTrialQuality(state: KartTrial): KartTrialQuality {
  const qualities = [...state.laps.map((lap) => lap.quality), state.quality];
  return qualities.includes("invalid")
    ? "invalid"
    : qualities.includes("assisted")
      ? "assisted"
      : "clean";
}

const trialTime = z.number().int().positive().max(86_400_000);
export const kartTrialRecordSchema = z
  .object({
    config: kartTrialConfigSchema,
    quality: z.enum(["clean", "assisted"]),
    totalMs: trialTime,
    lapsMs: z.array(trialTime).min(1).max(3),
  })
  .strict()
  .refine(
    (record) =>
      record.lapsMs.length === record.config.laps &&
      record.lapsMs.reduce((sum, time) => sum + time, 0) === record.totalMs,
  );
export type KartTrialRecord = z.infer<typeof kartTrialRecordSchema>;
export function kartTrialRecord(state: KartTrial): KartTrialRecord | undefined {
  const quality = kartTrialQuality(state);
  if (!state.finished || quality === "invalid") return undefined;
  const result = kartTrialRecordSchema.safeParse({
    config: state.config,
    quality,
    totalMs: state.elapsedMs,
    lapsMs: state.laps.map((lap) => lap.timeMs),
  });
  return result.success ? result.data : undefined;
}

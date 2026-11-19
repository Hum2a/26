import { z } from "zod";
import {
  kartCpuInput,
  kartCpuMax,
  kartCpuNames,
  kartCpuPlayerId,
  kartCpuSkill,
} from "./kart-cpu.ts";
import { courseEnabled, soloCourse, type CourseSettings } from "./kart-course.ts";
import { defaultDriverStyle, type DriverStyle } from "./kart-driver.ts";
import {
  clearOfWalls,
  createDrivingBody,
  soloDriving,
  stepDriving,
  type DrivingBody,
} from "./kart-driving.ts";
import { type KartHandling } from "./kart-handling.ts";
import { advanceKartLap, type KartLapCursor } from "./kart-laps.ts";
import { nearSegment, type OilSlick } from "./kart-powers.ts";
import {
  importedLapLength,
  importedTrackId,
  importedTrackProgress,
} from "./kart-route.ts";
import { type SlipstreamKart } from "./kart-slipstream.ts";
import { type KartTrial } from "./kart-time-trial.ts";
import { importedSurfaceAt, nearbyImportedWalls } from "./kart-track.ts";

export const kartPracticeBotMax = kartCpuMax;
export const kartPracticeBotCountSchema = z.number().int().min(0).max(kartCpuMax);

export type PracticeMode = "free" | "trial-1" | "trial-3";

export type PracticeBot = {
  playerId: string;
  name: string;
  number: number;
  skill: number;
  style: DriverStyle;
  body: DrivingBody;
  previous: DrivingBody;
  lastSafe: {
    x: number;
    z: number;
    heading: number;
    cursor: KartLapCursor;
    lapsDone: number;
  };
  cursor: KartLapCursor;
  lapsDone: number;
  lapsMs: number[];
  lapStartedMs: number;
  progress: number;
  finished: boolean;
  finishTimeMs: number | null;
  stuckMs: number;
  slowedUntil: number;
  hitOilIds: string[];
};

export type PracticeStanding = {
  playerId: string;
  name: string;
  number: number;
  isPlayer: boolean;
  finished: boolean;
  timeMs: number | null;
  progress: number;
  lapsDone: number;
  place: number;
};

/**
 * Clean verified-road grid slots around the solo player.
 * Free drive surrounds (0, 0); timed practice lines up behind the z = 0 timing line
 * around the player at (0, 8).
 */
const freeGridSlots: readonly (readonly [number, number])[] = [
  [-4, -3],
  [4, -3],
  [-8, 0],
  [8, 0],
  [-4, 3],
  [4, 3],
  [0, 6],
];

const trialGridSlots: readonly (readonly [number, number])[] = [
  [-4, 5],
  [4, 5],
  [-8, 8],
  [8, 8],
  [-4, 11],
  [0, 11],
  [4, 11],
];

export function practiceModeLaps(mode: PracticeMode): number {
  return mode === "trial-3" ? 3 : 1;
}

export function createPracticeBots(options: {
  count: number;
  mode: PracticeMode;
  practiceFeatureId?: string | null;
}): PracticeBot[] {
  if (options.practiceFeatureId) return [];
  const parsed = kartPracticeBotCountSchema.safeParse(options.count);
  const count = parsed.success ? parsed.data : 0;
  if (count === 0) return [];
  const slots = options.mode === "free" ? freeGridSlots : trialGridSlots;
  const heading = -Math.PI / 2;
  return Array.from({ length: count }, (_, index) => {
    const [x, z] = slots[index]!;
    const projection = importedTrackProgress(x, z);
    const cursor: KartLapCursor = {
      angle: projection.along,
      distance:
        projection.along > importedLapLength / 2
          ? projection.along - importedLapLength
          : projection.along,
      checkpoint: 0,
    };
    const body = createDrivingBody(x, z, heading);
    return {
      playerId: kartCpuPlayerId(index),
      name: kartCpuNames[index]!,
      number: index + 2,
      skill: kartCpuSkill(index),
      style: defaultDriverStyle(index + 1),
      body,
      previous: body,
      lastSafe: { x, z, heading, cursor: { ...cursor }, lapsDone: 0 },
      cursor,
      lapsDone: 0,
      lapsMs: [],
      lapStartedMs: 0,
      progress: 0,
      finished: false,
      finishTimeMs: null,
      stuckMs: 0,
      slowedUntil: 0,
      hitOilIds: [],
    };
  });
}

/** Advances every practice bot by one physics tick (<= 20 ms), purely. */
export function stepPracticeBots(
  bots: readonly PracticeBot[],
  options: {
    stepMs: number;
    elapsedMs: number;
    mode: PracticeMode;
    handling: KartHandling;
    courseSettings: CourseSettings;
    oils: readonly OilSlick[];
  },
): PracticeBot[] {
  if (
    !bots.length ||
    !Number.isFinite(options.stepMs) ||
    options.stepMs <= 0 ||
    options.stepMs > 20
  )
    return [...bots];
  const { stepMs, elapsedMs, mode, handling, courseSettings, oils } = options;
  const nextElapsed = elapsedMs + stepMs;
  const totalLaps = practiceModeLaps(mode);
  const features = soloCourse.filter((feature) =>
    courseEnabled(feature, courseSettings),
  );

  return bots.map((bot) => {
    if (bot.finished) {
      return bot.previous === bot.body ? bot : { ...bot, previous: bot.body };
    }

    let body = bot.body;
    let cursor = bot.cursor;
    let lapsDone = bot.lapsDone;
    let stuckMs = bot.stuckMs;

    const currentSpeed =
      body.vx * Math.cos(body.heading) + body.vz * Math.sin(body.heading);
    stuckMs = Math.abs(currentSpeed) < 1.5 ? stuckMs + stepMs : 0;
    if (stuckMs > 2500) {
      body = createDrivingBody(bot.lastSafe.x, bot.lastSafe.z, bot.lastSafe.heading);
      cursor = { ...bot.lastSafe.cursor };
      lapsDone = bot.lastSafe.lapsDone;
      stuckMs = 0;
    }

    const speed = body.vx * Math.cos(body.heading) + body.vz * Math.sin(body.heading);
    const input = kartCpuInput(
      { x: body.x, z: body.z, heading: body.heading, speed },
      importedTrackId,
      bot.skill,
      elapsedMs,
      bot.number,
    );
    const surface = importedSurfaceAt(body.x, body.z);
    const slowed = bot.slowedUntil > elapsedMs;

    let nextBody = stepDriving(
      { ...body, courseMs: elapsedMs },
      input,
      stepMs,
      soloDriving,
      nearbyImportedWalls(
        body.x,
        body.z,
        soloDriving.radius + Math.hypot(body.vx, body.vz) * 0.02,
      ),
      slowed || surface !== "road",
      true,
      features,
      handling,
    );

    let slowedUntil = bot.slowedUntil;
    const hitOilIds = bot.hitOilIds.filter((id) =>
      oils.some((oil) => oil.id === id && oil.expiresAt > nextElapsed),
    );
    if (!((nextBody.height ?? 0) > 0)) {
      for (const oil of oils) {
        if (
          oil.createdAt > nextElapsed ||
          oil.expiresAt <= nextElapsed ||
          hitOilIds.includes(oil.id) ||
          !nearSegment(body, nextBody, oil, 2)
        )
          continue;
        hitOilIds.push(oil.id);
        slowedUntil = nextElapsed + 1600;
        nextBody = {
          ...nextBody,
          vx: nextBody.vx * 0.35,
          vz: nextBody.vz * 0.35,
          boostMs: 0,
          driftMs: 0,
          wasDrifting: false,
        };
        break;
      }
    }

    const nextSpeed =
      nextBody.vx * Math.cos(nextBody.heading) +
      nextBody.vz * Math.sin(nextBody.heading);
    const projection = importedTrackProgress(nextBody.x, nextBody.z);
    const lap = advanceKartLap(cursor, {
      along: projection.along,
      routeDistance: projection.distance,
      lapLength: importedLapLength,
      speed: nextSpeed,
      stepMs,
    });

    let nextCursor: KartLapCursor = {
      angle: lap.angle,
      distance: lap.distance,
      checkpoint: lap.checkpoint,
    };
    let lastSafe = bot.lastSafe;
    if (
      lap.safeProgress &&
      !nextBody.contact &&
      !(nextBody.height ?? 0) &&
      importedSurfaceAt(nextBody.x, nextBody.z) === "road" &&
      clearOfWalls(
        nextBody.x,
        nextBody.z,
        nearbyImportedWalls(nextBody.x, nextBody.z, 3),
        soloDriving.radius + 2,
      )
    ) {
      lastSafe = {
        x: nextBody.x,
        z: nextBody.z,
        heading: nextBody.heading,
        cursor: { ...nextCursor },
        lapsDone,
      };
    }

    let lapsMs = bot.lapsMs;
    let lapStartedMs = bot.lapStartedMs;
    let finished = false;
    let finishTimeMs: number | null = null;
    let progress =
      mode === "free" ? lapsDone + lap.progress : (lapsDone + lap.progress) / totalLaps;

    if (lap.finished) {
      lapsMs = [...lapsMs, nextElapsed - lapStartedMs];
      lapsDone += 1;
      if (mode !== "free" && lapsDone >= totalLaps) {
        finished = true;
        finishTimeMs = nextElapsed;
        progress = 1;
        nextBody = {
          ...nextBody,
          vx: 0,
          vz: 0,
          boostMs: 0,
          driftMs: 0,
          wasDrifting: false,
        };
      } else {
        nextCursor = {
          angle: lap.angle,
          distance: lap.distance - importedLapLength,
          checkpoint: 0,
        };
        lapStartedMs = nextElapsed;
        lastSafe = {
          x: nextBody.x,
          z: nextBody.z,
          heading: nextBody.heading,
          cursor: { ...nextCursor },
          lapsDone,
        };
        progress = mode === "free" ? lapsDone : lapsDone / totalLaps;
      }
    }

    return {
      ...bot,
      body: nextBody,
      previous: body,
      lastSafe,
      cursor: nextCursor,
      lapsDone,
      lapsMs,
      lapStartedMs,
      progress,
      finished,
      finishTimeMs,
      stuckMs,
      slowedUntil,
      hitOilIds,
    };
  });
}

export function practiceBotSlipstreamActors(
  bots: readonly PracticeBot[],
): SlipstreamKart[] {
  return bots
    .filter((bot) => !bot.finished)
    .map((bot) => ({
      playerId: bot.playerId,
      x: bot.body.x,
      z: bot.body.z,
      heading: bot.body.heading,
      speed:
        bot.body.vx * Math.cos(bot.body.heading) +
        bot.body.vz * Math.sin(bot.body.heading),
    }));
}

export function practiceStandings(
  player: {
    progress: number;
    lapsDone: number;
    finished: boolean;
    timeMs: number | null;
  },
  bots: readonly PracticeBot[],
): PracticeStanding[] {
  const entries = [
    {
      playerId: "solo",
      name: "You",
      number: 1,
      isPlayer: true,
      finished: player.finished,
      timeMs: player.timeMs,
      progress: player.progress,
      lapsDone: player.lapsDone,
    },
    ...bots.map((bot) => ({
      playerId: bot.playerId,
      name: bot.name,
      number: bot.number,
      isPlayer: false,
      finished: bot.finished,
      timeMs: bot.finishTimeMs,
      progress: bot.progress,
      lapsDone: bot.lapsDone,
    })),
  ];

  entries.sort((a, b) => {
    if (a.finished && !b.finished) return -1;
    if (b.finished && !a.finished) return 1;
    if (a.finished && b.finished) return (a.timeMs ?? 0) - (b.timeMs ?? 0);
    return b.progress - a.progress || a.number - b.number;
  });

  let place = 1;
  return entries.map((entry, index) => {
    const previous = entries[index - 1];
    const tied =
      previous &&
      previous.finished === entry.finished &&
      (entry.finished
        ? previous.timeMs === entry.timeMs
        : previous.progress === entry.progress);
    if (previous && !tied) place = index + 1;
    return { ...entry, place };
  });
}

export type PracticePlayerLap = {
  cursor: KartLapCursor;
  lapsDone: number;
  progress: number;
};

export function createPracticePlayerLap(x: number, z: number): PracticePlayerLap {
  const projection = importedTrackProgress(x, z);
  const distance =
    projection.along > importedLapLength / 2
      ? projection.along - importedLapLength
      : projection.along;
  return {
    cursor: { angle: projection.along, distance, checkpoint: 0 },
    lapsDone: 0,
    progress: Math.max(0, distance / importedLapLength),
  };
}

/** Rewind free-drive lap cursor and lap count to a safe track anchor. */
export function recoverPracticePlayerLap(
  cursor: KartLapCursor,
  lapsDone: number,
): PracticePlayerLap {
  const safeLaps = Math.max(0, Math.floor(lapsDone));
  return {
    cursor: { ...cursor },
    lapsDone: safeLaps,
    progress: safeLaps + Math.max(0, cursor.distance / importedLapLength),
  };
}

export function stepPracticePlayerLap(
  state: PracticePlayerLap,
  sample: { x: number; z: number; speed: number; stepMs: number },
): PracticePlayerLap {
  const projection = importedTrackProgress(sample.x, sample.z);
  const lap = advanceKartLap(state.cursor, {
    along: projection.along,
    routeDistance: projection.distance,
    lapLength: importedLapLength,
    speed: sample.speed,
    stepMs: sample.stepMs,
  });
  if (lap.finished) {
    const lapsDone = state.lapsDone + 1;
    return {
      cursor: {
        angle: lap.angle,
        distance: lap.distance - importedLapLength,
        checkpoint: 0,
      },
      lapsDone,
      progress: lapsDone,
    };
  }
  return {
    cursor: { angle: lap.angle, distance: lap.distance, checkpoint: lap.checkpoint },
    lapsDone: state.lapsDone,
    progress: state.lapsDone + lap.progress,
  };
}

export function practiceTrialPlayerSummary(
  trial: KartTrial,
  raceFinishMs: number | null,
) {
  const totalLaps = trial.config.laps;
  const lapProgress = trial.finished
    ? 0
    : Math.max(0, trial.cursor.distance / importedLapLength);
  return {
    progress: trial.finished ? 1 : (trial.laps.length + lapProgress) / totalLaps,
    lapsDone: trial.laps.length,
    finished: trial.finished,
    timeMs: trial.finished ? raceFinishMs : null,
  };
}

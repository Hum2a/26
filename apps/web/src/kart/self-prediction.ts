import {
  createDrivingBody,
  advanceKartLap,
  parkRoute,
  type KartInput,
  type KartFinish,
  type KartRollback,
  indexWalls,
  kartTrackId,
  ringCourse,
  ringDriving,
  ringWalls,
  soloCourse,
  soloDriving,
  stepDriving,
  type CourseFeature,
  type DrivingBody,
  type DrivingInput,
  type DrivingProfile,
  type KartDriver,
  type KartRaceView,
  type Wall,
  type KartHandling,
  parkTrackId,
  nearbyParkWalls,
  parkSurfaceAt,
  parkCourse,
} from "@26/shared";
import {
  importedSurfaceAt,
  importedTrackProgress,
  importedLapLength,
  nearbyImportedWalls,
} from "../../../../packages/shared/src/kart/kart-track";

/**
 * Legacy cosmetic prediction. Device-v1 races use the exact rollback path below.
 *
 * The room stays authoritative: it alone decides gates, finishes, items and
 * points. This only changes where the phone draws its own kart, so steering and
 * pedals respond on the next frame instead of after a network round trip and
 * the next 200 ms server tick.
 *
 * Each server frame anchors the prediction. The anchor is the server's body at
 * `elapsedMs`, which reflects controls that reached the room about one round
 * trip before the frame arrived here. Replaying the phone's own recorded
 * controls from that moment to now gives the present pose. The difference from
 * the pose already on screen becomes a visual offset that eases away, so a
 * correction never snaps unless it is too large to be a prediction error.
 */

export type PredictedPose = Pick<
  KartDriver,
  "x" | "z" | "heading" | "speed" | "turnRate" | "height"
>;

type Sample = { at: number; input: DrivingInput };
type Environment = {
  profile: DrivingProfile;
  walls: (x: number, z: number, reach: number) => Wall[];
  offRoad: (x: number, z: number) => boolean;
  features: readonly CourseFeature[];
  handling: KartHandling;
};

const neutral: DrivingInput = { steer: 0, gas: false, brake: false, drift: false };
/** Physics step, matching the room's bounded integration. */
const stepMs = 20;
/** Never replay or extrapolate further than this; a stall waits for the room. */
const standardSpanMs = 600;
const historyMs = 3_000;
/** Beyond this the phone was wrong about more than timing: show the room's pose. */
const snapDistance = 6;
/** Visual correction rate per second (about 100 ms to settle). */
const standardCorrectionRate = 12;
/** "Conservative": shorter look-ahead and gentler corrections for poor networks. */
export const conservativePrediction = { correctionRate: 6, maxSpanMs: 300 };

const ringIndex = indexWalls(ringWalls);

function environment(race: KartRaceView): Environment {
  const ring = race.trackId === kartTrackId;
  const park = race.trackId === parkTrackId;
  return {
    profile: ring ? ringDriving : soloDriving,
    walls: park ? nearbyParkWalls : ring ? ringIndex : nearbyImportedWalls,
    offRoad: ring
      ? () => false
      : (x, z) => (park ? parkSurfaceAt(x, z) : importedSurfaceAt(x, z)) !== "road",
    features: race.courseEnabled
      ? park
        ? parkCourse
        : ring
          ? ringCourse
          : soloCourse
      : [],
    handling:
      race.presentation?.version === 2 || race.presentation?.version === 3
        ? (race.presentation.handling?.preset ?? "slide-v1")
        : "slide-v1",
  };
}

/** Rebuild a physics body from the public pose. Lateral slip is not public; it settles within a tick. */
function bodyFrom(driver: KartDriver, race: KartRaceView): DrivingBody {
  const body = createDrivingBody(driver.x, driver.z, driver.heading);
  body.vx = Math.cos(driver.heading) * driver.speed;
  body.vz = Math.sin(driver.heading) * driver.speed;
  body.turn = driver.turnRate ?? 0;
  body.driftMs = driver.driftChargeMs ?? driver.driftCharge * 700;
  body.wasDrifting = driver.drifting;
  body.boostMs = driver.boostRemainingMs;
  body.boostLevel = driver.boostLevel ?? 0;
  body.height = driver.height ?? 0;
  body.contact = driver.contact ?? false;
  if (
    (race.presentation?.version === 2 || race.presentation?.version === 3) &&
    race.presentation.handling
  ) {
    body.stunMs = race.presentation.handling.stunMs;
    body.impactCooldownMs = race.presentation.handling.cooldownMs;
  }
  return body;
}

const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

export type SelfPrediction = ReturnType<typeof createSelfPrediction>;

function createLegacyPrediction() {
  let maxSpanMs = standardSpanMs;
  let correctionRate = standardCorrectionRate;
  let inputs: Sample[] = [];
  let raceId: string | undefined;
  let lastElapsed = -1;
  let env: Environment | undefined;
  let environmentKey = "";
  let body: DrivingBody | undefined;
  let bodyAt = 0;
  /** Only a newer room frame extends the prediction window. */
  let frameAt = 0;
  /** Race time at a phone time: elapsed(t) = base.elapsed + t - base.at. */
  let base = { elapsed: 0, at: 0 };
  let slowedUntil = 0;
  let error = { x: 0, z: 0, heading: 0 };

  function inputAt(t: number): DrivingInput {
    for (let i = inputs.length - 1; i >= 0; i--)
      if (inputs[i]!.at <= t) return inputs[i]!.input;
    return neutral;
  }

  function advance(start: DrivingBody, from: number, to: number): DrivingBody {
    let next = start;
    for (let t = from; t < to;) {
      const ms = Math.min(stepMs, to - t);
      if (ms <= 0.01) break;
      const elapsed = base.elapsed + (t - base.at);
      const speed = Math.hypot(next.vx, next.vz);
      next = stepDriving(
        { ...next, courseMs: elapsed },
        inputAt(t),
        ms,
        env!.profile,
        env!.walls(next.x, next.z, env!.profile.radius + speed * 0.02),
        slowedUntil > elapsed || env!.offRoad(next.x, next.z),
        true,
        env!.features,
        env!.handling,
      );
      t += ms;
    }
    return next;
  }

  function reset() {
    body = undefined;
    lastElapsed = -1;
    error = { x: 0, z: 0, heading: 0 };
  }

  function predictionTime(now: number) {
    return Math.max(bodyAt, Math.min(now, frameAt + maxSpanMs));
  }

  return {
    /** Standard or conservative tuning, from the host's driving-feel setting. */
    configure(mode: "on" | "on-conservative") {
      maxSpanMs =
        mode === "on-conservative" ? conservativePrediction.maxSpanMs : standardSpanMs;
      correctionRate =
        mode === "on-conservative"
          ? conservativePrediction.correctionRate
          : standardCorrectionRate;
    },
    /** Record this phone's controls as they change. */
    input(value: DrivingInput, now: number) {
      const last = inputs[inputs.length - 1];
      if (
        last &&
        last.input.steer === value.steer &&
        last.input.gas === value.gas &&
        last.input.brake === value.brake &&
        last.input.drift === value.drift
      )
        return;
      inputs.push({ at: now, input: { ...value } });
      const cutoff = now - historyMs;
      const keep = inputs.findIndex((sample) => sample.at >= cutoff);
      // Keep the sample in force at the cutoff so replays start from it.
      if (keep > 1) inputs = inputs.slice(keep - 1);
    },

    /** Anchor on a server frame. Frames with no new race time are ignored. */
    server(race: KartRaceView, now: number, roundTripMs: number) {
      const self = race.participants.find(
        (driver) => driver.playerId === race.selfPlayerId,
      );
      if (!self || self.status !== "RACING" || race.ended) {
        reset();
        return;
      }
      if (race.raceId !== raceId) {
        raceId = race.raceId;
        // Keep the control currently held: controls only report changes, so
        // a pedal held as the race begins would otherwise be forgotten.
        inputs = inputs.slice(-1);
        reset();
      }
      // Host course changes can arrive without advancing the race clock.
      // Refresh presentation physics without treating that as a fresh pose.
      const nextEnvironmentKey = `${race.trackId}:${Boolean(race.courseEnabled)}:${race.presentation?.version === 2 || race.presentation?.version === 3 ? (race.presentation.handling?.preset ?? "slide-v1") : "slide-v1"}`;
      if (!env || nextEnvironmentKey !== environmentKey) {
        env = environment(race);
        environmentKey = nextEnvironmentKey;
      }
      if (race.elapsedMs === lastElapsed) return;
      const shown = body ? advance(body, bodyAt, predictionTime(now)) : undefined;
      lastElapsed = race.elapsedMs;
      frameAt = now;
      const rtt = Math.max(0, Math.min(maxSpanMs, roundTripMs));
      base = { elapsed: race.elapsedMs, at: now - rtt };
      const slowedMs =
        race.powers?.effects.find((effect) => effect.playerId === self.playerId)
          ?.slowedMs ?? 0;
      slowedUntil = race.elapsedMs + slowedMs;
      const replayed = advance(bodyFrom(self, race), base.at, now);
      if (shown) {
        const dx = shown.x + error.x - replayed.x,
          dz = shown.z + error.z - replayed.z;
        error =
          Math.hypot(dx, dz) > snapDistance
            ? { x: 0, z: 0, heading: 0 }
            : {
                x: dx,
                z: dz,
                heading: wrap(shown.heading + error.heading - replayed.heading),
              };
      }
      body = replayed;
      bodyAt = now;
    },

    /** The pose to draw now, or undefined when there is nothing to predict. */
    pose(now: number): PredictedPose | undefined {
      if (!body || !env) return undefined;
      const to = predictionTime(now);
      const dt = Math.max(0, to - bodyAt) / 1000;
      body = advance(body, bodyAt, to);
      bodyAt = to;
      const fade = Math.exp(-correctionRate * dt);
      error = { x: error.x * fade, z: error.z * fade, heading: error.heading * fade };
      return {
        x: body.x + error.x,
        z: body.z + error.z,
        heading: body.heading + error.heading,
        speed: body.vx * Math.cos(body.heading) + body.vz * Math.sin(body.heading),
        turnRate: Math.max(-10, Math.min(10, body.turn)),
        height: Math.max(0, body.height ?? 0),
      };
    },

    reset,
  };
}

/** A bounded replay of this kart only. Rendering offsets never feed back into physics. */
function createRollbackPrediction() {
  type Sample = { at: number; input: DrivingInput; sequence?: number };
  let race: KartRaceView | undefined;
  let env: Environment | undefined;
  let body: DrivingBody | undefined;
  let lap: KartRollback["lap"] | undefined;
  let revision = -1,
    recovery = -1,
    simulatedAt = 0;
  let clock = { at: 0, elapsed: 0 },
    active = false,
    initialised = false,
    needsAnchor = true;
  let samples: Sample[] = [];
  let control: DrivingInput = neutral;
  let finished: KartFinish | undefined;
  let error = { x: 0, z: 0, heading: 0 };
  let lastDraw = 0;
  const elapsed = (now: number) =>
    clock.elapsed + (active ? Math.max(0, now - clock.at) : 0);
  function reset() {
    race = undefined;
    body = undefined;
    lap = undefined;
    revision = -1;
    recovery = -1;
    samples = [];
    finished = undefined;
    initialised = false;
    error = { x: 0, z: 0, heading: 0 };
  }
  function advance(to: number) {
    if (!body || !env || !race || !lap || finished || !active) return;
    to = Math.min(to, race.timeLimitMs);
    // Tab suspension must never cause thousands of physics steps on resumption.
    if (to - simulatedAt > historyMs) {
      simulatedAt = to;
      return;
    }
    while (simulatedAt + stepMs <= to && !finished) {
      for (const sample of samples)
        if (sample.at <= simulatedAt) control = sample.input;
      const speed = Math.hypot(body.vx, body.vz);
      body = stepDriving(
        { ...body, courseMs: simulatedAt },
        control,
        stepMs,
        env.profile,
        env.walls(body.x, body.z, env.profile.radius + speed * 0.02),
        env.offRoad(body.x, body.z) ||
          (race.powers?.effects.some(
            (e) =>
              e.playerId === race!.selfPlayerId &&
              race!.elapsedMs + e.slowedMs > simulatedAt,
          ) ??
            false),
        true,
        env.features,
        env.handling,
      );
      simulatedAt += stepMs;
      const park = race.trackId === parkTrackId;
      const ring = race.trackId === kartTrackId;
      const projection = ring
        ? undefined
        : park
          ? parkRoute.progress(body.x, body.z)
          : importedTrackProgress(body.x, body.z);
      const length = ring
        ? Math.PI * 2
        : park
          ? parkRoute.lapLength
          : importedLapLength;
      const next = advanceKartLap(lap, {
        along: projection?.along ?? Math.atan2(body.z, body.x),
        lapLength: length,
        speed: Math.hypot(body.vx, body.vz),
        stepMs,
        ...(projection ? { routeDistance: projection.distance } : {}),
      });
      lap = {
        ...lap,
        angle: next.angle,
        distance: next.distance,
        checkpoint: next.checkpoint,
      };
      if (next.finished) {
        const time = Math.max(1, Math.round(simulatedAt));
        const splits: number[] = [...lap.splits, time];
        if (lap.done + 1 >= (race.laps ?? 1))
          finished = { raceId: race.raceId, elapsedMs: time, lapsMs: splits };
        else
          lap = {
            ...lap,
            done: lap.done + 1,
            splits,
            checkpoint: 0,
            distance: next.distance - length,
          };
      }
    }
  }
  return {
    reset,
    running(value: boolean, now: number) {
      if (active === value) return;
      if (initialised) {
        advance(elapsed(now));
        clock = { elapsed: elapsed(now), at: now };
      }
      active = value;
      if (value) needsAnchor = true;
    },
    input(value: DrivingInput, now: number, sequence?: number) {
      const at = initialised ? elapsed(now) : 0;
      samples.push({ at, input: { ...value }, sequence });
      // At most 300 controls, even if a noisy controller fires faster than the wire.
      samples = samples.filter((s) => s.at >= at - historyMs).slice(-300);
    },
    server(next: KartRaceView, now: number, roundTripMs: number) {
      if (race?.raceId !== next.raceId) reset();
      if (!next.rollback || next.ended) {
        body = undefined;
        return;
      }
      if (next.rollback.revision <= revision) return;
      const seed = next.rollback;
      if (!initialised) {
        clock = {
          elapsed:
            next.elapsedMs + (active ? Math.max(0, Math.min(500, roundTripMs / 2)) : 0),
          at: now,
        };
        initialised = true;
      }
      if (!active) clock = { elapsed: next.elapsedMs, at: now };
      else if (needsAnchor || next.elapsedMs > elapsed(now)) {
        clock = { elapsed: Math.max(elapsed(now), next.elapsedMs), at: now };
        needsAnchor = false;
      }
      const to = elapsed(now);
      const recovered = recovery !== -1 && recovery !== seed.recovery;
      if (!recovered) advance(to);
      const shown = body
        ? {
            x: body.x + error.x,
            z: body.z + error.z,
            heading: body.heading + error.heading,
          }
        : undefined;
      race = next;
      env = environment(next);
      revision = seed.revision;
      if (finished) return;
      if (recovered) samples = [];
      recovery = seed.recovery;
      // A very delayed checkpoint cannot erase driving outside retained history.
      if (body && to - next.elapsedMs > historyMs && !recovered) return;
      samples = samples.filter((s) =>
        s.sequence !== undefined
          ? s.sequence > seed.appliedSequence
          : s.at > next.elapsedMs,
      );
      body = { ...seed.body, featureCooldowns: { ...seed.body.featureCooldowns } };
      lap = { ...seed.lap, splits: [...seed.lap.splits] };
      control = seed.input;
      simulatedAt = next.elapsedMs;
      advance(to);
      if (
        shown &&
        !recovered &&
        Math.hypot(shown.x - body.x, shown.z - body.z) <= snapDistance
      )
        error = {
          x: shown.x - body.x,
          z: shown.z - body.z,
          heading: wrap(shown.heading - body.heading),
        };
      else error = { x: 0, z: 0, heading: 0 };
      lastDraw = now;
    },
    finish: () => finished,
    pose(now: number): PredictedPose | undefined {
      advance(elapsed(now));
      if (!body) return undefined;
      const fade = Math.exp((-12 * Math.max(0, now - lastDraw)) / 1000);
      error = { x: error.x * fade, z: error.z * fade, heading: error.heading * fade };
      lastDraw = now;
      return {
        x: body.x + error.x,
        z: body.z + error.z,
        heading: body.heading + error.heading,
        speed: body.vx * Math.cos(body.heading) + body.vz * Math.sin(body.heading),
        turnRate: Math.max(-10, Math.min(10, body.turn)),
        height: Math.max(0, body.height ?? 0),
      };
    },
  };
}

export function createSelfPrediction() {
  const legacy = createLegacyPrediction(),
    rollback = createRollbackPrediction();
  let device = false;
  const listeners = new Set<(pose: PredictedPose) => void>();
  return {
    configure: legacy.configure,
    input(value: DrivingInput, now: number) {
      legacy.input(value, now);
      rollback.input(value, now);
    },
    published(value: KartInput, now: number) {
      rollback.input(value, now, value.sequence);
    },
    running(value: boolean, now: number) {
      rollback.running(value, now);
    },
    server(race: KartRaceView, now: number, rtt: number) {
      device = race.timingMode === "device-v1";
      if (device) rollback.server(race, now, rtt);
      else legacy.server(race, now, rtt);
    },
    subscribe(listener: (pose: PredictedPose) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    pose(now: number) {
      const pose = device ? rollback.pose(now) : legacy.pose(now);
      if (pose) for (const listener of listeners) listener(pose);
      return pose;
    },
    finish() {
      return device ? rollback.finish() : undefined;
    },
    reset() {
      legacy.reset();
      rollback.reset();
    },
  };
}

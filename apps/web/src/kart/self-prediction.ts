import {
  createDrivingBody,
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
} from "@26/shared";
import {
  importedSurfaceAt,
  nearbyImportedWalls,
} from "../../../../packages/shared/src/kart-track";

/**
 * Cosmetic prediction of this phone's own kart.
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
};

const neutral: DrivingInput = { steer: 0, gas: false, brake: false, drift: false };
/** Physics step, matching the room's bounded integration. */
const stepMs = 20;
/** Never replay or extrapolate further than this; a stall waits for the room. */
const maxSpanMs = 600;
const historyMs = 3_000;
/** Beyond this the phone was wrong about more than timing: show the room's pose. */
const snapDistance = 6;
/** Visual correction rate per second (about 100 ms to settle). */
const correctionRate = 12;

const ringIndex = indexWalls(ringWalls);

function environment(race: KartRaceView): Environment {
  const ring = race.trackId === kartTrackId;
  return {
    profile: ring ? ringDriving : soloDriving,
    walls: ring ? ringIndex : nearbyImportedWalls,
    offRoad: ring ? () => false : (x, z) => importedSurfaceAt(x, z) !== "road",
    features: race.courseEnabled ? (ring ? ringCourse : soloCourse) : [],
  };
}

/** Rebuild a physics body from the public pose. Lateral slip is not public; it settles within a tick. */
function bodyFrom(driver: KartDriver): DrivingBody {
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
  return body;
}

const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

export type SelfPrediction = ReturnType<typeof createSelfPrediction>;

export function createSelfPrediction() {
  let inputs: Sample[] = [];
  let raceId: string | undefined;
  let lastElapsed = -1;
  let env: Environment | undefined;
  let body: DrivingBody | undefined;
  let bodyAt = 0;
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

  return {
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
        env = environment(race);
        inputs = [];
        reset();
      }
      if (race.elapsedMs === lastElapsed) return;
      lastElapsed = race.elapsedMs;
      const rtt = Math.max(0, Math.min(maxSpanMs, roundTripMs));
      base = { elapsed: race.elapsedMs, at: now - rtt };
      const slowedMs =
        race.powers?.effects.find((effect) => effect.playerId === self.playerId)
          ?.slowedMs ?? 0;
      slowedUntil = race.elapsedMs + slowedMs;
      const replayed = advance(bodyFrom(self), base.at, now);
      if (body) {
        const shown = advance(body, bodyAt, now);
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
      const from = Math.max(bodyAt, now - maxSpanMs);
      const dt = Math.max(0, now - bodyAt) / 1000;
      body = advance(body, from, now);
      bodyAt = now;
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

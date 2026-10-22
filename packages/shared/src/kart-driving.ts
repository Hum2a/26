/** Pure arcade driving and swept-circle contacts. No clocks, browser or rendering APIs. */
import { stepCourse, type CourseFeature } from "./kart-course.ts";
export type DrivingInput = {
  steer: number;
  gas: boolean;
  brake: boolean;
  drift: boolean;
};
export type Wall = { ax: number; az: number; bx: number; bz: number };
export type DrivingBody = {
  x: number;
  z: number;
  heading: number;
  vx: number;
  vz: number;
  turn: number;
  driftMs: number;
  boostMs: number;
  boostLevel?: number;
  height?: number;
  verticalSpeed?: number;
  courseMs?: number;
  featureCooldowns?: Record<string, number>;
  trackNotice?: "boost" | "ramp" | "hazard" | "landed";
  wasDrifting: boolean;
  /** Latched on entry; counter-steering widens the slide without losing charge. */
  driftSide?: number;
  contact: boolean;
  offRoad: boolean;
};
export type DrivingProfile = {
  /** Reference for steering and drift entry only; never a velocity limit. */
  maxSpeed: number;
  reverseSpeed: number;
  radius: number;
  acceleration: number;
  /** Power per unit mass (m²/s³); force falls as road speed rises. */
  power: number;
  drag: number;
  rollingResistance: number;
  turnRate: number;
  lowSpeedTurnRate?: number;
  driftTurnBase?: number;
};
export const ringDriving: DrivingProfile = {
  maxSpeed: 11,
  reverseSpeed: 3,
  radius: 0.8,
  acceleration: 5,
  power: 32,
  drag: 0.018,
  rollingResistance: 0.18,
  turnRate: 1.1,
};
export const soloDriving: DrivingProfile = {
  maxSpeed: 30,
  reverseSpeed: 8,
  radius: 0.85,
  acceleration: 12,
  power: 240,
  drag: 0.006,
  rollingResistance: 0.35,
  turnRate: 1.35,
  lowSpeedTurnRate: 2.4,
  driftTurnBase: 0.25,
};
export const createDrivingBody = (x = 0, z = 0, heading = 0): DrivingBody => ({
  x,
  z,
  heading,
  vx: 0,
  vz: 0,
  turn: 0,
  driftMs: 0,
  boostMs: 0,
  wasDrifting: false,
  contact: false,
  offRoad: false,
});
const damp = (a: number, b: number, k: number, dt: number) =>
  b + (a - b) * Math.exp(-k * dt);

export function drivingDriftLevel(chargeMs: number): 0 | 1 | 2 | 3 {
  return chargeMs >= 2400 ? 3 : chargeMs >= 1400 ? 2 : chargeMs >= 700 ? 1 : 0;
}

export const driftTierNames = ["Charging", "Mini", "Super", "Ultra"] as const;
export const driftThresholds = [700, 1400, 2400] as const;

/** First contact with a segment expanded by the kart radius, including round ends. */
function sweep(
  x: number,
  z: number,
  dx: number,
  dz: number,
  wall: Wall,
  radius: number,
) {
  const ex = wall.bx - wall.ax,
    ez = wall.bz - wall.az,
    length = Math.hypot(ex, ez);
  let best: { t: number; nx: number; nz: number } | undefined;
  const offer = (t: number, nx: number, nz: number) => {
    if (t >= -1e-8 && t <= 1 && dx * nx + dz * nz < -1e-9 && (!best || t < best.t))
      best = { t: Math.max(0, t), nx, nz };
  };
  if (length > 1e-8) {
    const tx = ex / length,
      tz = ez / length,
      nx = -tz,
      nz = tx;
    const distance = (x - wall.ax) * nx + (z - wall.az) * nz,
      velocity = dx * nx + dz * nz;
    for (const side of [-1, 1]) {
      if (Math.abs(velocity) < 1e-10) continue;
      const t = (side * radius - distance) / velocity;
      const along = (x + t * dx - wall.ax) * tx + (z + t * dz - wall.az) * tz;
      if (along >= 0 && along <= length) offer(t, nx * side, nz * side);
    }
  }
  const a = dx * dx + dz * dz;
  if (a > 1e-12)
    for (const [cx, cz] of [
      [wall.ax, wall.az],
      [wall.bx, wall.bz],
    ]) {
      const ox = x - cx!,
        oz = z - cz!,
        b = 2 * (ox * dx + oz * dz),
        c = ox * ox + oz * oz - radius * radius;
      const discriminant = b * b - 4 * a * c;
      if (discriminant < 0) continue;
      const t = (-b - Math.sqrt(discriminant)) / (2 * a);
      const px = ox + t * dx,
        pz = oz + t * dz,
        n = Math.hypot(px, pz);
      if (n > 1e-8) offer(t, px / n, pz / n);
    }
  return best;
}

export function moveWithWalls(
  body: DrivingBody,
  seconds: number,
  walls: readonly Wall[],
  radius: number,
): DrivingBody {
  const next = { ...body, contact: false };
  let remaining = seconds;
  // Bounded slide iterations handle corners without an unbounded collision loop.
  for (let iteration = 0; iteration < 4 && remaining > 1e-8; iteration++) {
    const dx = next.vx * remaining,
      dz = next.vz * remaining;
    let first: ReturnType<typeof sweep>;
    for (const wall of walls) {
      // Swept AABB broad phase; long moves cannot skip a wall's cell.
      if (
        Math.max(next.x, next.x + dx) + radius < Math.min(wall.ax, wall.bx) ||
        Math.min(next.x, next.x + dx) - radius > Math.max(wall.ax, wall.bx) ||
        Math.max(next.z, next.z + dz) + radius < Math.min(wall.az, wall.bz) ||
        Math.min(next.z, next.z + dz) - radius > Math.max(wall.az, wall.bz)
      )
        continue;
      const hit = sweep(next.x, next.z, dx, dz, wall, radius);
      if (hit && (!first || hit.t < first.t)) first = hit;
    }
    if (!first) {
      next.x += dx;
      next.z += dz;
      break;
    }
    next.contact = true;
    next.x += dx * first.t + first.nx * 0.0001;
    next.z += dz * first.t + first.nz * 0.0001;
    const inward = next.vx * first.nx + next.vz * first.nz;
    next.vx = (next.vx - inward * first.nx) * 0.98;
    next.vz = (next.vz - inward * first.nz) * 0.98;
    remaining *= 1 - first.t;
  }
  return next;
}

/** Call with at most 20ms; adapters own accumulated time and timestamped controls. */
export function stepDriving(
  body: DrivingBody,
  input: DrivingInput,
  ms: number,
  profile: DrivingProfile,
  walls: readonly Wall[],
  offRoad = false,
  fresh = true,
  features: readonly CourseFeature[] = [],
): DrivingBody {
  if (!Number.isFinite(ms) || ms <= 0 || ms > 20) return body;
  const dt = ms / 1000,
    next = { ...body, offRoad };
  const fx = Math.cos(body.heading),
    fz = Math.sin(body.heading);
  const forward = body.vx * fx + body.vz * fz;
  const airborne = (body.height ?? 0) > 0;
  const drifting =
    fresh &&
    input.drift &&
    (body.wasDrifting || Math.abs(input.steer) > 0.15) &&
    forward > profile.maxSpeed * (body.wasDrifting ? 0.25 : 0.4) &&
    input.gas &&
    !input.brake &&
    !offRoad &&
    !airborne;
  if (
    body.wasDrifting &&
    !drifting &&
    fresh &&
    !input.drift &&
    input.gas &&
    !input.brake &&
    !offRoad &&
    !body.contact &&
    body.driftMs >= 700
  ) {
    next.boostLevel = drivingDriftLevel(body.driftMs);
    next.boostMs = Math.max(
      body.boostMs,
      [0, 600, 900, 1200][drivingDriftLevel(body.driftMs)]!,
    );
  }
  next.boostMs = Math.max(0, next.boostMs - ms);
  if (!next.boostMs) next.boostLevel = 0;
  const side = body.wasDrifting
    ? body.driftSide || Math.sign(body.turn) || Math.sign(input.steer)
    : Math.sign(input.steer);
  next.driftSide = drifting ? side : 0;
  // Holding into a bend charges faster; widening remains useful and keeps the bank.
  next.driftMs = drifting
    ? Math.min(2400, body.driftMs + ms * (1 + Math.max(0, input.steer * side) * 0.5))
    : 0;
  next.wasDrifting = drifting;
  // Engine force + power + road/aerodynamic losses. No target-speed attraction:
  // boost expiry removes extra thrust; it never brakes towards a speed ceiling.
  const thrust = Math.min(
    profile.acceleration,
    profile.power / Math.max(1, Math.abs(forward)),
  );
  const boost = next.boostMs > 0 ? [1, 6, 9, 12][next.boostLevel || 1]! : 1;
  const resistance =
    profile.rollingResistance +
    profile.drag * forward * forward +
    (!fresh ? Math.abs(forward) * 1.5 : 0) +
    (offRoad && !airborne ? Math.abs(forward) * 1.8 : 0);
  let speed = forward;
  if (input.brake && !airborne) {
    speed =
      forward > 0.4
        ? Math.max(0, forward - profile.acceleration * 2 * dt)
        : Math.max(-profile.reverseSpeed, forward - profile.acceleration * dt);
  } else {
    const engine =
      input.gas && fresh ? thrust * boost * (airborne ? 0.15 : offRoad ? 0.4 : 1) : 0;
    speed += (engine - Math.sign(forward) * resistance) * dt;
    if (!engine && Math.sign(speed) !== Math.sign(forward)) speed = 0;
  }
  // Tight circuit bends need more steering lock at low speed, easing to the
  // established high-speed steering rate rather than amplifying a fast drift.
  const turnRate =
    profile.turnRate +
    ((profile.lowSpeedTurnRate ?? profile.turnRate) - profile.turnRate) *
      Math.max(
        0,
        Math.min(1, (profile.maxSpeed - Math.abs(speed)) / (profile.maxSpeed * 0.4)),
      );
  next.turn = damp(
    body.turn,
    (drifting
      ? side *
        ((profile.driftTurnBase ?? 0.12) +
          (profile.driftTurnBase ? 0.9 : 0.75) * input.steer * side)
      : input.steer) * turnRate,
    airborne ? 3 : 10,
    dt,
  );
  next.heading +=
    next.turn * (airborne ? 0.55 : 1) * Math.max(-0.8, speed / profile.maxSpeed) * dt;
  const nx = Math.cos(next.heading),
    nz = Math.sin(next.heading);
  // Remove lateral velocity gradually while drifting, quickly under ordinary grip.
  const lateral =
    (body.vx * -nz + body.vz * nx) *
    Math.exp(-(airborne ? 1.2 : drifting ? 2.2 : offRoad ? 7 : 14) * dt);
  next.vx = nx * speed - nz * lateral;
  next.vz = nz * speed + nx * lateral;
  const moved = moveWithWalls(next, dt, walls, profile.radius);
  if (moved.contact) {
    moved.driftMs = 0;
    moved.wasDrifting = false;
    moved.driftSide = 0;
    moved.boostMs = 0;
  }
  return stepCourse(
    body,
    moved,
    fresh ? input : { steer: 0, gas: false, brake: false, drift: false },
    ms,
    features,
    profile.radius,
  );
}

/** Shared visible/collision boundary definition for the procedural circuit. */
export const ringBounds = { inner: 34, outer: 50, segments: 128 };
export const ringWalls: readonly Wall[] = [ringBounds.inner, ringBounds.outer].flatMap(
  (radius) =>
    Array.from({ length: ringBounds.segments }, (_, i) => {
      const a = (i * Math.PI * 2) / ringBounds.segments,
        b = ((i + 1) * Math.PI * 2) / ringBounds.segments;
      return {
        ax: Math.cos(a) * radius,
        az: Math.sin(a) * radius,
        bx: Math.cos(b) * radius,
        bz: Math.sin(b) * radius,
      };
    }),
);

/** Static spatial hash, created once per track, not once per input or simulation step. */
export function indexWalls(walls: readonly Wall[], size = 12) {
  const cells = new Map<string, Wall[]>();
  for (const wall of walls)
    for (
      let x = Math.floor(Math.min(wall.ax, wall.bx) / size);
      x <= Math.floor(Math.max(wall.ax, wall.bx) / size);
      x++
    )
      for (
        let z = Math.floor(Math.min(wall.az, wall.bz) / size);
        z <= Math.floor(Math.max(wall.az, wall.bz) / size);
        z++
      ) {
        const key = `${x}:${z}`,
          cell = cells.get(key) ?? [];
        cell.push(wall);
        cells.set(key, cell);
      }
  return (x: number, z: number, reach: number): Wall[] => {
    const found = new Set<Wall>();
    for (
      let cx = Math.floor((x - reach) / size);
      cx <= Math.floor((x + reach) / size);
      cx++
    )
      for (
        let cz = Math.floor((z - reach) / size);
        cz <= Math.floor((z + reach) / size);
        cz++
      )
        for (const wall of cells.get(`${cx}:${cz}`) ?? []) found.add(wall);
    return [...found];
  };
}

/** Clearance for recovery poses; keep room to accelerate and steer away. */
export function clearOfWalls(
  x: number,
  z: number,
  walls: readonly Wall[],
  radius: number,
): boolean {
  return walls.every((w) => {
    const dx = w.bx - w.ax,
      dz = w.bz - w.az;
    const t = Math.max(
      0,
      Math.min(1, ((x - w.ax) * dx + (z - w.az) * dz) / (dx * dx + dz * dz || 1)),
    );
    return Math.hypot(x - w.ax - t * dx, z - w.az - t * dz) > radius;
  });
}

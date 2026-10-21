/** Pure arcade driving and swept-circle contacts. No clocks, browser or rendering APIs. */
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
  wasDrifting: boolean;
  contact: boolean;
  offRoad: boolean;
};
export type DrivingProfile = {
  maxSpeed: number;
  reverseSpeed: number;
  boostSpeed: number;
  radius: number;
  acceleration: number;
  turnRate: number;
};
export const ringDriving: DrivingProfile = {
  maxSpeed: 11,
  reverseSpeed: 3,
  boostSpeed: 14,
  radius: 0.8,
  acceleration: 3.6,
  turnRate: 1.1,
};
export const soloDriving: DrivingProfile = {
  maxSpeed: 30,
  reverseSpeed: 8,
  boostSpeed: 42,
  radius: 0.85,
  acceleration: 3.6,
  turnRate: 1.35,
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
): DrivingBody {
  if (!Number.isFinite(ms) || ms <= 0 || ms > 20) return body;
  const dt = ms / 1000,
    next = { ...body, offRoad };
  const fx = Math.cos(body.heading),
    fz = Math.sin(body.heading);
  const forward = body.vx * fx + body.vz * fz;
  const drifting =
    fresh &&
    input.drift &&
    Math.abs(input.steer) > 0.15 &&
    forward > profile.maxSpeed * 0.4 &&
    !input.brake &&
    !offRoad;
  if (
    body.wasDrifting &&
    !drifting &&
    fresh &&
    !input.drift &&
    input.gas &&
    !input.brake &&
    body.driftMs >= 700
  )
    next.boostMs = Math.min(1200, body.driftMs / 2);
  next.boostMs = Math.max(0, next.boostMs - ms);
  next.driftMs = drifting ? body.driftMs + ms : 0;
  next.wasDrifting = drifting;
  let target = input.brake
    ? forward > 0.4
      ? 0
      : -profile.reverseSpeed
    : input.gas
      ? next.boostMs > 0
        ? profile.boostSpeed
        : profile.maxSpeed
      : 0;
  if (offRoad) target *= 0.45;
  const speed = damp(forward, target, input.brake ? 7 : profile.acceleration, dt);
  next.turn = damp(
    body.turn,
    input.steer * profile.turnRate * (drifting ? 1.35 : 1),
    10,
    dt,
  );
  next.heading +=
    next.turn * Math.max(-0.8, Math.min(1, speed / (profile.maxSpeed * 0.65))) * dt;
  const nx = Math.cos(next.heading),
    nz = Math.sin(next.heading);
  // Remove lateral velocity gradually while drifting, quickly under ordinary grip.
  const lateral =
    (body.vx * -nz + body.vz * nx) *
    Math.exp(-(drifting ? 3.5 : offRoad ? 7 : 14) * dt);
  next.vx = nx * speed - nz * lateral;
  next.vz = nz * speed + nx * lateral;
  const moved = moveWithWalls(next, dt, walls, profile.radius);
  if (moved.contact) {
    moved.driftMs = 0;
    moved.wasDrifting = false;
    moved.boostMs = 0;
  }
  return moved;
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

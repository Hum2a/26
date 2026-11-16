import {
  kartVfxBudgets,
  kartVfxKinds,
  kartVfxPresetSchema,
  defaultKartVfxPreset,
  readFreshKartEvents,
  type KartVfxKind,
  type KartPresentation,
} from "@26/shared";
import type { GraphicsTier } from "./graphics";

export type VfxTone = "accent" | "highlight" | "muted" | "ink";
export type VfxCounts = {
  particles: number;
  skids: number;
  byKind?: Partial<Record<KartVfxKind, number>>;
  resources?: {
    calls: number;
    triangles: number;
    geometries: number;
    textures: number;
  };
};
export type VfxActor = {
  contact?: boolean;
  playerId: string;
  number: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  /** World Y and flight clearance differ on the imported track. */
  clearance?: number;
  groundNormal?: [number, number, number];
  speed: number;
  drifting: boolean;
  charge: number;
  boosting: boolean;
  surface: "road" | "dirt" | "unsupported";
  status: "RACING" | "FINISHED" | "DNF";
};
type Particle = {
  owner: string;
  side: number;
  alive: boolean;
  kind: KartVfxKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
  heading: number;
  tone: VfxTone;
  seed: number;
};
type Skid = {
  alive: boolean;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  y: number;
  ay: number;
  by: number;
  normal: [number, number, number];
  age: number;
  life: number;
};
export type VfxParticleView = {
  kind: KartVfxKind;
  x: number;
  y: number;
  z: number;
  size: number;
  opacity: number;
  heading: number;
  tone: VfxTone;
  seed: number;
};
type ActorHistory = {
  surface: VfxActor["surface"];
  contact: boolean;
  x: number;
  y: number;
  clearance: number;
  z: number;
  heading: number;
  emission: number;
  tier: number;
  boosting: boolean;
  drifting: boolean;
};
const followsSocket = (kind: KartVfxKind) =>
  kind === "glow" || kind === "arc" || kind === "flame";
const boundedDt = (dt: number) =>
  Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
const noise = (seed: number) => {
  const n = Math.sin(seed * 12.9898) * 43758.5453;
  return n - Math.floor(n);
};

/** One scene owns this bounded cosmetic history. No clock, socket, identity or gameplay store. */
export function createKartVfxPool() {
  const particles: Particle[] = Array.from({ length: 1024 }, () => ({
    alive: false,
    owner: "",
    side: 0,
    kind: "spark",
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    age: 0,
    life: 1,
    size: 1,
    heading: 0,
    tone: "accent",
    seed: 0,
  }));
  const skids: Skid[] = Array.from({ length: 256 }, () => ({
    alive: false,
    ax: 0,
    az: 0,
    bx: 0,
    bz: 0,
    y: 0,
    ay: 0,
    by: 0,
    normal: [0, 1, 0] as [number, number, number],
    age: 0,
    life: 1,
  }));
  const histories = new Map<string, ActorHistory>();
  let particleCursor = 0,
    skidCursor = 0,
    sequence = 0,
    race = "",
    started = false;
  let preset = kartVfxPresetSchema.parse(defaultKartVfxPreset);
  let budget: { particles: number; skids: number } = kartVfxBudgets.high;
  let cursor: { raceId: string; eventId: number } | null = null;
  let disposed = false;
  function clear() {
    particles.forEach((p) => (p.alive = false));
    skids.forEach((p) => (p.alive = false));
    histories.clear();
    particleCursor = skidCursor = sequence = 0;
  }
  function emit(kind: KartVfxKind, actor: VfxActor, side = 0, power = 1) {
    if (!preset.enabled || !preset.effects[kind]) return;
    sequence = (sequence + 1) % 1_000_000;
    const seed = sequence + actor.number * 173;
    const p = particles[particleCursor % budget.particles]!;
    particleCursor = (particleCursor + 1) % budget.particles;
    const back = kind === "confetti" ? 0 : 1;
    const c = Math.cos(actor.heading),
      s = Math.sin(actor.heading);
    p.alive = true;
    p.owner = actor.playerId;
    p.side = side;
    p.kind = kind;
    p.age = 0;
    p.x = actor.x - c * back - s * side;
    p.z = actor.z - s * back + c * side;
    p.y = actor.y + (kind === "confetti" ? 2 : kind === "dust" ? 0.12 : 0.35);
    p.vx = (noise(seed) - 0.5) * (kind === "confetti" ? 6 : 0.8);
    p.vz = (noise(seed + 1) - 0.5) * (kind === "confetti" ? 6 : 0.8);
    p.vy =
      kind === "confetti"
        ? 3 + noise(seed + 2) * 3
        : kind === "exhaust" || kind === "dust"
          ? 0.5
          : 0.15;
    p.life = (preset.lifetimeMs / 1000) * (kind === "glow" || kind === "arc" ? 0.2 : 1);
    p.size = preset.size * power;
    p.heading = actor.heading;
    p.seed = seed;
    p.tone =
      kind === "exhaust" || kind === "dust"
        ? "muted"
        : kind === "confetti"
          ? seed % 2
            ? "accent"
            : "highlight"
          : actor.charge >= 2 || actor.boosting
            ? "highlight"
            : "accent";
  }
  function mark(actor: VfxActor, old: ActorHistory) {
    if (
      !preset.effects.skids ||
      (actor.clearance ?? actor.y) > 0.05 ||
      old.clearance > 0.05 ||
      actor.surface !== "road" ||
      old.surface !== "road" ||
      !actor.drifting ||
      Math.abs(actor.speed) < 2
    )
      return;
    const distance = Math.hypot(actor.x - old.x, actor.z - old.z);
    if (distance < 0.04 || distance > 4) return;
    const pieces = Math.min(8, Math.ceil(distance / 0.5));
    for (const side of [-0.78, 0.78])
      for (let i = 0; i < pieces; i++) {
        const p = skids[skidCursor % budget.skids]!;
        skidCursor = (skidCursor + 1) % budget.skids;
        const from = i / pieces,
          to = (i + 1) / pieces;
        const ox = -Math.sin(actor.heading) * side,
          oz = Math.cos(actor.heading) * side;
        const normal = actor.groundNormal ?? [0, 1, 0];
        const sideY = -(normal[0]! * ox + normal[2]! * oz) / Math.max(0.01, normal[1]!);
        const oldGround = old.y - old.clearance,
          ground = actor.y - (actor.clearance ?? actor.y);
        const ay = oldGround + (ground - oldGround) * from + sideY + 0.025,
          by = oldGround + (ground - oldGround) * to + sideY + 0.025;
        Object.assign(p, {
          alive: true,
          ax: old.x + (actor.x - old.x) * from + ox,
          az: old.z + (actor.z - old.z) * from + oz,
          bx: old.x + (actor.x - old.x) * to + ox,
          bz: old.z + (actor.z - old.z) * to + oz,
          y: (ay + by) / 2,
          ay,
          by,
          normal,
          age: 0,
          life: preset.skidLifetimeMs / 1000,
        });
      }
  }
  return {
    configure(value: unknown) {
      preset = kartVfxPresetSchema.parse(value);
      clear();
    },
    update(input: {
      raceId: string;
      elapsedMs: number;
      dt: number;
      tier: GraphicsTier;
      actors: readonly VfxActor[];
      presentation?: KartPresentation;
      paused?: boolean;
      hidden?: boolean;
      reducedMotion?: boolean;
    }) {
      if (disposed) return;
      if (input.raceId !== race) {
        clear();
        race = input.raceId;
        cursor = null;
        started = input.elapsedMs > 0;
      }
      budget = kartVfxBudgets[input.tier];
      for (let i = budget.particles; i < particles.length; i++)
        particles[i]!.alive = false;
      for (let i = budget.skids; i < skids.length; i++) skids[i]!.alive = false;
      const events = readFreshKartEvents(race, input.presentation, cursor);
      cursor = events.cursor;
      if (!preset.enabled || input.reducedMotion) {
        clear();
        started = true;
        return;
      }
      if (input.paused || input.hidden) return;
      const dt = boundedDt(input.dt);
      for (const p of particles)
        if (p.alive) {
          p.age += dt;
          if (p.age >= p.life) p.alive = false;
        }
      for (const p of skids)
        if (p.alive) {
          p.age += dt;
          if (p.age >= p.life) p.alive = false;
        }
      const actors = input.actors.slice(0, 80);
      const present = new Set(actors.map((actor) => actor.playerId));
      for (const id of histories.keys()) if (!present.has(id)) histories.delete(id);
      for (const actor of actors) {
        if (
          ![
            actor.x,
            actor.y,
            actor.z,
            actor.heading,
            actor.speed,
            actor.charge,
            actor.clearance ?? 0,
            ...(actor.groundNormal ?? [0, 1, 0]),
          ].every(Number.isFinite)
        )
          continue;
        const old = histories.get(actor.playerId);
        const tier = Math.max(0, Math.min(3, Math.floor(actor.charge)));
        const active = actor.status === "RACING";
        const grounded =
          (actor.clearance ?? actor.y) <= 0.05 && actor.surface !== "unsupported";
        const history = {
          surface: actor.surface,
          contact: actor.contact ?? false,
          x: actor.x,
          y: actor.y,
          clearance: actor.clearance ?? actor.y,
          z: actor.z,
          heading: actor.heading,
          emission: Math.min(1, (old?.emission ?? 0) + dt),
          tier,
          boosting: actor.boosting,
          drifting: actor.drifting,
        };
        const changed =
          !!old &&
          (old.tier !== tier ||
            old.boosting !== actor.boosting ||
            old.drifting !== actor.drifting);
        if (active && old && grounded) mark(actor, old);
        const bursts =
          preset.mode === "burst"
            ? changed
              ? 1
              : 0
            : Math.min(6, Math.floor(history.emission * preset.rate));
        if (bursts)
          history.emission =
            preset.mode === "time" ? history.emission % (1 / preset.rate) : 0;
        if (active)
          for (let n = 0; n < bursts; n++) {
            const count = preset.mode === "burst" ? preset.burstCount : 1;
            for (let j = 0; j < count; j++) {
              emit("exhaust", actor, 0, Math.abs(actor.speed) < 2 ? 0.4 : 0.6);
              if (grounded && actor.surface === "dirt" && Math.abs(actor.speed) > 2)
                for (const side of [-0.78, 0.78]) emit("dust", actor, side, 0.8);
              if (grounded && actor.drifting)
                for (const side of [-0.78, 0.78]) {
                  emit("spark", actor, side);
                  emit("glow", actor, side, 0.8);
                  emit("arc", actor, side, 0.8);
                  if (preset.trailLength > 0) emit("trail", actor, side);
                }
              if (actor.boosting) emit("flame", actor, 0, 1.2);
            }
          }
        if (changed && tier > (old?.tier ?? 0) && grounded)
          for (let i = 0; i < 6; i++) emit("spark", actor, i % 2 ? -0.78 : 0.78, 1.2);
        if (active && grounded && old && actor.contact && !old.contact)
          for (let i = 0; i < 8; i++) emit("spark", actor, i % 2 ? -0.78 : 0.78, 1.2);
        if (
          events.events.some(
            (event) => event.playerId === actor.playerId && event.status === "FINISHED",
          )
        )
          for (let i = 0; i < preset.burstCount; i++) emit("confetti", actor);
        histories.set(actor.playerId, history);
      }
      for (const p of particles) {
        if (!p.alive || !(p.kind === "trail" || followsSocket(p.kind))) continue;
        const owner = histories.get(p.owner);
        if (!owner) {
          p.alive = false;
          continue;
        }
        if (p.kind === "trail") {
          if (
            Math.hypot(p.x + p.vx * p.age - owner.x, p.z + p.vz * p.age - owner.z) >
            preset.trailLength
          )
            p.alive = false;
        } else {
          p.x = owner.x - Math.cos(owner.heading) - Math.sin(owner.heading) * p.side;
          p.z = owner.z - Math.sin(owner.heading) + Math.cos(owner.heading) * p.side;
          p.y = owner.y + 0.35;
          p.vx = p.vy = p.vz = 0;
        }
      }
      if (!started && input.elapsedMs > 0) {
        started = true;
        for (const actor of actors.slice(0, 4))
          for (let i = 0; i < preset.burstCount; i++) emit("confetti", actor);
      }
    },
    view(): { particles: VfxParticleView[]; skids: (Skid & { opacity: number })[] } {
      const visible = particles
        .filter((p) => p.alive)
        .map((p) => {
          const progress = Math.min(1, p.age / p.life);
          const opacity = preset.fade === "linear" ? 1 - progress : (1 - progress) ** 2;
          const rising = p.kind === "dust" || p.kind === "exhaust";
          return {
            kind: p.kind,
            x: p.x + p.vx * p.age,
            y:
              p.y +
              p.vy * p.age -
              ((followsSocket(p.kind)
                ? 0
                : preset.gravity + (p.kind === "confetti" ? 3 : 0)) *
                p.age ** 2) /
                2,
            z: p.z + p.vz * p.age,
            size: p.size * (rising ? 1 + progress : 1 - progress * 0.6),
            opacity,
            heading: p.heading,
            tone: p.tone,
            seed: p.seed,
          };
        });
      return {
        particles: visible,
        skids: skids
          .filter((p) => p.alive)
          .map((p) => ({ ...p, opacity: (1 - p.age / p.life) * 0.45 })),
      };
    },
    stats() {
      const byKind = {} as Record<KartVfxKind, number>;
      for (const kind of kartVfxKinds) byKind[kind] = 0;
      let count = 0;
      for (const particle of particles)
        if (particle.alive) {
          count++;
          byKind[particle.kind]++;
        }
      return {
        particles: count,
        skids: skids.filter((p) => p.alive).length,
        actors: histories.size,
        capacity: { ...budget },
        byKind,
      };
    },
    reset() {
      clear();
      cursor = null;
      race = "";
      started = false;
    },
    dispose() {
      clear();
      disposed = true;
      cursor = null;
    },
  };
}

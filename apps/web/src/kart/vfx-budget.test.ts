import { expect, it } from "vitest";
import {
  defaultKartVfxPreset,
  exportKartVfxPreset,
  kartVfxPresetSchema,
  type KartPresentation,
} from "@26/shared";
import { createKartVfxPool, type VfxActor } from "./vfx-budget";

const actor = (number = 1): VfxActor => ({
  playerId: "p" + number,
  number,
  x: number,
  y: 0,
  z: 0,
  heading: 0,
  speed: 12,
  drifting: true,
  charge: 2,
  boosting: true,
  surface: "road",
  status: "RACING",
});
const frame = (actors = [actor()]) => ({
  raceId: "r",
  elapsedMs: 100,
  dt: 0.1,
  tier: "high" as const,
  actors,
});
it("separates negative world ground height from flight clearance and slopes tyre marks", () => {
  const pool = createKartVfxPool();
  const a = {
    ...actor(),
    y: -1.6,
    clearance: 0,
    groundNormal: [-0.1, 1, 0] as [number, number, number],
  };
  pool.update(frame([a]));
  a.x += 0.5;
  a.y += 0.05;
  pool.update(frame([a]));
  const marks = pool.view().skids;
  expect(marks.length).toBeGreaterThan(0);
  expect(marks[0]!.ay).toBeCloseTo(-1.575);
  expect(marks[0]!.by).toBeCloseTo(-1.525);
  expect(pool.view().particles.some((p) => p.kind === "spark" && p.y < 0)).toBe(true);
  pool.reset();
  pool.update(frame([{ ...a, y: -0.6, clearance: 1 }]));
  pool.update(frame([{ ...a, x: a.x + 0.5, y: -0.6, clearance: 1 }]));
  expect(pool.view().skids).toHaveLength(0);
  expect(
    pool.view().particles.filter((p) => p.kind === "spark" || p.kind === "dust"),
  ).toHaveLength(0);
});
it("breaks tyre history across an unsupported patch rather than marking over the gap", () => {
  const pool = createKartVfxPool();
  pool.update(frame([{ ...actor(), surface: "unsupported" }]));
  pool.update(frame([{ ...actor(), x: 1.5 }]));
  expect(pool.view().skids).toHaveLength(0);
  pool.update(frame([{ ...actor(), x: 2 }]));
  expect(pool.view().skids.length).toBeGreaterThan(0);
});

it("celebrates an observed race start once, then expires and suppresses a late mounted start", () => {
  const pool = createKartVfxPool();
  pool.configure({ ...defaultKartVfxPreset, mode: "burst" });
  const a = { ...actor(), drifting: false, boosting: false, charge: 0 };
  pool.update({ ...frame([a]), elapsedMs: 0 });
  expect(pool.view().particles).toHaveLength(0);
  pool.update({ ...frame([a]), elapsedMs: 50 });
  expect(pool.view().particles.filter((p) => p.kind === "confetti")).toHaveLength(
    defaultKartVfxPreset.burstCount,
  );
  for (let i = 0; i < 20; i++) pool.update({ ...frame([a]), elapsedMs: 100 + i * 100 });
  expect(pool.view().particles.filter((p) => p.kind === "confetti")).toHaveLength(0);
  const late = createKartVfxPool();
  late.update(frame([a]));
  expect(late.view().particles.filter((p) => p.kind === "confetti")).toHaveLength(0);
});

it("bursts once for a fresh accepted contact edge, suppressing held and historical contacts", () => {
  const pool = createKartVfxPool();
  pool.configure({ ...defaultKartVfxPreset, mode: "burst" });
  const a = { ...actor(), drifting: false, boosting: false, charge: 0 };
  pool.update(frame([{ ...a, contact: true }]));
  expect(pool.view().particles).toHaveLength(0);
  pool.update(frame([{ ...a, contact: false }]));
  pool.update(frame([{ ...a, contact: true }]));
  expect(pool.view().particles.filter((p) => p.kind === "spark")).toHaveLength(8);
  pool.update(frame([{ ...a, contact: true }]));
  expect(pool.view().particles.filter((p) => p.kind === "spark")).toHaveLength(8);
});

it("keeps particles and skid segments within a scene budget across 80 racers and tier changes", () => {
  const pool = createKartVfxPool();
  const actors = Array.from({ length: 80 }, (_, i) => actor(i + 1));
  for (let i = 0; i < 80; i++) {
    actors.forEach((a) => (a.x += 0.2));
    pool.update(frame(actors));
    expect(pool.stats().particles).toBeLessThanOrEqual(1024);
    expect(pool.stats().skids).toBeLessThanOrEqual(256);
  }
  pool.update({ ...frame(actors), tier: "low" });
  expect(pool.stats().particles).toBeLessThanOrEqual(128);
  expect(pool.stats().skids).toBeLessThanOrEqual(64);
  pool.update({ ...frame(actors), tier: "balanced" });
  expect(pool.stats().particles).toBeLessThanOrEqual(512);
  expect(pool.stats().skids).toBeLessThanOrEqual(128);
  pool.update(frame([]));
  expect(pool.stats().actors).toBe(0);
});
it("suppresses dust, tyre effects and marks in flight and on unsupported terrain", () => {
  for (const airborne of [true, false]) {
    const pool = createKartVfxPool();
    const a = {
      ...actor(),
      y: airborne ? 3 : 0,
      surface: airborne ? ("dirt" as const) : ("unsupported" as const),
    };
    pool.update(frame([a]));
    a.x += 1;
    pool.update(frame([a]));
    expect(
      pool
        .view()
        .particles.some((p) =>
          ["dust", "spark", "glow", "arc", "trail"].includes(p.kind),
        ),
    ).toBe(false);
    expect(pool.stats().skids).toBe(0);
    expect(pool.view().particles.some((p) => p.kind === "exhaust")).toBe(true);
  }
});
it("makes finite dust, exhaust, drift and boost output with no permanent driving celebration", () => {
  const pool = createKartVfxPool();
  const a = { ...actor(), surface: "dirt" as const };
  pool.update(frame([a]));
  expect(new Set(pool.view().particles.map((p) => p.kind))).toEqual(
    new Set(["dust", "exhaust", "spark", "glow", "arc", "trail", "flame"]),
  );
  for (let i = 0; i < 50; i++) pool.update(frame([]));
  expect(pool.view().particles).toHaveLength(0);
  expect(pool.stats().skids).toBe(0);
});
it("freezes on pause/hidden, clears decoration for reduced motion, and does not resurrect after disposal", () => {
  const pool = createKartVfxPool();
  pool.update(frame());
  const before = pool.view();
  pool.update({ ...frame(), paused: true });
  expect(pool.view()).toEqual(before);
  pool.update({ ...frame(), hidden: true });
  expect(pool.view()).toEqual(before);
  pool.update({ ...frame(), reducedMotion: true });
  expect(pool.stats().particles).toBe(0);
  expect(pool.stats().skids).toBe(0);
  pool.dispose();
  pool.update(frame());
  expect(pool.stats().particles).toBe(0);
});
it("draws tyre segments between accepted endpoints without overshoot and breaks at recovery", () => {
  const pool = createKartVfxPool();
  pool.update(frame([{ ...actor(), x: 0 }]));
  pool.update(frame([{ ...actor(), x: 2 }]));
  const marks = pool.view().skids;
  expect(marks.length).toBeGreaterThan(0);
  expect(marks.every((mark) => mark.ax >= 0 && mark.bx <= 2 && mark.bx > mark.ax)).toBe(
    true,
  );
  const count = pool.stats().skids;
  pool.update(frame([{ ...actor(), x: 100 }]));
  expect(pool.stats().skids).toBe(count);
  for (let i = 0; i < 90; i++) pool.update(frame([]));
  expect(pool.stats().skids).toBe(0);
});
it("deduplicates accepted finish bursts and suppresses historical events on reconnect", () => {
  const pool = createKartVfxPool();
  const a = { ...actor(), drifting: false, boosting: false };
  pool.update(frame([a]));
  const event: KartPresentation = {
    version: 1,
    assetVersion: "kart-assets-v1",
    events: [
      {
        eventId: 100001,
        atMs: 1000,
        kind: "finish",
        playerId: a.playerId,
        status: "FINISHED",
      },
    ],
  };
  const finished = { ...frame([{ ...a, status: "FINISHED" }]), presentation: event };
  pool.update(finished);
  expect(pool.view().particles.filter((p) => p.kind === "confetti")).toHaveLength(12);
  pool.update(finished);
  expect(pool.view().particles.filter((p) => p.kind === "confetti")).toHaveLength(12);
  pool.reset();
  pool.update(finished);
  expect(pool.view().particles).toHaveLength(0);
});
it("validates export with the exact runtime schema and clears buffers when a preset changes", () => {
  const pool = createKartVfxPool();
  pool.update(frame());
  expect(pool.stats().particles).toBeGreaterThan(0);
  const next = { ...defaultKartVfxPreset, enabled: false };
  expect(kartVfxPresetSchema.parse(JSON.parse(exportKartVfxPreset(next)))).toEqual(
    next,
  );
  pool.configure(next);
  pool.update(frame());
  expect(pool.stats().particles).toBe(0);
  for (const invalid of [
    { ...next, rate: Infinity },
    { ...next, version: 2 },
    { ...next, size: 20 },
    { ...next, credential: "no" },
  ])
    expect(() => pool.configure(invalid)).toThrow();
});

it("applies gravity tuning to smoke and accepted finish confetti", () => {
  const a = { ...actor(), drifting: false, boosting: false };
  const make = (gravity: number) => {
    const pool = createKartVfxPool();
    pool.configure({ ...defaultKartVfxPreset, gravity });
    pool.update(frame([a]));
    pool.update({
      ...frame([{ ...a, status: "FINISHED" }]),
      presentation: {
        version: 1,
        assetVersion: "kart-assets-v1",
        events: [
          {
            eventId: 100001,
            atMs: 1000,
            kind: "finish",
            playerId: a.playerId,
            status: "FINISHED",
          },
        ],
      },
    });
    pool.update(frame([]));
    return pool.view();
  };
  const light = make(0),
    heavy = make(2);
  for (const kind of ["exhaust", "confetti"] as const)
    expect(heavy.particles.find((p) => p.kind === kind)!.y).toBeLessThan(
      light.particles.find((p) => p.kind === kind)!.y,
    );
});

it("limits a curved world-space wake by distance and keeps flames attached to the current exhaust socket", () => {
  const run = (trailLength: number) => {
    const pool = createKartVfxPool();
    pool.configure({ ...defaultKartVfxPreset, trailLength });
    for (let i = 0; i < 4; i++) pool.update(frame([{ ...actor(), x: i, z: i * 0.25 }]));
    return pool;
  };
  const short = run(1.5),
    long = run(6);
  const trails = (pool: ReturnType<typeof createKartVfxPool>) =>
    pool.view().particles.filter((p) => p.kind === "trail");
  expect(trails(long).length).toBeGreaterThan(trails(short).length);
  expect(trails(short).every((p) => Math.hypot(p.x - 3, p.z - 0.75) <= 1.5)).toBe(true);
  const flames = long.view().particles.filter((p) => p.kind === "flame");
  expect(flames.length).toBeGreaterThan(0);
  expect(flames.every((p) => p.x === 2 && p.z === 0.75)).toBe(true);
  const before = long.view();
  long.update({ ...frame([{ ...actor(), x: 20 }]), paused: true });
  expect(long.view()).toEqual(before);
});

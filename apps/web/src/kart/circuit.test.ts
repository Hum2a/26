import { afterEach, expect, it, vi } from "vitest";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { createKartRace, projectKartRace, defaultKartVfxPreset } from "@26/shared";
import { vfxRehearsalRace } from "./vfx-rehearsal";
import { createCircuit } from "./circuit";
import { kartCameraPose, smoothKartPose, kartVehiclePose } from "./presentation";
import { driftEffectDescription } from "./drift-effects";

it("uses versioned plain pose/effect descriptions without cross-bundle Three objects", () => {
  expect(kartVehiclePose({ x: 1, z: 2, height: 3, heading: 4 })).toEqual({
    version: 1,
    position: [1, 3, 2],
    heading: 4,
  });
  const effect = driftEffectDescription(1, 1, 1, true, false);
  expect(effect.version).toBe(1);
  expect(effect.space).toBe("kart-local");
  expect(effect.points).toHaveLength(8);
  expect(driftEffectDescription(1, 1, 1, true, true).points).toHaveLength(2);
  expect(JSON.parse(JSON.stringify(effect))).toEqual(effect);
});

afterEach(() => vi.restoreAllMocks());
it("renders bounded authoritative item hazards even with decoration and detail off, then clears stale poses", () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const palette = Object.fromEntries(
    ["ground", "road", "accent", "highlight", "ink", "muted"].map((role) => [
      role,
      new THREE.Color(),
    ]),
  ) as Parameters<typeof createCircuit>[0];
  const race = projectKartRace(
    createKartRace("items", [], {
      itemRules: { version: 2, allowed: ["tennis", "bomb", "homing"] },
    }),
    null,
    0,
  );
  if (race.presentation?.version !== 3) throw new Error("Expanded projection required");
  race.presentation.items.projectiles = ["tennis", "bomb", "homing"].map(
    (kind, index) => ({
      id: `projectile-${index + 1}`,
      kind: kind as "tennis" | "bomb" | "homing",
      x: 42,
      z: index * 5,
      height: 0,
      createdAt: 0,
    }),
  );
  const circuit = createCircuit(palette, false, undefined, "party-ring-v1");
  circuit.update(race, 0.02, false, 1, 0, 0, false);
  for (const kind of ["tennis", "bomb", "homing"])
    expect(
      (circuit.scene.getObjectByName(`kart-projectile-${kind}`) as THREE.InstancedMesh)
        .count,
    ).toBe(1);
  const mesh = circuit.scene.getObjectByName(
    "kart-projectile-tennis",
  ) as THREE.InstancedMesh;
  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(0, matrix);
  expect(new THREE.Vector3().setFromMatrixPosition(matrix).x).toBe(42);
  race.presentation.items.projectiles = [];
  circuit.update(race, 0.02, true, 1, 0, 0, false);
  for (const kind of ["tennis", "bomb", "homing"])
    expect(
      (circuit.scene.getObjectByName(`kart-projectile-${kind}`) as THREE.InstancedMesh)
        .count,
    ).toBe(0);
  circuit.dispose();
});
it("renders the finite impact script as a fresh contact spark burst", () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.spyOn(GLTFLoader.prototype, "load").mockImplementation(() => {});
  const palette = Object.fromEntries(
    ["ground", "road", "accent", "highlight", "ink", "muted"].map((role) => [
      role,
      new THREE.Color(),
    ]),
  ) as Parameters<typeof createCircuit>[0];
  const source = projectKartRace(
    createKartRace("sample", [{ playerId: "p", name: "Stand-in" }], {
      trackId: "mario-circuit-v1",
    }),
    "p",
    0,
  );
  const circuit = createCircuit(palette, true, "p", "mario-circuit-v1");
  let peak = 0;
  for (let ms = 0; ms < 3500; ms += 50) {
    circuit.update(
      vfxRehearsalRace(source, "impact", ms, 1),
      0.05,
      false,
      1,
      640,
      8,
      false,
      { preset: defaultKartVfxPreset, tier: "high", paused: false },
    );
    peak = Math.max(peak, circuit.vfxStats().byKind?.spark ?? 0);
  }
  expect(peak).toBeGreaterThan(0);
  expect(circuit.vfxStats().byKind?.spark ?? 0).toBe(0);
  circuit.dispose();
});
it("renders self and only the quality-limited server-selected neighbours and drops stale rig state", () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const palette = Object.fromEntries(
    ["ground", "road", "accent", "highlight", "ink", "muted"].map((role) => [
      role,
      new THREE.Color(),
    ]),
  ) as Parameters<typeof createCircuit>[0];
  const full = projectKartRace(
    createKartRace(
      "neighbours",
      Array.from({ length: 80 }, (_, i) => ({ playerId: "p" + i, name: "Driver" })),
    ),
    "p79",
    100,
  );
  const phone = {
    ...full,
    participants: [full.participants[79]!],
    nearby: full.participants.slice(0, 8),
  };
  const circuit = createCircuit(
    palette,
    true,
    "p79",
    "party-ring-v1",
    undefined,
    undefined,
    8,
  );
  circuit.update(phone, 1 / 30, false, 1, 640, 2);
  expect(circuit.pose("p79")).toBeDefined();
  expect(circuit.pose("p0")).toBeDefined();
  expect(circuit.pose("p2")).toBeUndefined();
  circuit.update(phone, 1 / 30, false, 1, 640, 8);
  expect(circuit.pose("p7")).toBeDefined();
  circuit.update({ ...phone, nearby: [] }, 1 / 30, false, 1, 640, 8);
  expect(circuit.pose("p0")).toBeUndefined();
  expect(circuit.pose("p79")).toBeDefined();
  circuit.dispose();
});
it("reports actual model loading, decode success and failure, and ignores late callbacks after disposal", () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  let loaded: Parameters<GLTFLoader["load"]>[1] | undefined;
  let failed: Parameters<GLTFLoader["load"]>[3];
  const load = vi
    .spyOn(GLTFLoader.prototype, "load")
    .mockImplementation((_url, ready, _progress, error) => {
      loaded = ready;
      failed = error;
    });
  const palette = Object.fromEntries(
    ["ground", "road", "accent", "highlight", "ink", "muted"].map((role) => [
      role,
      new THREE.Color(),
    ]),
  ) as Parameters<typeof createCircuit>[0];
  const status = vi.fn(),
    error = vi.fn();
  const circuit = createCircuit(palette, true, "p", "mario-circuit-v1", error, status);
  expect(status).toHaveBeenLastCalledWith("loading");
  expect(load).toHaveBeenCalledWith(
    "/kart-engine/models/mario-circuit-test-transformed.glb",
    expect.any(Function),
    undefined,
    expect.any(Function),
  );
  loaded!({ scene: new THREE.Group() } as GLTF);
  expect(status).toHaveBeenLastCalledWith("ready");
  circuit.dispose();
  failed!(new Error("late"));
  expect(error).not.toHaveBeenCalled();
  const broken = createCircuit(palette, true, "p", "mario-circuit-v1", error, status);
  failed!(new Error("missing"));
  expect(status).toHaveBeenLastCalledWith("failed");
  expect(error).toHaveBeenCalledTimes(1);
  broken.dispose();
});
it("caps decorative scene sparks without removing item boxes or karts", () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const palette = Object.fromEntries(
    ["ground", "road", "accent", "highlight", "ink", "muted"].map((role) => [
      role,
      new THREE.Color(),
    ]),
  ) as Parameters<typeof createCircuit>[0];
  const circuit = createCircuit(palette, false);
  const race = projectKartRace(
    createKartRace(
      "budget",
      Array.from({ length: 80 }, (_, i) => ({ playerId: "p" + i, name: "Driver" })),
    ),
    null,
    100,
  );
  for (const driver of race.participants) {
    driver.drifting = true;
    driver.driftCharge = 1;
  }
  circuit.update(race, 0.1, false, 1, 128);
  expect(
    (circuit.scene.getObjectByName("kart-drift-sparks") as THREE.InstancedMesh).count,
  ).toBe(128);
  expect(
    (circuit.scene.getObjectByName("kart-item-boxes") as THREE.InstancedMesh).count,
  ).toBe(18);
  expect(circuit.pose("p79")).toBeDefined();
  circuit.update(race, 0.1, false, 1, 0);
  expect(
    (circuit.scene.getObjectByName("kart-drift-sparks") as THREE.InstancedMesh).count,
  ).toBe(0);
  circuit.dispose();
});
it("smooths at the same rate across frame rates, uses the short angle and disables travel for reduced motion", () => {
  const target = { x: 10, z: 10, heading: Math.PI + 0.1 };
  const start = { x: 0, z: 0, heading: Math.PI - 0.1 };
  let sixty = start,
    thirty = start;
  for (let i = 0; i < 60; i++) sixty = smoothKartPose(sixty, target, 1 / 60, false);
  for (let i = 0; i < 30; i++) thirty = smoothKartPose(thirty, target, 1 / 30, false);
  expect(sixty.x).toBeCloseTo(thirty.x, 8);
  expect(sixty.heading).toBeCloseTo(thirty.heading, 8);
  const wrap = smoothKartPose(
    { x: 0, z: 0, heading: Math.PI - 0.1 },
    { x: 0, z: 0, heading: -Math.PI + 0.1 },
    0.05,
    false,
  );
  expect(wrap.heading).toBeGreaterThan(Math.PI - 0.1);
  expect(wrap.heading).toBeLessThan(Math.PI + 0.1);
  expect(smoothKartPose(start, target, 0.01, true)).toEqual(target);
  expect(smoothKartPose(start, target, 0, false)).toEqual(start);
});

it("frames the player's kart from behind and removes turning camera motion in reduced motion", () => {
  expect(
    kartCameraPose({ x: 42, z: 0, heading: Math.PI / 2 }, false).position[2],
  ).toBeCloseTo(-9);
  const right = kartCameraPose({ x: 42, z: 10, heading: 0 }, false);
  expect(right.position).toEqual([33, 6, 10]);
  expect(right.target).toEqual([47, 0.8, 10]);
  expect(kartCameraPose({ x: 42, z: 10, heading: 0 }, true)).toEqual(
    kartCameraPose({ x: 42, z: 10, heading: Math.PI }, true),
  );
});

it("bounds a phone scene to its own kart even with a 50-driver snapshot", () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const palette = Object.fromEntries(
    ["ground", "road", "accent", "highlight", "ink", "muted"].map((key) => [
      key,
      new THREE.Color(),
    ]),
  ) as Parameters<typeof createCircuit>[0];
  const race = projectKartRace(
    createKartRace(
      "fifty",
      Array.from({ length: 50 }, (_, i) => ({
        playerId: `p${i}`,
        name: `Driver ${i}`,
      })),
    ),
    "p49",
    100,
  );
  const circuit = createCircuit(palette, true, "p49");
  circuit.update(race, 1 / 30, false);
  expect(circuit.pose("p49")).toMatchObject({ x: race.participants[49]!.x });
  expect(circuit.pose("p0")).toBeUndefined();
  const instances = circuit.scene.children.filter(
    (node) => node instanceof THREE.InstancedMesh,
  );
  expect(instances.filter((node) => node.count === 4)).toHaveLength(1);
  expect(circuit.scene.children.some((node) => node instanceof THREE.Sprite)).toBe(
    false,
  );
  circuit.dispose();
});

it("renders 80 ghost karts with bounded shared geometry, no shadow maps and disposes all resources", () => {
  // Real Three.js scene, no WebGL or fabricated race transport needed.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const palette = Object.fromEntries(
    ["ground", "road", "accent", "highlight", "ink", "muted"].map((role) => [
      role,
      new THREE.Color(),
    ]),
  ) as Parameters<typeof createCircuit>[0];
  const circuit = createCircuit(palette, false);
  const drivers = Array.from({ length: 80 }, (_, i) => ({
    playerId: `p${i}`,
    name: `Driver ${i}`,
  }));
  const race = projectKartRace(createKartRace("full-room", drivers), null, 100);
  circuit.update(race, 1 / 60, false);
  const instances: THREE.InstancedMesh[] = [],
    geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>();
  circuit.scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      geometries.add(object.geometry);
      for (const m of Array.isArray(object.material)
        ? object.material
        : [object.material])
        materials.add(m);
      expect(object.castShadow).toBe(false);
    }
    if (object instanceof THREE.InstancedMesh) instances.push(object);
  });
  expect(instances.some((mesh) => mesh.count === 320)).toBe(true);
  // Body, nose and seat, plus each driver's torso, head, both arms, steering
  // wheel and plain face (plate and two eyes, as no driver here has a photo).
  expect(instances.filter((mesh) => mesh.count === 80).length).toBe(11);
  // Driver styles add shared shapes, never one per driver.
  expect(geometries.size).toBeLessThan(40);
  expect(materials.size).toBeLessThan(10);
  // Hundreds of props, karts and drivers use fewer than 70 non-label draw objects,
  // and the same number for one driver as for eighty.
  const drawObjects = circuit.scene.children.filter(
    (o) => o instanceof THREE.Mesh,
  ).length;
  expect(drawObjects).toBeLessThan(70);
  const solo = createCircuit(palette, false);
  solo.update(
    projectKartRace(createKartRace("solo", drivers.slice(0, 1)), null, 100),
    1 / 60,
    false,
  );
  expect(solo.scene.children.filter((o) => o instanceof THREE.Mesh).length).toBe(
    drawObjects,
  );
  solo.dispose();
  const disposal = [...geometries].map((g) => vi.spyOn(g, "dispose"));
  const instanceDisposal = instances.map((i) => vi.spyOn(i, "dispose"));
  circuit.dispose();
  expect(circuit.scene.children).toHaveLength(0);
  for (const dispose of [...disposal, ...instanceDisposal])
    expect(dispose).toHaveBeenCalledOnce();
});

it("snaps recovered server poses instead of travelling across the circuit", () => {
  const target = { x: 42, z: 0, heading: 0 };
  expect(smoothKartPose({ x: -42, z: 0, heading: 1 }, target, 0.02, false)).toEqual(
    target,
  );
});

it("renders enabled course props and an airborne kart from public server height", () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const palette = Object.fromEntries(
    ["ground", "road", "accent", "highlight", "ink", "muted"].map((role) => [
      role,
      new THREE.Color(),
    ]),
  ) as Parameters<typeof createCircuit>[0];
  const state = createKartRace("flight", [{ playerId: "a", name: "Driver" }]);
  state.courseEnabled = true;
  const race = projectKartRace(state, "a", 100);
  race.participants[0]!.height = 3;
  const circuit = createCircuit(palette, true, "a");
  circuit.update(race, 0.1, true);
  expect(circuit.pose("a")?.height).toBe(3);
  expect(
    (circuit.scene.getObjectByName("kart-course-features") as THREE.InstancedMesh)
      .count,
  ).toBe(3);
  expect(
    (circuit.scene.getObjectByName("kart-gliders") as THREE.InstancedMesh).count,
  ).toBe(1);
  expect(kartCameraPose(circuit.pose("a")!, false).position[1]).toBe(9);
  race.courseEnabled = false;
  race.participants[0]!.height = 0;
  circuit.update(race, 0.1, true);
  expect(
    (circuit.scene.getObjectByName("kart-course-features") as THREE.InstancedMesh)
      .count,
  ).toBe(0);
  expect(
    (circuit.scene.getObjectByName("kart-gliders") as THREE.InstancedMesh).count,
  ).toBe(0);
  circuit.dispose();
});

it("animates drift sparks from server feedback, reduces motion and clears new races", () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const palette = Object.fromEntries(
    ["ground", "road", "accent", "highlight", "ink", "muted"].map((key) => [
      key,
      new THREE.Color(),
    ]),
  ) as Parameters<typeof createCircuit>[0];
  const circuit = createCircuit(palette, true, "a");
  const race = projectKartRace(
    createKartRace("sparks", [{ playerId: "a", name: "Amina" }]),
    "a",
    100,
  );
  race.participants[0]!.drifting = true;
  race.participants[0]!.driftCharge = 1;
  circuit.update(race, 0.1, false);
  const sparks = circuit.scene.getObjectByName(
    "kart-drift-sparks",
  ) as THREE.InstancedMesh;
  expect(sparks.count).toBe(8);
  const before = new THREE.Matrix4();
  sparks.getMatrixAt(0, before);
  circuit.update(race, 0.1, false);
  const after = new THREE.Matrix4();
  sparks.getMatrixAt(0, after);
  expect(after.equals(before)).toBe(false);
  circuit.update(race, 0.1, true);
  expect(sparks.count).toBe(2);
  race.raceId = "next";
  race.participants[0]!.drifting = false;
  circuit.update(race, 0.1, false);
  expect(sparks.count).toBe(0);
  circuit.dispose();
});

it("renders available boxes, deployed oil and shields with the existing resource budget", () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const palette = Object.fromEntries(
    ["ground", "road", "accent", "highlight", "ink", "muted"].map((k) => [
      k,
      new THREE.Color(),
    ]),
  ) as Parameters<typeof createCircuit>[0];
  const circuit = createCircuit(palette, true, "a"),
    race = projectKartRace(
      createKartRace("items", [{ playerId: "a", name: "Amina" }]),
      "a",
      100,
    );
  race.powers!.boxes[0]!.available = false;
  race.powers!.oils = [
    { id: "oil", owner: "a", x: 42, z: 3, createdAt: 0, expiresAt: 8000 },
  ];
  race.powers!.effects[0]!.shieldMs = 5000;
  circuit.update(race, 0.1, false);
  expect(
    (circuit.scene.getObjectByName("kart-item-boxes") as THREE.InstancedMesh).count,
  ).toBe(17);
  expect(
    (circuit.scene.getObjectByName("kart-oil-slicks") as THREE.InstancedMesh).count,
  ).toBe(1);
  expect(
    (circuit.scene.getObjectByName("kart-shields") as THREE.InstancedMesh).count,
  ).toBe(1);
  circuit.dispose();
});

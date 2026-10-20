import { afterEach, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createKartRace, projectKartRace } from "@26/shared";
import { createCircuit } from "./circuit";
import { kartCameraPose, smoothKartPose } from "./presentation";

afterEach(() => vi.restoreAllMocks());
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
  expect(instances.filter((mesh) => mesh.count === 80).length).toBe(4);
  expect(geometries.size).toBeLessThan(24);
  expect(materials.size).toBeLessThan(10);
  // Hundreds of props and karts use fewer than 50 non-label draw objects.
  expect(
    circuit.scene.children.filter((o) => o instanceof THREE.Mesh).length,
  ).toBeLessThan(50);
  const disposal = [...geometries].map((g) => vi.spyOn(g, "dispose"));
  const instanceDisposal = instances.map((i) => vi.spyOn(i, "dispose"));
  circuit.dispose();
  expect(circuit.scene.children).toHaveLength(0);
  for (const dispose of [...disposal, ...instanceDisposal])
    expect(dispose).toHaveBeenCalledOnce();
});

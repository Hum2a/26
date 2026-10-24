import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { approachAngle, createDriverRig, driverMood, lookBackMs } from "./driver-rig";

const racing = {
  status: "RACING" as const,
  drifting: false,
  elapsedMs: 10_000,
  turnRate: 0,
};

describe("driver mood", () => {
  it("looks back at the camera at the start so a guest sees their face", () => {
    expect(driverMood({ ...racing, elapsedMs: lookBackMs - 1 }).look).toBeGreaterThan(
      2.5,
    );
    expect(driverMood(racing).look).toBe(0);
  });

  it("glances toward the outside of a drift and leans into the turn", () => {
    const left = driverMood({ ...racing, drifting: true, turnRate: 1 });
    expect(left.look).toBeLessThan(0);
    expect(left.lean).toBeLessThan(0);
    expect(
      driverMood({ ...racing, drifting: true, turnRate: -1 }).look,
    ).toBeGreaterThan(0);
  });

  it("turns round and waves on finishing, and sits still after a DNF", () => {
    expect(driverMood({ ...racing, status: "FINISHED" }).wave).toBe(1);
    expect(driverMood({ ...racing, status: "DNF" })).toEqual({
      lean: 0,
      look: 0,
      wave: 0,
    });
  });

  it("caps the lean so a spin does not tip the driver over", () => {
    expect(Math.abs(driverMood({ ...racing, turnRate: 50 }).lean)).toBeLessThanOrEqual(
      0.35,
    );
  });

  it("eases angles the short way round", () => {
    expect(approachAngle(3, -3, 10)).toBeGreaterThan(3);
  });
});

function rig(capacity = 4) {
  const scene = new THREE.Scene();
  const textures = new Set<THREE.Texture>();
  const value = createDriverRig({
    scene,
    capacity,
    geo: (geometry) => geometry,
    batch: (geometry, material, count) => {
      const mesh = new THREE.InstancedMesh(geometry, material, count);
      scene.add(mesh);
      return mesh;
    },
    material: new THREE.MeshLambertMaterial({ color: 0xffffff }),
    textures,
    palette: {
      ink: new THREE.Color(0x111111),
      ground: new THREE.Color(0xffffff),
      accent: new THREE.Color(0xff0000),
      highlight: new THREE.Color(0x00ff00),
    },
  });
  return { scene, value, textures };
}

const pose = { x: 42, z: 0, heading: Math.PI / 2 };
const cue = { status: "RACING" as const, drifting: false, elapsedMs: 10_000 };
const red = new THREE.Color(0xff0000);

function drawn(value: ReturnType<typeof rig>["value"]) {
  return value.counts().reduce((sum, part) => sum + part.count, 0);
}

describe("driver rig", () => {
  it("refreshes photo policy URLs and releases the previous face texture", () => {
    const load = vi
      .spyOn(THREE.TextureLoader.prototype, "load")
      .mockImplementation(() => new THREE.Texture());
    try {
      const { scene, value, textures } = rig();
      const drivers = new Map([
        ["a", { style: "racer" as const, faceMediaId: "photo" }],
      ]);
      value.setDrivers(drivers, () => "/media/photo?display=1");
      value.begin(0.016);
      value.place("a", 0, pose, cue, red, red, 0.016, false);
      const previous = [...textures][0]!;
      const dispose = vi.spyOn(previous, "dispose");
      const oldFace = scene.getObjectByName("kart-driver-face");
      value.setDrivers(drivers, () => "/media/photo?display=2");
      value.begin(0.016);
      value.place("a", 0, pose, cue, red, red, 0.016, false);
      expect(load.mock.calls.map(([url]) => url)).toEqual([
        "/media/photo?display=1",
        "/media/photo?display=2",
      ]);
      expect(dispose).toHaveBeenCalledOnce();
      expect(textures.size).toBe(1);
      expect(scene.getObjectByName("kart-driver-face")).not.toBe(oldFace);
    } finally {
      load.mockRestore();
    }
  });
  it("draws only the chosen style's headgear", () => {
    const { value } = rig();
    value.setDrivers(new Map([["a", { style: "royal" }]]), () => "");
    value.begin(0.016);
    value.place("a", 0, pose, cue, red, red, 0.016, false);
    value.end(new Set(["a"]));
    const royal = value.counts().filter((part) => part.name === "royal");
    const party = value.counts().filter((part) => part.name === "party");
    expect(royal.every((part) => part.count === 1)).toBe(true);
    expect(party.every((part) => part.count === 0)).toBe(true);
  });

  it("puts a face photo on the head, hides the plain face behind it, and removes it when the driver leaves", () => {
    const { scene, value } = rig();
    value.setDrivers(new Map([["a", { style: "racer" }]]), (id) => `/media/${id}`);
    value.begin(0.016);
    value.place("a", 0, pose, cue, red, red, 0.016, false);
    value.end(new Set(["a"]));
    const plain = drawn(value);

    const face = "7c0b7d0e-1f9b-4b39-9d6e-2a6f9a1a0c11";
    value.setDrivers(
      new Map([["a", { style: "racer", faceMediaId: face }]]),
      (id) => `/media/${id}`,
    );
    value.begin(0.016);
    value.place("a", 0, pose, cue, red, red, 0.016, false);
    value.end(new Set(["a"]));
    expect(value.faceCount()).toBe(1);
    expect(scene.getObjectByName("kart-driver-face")).toBeDefined();
    // Face plate, two eyes and the visor give way to the photo.
    expect(drawn(value)).toBe(plain - 4);

    value.begin(0.016);
    value.end(new Set());
    expect(value.faceCount()).toBe(0);
    expect(scene.getObjectByName("kart-driver-face")).toBeUndefined();
  });

  it("gives a driver with no choice a default style rather than nothing", () => {
    const { value } = rig();
    value.setDrivers(new Map(), () => "");
    value.begin(0.016);
    value.place("a", 1, pose, cue, red, red, 0.016, false);
    value.end(new Set(["a"]));
    expect(value.counts().find((part) => part.name === "party")?.count).toBe(1);
  });

  it("never draws more drivers than its capacity", () => {
    const { value } = rig(2);
    value.setDrivers(new Map(), () => "");
    value.begin(0.016);
    for (const id of ["a", "b", "c"])
      value.place(id, 0, pose, cue, red, red, 0.016, false);
    value.end(new Set(["a", "b", "c"]));
    expect(value.counts().every((part) => part.count <= 2)).toBe(true);
  });
});

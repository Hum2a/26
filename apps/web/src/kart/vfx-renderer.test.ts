import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { defaultKartVfxPreset } from "@26/shared";
import { createNativeKartVfx, kartVfxMaskData } from "./vfx-renderer";
it("creates a finite original neutral alpha atlas with distinct flame, sparkle and curved masks", () => {
  const atlas = kartVfxMaskData();
  expect(atlas.bytes.length).toBe(atlas.width * atlas.height * 4);
  expect([...atlas.bytes].every((v, i) => i % 4 === 3 || v === 255)).toBe(true);
  expect(new Set(atlas.bytes.filter((_, i) => i % 4 === 3)).size).toBeGreaterThan(10);
});
it("updates actual instance buffers, changes render mode without extra live particles, and disposes once", () => {
  const scene = new THREE.Scene();
  const colour = new THREE.Color();
  const renderer = createNativeKartVfx(THREE, scene, {
    accent: colour,
    highlight: colour,
    muted: colour,
    ink: colour,
  });
  const material = (scene.children[0] as THREE.Mesh).material as THREE.ShaderMaterial;
  const release = vi.spyOn(material, "dispose");
  const view = {
    particles: [
      {
        kind: "flame" as const,
        x: 1,
        y: 2,
        z: 3,
        size: 1,
        opacity: 0.5,
        heading: 0,
        tone: "accent" as const,
        seed: 1,
      },
    ],
    skids: [],
  };
  renderer.render(view, new THREE.PerspectiveCamera(), defaultKartVfxPreset);
  expect(renderer.stats()).toEqual({ particles: 1, skids: 0 });
  const mesh = scene.getObjectByName("kart-vfx-particles") as THREE.InstancedMesh;
  expect(mesh.geometry.getAttribute("vfxOpacity").getX(0)).toBe(0.5);
  expect(mesh.geometry.getAttribute("vfxMask").getX(0)).toBe(2);
  renderer.render(view, new THREE.PerspectiveCamera(), {
    ...defaultKartVfxPreset,
    renderMode: "mesh",
  });
  expect(mesh.count).toBe(0);
  expect((scene.getObjectByName("kart-vfx-solids") as THREE.InstancedMesh).count).toBe(
    1,
  );
  renderer.render(
    {
      ...view,
      skids: [
        {
          alive: true,
          ax: 0,
          az: 0,
          bx: 1,
          bz: 0,
          ay: -1.6,
          by: -1.5,
          y: -1.55,
          normal: [-0.1, 1, 0] as [number, number, number],
          age: 0,
          life: 1,
          opacity: 0.8,
        },
      ],
    },
    new THREE.PerspectiveCamera(),
    defaultKartVfxPreset,
  );
  const mark = scene.getObjectByName("kart-vfx-skids") as THREE.InstancedMesh;
  const matrix = new THREE.Matrix4();
  mark.getMatrixAt(0, matrix);
  expect(new THREE.Vector3(-0.5, 0, 0).applyMatrix4(matrix).y).toBeCloseTo(-1.6, 5);
  expect(new THREE.Vector3(0.5, 0, 0).applyMatrix4(matrix).y).toBeCloseTo(-1.5, 5);
  colour.setRGB(0.1, 0.2, 0.3);
  renderer.render(view, new THREE.PerspectiveCamera(), defaultKartVfxPreset);
  const tinted = new THREE.Color();
  mesh.getColorAt(0, tinted);
  expect(tinted.r).toBeCloseTo(0.1, 6);
  expect(tinted.g).toBeCloseTo(0.2, 6);
  expect(tinted.b).toBeCloseTo(0.3, 6);
  renderer.dispose();
  renderer.dispose();
  expect(scene.children).toHaveLength(0);
  expect(release).toHaveBeenCalledOnce();
});

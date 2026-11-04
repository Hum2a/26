import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { kartLookPresetSchema, neutralKartLook } from "@26/shared";
import { createNativeKartEnvironment } from "./look-environment";
it("keeps neutral untouched, uses procedural Low sky without reflection assets, bounds shadows and restores ownership", () => {
  const scene = new THREE.Scene(),
    source = new THREE.HemisphereLight(),
    camera = new THREE.PerspectiveCamera(65, 1, 0.1, 1000);
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(),
    new THREE.MeshLambertMaterial(),
    2,
  );
  mesh.name = "kart-detail-body";
  scene.add(source, mesh);
  const renderer = {
    shadowMap: {
      enabled: false,
      autoUpdate: true,
      type: THREE.PCFShadowMap,
      needsUpdate: false,
    },
  } as unknown as THREE.WebGLRenderer;
  const colour = new THREE.Color(),
    env = createNativeKartEnvironment(THREE, renderer, scene, {
      ground: colour,
      road: colour,
      accent: colour,
      highlight: colour,
      ink: colour,
      muted: colour,
    });
  env.update(neutralKartLook, camera, "high");
  expect(scene.children).toHaveLength(2);
  expect(source.visible).toBe(true);
  const look = kartLookPresetSchema.parse({
    ...neutralKartLook,
    environment: {
      ...neutralKartLook.environment,
      enabled: true,
      reflection: 1,
      shadows: true,
    },
  });
  env.update(look, camera, "low", { focus: [31, 0, 44] });
  expect(env.stats()).toMatchObject({
    active: true,
    sky: true,
    reflection: false,
    shadows: false,
  });
  expect(source.visible).toBe(false);
  const sun = scene.getObjectByName("kart-look-sun") as THREE.DirectionalLight;
  expect(sun.target.position.toArray()).toEqual([24, 0, 40]);
  look.environment.reflection = 0;
  env.update(look, camera, "high", { focus: [80, 0, 80], paused: true });
  expect(sun.target.position.toArray()).toEqual([24, 0, 40]);
  expect(env.stats()).toMatchObject({ shadows: true, shadowSize: 0 });
  expect(sun.shadow.mapSize.toArray()).toEqual([1024, 1024]);
  expect(sun.shadow.camera.right - sun.shadow.camera.left).toBe(56);
  expect(mesh.castShadow).toBe(true);
  expect(mesh.receiveShadow).toBe(true);
  const sky = scene.getObjectByName("kart-look-sky") as THREE.Mesh,
    release = vi.spyOn(sky.geometry, "dispose"),
    sourceRelease = vi.spyOn(mesh.geometry, "dispose");
  env.update(neutralKartLook, camera, "high");
  expect(source.visible).toBe(true);
  expect(mesh.castShadow).toBe(false);
  expect(mesh.receiveShadow).toBe(false);
  expect(renderer.shadowMap.enabled).toBe(false);
  env.dispose();
  env.dispose();
  expect(release).toHaveBeenCalledOnce();
  expect(sourceRelease).not.toHaveBeenCalled();
  expect(scene.children).toHaveLength(2);
});

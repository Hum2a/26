import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { neutralKartLook, kartLookPresets, kartLookPresetSchema } from "@26/shared";
import { createNativeKartLook } from "./look-renderer";
function fixture() {
  let target: THREE.WebGLRenderTarget | null = null;
  const renderer = {
    extensions: { has: () => false },
    capabilities: { maxTextureSize: 2048, maxSamples: 4 },
    getDrawingBufferSize: (v: THREE.Vector2) => v.set(3000, 1500),
    getRenderTarget: () => target,
    setRenderTarget: vi.fn((next: THREE.WebGLRenderTarget | null) => (target = next)),
    toneMapping: THREE.ACESFilmicToneMapping,
    info: { autoReset: true, reset: vi.fn() },
    render: vi.fn(),
  } as unknown as THREE.WebGLRenderer;
  const colour = new THREE.Color(),
    look = createNativeKartLook(THREE, renderer, {
      ground: colour,
      road: colour,
      accent: colour,
      highlight: colour,
      muted: colour,
      ink: colour,
    });
  return { look, renderer, scene: new THREE.Scene(), camera: new THREE.Camera() };
}
it("bypasses neutral without a buffer and preserves source renderer settings", () => {
  const { look, renderer, scene, camera } = fixture();
  look.configure(neutralKartLook);
  look.render(scene, camera, "high");
  expect(renderer.render).toHaveBeenCalledExactlyOnceWith(scene, camera);
  expect(renderer.setRenderTarget).not.toHaveBeenCalled();
  expect(look.stats()).toMatchObject({ active: false, buffers: 0, passes: 1 });
  look.dispose();
});
it("bounds actual targets, supports Low without float textures, releases buffers on neutral and restores state after an error", () => {
  const { look, renderer, scene, camera } = fixture();
  look.configure(kartLookPresets.warm);
  look.render(scene, camera, "low");
  expect(look.stats()).toMatchObject({
    active: true,
    buffers: 1,
    passes: 2,
    width: 1024,
    height: 512,
    hdr: false,
  });
  const first = vi.mocked(renderer.setRenderTarget).mock.calls[0]![0]!,
    release = vi.spyOn(first, "dispose");
  look.render(scene, camera, "high");
  expect(look.stats().width).toBe(2048);
  expect(look.stats().samples).toBe(4);
  // Three releases the old GPU attachment when resizing the same target.
  expect(release).toHaveBeenCalledOnce();
  expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
  expect(renderer.getRenderTarget()).toBeNull();
  expect(renderer.info.autoReset).toBe(true);
  vi.mocked(renderer.render).mockImplementationOnce(() => {
    throw Error("context lost");
  });
  expect(() => look.render(scene, camera, "high")).toThrow("context lost");
  expect(renderer.getRenderTarget()).toBeNull();
  expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
  expect(renderer.info.autoReset).toBe(true);
  look.configure(neutralKartLook);
  look.render(scene, camera, "low");
  expect(release).toHaveBeenCalledTimes(2);
  look.dispose();
  look.dispose();
  expect(release).toHaveBeenCalledTimes(2);
});

it("uses one native colour target and one owned depth texture for High optics, then releases both on Low", () => {
  const { look, renderer, scene } = fixture();
  const camera = new THREE.PerspectiveCamera(60, 2, 0.1, 500);
  const preset = kartLookPresetSchema.parse(neutralKartLook);
  for (const setting of Object.values(preset.optics)) setting.enabled = true;
  look.configure(preset);
  look.render(scene, camera, "high", { speed: 30, boost: 1, dt: 0.1 });
  expect(look.stats()).toMatchObject({
    active: true,
    buffers: 1,
    depthTextures: 1,
    textureSamples: 12,
    passes: 2,
    samples: 2,
    optics: {
      wind: true,
      chromatic: true,
      lensDirt: true,
      bloom: true,
      ao: true,
      tiltShift: true,
    },
  });
  const target = vi.mocked(renderer.setRenderTarget).mock.calls[0]![0]!;
  const depth = target.depthTexture!;
  expect(depth).toBeInstanceOf(THREE.DepthTexture);
  expect(depth.image).toMatchObject({ width: 2048, height: 1024 });
  const releaseTarget = vi.spyOn(target, "dispose");
  const releaseDepth = vi.spyOn(depth, "dispose");
  const quadScene = vi.mocked(renderer.render).mock.calls[1]![0] as THREE.Scene;
  const material = (quadScene.children[0] as THREE.Mesh)
    .material as THREE.ShaderMaterial;
  expect(material.uniforms.depthImage!.value).toBe(depth);
  expect(material.uniforms.gradeEnabled!.value).toBe(0);
  expect(material.uniforms.inverseResolution!.value.toArray()).toEqual([
    1 / 2048,
    1 / 1024,
  ]);
  expect(material.uniforms.opticsA!.value.x).toBeCloseTo(0.024);
  expect(material.uniforms.opticsA!.value.y).toBeCloseTo(0.45);
  expect(material.uniforms.opticsA!.value.z).toBe(0.05);
  expect(material.uniforms.opticsA!.value.w).toBe(0.12);
  expect(material.uniforms.opticsB!.value.toArray()).toEqual([1, 0.12, 3, 0.3]);
  expect(material.uniforms.focusDepth!.value.toArray()).toEqual([25, 18]);
  expect(material.uniforms.cameraDepth!.value.toArray()).toEqual([0.1, 500, 1]);
  expect(material.uniforms.opticsTime!.value).toBe(0.1);
  look.render(scene, camera, "high", { speed: 30, boost: 1 });
  expect(releaseTarget).not.toHaveBeenCalled();
  expect(releaseDepth).not.toHaveBeenCalled();
  look.render(scene, camera, "low", { speed: 30, boost: 1 });
  expect(releaseTarget).toHaveBeenCalledOnce();
  expect(releaseDepth).toHaveBeenCalledOnce();
  expect(look.stats()).toMatchObject({
    active: false,
    buffers: 0,
    depthTextures: 0,
    textureSamples: 0,
    passes: 1,
  });
  look.render(scene, camera, "high", { speed: 30, boost: 1 });
  const replacement = vi.mocked(renderer.setRenderTarget).mock.calls.at(-3)![0]!;
  expect(replacement).not.toBe(target);
  expect(replacement.depthTexture).not.toBe(depth);
  const releaseReplacement = vi.spyOn(replacement.depthTexture!, "dispose");
  look.configure(neutralKartLook);
  look.render(scene, camera, "high");
  expect(releaseReplacement).toHaveBeenCalledOnce();
  look.dispose();
  look.dispose();
  expect(releaseDepth).toHaveBeenCalledOnce();
  expect(releaseReplacement).toHaveBeenCalledOnce();
});

it("drops the sampled depth attachment safely while keeping grading and the same bounded colour target", () => {
  const { look, renderer, scene } = fixture();
  const camera = new THREE.PerspectiveCamera();
  const preset = kartLookPresetSchema.parse(kartLookPresets.warm);
  preset.optics.ao.enabled = true;
  look.configure(preset);
  look.render(scene, camera, "high");
  const target = vi.mocked(renderer.setRenderTarget).mock.calls[0]![0]!;
  const releaseTarget = vi.spyOn(target, "dispose");
  const releaseDepth = vi.spyOn(target.depthTexture!, "dispose");
  preset.optics.ao.enabled = false;
  look.configure(preset);
  look.render(scene, camera, "high");
  expect(releaseTarget).toHaveBeenCalledOnce();
  expect(releaseDepth).toHaveBeenCalledOnce();
  expect(target.depthTexture).toBeNull();
  expect(look.stats()).toMatchObject({
    buffers: 1,
    depthTextures: 0,
    textureSamples: 1,
    samples: 4,
  });
  look.dispose();
  expect(releaseTarget).toHaveBeenCalledTimes(2);
  expect(releaseDepth).toHaveBeenCalledOnce();
});

it("bypasses unsupported depth cameras and paused moving-only optics without allocating a target", () => {
  const { look, renderer, scene, camera } = fixture();
  const preset = kartLookPresetSchema.parse(neutralKartLook);
  preset.optics.ao.enabled = true;
  preset.optics.tiltShift.enabled = true;
  look.configure(preset);
  look.render(scene, camera, "high");
  expect(look.stats()).toMatchObject({ active: false, buffers: 0, depthTextures: 0 });
  preset.optics.ao.enabled = false;
  preset.optics.tiltShift.enabled = false;
  preset.optics.wind.enabled = true;
  preset.optics.chromatic.enabled = true;
  look.configure(preset);
  look.render(scene, camera, "high", { speed: 30, boost: 1, paused: true });
  expect(look.stats()).toMatchObject({ active: false, buffers: 0 });
  expect(renderer.setRenderTarget).not.toHaveBeenCalled();
  look.dispose();
});

it("clamps optical animation time and suppresses motion uniforms immediately on pause and reduced motion", () => {
  const { look, renderer, scene, camera } = fixture();
  const preset = kartLookPresetSchema.parse(neutralKartLook);
  preset.optics.lensDirt.enabled = true;
  preset.optics.wind.enabled = true;
  preset.optics.chromatic.enabled = true;
  // Disabled grading must not apply dormant non-neutral values through optics.
  preset.grading.enabled = false;
  preset.grading.gamma = 2;
  preset.grading.toneMapping = "linear";
  look.configure(preset);
  look.render(scene, camera, "high", { speed: 30, boost: 1, dt: 10 });
  const quadScene = vi.mocked(renderer.render).mock.calls[1]![0] as THREE.Scene;
  const material = (quadScene.children[0] as THREE.Mesh)
    .material as THREE.ShaderMaterial;
  expect(material.uniforms.gradeEnabled!.value).toBe(0);
  expect(material.uniforms.opticsTime!.value).toBe(0.1);
  expect(material.uniforms.opticsA!.value.x).toBeGreaterThan(0);
  expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
  for (const frame of [{ paused: true }, { reducedMotion: true }]) {
    look.render(scene, camera, "high", { speed: 30, boost: 1, dt: 10, ...frame });
    expect(material.uniforms.opticsA!.value.x).toBe(0);
    expect(material.uniforms.opticsA!.value.y).toBe(0);
    expect(material.uniforms.opticsTime!.value).toBe(0.1);
    expect(look.stats().optics.lensDirt).toBe(true);
  }
  look.dispose();
});

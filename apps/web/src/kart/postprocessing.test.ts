import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { neutralKartLook, kartLookPresets } from "@26/shared";
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

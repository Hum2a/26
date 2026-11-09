import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { DrivingBody, KartLookPreset } from "@26/shared";
import { importedGroundAt } from "../../../packages/shared/src/kart/kart-track";
import {
  createNativeKartLook,
  type KartLookFrame,
} from "../../web/src/kart/look-renderer";
import type { GraphicsTier } from "../../web/src/kart/graphics";
import { useGraphicsTier } from "../../web/src/kart/graphics-preferences";
import { themes, DEFAULT_THEME_ID } from "../../web/src/theme/themes";
import { usePrefersReducedMotion } from "../../web/src/anim/use-reduced-motion";
import { useGameStore } from "./upstream/store.js";
type SoloLookRenderer = Omit<ReturnType<typeof createNativeKartLook>, "render"> & {
  render(
    scene: THREE.Scene,
    camera: THREE.Camera,
    tier: GraphicsTier,
    frame?: KartLookFrame,
  ): void;
};
const nativeLook = createNativeKartLook as unknown as (
  native: typeof THREE,
  renderer: THREE.WebGLRenderer,
  palette: Record<
    "ground" | "road" | "ink" | "muted" | "accent" | "highlight",
    THREE.Color
  >,
) => SoloLookRenderer;

/** One committed native176 pass owns final rendering only while explicitly opted in. */
export function SoloLook({
  body,
  preset,
}: {
  body: { current: DrivingBody };
  preset: KartLookPreset;
}) {
  const scene = useThree((s) => s.scene) as unknown as THREE.Scene,
    camera = useThree((s) => s.camera) as unknown as THREE.Camera,
    gl = useThree((s) => s.gl) as unknown as THREE.WebGLRenderer,
    invalidate = useThree((s) => s.invalidate);
  const resources = useRef<SoloLookRenderer | null>(null),
    tier = useGraphicsTier(),
    reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (!(scene instanceof THREE.Scene) || !(gl instanceof THREE.WebGLRenderer))
      throw Error("Practice look renderer versions do not match. Reload the circuit.");
    const c = themes[DEFAULT_THEME_ID].colors;
    const renderer = nativeLook(THREE, gl, {
      ground: new THREE.Color(c.background),
      road: new THREE.Color(c.surface),
      ink: new THREE.Color(c.foreground),
      muted: new THREE.Color(c.muted),
      accent: new THREE.Color(c.accent),
      highlight: new THREE.Color(c.highlight),
    });
    resources.current = renderer;
    useGameStore.setState({ soloLookReady: false });
    invalidate();
    return () => {
      resources.current = null;
      useGameStore.setState({ soloLookReady: false });
      renderer.dispose();
      gl.domElement.dataset.soloLook = "legacy";
      for (const key of [
        "lookNative",
        "lookActive",
        "lookSky",
        "lookReflection",
        "lookShadows",
        "lookBuffers",
        "lookDepthTextures",
        "lookTextureSamples",
        "lookWind",
        "lookChromatic",
        "lookLensDirt",
        "lookBloom",
        "lookAo",
        "lookTiltShift",
      ])
        delete gl.domElement.dataset[key];
    };
  }, [scene, gl, invalidate]);
  useEffect(() => {
    resources.current?.configure(preset);
    invalidate();
  }, [preset, scene, gl, invalidate]);
  useEffect(() => {
    invalidate();
  }, [tier, reduced, invalidate]);
  useFrame((_, dt) => {
    const renderer = resources.current;
    if (!renderer) {
      gl.render(scene, camera);
      return;
    }
    const state = useGameStore.getState(),
      d = body.current,
      ground = importedGroundAt(d.x, d.z, "solo");
    renderer.render(scene, camera, tier, {
      dt,
      paused: state.soloPaused,
      reducedMotion: reduced,
      speed: Math.hypot(d.vx, d.vz),
      boost: d.boostMs > 0 ? 1 : 0,
      focus: [d.x, (ground?.y ?? -1.6) + (d.height ?? 0), d.z],
    });
    const stats = renderer.stats(),
      canvas = gl.domElement;
    canvas.dataset.soloLook = "preset";
    canvas.dataset.lookNative = String(
      scene instanceof THREE.Scene && gl instanceof THREE.WebGLRenderer,
    );
    canvas.dataset.lookActive = String(stats.active);
    canvas.dataset.lookBuffers = String(stats.buffers);
    canvas.dataset.lookSky = String(stats.environment?.sky ?? false);
    canvas.dataset.lookReflection = String(stats.environment?.reflection ?? false);
    canvas.dataset.lookShadows = String(stats.environment?.shadows ?? false);
    canvas.dataset.lookDepthTextures = String(stats.depthTextures);
    canvas.dataset.lookTextureSamples = String(stats.textureSamples);
    for (const key of [
      "wind",
      "chromatic",
      "lensDirt",
      "bloom",
      "ao",
      "tiltShift",
    ] as const)
      canvas.dataset[`look${key[0]!.toUpperCase()}${key.slice(1)}`] = String(
        stats.optics[key],
      );
    if (!state.soloLookReady) useGameStore.setState({ soloLookReady: true });
  }, 1);
  return null;
}

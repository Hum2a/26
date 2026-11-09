import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { drivingDriftLevel, type DrivingBody, type KartVfxPreset } from "@26/shared";
import { createKartVfxPool, type VfxTone } from "../../web/src/kart/vfx-budget";
import { createNativeKartVfx } from "../../web/src/kart/vfx-renderer";
import { usePrefersReducedMotion } from "../../web/src/anim/use-reduced-motion";
import { themes, DEFAULT_THEME_ID } from "../../web/src/theme/themes";
import { useGraphicsTier } from "../../web/src/kart/graphics-preferences";
import { useGameStore } from "./upstream/store.js";
import { importedGroundAt } from "../../../packages/shared/src/kart/kart-track";

type SceneView = ReturnType<ReturnType<typeof createKartVfxPool>["view"]>;
type SoloRenderer = Omit<ReturnType<typeof createNativeKartVfx>, "render"> & {
  render(view: SceneView, camera: THREE.Camera, preset: KartVfxPreset): void;
};
// Rebind nominal declarations only. Vite deduplicates the actual solo176 runtime.
const nativeVfx = createNativeKartVfx as unknown as (
  native: typeof THREE,
  scene: THREE.Scene,
  palette: Record<VfxTone, THREE.Color>,
) => SoloRenderer;

export function SoloVfx({
  body,
  preset,
}: {
  body: { current: DrivingBody };
  preset: KartVfxPreset;
}) {
  const scene = useThree((state) => state.scene) as unknown as THREE.Scene;
  const camera = useThree((state) => state.camera) as unknown as THREE.Camera;
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const tier = useGraphicsTier();
  const reduced = usePrefersReducedMotion();
  const resources = useMemo(() => {
    if (!(scene instanceof THREE.Scene) || !(gl instanceof THREE.WebGLRenderer))
      throw new Error("Practice renderer versions do not match. Reload the circuit.");
    const colours = themes[DEFAULT_THEME_ID].colors;
    return {
      pool: createKartVfxPool(),
      renderer: nativeVfx(THREE, scene, {
        accent: new THREE.Color(colours.accent),
        highlight: new THREE.Color(colours.highlight),
        muted: new THREE.Color(colours.muted),
        ink: new THREE.Color(colours.foreground),
      }),
    };
  }, [scene, gl]);
  useEffect(() => {
    resources.pool.configure(preset);
    invalidate();
  }, [resources, preset, invalidate]);
  useEffect(() => {
    invalidate();
  }, [reduced, tier, invalidate]);
  useEffect(() => {
    const visibility = () => {
      resources.pool.reset();
      invalidate();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      resources.pool.dispose();
      resources.renderer.dispose();
      gl.domElement.dataset.soloVfx = "legacy";
      delete gl.domElement.dataset.vfxParticles;
      delete gl.domElement.dataset.vfxSkids;
      delete gl.domElement.dataset.vfxNative;
      delete gl.domElement.dataset.vfxGeometries;
      delete gl.domElement.dataset.vfxTextures;
    };
  }, [resources, invalidate, gl]);
  useFrame((_, dt) => {
    const state = useGameStore.getState(),
      d = body.current;
    const ground = importedGroundAt(d.x, d.z, "solo");
    const surface =
      state.soloSurface === "dirt"
        ? "dirt"
        : state.soloSurface === "unsupported"
          ? "unsupported"
          : "road";
    resources.pool.update({
      raceId: `solo:${state.soloReset}`,
      elapsedMs: state.soloElapsed,
      dt,
      tier,
      paused: state.soloPaused || !state.soloStarted,
      hidden: document.hidden,
      reducedMotion: reduced,
      actors: [
        {
          playerId: "solo",
          contact: d.contact,
          number: 1,
          x: d.x,
          y: (ground?.y ?? -1.6) + (d.height ?? 0),
          clearance: d.height ?? 0,
          groundNormal: ground?.normal,
          z: d.z,
          heading: d.heading,
          speed: Math.hypot(d.vx, d.vz),
          drifting: d.wasDrifting,
          charge: drivingDriftLevel(d.driftMs),
          boosting: d.boostMs > 0,
          surface,
          status: "RACING",
        },
      ],
    });
    resources.renderer.render(resources.pool.view(), camera, preset);
    const stats = resources.renderer.stats();
    gl.domElement.dataset.soloVfx = "preset";
    gl.domElement.dataset.vfxParticles = String(stats.particles);
    gl.domElement.dataset.vfxSkids = String(stats.skids);
    // Explicit preset rehearsal only. Native renderer's preceding completed frame.
    gl.domElement.dataset.vfxGeometries = String(gl.info.memory.geometries);
    gl.domElement.dataset.vfxTextures = String(gl.info.memory.textures);
    gl.domElement.dataset.vfxNative = String(
      scene instanceof THREE.Scene && gl instanceof THREE.WebGLRenderer,
    );
  });
  return null;
}

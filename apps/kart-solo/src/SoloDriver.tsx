import { useEffect, useMemo, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { createNativeDriverRig } from "../../web/src/kart/driver-rig-core";
import { themes, DEFAULT_THEME_ID } from "../../web/src/theme/themes";
import { useGameStore } from "./upstream/store.js";
import type { DriverCue } from "../../web/src/kart/driver-rig-core";

type SoloHelpers = {
  scene: THREE.Scene;
  capacity: number;
  textures: Set<THREE.Texture>;
  material: THREE.Material;
  onChange?: () => void;
  palette: {
    ink: THREE.Color;
    ground: THREE.Color;
    accent: THREE.Color;
    highlight: THREE.Color;
  };
  geo<T extends THREE.BufferGeometry>(geometry: T): T;
  batch(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    capacity: number,
  ): THREE.InstancedMesh;
};
type SoloRig = Omit<ReturnType<typeof createNativeDriverRig>, "place"> & {
  place(
    playerId: string,
    order: number,
    pose: { x: number; z: number; heading: number; height?: number },
    cue: Omit<DriverCue, "turnRate">,
    colour: THREE.Color,
    second: THREE.Color,
    dt: number,
    reduced: boolean,
  ): void;
};
// Both retained Three releases implement the used construction/instance APIs.
// This boundary rebinds their nominal declarations, never their runtime objects.
const createSoloRig = createNativeDriverRig as unknown as (
  native: typeof THREE,
  helpers: SoloHelpers,
) => SoloRig;

/** Native solo Three objects only; the party renderer contributes construction code. */
export function SoloDriver({ anchor }: { anchor: RefObject<THREE.Object3D | null> }) {
  // Fiber's hoisted declarations resolve the party version, while this bundle's
  // Canvas and all constructors use solo's pinned runtime.
  const scene = useThree((state) => state.scene) as unknown as THREE.Scene;
  const invalidate = useThree((state) => state.invalidate);
  const canvas = useThree((state) => state.gl.domElement);
  const renderer = useThree((state) => state.gl);
  const position = useMemo(() => new THREE.Vector3(), []);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const style = useGameStore((state) => state.soloDriverStyle);
  const face = useGameStore((state) => state.soloDriverFace);
  const resources = useMemo(() => {
    if (!(scene instanceof THREE.Scene) || !(renderer instanceof THREE.WebGLRenderer))
      throw new Error("Practice renderer versions do not match. Reload the circuit.");
    const geometries = new Set<THREE.BufferGeometry>();
    const textures = new Set<THREE.Texture>();
    const meshes: THREE.InstancedMesh[] = [];
    const colours = themes[DEFAULT_THEME_ID].colors;
    const palette = {
      ink: new THREE.Color(colours.foreground),
      ground: new THREE.Color(colours.background),
      accent: new THREE.Color(colours.accent),
      highlight: new THREE.Color(colours.highlight),
    };
    const material = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      flatShading: true,
    });
    const rig = createSoloRig(THREE, {
      scene,
      onChange: invalidate,
      capacity: 1,
      textures,
      material,
      palette,
      geo(geometry) {
        geometries.add(geometry);
        return geometry;
      },
      batch(geometry, material, capacity) {
        const mesh = new THREE.InstancedMesh(geometry, material, capacity);
        mesh.frustumCulled = false;
        meshes.push(mesh);
        scene.add(mesh);
        return mesh;
      },
    });
    return { rig, geometries, textures, meshes, material, palette };
  }, [scene, renderer, invalidate]);
  useEffect(() => {
    resources.rig.setDrivers(
      new Map([["solo", { style, ...(face ? { faceMediaId: face } : {}) }]]),
      (url) => url,
    );
    invalidate();
  }, [style, face, resources, invalidate]);
  useEffect(
    () => () => {
      resources.rig.dispose();
      for (const mesh of resources.meshes) {
        scene.remove(mesh);
        mesh.dispose();
      }
      for (const geometry of resources.geometries) geometry.dispose();
      for (const texture of resources.textures) texture.dispose();
      resources.material.dispose();
    },
    [resources, scene],
  );
  useFrame((_, dt) => {
    const state = useGameStore.getState();
    if (!anchor.current) return;
    anchor.current.getWorldPosition(position);
    forward.set(0, 0, 1);
    anchor.current.localToWorld(forward).sub(position);
    const pose = {
      x: position.x,
      z: position.z,
      height: position.y - 0.5,
      heading: Math.atan2(forward.z, forward.x),
    };
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { rig, palette } = resources;
    rig.begin(state.soloPaused ? 0 : dt);
    rig.place(
      "solo",
      0,
      pose,
      {
        status: "RACING",
        drifting: !!state.driftLevel?.charging,
        elapsedMs: state.soloElapsed,
      },
      palette.accent,
      palette.highlight,
      state.soloPaused ? 0 : dt,
      reduced,
    );
    rig.end(new Set(["solo"]));
    canvas.dataset.driverStyle = state.soloDriverStyle;
    canvas.dataset.threeRevision = THREE.REVISION;
    canvas.dataset.driverNative = String(
      scene instanceof THREE.Scene && renderer instanceof THREE.WebGLRenderer,
    );
    canvas.dataset.driverFaces = String(rig.faceCount());
    canvas.dataset.driverInstances = String(
      Math.max(...rig.counts().map((part) => part.count)),
    );
  });
  return null;
}

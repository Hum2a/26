import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  Object3D,
  AdditiveBlending,
} from "three";
import { driftSparks, driftStrength } from "../../web/src/kart/drift-effects";
import { themes, DEFAULT_THEME_ID } from "../../web/src/theme/themes";
import { useGameStore } from "./upstream/store.js";
import type { DrivingBody } from "@26/shared";

export function DriftEffects({ body }: { body: { current: DrivingBody } }) {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useRef(new Object3D());
  const time = useRef(0),
    strength = useRef(0);
  const palette = themes[DEFAULT_THEME_ID].colors;
  const cold = useRef(new Color(palette.accent)),
    hot = useRef(new Color(palette.highlight));
  useFrame((_, dt) => {
    if (!mesh.current) return;
    const state = useGameStore.getState(),
      d = body.current;
    const paused = state.soloPaused || !state.soloStarted;
    if (!paused) time.current += Math.min(0.1, dt);
    const active = !paused && (d.wasDrifting || d.boostMs > 0);
    strength.current = driftStrength(strength.current, active, dt);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const particles = driftSparks(
      time.current,
      strength.current,
      d.driftMs / 700,
      d.boostMs > 0,
      reduced,
    );
    mesh.current.count = strength.current > 0.01 ? particles.length : 0;
    particles.forEach((p, i) => {
      const object = dummy.current;
      object.position.set(p.x, -1.1 + p.y, p.z);
      object.scale.set(
        p.scale * 2.5,
        p.scale * 0.6,
        p.scale * (d.boostMs > 0 ? 2.5 : 0.6),
      );
      object.updateMatrix();
      mesh.current!.setMatrixAt(i, object.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    const material = mesh.current.material;
    if (!Array.isArray(material) && "color" in material)
      (material.color as Color)
        .copy(cold.current)
        .lerp(hot.current, Math.min(1, d.boostMs > 0 ? 1 : d.driftMs / 700));
  });
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, 8]}
      frustumCulled={false}
      name="solo-drift-sparks"
      onUpdate={(object) => {
        object.count = 0;
        object.instanceMatrix.setUsage(DynamicDrawUsage);
      }}
    >
      <octahedronGeometry args={[0.16]} />
      <meshBasicMaterial
        color={palette.accent}
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </instancedMesh>
  );
}

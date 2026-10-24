import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  Object3D,
  AdditiveBlending,
  Vector3,
} from "three";
import { driftSparks, driftStrength } from "../../web/src/kart/drift-effects";
import { themes, DEFAULT_THEME_ID } from "../../web/src/theme/themes";
import { useGameStore } from "./upstream/store.js";
import type { DrivingBody } from "@26/shared";
import { useGraphicsTier } from "../../web/src/kart/graphics-preferences";
import { graphicsProfiles } from "../../web/src/kart/graphics";

export function DriftEffects({ body }: { body: { current: DrivingBody } }) {
  const tier = useGraphicsTier();
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useRef(new Object3D());
  const time = useRef(0),
    strength = useRef(0);
  const trails = useRef(
    Array.from({ length: 32 }, () => ({ position: new Vector3(), age: 1, power: 0 })),
  );
  const cursor = useRef(0),
    emission = useRef(0);
  const palette = themes[DEFAULT_THEME_ID].colors;
  const cold = useRef(new Color(palette.accent)),
    hot = useRef(new Color(palette.highlight));
  useFrame((_, dt) => {
    if (!mesh.current) return;
    const state = useGameStore.getState(),
      d = body.current;
    const paused = state.soloPaused || !state.soloStarted;
    if (paused) return;
    if (!paused) time.current += Math.min(0.1, dt);
    const active = !paused && (d.wasDrifting || d.boostMs > 0);
    strength.current = driftStrength(strength.current, active, dt);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const particles = driftSparks(
      time.current,
      strength.current,
      d.driftMs / 2400,
      d.boostMs > 0,
      reduced,
    ).filter((_, index) => index % graphicsProfiles[tier].sparkStride === 0);
    mesh.current.count = reduced || tier !== "high" ? particles.length : 40;
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
    // Leave sparks in world space: a slide draws a curved wake instead of a
    // rigid ornament which rotates with the kart. Recycle a bounded pool.
    mesh.current.updateWorldMatrix(true, false);
    const seconds = Math.min(0.1, dt);
    for (const trail of trails.current) trail.age += seconds;
    emission.current += seconds;
    while (emission.current >= 0.025) {
      emission.current -= 0.025;
      if (!active || reduced || tier !== "high") continue;
      for (const side of [-1, 1]) {
        const trail = trails.current[cursor.current++ % trails.current.length]!;
        trail.position.set(side * 0.83, -1.05, 0.8);
        mesh.current.localToWorld(trail.position);
        trail.age = 0;
        trail.power = 0.6 + Math.min(1, d.driftMs / 2400);
      }
    }
    if (!reduced && tier === "high")
      trails.current.forEach((trail, i) => {
        const object = dummy.current;
        object.position.copy(trail.position);
        mesh.current!.worldToLocal(object.position);
        object.position.y += Math.min(0.4, trail.age) * 0.5;
        const scale = Math.max(0, 1 - trail.age / 0.4) * trail.power;
        object.scale.set(scale * 1.8, scale * 0.6, scale * 0.6);
        object.updateMatrix();
        mesh.current!.setMatrixAt(i + 8, object.matrix);
      });
    mesh.current.instanceMatrix.needsUpdate = true;
    const material = mesh.current.material;
    if (!Array.isArray(material) && "color" in material)
      (material.color as Color)
        .copy(cold.current)
        .lerp(hot.current, Math.min(1, d.boostMs > 0 ? 1 : d.driftMs / 2400));
  });
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, 40]}
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

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Mesh, Object3D } from "three";
import { soloItemBoxes } from "@26/shared";
import { themes, DEFAULT_THEME_ID } from "../../web/src/theme/themes";
import { useGameStore } from "./upstream/store.js";
export function TrackItems() {
  const boxes = useRef<InstancedMesh>(null),
    oils = useRef<InstancedMesh>(null),
    shield = useRef<Mesh>(null),
    dummy = useRef(new Object3D());
  const palette = themes[DEFAULT_THEME_ID].colors;
  useFrame(() => {
    if (!boxes.current || !oils.current || !shield.current) return;
    const state = useGameStore.getState(),
      now = state.soloElapsed,
      powers = state.soloPowers;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let count = 0;
    for (const box of soloItemBoxes) {
      if ((powers.cooldowns[box.id] ?? 0) > now) continue;
      dummy.current.position.set(
        box.x,
        -0.7 + (reduced ? 0 : Math.sin(now / 500) * 0.12),
        box.z,
      );
      dummy.current.rotation.set(0, reduced ? Math.PI / 4 : now / 1000, 0);
      dummy.current.scale.setScalar(1);
      dummy.current.updateMatrix();
      boxes.current.setMatrixAt(count++, dummy.current.matrix);
    }
    boxes.current.count = count;
    boxes.current.instanceMatrix.needsUpdate = true;
    let oilCount = 0;
    for (const oil of state.soloOils) {
      dummy.current.position.set(oil.x, -1.58, oil.z);
      dummy.current.rotation.set(-Math.PI / 2, 0, 0);
      dummy.current.scale.setScalar(1);
      dummy.current.updateMatrix();
      oils.current.setMatrixAt(oilCount++, dummy.current.matrix);
    }
    oils.current.count = oilCount;
    oils.current.instanceMatrix.needsUpdate = true;
    shield.current.visible = powers.shieldUntil > now;
    const pos = state.playerPosition;
    if (pos) shield.current.position.set(pos.x, -0.35, pos.z);
  });
  return (
    <group name="solo-track-items">
      <instancedMesh
        ref={boxes}
        args={[undefined, undefined, soloItemBoxes.length]}
        frustumCulled={false}
        onUpdate={(m) => {
          m.count = 0;
        }}
      >
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshStandardMaterial color={palette.accent} wireframe />
      </instancedMesh>
      <instancedMesh
        ref={oils}
        args={[undefined, undefined, 64]}
        frustumCulled={false}
        onUpdate={(m) => {
          m.count = 0;
        }}
      >
        <circleGeometry args={[1.6, 16]} />
        <meshBasicMaterial color={palette.background} />
      </instancedMesh>
      <mesh ref={shield} visible={false}>
        <sphereGeometry args={[1.5, 12, 8]} />
        <meshBasicMaterial
          color={palette.highlight}
          transparent
          opacity={0.35}
          wireframe
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

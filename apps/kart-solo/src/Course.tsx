import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import {
  soloCourse,
  courseEnabled,
  courseFeaturePose,
  type CourseFeature,
} from "@26/shared";
import { themes, DEFAULT_THEME_ID } from "../../web/src/theme/themes";
import { useGameStore } from "./upstream/store.js";

function Feature({ feature }: { feature: CourseFeature }) {
  const group = useRef<Group>(null);
  const palette = themes[DEFAULT_THEME_ID].colors;
  useFrame(() => {
    if (!group.current) return;
    const state = useGameStore.getState();
    group.current.visible = courseEnabled(feature, state.soloCourseSettings);
    const pose = courseFeaturePose(feature, state.soloElapsed);
    group.current.position.set(pose.x, -1.5, pose.z);
  });
  const ramp = feature.kind === "ramp",
    hazard = feature.kind === "hazard";
  return (
    <group
      ref={group}
      rotation={[0, -feature.heading, 0]}
      name={`course-${feature.kind}`}
    >
      <mesh
        position={[0, ramp ? 0.65 : hazard ? 0.6 : 0.05, 0]}
        rotation={[0, 0, ramp ? 0.22 : 0]}
      >
        <boxGeometry
          args={[feature.length, ramp ? 0.15 : hazard ? 1.2 : 0.1, feature.width]}
        />
        <meshStandardMaterial
          color={
            hazard ? palette.foreground : ramp ? palette.highlight : palette.accent
          }
        />
      </mesh>
      {[-1, 0, 1].map((x) => (
        <mesh
          key={x}
          position={[x, ramp ? 0.7 + x * 0.22 : hazard ? 1.25 : 0.12, 0]}
          rotation={[-Math.PI / 2, 0, -Math.PI / 2]}
        >
          <coneGeometry args={[0.3, 0.65, 3]} />
          <meshBasicMaterial color={palette.background} />
        </mesh>
      ))}
    </group>
  );
}
export function Course() {
  return (
    <group name="solo-course">
      {soloCourse.map((feature) => (
        <Feature key={feature.id} feature={feature} />
      ))}
    </group>
  );
}

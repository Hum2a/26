import * as THREE from "three";
import { vehiclePose } from "./vehicle-pose";
import type { KartPose } from "./presentation";

const partNames = [
  "body",
  "d_wheel",
  "booster",
  "wheel_0",
  "wheel_1",
  "wheel_2",
  "wheel_3",
] as const;

/** Original adapter for the retained GLB. Source geometry/materials stay with its loader owner. */
export function createVehicleRig(
  source: THREE.Object3D,
  scene: THREE.Scene,
  capacity: number,
) {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 80)
    throw new Error("Invalid vehicle capacity");
  const nodes = partNames.map((name) => source.getObjectByName(name));
  if (nodes.some((node) => !(node instanceof THREE.Mesh)))
    throw new Error("Kart model is missing a required part");
  const parts = nodes.map((node, i) => {
    const original = node as THREE.Mesh;
    const mesh = new THREE.InstancedMesh(
      original.geometry,
      original.material,
      capacity,
    );
    mesh.name = "kart-detail-" + partNames[i];
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    return { original, mesh, name: partNames[i]! };
  });
  const root = new THREE.Object3D(),
    local = new THREE.Object3D(),
    matrix = new THREE.Matrix4();
  return {
    place(
      index: number,
      pose: KartPose,
      motion: { speed: number; turnRate: number; travel: number },
      reduced: boolean,
    ) {
      if (!Number.isInteger(index) || index < 0 || index >= capacity) return;
      const front = vehiclePose(motion, reduced, {
        wheelBase: 1.4,
        wheelRadius: 0.2892,
      });
      const rear = vehiclePose(motion, reduced, {
        wheelBase: 1.4,
        wheelRadius: 0.3518,
      });
      // Raw GLB parts face +Z. Ignore the authoring root's scale10, as solo does.
      root.position.set(pose.x, (pose.height ?? 0) + 0.5, pose.z);
      root.rotation.set(0, -pose.heading + Math.PI / 2, front.roll, "YXZ");
      root.updateMatrixWorld(true);
      for (const { original, mesh, name } of parts) {
        local.position.copy(original.position);
        local.quaternion.copy(original.quaternion);
        local.scale.copy(original.scale);
        if (name.startsWith("wheel_")) {
          const steering = name === "wheel_0" || name === "wheel_1";
          local.rotation.x += steering ? front.wheelRotation : rear.wheelRotation;
          if (steering) local.rotation.y -= front.steering;
        } else if (name === "d_wheel") local.rotation.y -= front.steering * 2.2;
        local.updateMatrix();
        mesh.setMatrixAt(
          index,
          matrix.multiplyMatrices(root.matrixWorld, local.matrix),
        );
      }
    },
    end(count: number) {
      for (const { mesh } of parts) {
        mesh.count = Math.max(0, Math.min(capacity, Math.floor(count) || 0));
        mesh.instanceMatrix.needsUpdate = true;
      }
    },
    dispose() {
      for (const { mesh } of parts) {
        scene.remove(mesh);
        mesh.dispose();
      }
    },
  };
}

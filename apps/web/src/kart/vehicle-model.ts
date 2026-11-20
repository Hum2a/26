import * as THREE from "three";
import { createNativeVehicleRig } from "./vehicle-model-core";

/** Original adapter for the retained GLB. Source geometry/materials stay with its loader owner. */
export function createVehicleRig(
  source: THREE.Object3D,
  scene: THREE.Scene,
  capacity: number,
) {
  return createNativeVehicleRig(THREE, source, scene, capacity);
}

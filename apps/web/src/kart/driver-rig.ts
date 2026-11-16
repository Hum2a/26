import * as THREE from "three";
import { createNativeDriverRig, type DriverRigHelpers } from "./driver-rig-core";
export { driverMood, approachAngle, lookBackMs } from "./driver-rig-core";
export type { DriverMood, DriverCue } from "./driver-rig-core";

/** Each renderer supplies its native Three constructors; no objects cross bundles. */
export function createDriverRig(helpers: DriverRigHelpers) {
  return createNativeDriverRig(THREE, helpers);
}

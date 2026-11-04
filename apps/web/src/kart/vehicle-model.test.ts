import * as THREE from "three";
import { expect, it, vi } from "vitest";
import { createVehicleRig } from "./vehicle-model";

function source() {
  const root = new THREE.Group();
  for (const name of [
    "body",
    "d_wheel",
    "booster",
    "wheel_0",
    "wheel_1",
    "wheel_2",
    "wheel_3",
  ]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    mesh.name = name;
    root.add(mesh);
  }
  return root;
}
it("instances all retained vehicle parts at bounded capacity with shared resources and disposes only owned instances", () => {
  const model = source(),
    scene = new THREE.Scene();
  const body = model.getObjectByName("body") as THREE.Mesh;
  const dispose = vi.spyOn(body.geometry, "dispose");
  const rig = createVehicleRig(model, scene, 80);
  rig.place(
    79,
    { x: 2, z: 3, heading: 0 },
    { speed: 5, turnRate: 0.5, travel: 10 },
    false,
  );
  rig.end(1000);
  expect(scene.children).toHaveLength(7);
  expect(
    scene.children.every((mesh) => (mesh as THREE.InstancedMesh).count === 80),
  ).toBe(true);
  expect((scene.getObjectByName("kart-detail-body") as THREE.Mesh).geometry).toBe(
    body.geometry,
  );
  const matrix = new THREE.Matrix4();
  (scene.getObjectByName("kart-detail-body") as THREE.InstancedMesh).getMatrixAt(
    79,
    matrix,
  );
  expect(new THREE.Vector3().setFromMatrixPosition(matrix).toArray()).toEqual([
    2, 0.5, 3,
  ]);
  rig.dispose();
  expect(scene.children).toHaveLength(0);
  expect(dispose).not.toHaveBeenCalled();
});
it("refuses incomplete models before adding meshes and bounds every visible count", () => {
  const scene = new THREE.Scene();
  expect(() => createVehicleRig(new THREE.Group(), scene, 1)).toThrow();
  expect(scene.children).toHaveLength(0);
  expect(() => createVehicleRig(source(), scene, 81)).toThrow();
  const rig = createVehicleRig(source(), scene, 1);
  rig.end(-1);
  expect(
    scene.children.every((mesh) => (mesh as THREE.InstancedMesh).count === 0),
  ).toBe(true);
  rig.dispose();
});

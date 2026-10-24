import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { ringBounds, ringCourse, soloCourse, courseFeaturePose } from "@26/shared";
import type { KartRaceView } from "@26/shared";
import { driftSparks, driftStrength } from "./drift-effects";
import { smoothKartPose, type KartPose } from "./presentation";
import { createDriverRig } from "./driver-rig";

type Palette = Record<
  "ground" | "road" | "accent" | "highlight" | "ink" | "muted",
  THREE.Color
>;

/** Original low-poly venue. Shared/instanced meshes keep a full room inexpensive. */
export function createCircuit(
  palette: Palette,
  mobile: boolean,
  focusPlayerId?: string,
  trackId = "party-ring-v1",
  onAssetError?: () => void,
) {
  const imported = trackId === "mario-circuit-v1";
  const course = imported ? soloCourse : ringCourse;
  let disposed = false;
  const venue = new THREE.Group();
  venue.visible = !imported;
  let target: THREE.Object3D = venue;
  const capacity = focusPlayerId ? 1 : 80;
  const { ground, road, accent, highlight, ink, muted } = palette;
  const scene = new THREE.Scene();
  scene.background = ground;
  scene.add(venue);
  scene.add(new THREE.HemisphereLight(ink, ground, 2));
  const sun = new THREE.DirectionalLight(ink, 2);
  sun.position.set(25, 70, 10);
  scene.add(sun);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const instances = new Set<THREE.InstancedMesh>();
  const geo = <T extends THREE.BufferGeometry>(value: T) => {
    geometries.add(value);
    return value;
  };
  const mat = (color: THREE.Color) => {
    const value = new THREE.MeshLambertMaterial({ color, flatShading: true });
    materials.add(value);
    return value;
  };
  const surface = mat(road),
    bright = mat(accent),
    second = mat(highlight),
    text = mat(ink),
    dark = mat(ground),
    quiet = mat(muted);
  const releaseModel = (root: THREE.Object3D) =>
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) {
            const bitmap = value.source.data;
            if (bitmap && typeof bitmap.close === "function") bitmap.close();
            value.dispose();
          }
        material.dispose();
      }
    });
  let model: THREE.Object3D | undefined;
  const draco = imported
    ? new DRACOLoader().setDecoderPath("/kart-engine/draco/").setWorkerLimit(1)
    : undefined;
  if (draco)
    new GLTFLoader().setDRACOLoader(draco).load(
      "/kart-engine/models/mario-circuit-test-transformed.glb",
      (gltf) => {
        if (disposed) {
          releaseModel(gltf.scene);
          return;
        }
        model = gltf.scene;
        model.position.set(155, -26.4, 15);
        model.scale.setScalar(0.08);
        scene.add(model);
        draco.dispose();
      },
      undefined,
      () => {
        draco.dispose();
        onAssetError?.();
      },
    );
  const transform = new THREE.Object3D();
  const mesh = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const value = new THREE.Mesh(geometry, material);
    value.position.set(x, y, z);
    target.add(value);
    return value;
  };
  const batch = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    count: number,
  ) => {
    const value = new THREE.InstancedMesh(geometry, material, count);
    value.frustumCulled = false;
    target.add(value);
    instances.add(value);
    return value;
  };
  const place = (
    value: THREE.InstancedMesh,
    i: number,
    x: number,
    y: number,
    z: number,
    yaw = 0,
    sx = 1,
    sy = 1,
    sz = 1,
  ) => {
    transform.position.set(x, y, z);
    transform.rotation.set(0, yaw, 0);
    transform.scale.set(sx, sy, sz);
    transform.updateMatrix();
    value.setMatrixAt(i, transform.matrix);
  };
  const segments = mobile ? 64 : 96;
  // Raised circuit plinth and inner lawn are distinct silhouettes, without shadow maps.
  mesh(geo(new THREE.CylinderGeometry(53, 54, 2, segments)), dark, 0, -1.4, 0);
  const roadMesh = mesh(
    geo(new THREE.RingGeometry(ringBounds.inner, ringBounds.outer, segments)),
    surface,
    0,
    0.02,
    0,
  );
  roadMesh.rotation.x = -Math.PI / 2;
  mesh(geo(new THREE.CylinderGeometry(32.5, 33, 0.7, segments)), quiet, 0, -0.3, 0);
  const curbGeo = geo(new THREE.BoxGeometry(3.1, 0.65, 0.9));
  const curbsA = batch(curbGeo, bright, 64),
    curbsB = batch(curbGeo, text, 64);
  for (let i = 0; i < 128; i++) {
    const a = (Math.floor(i / 2) * Math.PI) / 32,
      r = i % 2 ? 50.5 : 33.5;
    place(
      Math.floor(i / 2) % 2 ? curbsB : curbsA,
      Math.floor(i / 4) * 2 + (i % 2),
      Math.cos(a) * r,
      0.15,
      Math.sin(a) * r,
      -a + Math.PI / 2,
    );
  }
  const dash = batch(geo(new THREE.BoxGeometry(1.6, 0.05, 0.12)), text, 48);
  for (let i = 0; i < 48; i++) {
    const a = (i * Math.PI) / 24;
    place(dash, i, Math.cos(a) * 42, 0.08, Math.sin(a) * 42, -a + Math.PI / 2);
  }
  const checkGeo = geo(new THREE.BoxGeometry(2, 0.08, 1));
  const finishA = batch(checkGeo, text, 8),
    finishB = batch(checkGeo, dark, 8);
  let finishIndexA = 0,
    finishIndexB = 0;
  for (let x = 0; x < 8; x++)
    for (let z = 0; z < 2; z++) {
      const white = (x + z) % 2;
      place(
        white ? finishA : finishB,
        white ? finishIndexA++ : finishIndexB++,
        35 + x * 2,
        0.11,
        z - 0.5,
      );
    }
  const poleGeo = geo(new THREE.CylinderGeometry(0.3, 0.3, 6, 6));
  for (const x of [32.5, 51.5]) mesh(poleGeo, second, x, 3, 0);
  mesh(geo(new THREE.BoxGeometry(19.5, 1.5, 0.8)), bright, 42, 6, 0);
  const arrowShape = new THREE.Shape()
    .moveTo(0, 2)
    .lineTo(-1.4, -1)
    .lineTo(1.4, -1)
    .closePath();
  const arrowGeo = geo(new THREE.ShapeGeometry(arrowShape));
  for (let i = 1; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const arrow = mesh(arrowGeo, second, Math.cos(a) * 45, 0.12, Math.sin(a) * 45);
    arrow.rotation.x = -Math.PI / 2;
    arrow.rotation.z = Math.PI - a;
  }
  // Tiered stands and low-poly trees stay outside the driving surface.
  const standGeo = geo(new THREE.BoxGeometry(16, 1.2, 3));
  for (const x of [-22, 0, 22])
    for (let tier = 0; tier < 3; tier++)
      mesh(standGeo, tier % 2 ? second : bright, x, 0.5 + tier * 1.1, -56 - tier * 2.5);
  const trunks = batch(geo(new THREE.CylinderGeometry(0.35, 0.5, 2.5, 5)), dark, 12),
    crowns = batch(geo(new THREE.ConeGeometry(2.2, 5, 5)), bright, 12);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6,
      r = 24;
    place(trunks, i, Math.cos(a) * r, 1, Math.sin(a) * r);
    place(crowns, i, Math.cos(a) * r, 4, Math.sin(a) * r);
  }
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = `#${ground.getHexString()}`;
    ctx.font = "900 150px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("26", 256, 160);
    ctx.font = "700 25px sans-serif";
    ctx.fillText("GRAND PRIX", 256, 210);
    const texture = new THREE.CanvasTexture(canvas);
    textures.add(texture);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    materials.add(material);
    const mark = mesh(geo(new THREE.PlaneGeometry(28, 14)), material, 0, 0.12, 0);
    mark.rotation.x = -Math.PI / 2;
  }
  // Six batches instead of one group of draw calls per racer (including 320 wheels).
  // Instance colours are the palette; the base material is a neutral multiplier.
  target = scene;
  const bodyMat = mat(ink);
  bodyMat.color.setRGB(1, 1, 1);
  const bodies = batch(geo(new THREE.BoxGeometry(2.8, 0.65, 1.5)), bodyMat, capacity);
  const noses = batch(geo(new THREE.BoxGeometry(0.8, 0.35, 1.7)), second, capacity);
  const seats = batch(geo(new THREE.BoxGeometry(0.65, 0.9, 0.65)), text, capacity);
  const helmets = batch(geo(new THREE.SphereGeometry(0.48, 8, 6)), second, capacity);
  const wheels = batch(
    geo(new THREE.BoxGeometry(0.65, 0.65, 0.35)),
    dark,
    capacity * 4,
  );
  for (const value of [bodies, noses, seats, helmets, wheels]) {
    value.count = 0;
    value.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }
  // Each kart's driver. The old helmet sphere stays unused: its geometry is shared below.
  const rig = createDriverRig({
    scene,
    capacity,
    geo,
    batch,
    material: bodyMat,
    textures,
    palette: { ink, ground, accent, highlight },
  });
  const sparkMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  materials.add(sparkMaterial);
  const sparks = batch(
    geo(new THREE.OctahedronGeometry(0.16)),
    sparkMaterial,
    capacity * 8,
  );
  sparks.name = "kart-drift-sparks";
  sparks.count = 0;
  sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const courseProps = batch(seats.geometry, bright, course.length);
  courseProps.name = "kart-course-features";
  const gliders = batch(seats.geometry, second, capacity);
  gliders.name = "kart-gliders";
  const itemBoxes = batch(seats.geometry, bright, 24),
    oilSlicks = batch(helmets.geometry, dark, 64);
  const shieldMaterial = new THREE.MeshBasicMaterial({
    color: highlight,
    transparent: true,
    opacity: 0.35,
    wireframe: true,
    depthWrite: false,
  });
  materials.add(shieldMaterial);
  const shields = batch(helmets.geometry, shieldMaterial, capacity);
  itemBoxes.name = "kart-item-boxes";
  oilSlicks.name = "kart-oil-slicks";
  shields.name = "kart-shields";
  for (const m of [itemBoxes, oilSlicks, shields]) {
    m.count = 0;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }
  const emission = new Map<string, number>();
  let effectTime = 0,
    effectRaceId: string | undefined;
  const poses = new Map<string, KartPose>();
  const featurePoses = new Map<string, { x: number; z: number }>();
  const labels = new Map<string, THREE.Sprite>();
  function label(driver: KartRaceView["participants"][number]) {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    ctx.fillStyle = `#${ground.getHexString()}`;
    ctx.beginPath();
    ctx.arc(32, 32, 29, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `#${driver.number % 2 ? accent.getHexString() : highlight.getHexString()}`;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = `#${ink.getHexString()}`;
    ctx.font = "bold 34px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(driver.number), 32, 34);
    const texture = new THREE.CanvasTexture(canvas);
    textures.add(texture);
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    materials.add(material);
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(4.5, 4.5, 1);
    scene.add(sprite);
    labels.set(driver.playerId, sprite);
    return sprite;
  }
  function update(race: KartRaceView, dt: number, reduced: boolean, sparkStride = 1) {
    if (effectRaceId !== race.raceId) {
      emission.clear();
      featurePoses.clear();
      effectTime = 0;
      effectRaceId = race.raceId;
    }
    let sparkCount = 0,
      shieldCount = 0;
    effectTime += Math.max(0, Math.min(0.1, dt));
    const drivers = (
      focusPlayerId
        ? race.participants.filter((driver) => driver.playerId === focusPlayerId)
        : race.participants
    ).slice(0, capacity);
    rig.begin(dt);
    for (let i = 0; i < drivers.length; i++) {
      const driver = drivers[i]!,
        pose = smoothKartPose(
          poses.get(driver.playerId) ?? driver,
          driver,
          dt,
          reduced,
        );
      poses.set(driver.playerId, pose);
      const height = pose.height ?? 0;
      const { x, z, heading } = pose,
        c = Math.cos(heading),
        s = Math.sin(heading);
      place(bodies, i, x, 0.6 + height, z, -heading);
      place(noses, i, x + c * 1.25, 0.5 + height, z + s * 1.25, -heading);
      // The seat is now a backrest behind the driver.
      place(seats, i, x - c * 0.78, 1.05 + height, z - s * 0.78, -heading, 0.5, 1, 1.1);
      bodies.setColorAt(i, driver.number % 2 ? accent : highlight);
      rig.place(
        driver.playerId,
        driver.number - 1,
        pose,
        { status: driver.status, drifting: driver.drifting, elapsedMs: race.elapsedMs },
        driver.number % 2 ? accent : highlight,
        driver.number % 2 ? highlight : accent,
        dt,
        reduced,
      );
      for (let j = 0; j < 4; j++) {
        const localX = j < 2 ? -0.75 : 0.75,
          localZ = j % 2 ? -0.78 : 0.78;
        place(
          wheels,
          i * 4 + j,
          x + c * localX - s * localZ,
          0.35 + height,
          z + s * localX + c * localZ,
          -heading,
        );
      }
      if (
        race.powers?.effects.some(
          (e) => e.playerId === driver.playerId && e.shieldMs > 0,
        )
      )
        place(shields, shieldCount++, x, 0.9 + height, z, 0, 3.5, 3, 3.5);
      const active =
        driver.status === "RACING" && (driver.drifting || driver.boostRemainingMs > 0);
      const strength = driftStrength(emission.get(driver.playerId) ?? 0, active, dt);
      emission.set(driver.playerId, strength);
      if (strength > 0.01) {
        const charged = driver.boostRemainingMs > 0 || driver.driftCharge >= 1;
        for (const spark of driftSparks(
          effectTime + i * 0.17,
          strength,
          (driver.driftChargeMs ?? driver.driftCharge * 700) / 2400,
          driver.boostRemainingMs > 0,
          reduced,
        ).filter((_, index) => index % sparkStride === 0)) {
          place(
            sparks,
            sparkCount,
            x - c * spark.z - s * spark.x,
            0.22 + spark.y + height,
            z - s * spark.z + c * spark.x,
            -heading,
            spark.scale * 2.5,
            spark.scale * 0.6,
            spark.scale * 0.6,
          );
          sparks.setColorAt(sparkCount++, charged ? highlight : accent);
        }
      }
      const sprite = focusPlayerId
        ? undefined
        : (labels.get(driver.playerId) ?? label(driver));
      if (sprite) sprite.position.set(x, 3.8 + height, z);
    }
    for (const value of [bodies, noses, seats]) {
      value.count = drivers.length;
      value.instanceMatrix.needsUpdate = true;
    }
    rig.end(new Set(drivers.map((driver) => driver.playerId)));
    wheels.count = drivers.length * 4;
    wheels.instanceMatrix.needsUpdate = true;
    let gliderCount = 0;
    for (const driver of drivers) {
      const pose = poses.get(driver.playerId);
      if (pose && (pose.height ?? 0) > 0.05)
        place(
          gliders,
          gliderCount++,
          pose.x,
          (pose.height ?? 0) + 2.8,
          pose.z,
          -pose.heading,
          1.5,
          0.08,
          6,
        );
    }
    gliders.count = gliderCount;
    gliders.instanceMatrix.needsUpdate = true;
    let featureCount = 0;
    if (race.courseEnabled)
      for (const feature of course) {
        const target = courseFeaturePose(feature, race.elapsedMs);
        const previous = featurePoses.get(feature.id) ?? target;
        const alpha = reduced ? 1 : 1 - Math.exp(-14 * Math.max(0, Math.min(0.1, dt)));
        const pose = {
          x: previous.x + (target.x - previous.x) * alpha,
          z: previous.z + (target.z - previous.z) * alpha,
        };
        featurePoses.set(feature.id, pose);
        const i = featureCount++;
        place(
          courseProps,
          i,
          pose.x,
          feature.kind === "ramp" ? 0.6 : feature.kind === "hazard" ? 0.5 : 0.1,
          pose.z,
          -feature.heading,
          feature.length / 0.65,
          (feature.kind === "hazard" ? 1 : 0.15) / 0.9,
          feature.width / 0.65,
        );
        if (feature.kind === "ramp") {
          transform.rotation.z = 0.22;
          transform.updateMatrix();
          courseProps.setMatrixAt(i, transform.matrix);
        }
        courseProps.setColorAt(
          i,
          feature.kind === "hazard"
            ? ink
            : feature.kind === "ramp"
              ? highlight
              : accent,
        );
      }
    courseProps.count = featureCount;
    courseProps.instanceMatrix.needsUpdate = true;
    if (courseProps.instanceColor) courseProps.instanceColor.needsUpdate = true;
    let boxCount = 0;
    for (const box of race.powers?.boxes ?? [])
      if (box.available)
        place(
          itemBoxes,
          boxCount++,
          box.x,
          1.1 + (reduced ? 0 : Math.sin(effectTime * 2) * 0.12),
          box.z,
          reduced ? Math.PI / 4 : effectTime,
          1.7,
          1.3,
          1.7,
        );
    let oilCount = 0;
    for (const oil of race.powers?.oils ?? [])
      place(oilSlicks, oilCount++, oil.x, 0.09, oil.z, 0, 3.5, 0.05, 3.5);
    itemBoxes.count = boxCount;
    oilSlicks.count = oilCount;
    shields.count = shieldCount;
    for (const m of [itemBoxes, oilSlicks, shields])
      m.instanceMatrix.needsUpdate = true;
    sparks.count = sparkCount;
    sparks.instanceMatrix.needsUpdate = true;
    if (sparks.instanceColor) sparks.instanceColor.needsUpdate = true;
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
    // Marks and static props are created once. A theme change remounts the whole palette.
  }
  for (const value of instances) value.instanceMatrix.needsUpdate = true;
  return {
    scene,
    update,
    pose: (playerId: string) => poses.get(playerId),
    setDrivers: rig.setDrivers,
    driverCounts: rig.counts,
    dispose() {
      disposed = true;
      draco?.dispose();
      if (model) releaseModel(model);
      rig.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      instances.forEach((i) => i.dispose());
      emission.clear();
      poses.clear();
      featurePoses.clear();
      labels.clear();
      scene.clear();
    },
  };
}

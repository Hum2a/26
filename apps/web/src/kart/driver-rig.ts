import * as THREE from "three";
import { defaultDriverStyle, type DriverStyle, type LobbyDriver } from "@26/shared";

/** How the driver should hold themselves this frame. Pure, so it can be tested. */
export type DriverMood = {
  /** Body roll into a turn, radians. */
  lean: number;
  /** Head turn from facing forward, radians. Pi looks back at the chase camera. */
  look: number;
  /** 0..1 how far the right arm is raised to wave. */
  wave: number;
};

export type DriverCue = {
  status: "RACING" | "FINISHED" | "DNF";
  drifting: boolean;
  elapsedMs: number;
  /** Heading change per second from the smoothed pose. Positive turns left. */
  turnRate: number;
};

/** The look back lasts this long at the start, so a guest sees their own face. */
export const lookBackMs = 2000;

export function driverMood(cue: DriverCue): DriverMood {
  const lean = Math.max(-0.35, Math.min(0.35, -cue.turnRate * 0.18));
  if (cue.status === "FINISHED") return { lean: 0, look: Math.PI * 0.9, wave: 1 };
  if (cue.status === "DNF") return { lean: 0, look: 0, wave: 0 };
  if (cue.elapsedMs < lookBackMs) return { lean, look: Math.PI * 0.9, wave: 0 };
  // A drift glance toward the outside of the turn.
  if (cue.drifting) return { lean, look: Math.sign(cue.turnRate || 1) * -0.9, wave: 0 };
  return { lean, look: 0, wave: 0 };
}

/** Eases toward a target angle along the shortest way round. */
export function approachAngle(current: number, target: number, dt: number, rate = 8) {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * (1 - Math.exp(-rate * Math.max(0, dt)));
}

type Helpers = {
  scene: THREE.Scene;
  capacity: number;
  geo: <T extends THREE.BufferGeometry>(value: T) => T;
  batch: (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    count: number,
  ) => THREE.InstancedMesh;
  /** A white, flat-shaded material; instance colours supply the palette. */
  material: THREE.Material;
  textures: Set<THREE.Texture>;
  palette: {
    ink: THREE.Color;
    ground: THREE.Color;
    accent: THREE.Color;
    highlight: THREE.Color;
  };
};

type Part = {
  mesh: THREE.InstancedMesh;
  node: THREE.Object3D;
  /** Which styles show this part. Undefined means every driver. */
  styles?: readonly DriverStyle[];
  /** Kart colour, second colour, or a fixed palette colour. */
  tint: "kart" | "second" | "ink" | "ground";
  /** Drawn only when the driver has no face photo (it would cover the photo). */
  plain?: boolean;
  count: number;
};

/** A dome around the head with an opening at the front (+X), where the face is. */
function openDome(radius: number, thetaLength: number, gap: number) {
  // three.js sphere vertices put phi = pi at +X.
  return new THREE.SphereGeometry(
    radius,
    14,
    8,
    Math.PI + gap / 2,
    Math.PI * 2 - gap,
    0,
    thetaLength,
  );
}

/**
 * Low-poly drivers for every kart. One node rig is posed per driver and its
 * world matrices are copied into instanced meshes, so 80 drivers cost a handful
 * of draw calls. Only face photos are per-driver meshes.
 */
export function createDriverRig({
  scene,
  capacity,
  geo,
  batch,
  material: white,
  textures,
  palette,
}: Helpers) {
  // Instance colours do the tinting, so every part shares the circuit's neutral material.

  // Rig: kart root -> torso (lean) -> head (look). Driver faces local +X.
  const root = new THREE.Object3D();
  const torso = new THREE.Object3D();
  torso.position.set(-0.32, 1.05, 0);
  root.add(torso);
  const head = new THREE.Object3D();
  head.position.set(0, 0.78, 0);
  torso.add(head);

  const parts: Part[] = [];
  const add = (
    geometry: THREE.BufferGeometry,
    parent: THREE.Object3D,
    position: [number, number, number],
    rotation: [number, number, number],
    tint: Part["tint"],
    styles?: readonly DriverStyle[],
    plain = false,
  ) => {
    const node = new THREE.Object3D();
    node.position.set(...position);
    node.rotation.set(...rotation);
    parent.add(node);
    const mesh = batch(geo(geometry), white, capacity);
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.name = "kart-driver-part";
    const part: Part = {
      mesh,
      node,
      tint,
      count: 0,
      ...(styles ? { styles } : {}),
      ...(plain ? { plain } : {}),
    };
    parts.push(part);
    return node;
  };

  // Body, shared by every style.
  add(new THREE.BoxGeometry(0.5, 0.72, 0.72), torso, [0, 0.28, 0], [0, 0, 0], "kart");
  add(new THREE.SphereGeometry(0.36, 10, 8), head, [0, 0.05, 0], [0, 0, 0], "ink");
  // Plain face for a driver without a photo; hidden when a photo disc is shown.
  add(
    new THREE.CylinderGeometry(0.27, 0.27, 0.04, 14),
    head,
    [0.33, 0.05, 0],
    [0, 0, Math.PI / 2],
    "ground",
    undefined,
    true,
  );
  const eye = new THREE.SphereGeometry(0.045, 6, 4);
  add(eye, head, [0.36, 0.11, -0.1], [0, 0, 0], "ink", undefined, true);
  add(eye, head, [0.36, 0.11, 0.1], [0, 0, 0], "ink", undefined, true);
  const armGeometry = new THREE.BoxGeometry(0.62, 0.16, 0.16);
  add(armGeometry, torso, [0.28, 0.42, -0.3], [0, 0.35, -0.35], "kart");
  // The right arm hangs from a shoulder so a wave can lift it.
  const rightShoulder = new THREE.Object3D();
  rightShoulder.position.set(0, 0.55, 0.3);
  torso.add(rightShoulder);
  add(armGeometry, rightShoulder, [0.28, -0.13, 0], [0, -0.35, -0.35], "kart");
  // Steering wheel, facing the driver.
  add(
    new THREE.TorusGeometry(0.24, 0.045, 6, 14),
    root,
    [0.32, 1.32, 0],
    [0, Math.PI / 2, 0.35],
    "ink",
  );

  // Headgear per style, on the head node so it turns with the face.
  // Shared shapes keep the geometry budget small.
  // Closed domes sit just above the face, so nothing shows through them.
  const smallDome = openDome(0.38, Math.PI / 2, 0);
  const eyewear = new THREE.BoxGeometry(0.12, 0.15, 0.52);
  const racer = ["racer"] as const;
  add(
    openDome(0.43, Math.PI * 0.62, 1.5),
    head,
    [0, 0.07, 0],
    [0, 0, 0],
    "kart",
    racer,
  );
  // A closed crown seals the top of the face opening.
  add(openDome(0.435, Math.PI * 0.3, 0), head, [0, 0.07, 0], [0, 0, 0], "kart", racer);
  add(eyewear, head, [0.36, 0.16, 0], [0, 0, 0], "ink", racer, true);
  const party = ["party"] as const;
  add(
    new THREE.ConeGeometry(0.22, 0.62, 10),
    head,
    [0, 0.62, 0],
    [0, 0, -0.12],
    "second",
    party,
  );
  add(
    new THREE.SphereGeometry(0.08, 6, 4),
    head,
    [-0.04, 0.95, 0],
    [0, 0, 0],
    "ground",
    party,
  );
  const royal = ["royal"] as const;
  add(
    new THREE.CylinderGeometry(0.3, 0.28, 0.16, 10, 1, true),
    head,
    [0, 0.42, 0],
    [0, 0, 0],
    "second",
    royal,
  );
  const spike = new THREE.ConeGeometry(0.07, 0.2, 4);
  for (let k = 0; k < 4; k++) {
    const angle = (k * Math.PI) / 2 + Math.PI / 4;
    add(
      spike,
      head,
      [Math.cos(angle) * 0.27, 0.58, Math.sin(angle) * 0.27],
      [0, 0, 0],
      "second",
      royal,
    );
  }
  const cap = ["cap"] as const;
  add(smallDome, head, [0, 0.27, 0], [0, 0, 0], "kart", cap);
  add(
    new THREE.BoxGeometry(0.34, 0.04, 0.4),
    head,
    [-0.42, 0.14, 0],
    [0, 0, 0.1],
    "kart",
    cap,
  );
  const dj = ["dj"] as const;
  // Headband over the top from ear to ear (the torus arc turned onto the YZ plane).
  add(
    new THREE.TorusGeometry(0.4, 0.05, 6, 14, Math.PI),
    head,
    [0, 0.05, 0],
    [0, Math.PI / 2, 0],
    "second",
    dj,
  );
  const cup = new THREE.CylinderGeometry(0.15, 0.15, 0.12, 10);
  add(cup, head, [0, 0.02, -0.4], [Math.PI / 2, 0, 0], "kart", dj);
  add(cup, head, [0, 0.02, 0.4], [Math.PI / 2, 0, 0], "kart", dj);
  const bandit = ["bandit"] as const;
  add(smallDome, head, [0, 0.25, 0], [0, 0, 0], "kart", bandit);
  add(
    new THREE.ConeGeometry(0.1, 0.3, 5),
    head,
    [-0.42, 0.15, 0],
    [0, 0, Math.PI / 2],
    "kart",
    bandit,
  );
  add(eyewear, head, [0.36, 0.19, 0], [0, 0, 0], "ink", bandit, true);

  // Face photos: one disc per driver that has one, on the front of the head.
  const faceGeometry = geo(new THREE.CircleGeometry(0.29, 20));
  const facePivot = new THREE.Object3D();
  facePivot.position.set(0.365, 0.05, 0);
  facePivot.rotation.set(0, Math.PI / 2, 0);
  head.add(facePivot);
  const loader = new THREE.TextureLoader();
  const faceTextures = new Map<string, THREE.Texture>();
  const faces = new Map<string, { mesh: THREE.Mesh; mediaId: string }>();
  const moods = new Map<
    string,
    { lean: number; look: number; wave: number; heading: number }
  >();
  let drivers: ReadonlyMap<string, LobbyDriver> = new Map();
  let faceUrl: (mediaId: string) => string = () => "";
  let time = 0;

  function texture(mediaId: string) {
    let value = faceTextures.get(mediaId);
    if (!value) {
      value = loader.load(faceUrl(mediaId));
      value.colorSpace = THREE.SRGBColorSpace;
      faceTextures.set(mediaId, value);
      textures.add(value);
    }
    return value;
  }

  function faceFor(playerId: string, mediaId: string | undefined) {
    const current = faces.get(playerId);
    if (current && current.mediaId === mediaId) return current.mesh;
    if (current) {
      scene.remove(current.mesh);
      (current.mesh.material as THREE.Material).dispose();
      faces.delete(playerId);
    }
    if (!mediaId) return undefined;
    const material = new THREE.MeshBasicMaterial({ map: texture(mediaId) });
    const mesh = new THREE.Mesh(faceGeometry, material);
    mesh.matrixAutoUpdate = false;
    mesh.name = "kart-driver-face";
    scene.add(mesh);
    faces.set(playerId, { mesh, mediaId });
    return mesh;
  }

  return {
    setDrivers(
      next: ReadonlyMap<string, LobbyDriver>,
      url: (mediaId: string) => string,
    ) {
      drivers = next;
      faceUrl = url;
    },
    begin(dt: number) {
      time += Math.max(0, Math.min(0.1, dt));
      for (const part of parts) part.count = 0;
    },
    place(
      playerId: string,
      order: number,
      pose: { x: number; z: number; heading: number; height?: number },
      cue: Omit<DriverCue, "turnRate">,
      kartColour: THREE.Color,
      secondColour: THREE.Color,
      dt: number,
      reduced: boolean,
    ) {
      const chosen = drivers.get(playerId);
      const style = chosen?.style ?? defaultDriverStyle(order);
      const previous = moods.get(playerId);
      let turn = previous ? pose.heading - previous.heading : 0;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      const target = driverMood({ ...cue, turnRate: dt > 0 ? turn / dt : 0 });
      const ease = (from: number, to: number) =>
        reduced || !previous ? to : from + (to - from) * (1 - Math.exp(-6 * dt));
      const mood = {
        lean: ease(previous?.lean ?? 0, target.lean),
        look:
          reduced || !previous
            ? target.look
            : approachAngle(previous.look, target.look, dt),
        wave: ease(previous?.wave ?? 0, target.wave),
        heading: pose.heading,
      };
      moods.set(playerId, mood);

      root.position.set(pose.x, pose.height ?? 0, pose.z);
      root.rotation.set(0, -pose.heading, 0);
      torso.rotation.set(mood.lean, 0, 0);
      head.rotation.set(0, mood.look, 0);
      // The wave pitches the forward-pointing arm up about the shoulder's Z axis;
      // reduced motion holds it up without swinging.
      const swing = reduced ? 0 : Math.sin(time * 9) * 0.35;
      rightShoulder.rotation.set(0, 0, mood.wave * (1.9 + swing));
      root.updateMatrixWorld(true);

      const face = faceFor(playerId, chosen?.faceMediaId);
      const colours = {
        kart: kartColour,
        second: secondColour,
        ink: palette.ink,
        ground: palette.ground,
      };
      for (const part of parts) {
        if (part.styles && !part.styles.includes(style)) continue;
        if (part.plain && face) continue;
        if (part.count >= capacity) continue;
        part.mesh.setMatrixAt(part.count, part.node.matrixWorld);
        part.mesh.setColorAt(part.count, colours[part.tint]);
        part.count++;
      }
      if (face) face.matrix.copy(facePivot.matrixWorld);
    },
    end(present: ReadonlySet<string>) {
      for (const part of parts) {
        part.mesh.count = part.count;
        part.mesh.instanceMatrix.needsUpdate = true;
        if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true;
      }
      for (const playerId of [...faces.keys()])
        if (!present.has(playerId)) faceFor(playerId, undefined);
      for (const playerId of [...moods.keys()])
        if (!present.has(playerId)) moods.delete(playerId);
    },
    /** For tests: how many instances each part drew last frame. */
    counts: () =>
      parts.map((part) => ({
        name: part.styles?.join(",") ?? "all",
        count: part.mesh.count,
      })),
    faceCount: () => faces.size,
    dispose() {
      for (const { mesh } of faces.values())
        (mesh.material as THREE.Material).dispose();
      faces.clear();
      faceTextures.clear();
      moods.clear();
    },
  };
}

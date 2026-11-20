import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { kartAssetPaths, kartPracticeBotMax } from "@26/shared";
import { importedGroundAt } from "../../../packages/shared/src/kart/kart-track";
import {
  createNativeDriverRig,
  type DriverCue,
} from "../../web/src/kart/driver-rig-core";
import { createNativeVehicleRig } from "../../web/src/kart/vehicle-model-core";
import { kartTagName } from "../../web/src/kart/circuit";
import { DEFAULT_THEME_ID, themes } from "../../web/src/theme/themes";
import { soloBotFrame } from "./bots-state";
import { useGameStore } from "./upstream/store.js";

type SoloRigHelpers = {
  scene: THREE.Scene;
  capacity: number;
  textures: Set<THREE.Texture>;
  material: THREE.Material;
  onChange?: () => void;
  palette: {
    ink: THREE.Color;
    ground: THREE.Color;
    accent: THREE.Color;
    highlight: THREE.Color;
  };
  geo<T extends THREE.BufferGeometry>(geometry: T): T;
  batch(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    capacity: number,
  ): THREE.InstancedMesh;
};

type SoloDriverRig = Omit<ReturnType<typeof createNativeDriverRig>, "place"> & {
  place(
    playerId: string,
    order: number,
    pose: { x: number; z: number; heading: number; height?: number },
    cue: Omit<DriverCue, "turnRate"> & { turnRate?: number },
    colour: THREE.Color,
    second: THREE.Color,
    dt: number,
    reduced: boolean,
  ): void;
};

type SoloVehicleRig = ReturnType<typeof createNativeVehicleRig>;

const createSoloDriverRig = createNativeDriverRig as unknown as (
  native: typeof THREE,
  helpers: SoloRigHelpers,
) => SoloDriverRig;

const createSoloVehicleRig = createNativeVehicleRig as unknown as (
  native: typeof THREE,
  source: THREE.Object3D,
  scene: THREE.Scene,
  capacity: number,
) => SoloVehicleRig;

function createBotLabel(
  bot: { number: number; name: string },
  colours: (typeof themes)[typeof DEFAULT_THEME_ID]["colors"],
  scene: THREE.Scene,
  textures: Set<THREE.Texture>,
  materials: Set<THREE.Material>,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  const edge = bot.number % 2 ? colours.accent : colours.highlight;
  ctx.fillStyle = colours.background;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(4, 6, 248, 52, 26);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = colours.foreground;
  ctx.textBaseline = "middle";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`${bot.number} ${kartTagName(bot.name)}`, 22, 34, 216);
  const texture = new THREE.CanvasTexture(canvas);
  textures.add(texture);
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
  materials.add(material);
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(9, 2.25, 1);
  sprite.visible = false;
  scene.add(sprite);
  return sprite;
}

export function SoloBots({ count }: { count: number }) {
  const capacity = Math.max(1, Math.min(kartPracticeBotMax, Math.floor(count)));
  const { scene: kartModel } = useGLTF(kartAssetPaths.kart, kartAssetPaths.draco);
  const scene = useThree((state) => state.scene) as unknown as THREE.Scene;
  const renderer = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const present = useMemo(() => new Set<string>(), []);
  const gliderObject = useMemo(() => new THREE.Object3D(), []);
  const configuredDrivers = useRef("");

  const resources = useMemo(() => {
    if (!(scene instanceof THREE.Scene) || !(renderer instanceof THREE.WebGLRenderer))
      throw new Error("Practice renderer versions do not match. Reload the circuit.");
    const colours = themes[DEFAULT_THEME_ID].colors;
    const palette = {
      ink: new THREE.Color(colours.foreground),
      ground: new THREE.Color(colours.background),
      accent: new THREE.Color(colours.accent),
      highlight: new THREE.Color(colours.highlight),
    };
    const geometries = new Set<THREE.BufferGeometry>();
    const textures = new Set<THREE.Texture>();
    const materials = new Set<THREE.Material>();
    const meshes: THREE.InstancedMesh[] = [];

    const driverMaterial = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      flatShading: true,
    });
    materials.add(driverMaterial);

    const vehicle = createSoloVehicleRig(
      THREE,
      kartModel as unknown as THREE.Object3D,
      scene,
      capacity,
    );

    const driverRig = createSoloDriverRig(THREE, {
      scene,
      onChange: invalidate,
      capacity,
      textures,
      material: driverMaterial,
      palette,
      geo(geometry) {
        geometries.add(geometry);
        return geometry;
      },
      batch(geometry, material, batchCapacity) {
        const mesh = new THREE.InstancedMesh(geometry, material, batchCapacity);
        mesh.frustumCulled = false;
        meshes.push(mesh);
        scene.add(mesh);
        return mesh;
      },
    });

    const gliderGeo = new THREE.BoxGeometry(5, 0.12, 1.6);
    geometries.add(gliderGeo);
    const gliderMat = new THREE.MeshBasicMaterial({ color: palette.accent });
    materials.add(gliderMat);
    const gliders = new THREE.InstancedMesh(gliderGeo, gliderMat, capacity);
    gliders.count = 0;
    gliders.frustumCulled = false;
    gliders.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(gliders);
    meshes.push(gliders);

    const labels = new Map<string, THREE.Sprite>();

    return {
      vehicle,
      driverRig,
      gliders,
      labels,
      geometries,
      textures,
      materials,
      meshes,
      palette,
      colours,
    };
  }, [scene, renderer, invalidate, kartModel, capacity]);

  useEffect(() => {
    configuredDrivers.current = "";
    return () => {
      resources.vehicle.dispose();
      resources.driverRig.dispose();
      for (const sprite of resources.labels.values()) scene.remove(sprite);
      resources.labels.clear();
      for (const mesh of resources.meshes) {
        scene.remove(mesh);
        mesh.dispose();
      }
      for (const geometry of resources.geometries) geometry.dispose();
      for (const texture of resources.textures) texture.dispose();
      for (const material of resources.materials) material.dispose();
    };
  }, [resources, scene]);

  useFrame((_, dt) => {
    const state = useGameStore.getState();
    const poses = soloBotFrame.poses;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stepDt = state.soloPaused ? 0 : dt;

    const driverKey = poses.map((pose) => `${pose.playerId}:${pose.style}`).join("|");
    if (driverKey !== configuredDrivers.current) {
      configuredDrivers.current = driverKey;
      resources.driverRig.setDrivers(
        new Map(poses.map((pose) => [pose.playerId, { style: pose.style }])),
        (url) => url,
      );
    }

    present.clear();
    resources.driverRig.begin(stepDt);
    let gliderCount = 0;

    for (let index = 0; index < poses.length && index < capacity; index++) {
      const bot = poses[index]!;
      present.add(bot.playerId);
      const ground = importedGroundAt(bot.x, bot.z, "solo");
      const y = (ground?.y ?? -1.6) + bot.height;
      const pose = { x: bot.x, z: bot.z, heading: bot.heading, height: y };

      resources.vehicle.place(
        index,
        pose,
        { speed: bot.speed, turnRate: bot.turnRate, travel: bot.travel },
        reduced,
      );

      const kartColour =
        bot.number % 2 ? resources.palette.accent : resources.palette.highlight;
      const secondColour =
        bot.number % 2 ? resources.palette.highlight : resources.palette.accent;

      resources.driverRig.place(
        bot.playerId,
        bot.number - 1,
        pose,
        {
          status: bot.finished ? "FINISHED" : "RACING",
          drifting: bot.drifting,
          elapsedMs: state.soloElapsed,
          turnRate: bot.turnRate,
        },
        kartColour,
        secondColour,
        stepDt,
        reduced,
      );

      if (bot.height > 0.05) {
        gliderObject.position.set(bot.x, y + 2.4, bot.z);
        gliderObject.rotation.set(0, -bot.heading + Math.PI / 2, 0);
        gliderObject.updateMatrix();
        resources.gliders.setMatrixAt(gliderCount++, gliderObject.matrix);
      }

      let sprite = resources.labels.get(bot.playerId);
      if (!sprite) {
        sprite = createBotLabel(
          bot,
          resources.colours,
          scene,
          resources.textures,
          resources.materials,
        );
        if (sprite) resources.labels.set(bot.playerId, sprite);
      }
      if (sprite) {
        sprite.position.set(bot.x, y + 3.8, bot.z);
        sprite.visible = true;
      }
    }

    for (const [id, sprite] of resources.labels) {
      if (!present.has(id)) sprite.visible = false;
    }

    resources.vehicle.end(Math.min(capacity, poses.length));
    resources.driverRig.end(present);
    resources.gliders.count = gliderCount;
    resources.gliders.instanceMatrix.needsUpdate = true;
  });

  return null;
}

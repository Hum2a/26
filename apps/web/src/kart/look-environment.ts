import type * as Native from "three";
import type { KartLookPreset } from "@26/shared";
import type { GraphicsTier } from "./graphics";

export type LookPalette = Record<
  "ground" | "road" | "accent" | "highlight" | "ink" | "muted",
  Native.Color
>;
export type EnvironmentFrame = {
  focus?: readonly [number, number, number];
  dt?: number;
  paused?: boolean;
  reducedMotion?: boolean;
};
const skyVertex = `varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const skyFragment = `uniform vec3 lowColour;uniform vec3 highColour;uniform vec3 sunColour;uniform vec3 sunDirection;uniform float sunStrength;varying vec3 direction;
void main(){vec3 d=normalize(direction);float h=smoothstep(-0.15,0.7,d.y);vec3 c=mix(lowColour,highColour,h);float glow=pow(max(0.0,dot(d,sunDirection)),64.0);float disc=smoothstep(0.9993,0.9998,dot(d,sunDirection));gl_FragColor=vec4(c+sunColour*(glow*0.12+disc)*sunStrength,1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;

/** One scene owns the local procedural sky/PMREM and a single bounded shadow light. */
export function createNativeKartEnvironment(
  THREE: typeof Native,
  renderer: Native.WebGLRenderer,
  scene: Native.Scene,
  palette: LookPalette,
) {
  const saved = {
    environment: scene.environment,
    intensity: scene.environmentIntensity,
    shadowEnabled: renderer.shadowMap.enabled,
    shadowAuto: renderer.shadowMap.autoUpdate,
    shadowType: renderer.shadowMap.type,
  };
  const sourceLights = new Map<Native.Light, boolean>(),
    flags = new Map<Native.Mesh, { cast: boolean; receive: boolean }>();
  let sky: Native.Mesh | undefined,
    material: Native.ShaderMaterial | undefined,
    geometry: Native.SphereGeometry | undefined,
    sun: Native.DirectionalLight | undefined,
    ambient: Native.HemisphereLight | undefined;
  let reflection: ReturnType<Native.PMREMGenerator["fromScene"]> | undefined;
  let active = false,
    disposed = false,
    reflectKey = "",
    lastChildren = -1,
    shadowOn = false,
    shadowClock = 0;
  const centre = new THREE.Vector3(),
    lastCentre = new THREE.Vector3(Infinity, 0, 0),
    direction = new THREE.Vector3();
  const brightest = Object.values(palette)
    .reduce((a, b) => (a.r + a.g + a.b >= b.r + b.g + b.b ? a : b))
    .clone();
  function restoreFlags() {
    for (const [mesh, value] of flags) {
      mesh.castShadow = value.cast;
      mesh.receiveShadow = value.receive;
    }
    flags.clear();
  }
  function clearReflection() {
    reflection?.dispose();
    reflection = undefined;
    reflectKey = "";
    scene.environment = saved.environment;
    scene.environmentIntensity = saved.intensity;
  }
  function disable() {
    if (!active) return;
    for (const [light, visible] of sourceLights) light.visible = visible;
    sourceLights.clear();
    restoreFlags();
    if (sky) sky.visible = false;
    if (sun) sun.visible = false;
    if (ambient) ambient.visible = false;
    renderer.shadowMap.enabled = saved.shadowEnabled;
    renderer.shadowMap.autoUpdate = saved.shadowAuto;
    renderer.shadowMap.type = saved.shadowType;
    sun?.shadow.map?.dispose();
    if (sun) sun.shadow.map = null;
    clearReflection();
    active = shadowOn = false;
    lastCentre.set(Infinity, 0, 0);
    lastChildren = -1;
  }
  function ensure() {
    if (sky) return;
    geometry = new THREE.SphereGeometry(500, 32, 16);
    material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: skyVertex,
      fragmentShader: skyFragment,
      uniforms: {
        lowColour: { value: palette.ground.clone().lerp(palette.highlight, 0.2) },
        highColour: { value: palette.ground.clone().lerp(palette.accent, 0.35) },
        sunColour: { value: brightest },
        sunDirection: { value: direction },
        sunStrength: { value: 1 },
      },
    });
    sky = new THREE.Mesh(geometry, material);
    sky.name = "kart-look-sky";
    sky.frustumCulled = false;
    sky.renderOrder = -1000;
    scene.add(sky);
    sun = new THREE.DirectionalLight(brightest, 1.5);
    sun.name = "kart-look-sun";
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -28,
      right: 28,
      top: 28,
      bottom: -28,
      near: 1,
      far: 180,
    });
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.08;
    sun.shadow.autoUpdate = false;
    ambient = new THREE.HemisphereLight(brightest, palette.ground, 0.7);
    scene.add(sun, sun.target, ambient);
  }
  return {
    update(
      preset: KartLookPreset,
      camera: Native.Camera,
      tier: GraphicsTier,
      frame: EnvironmentFrame = {},
    ) {
      if (disposed) return;
      const e = preset.environment;
      if (!preset.enabled || !e.enabled) {
        disable();
        return;
      }
      ensure();
      active = true;
      sun!.visible = ambient!.visible = true;
      sky!.visible = e.sky;
      const angle = (e.sunAzimuth * Math.PI) / 180,
        height = (e.sunElevation * Math.PI) / 180;
      direction.set(
        Math.cos(angle) * Math.cos(height),
        Math.sin(height),
        Math.sin(angle) * Math.cos(height),
      );
      sky!.position.copy(camera.position);
      const far = "far" in camera && typeof camera.far === "number" ? camera.far : 1000;
      sky!.scale.setScalar(Math.max(10, Math.min(500, far * 0.4)) / 500);
      material!.uniforms.sunStrength!.value = e.intensity;
      sun!.intensity = e.intensity;
      ambient!.intensity = 0.4 + e.intensity * 0.2;
      const shadows = e.shadows && tier === "high";
      if (shadowOn && !shadows) {
        restoreFlags();
        sun!.shadow.map?.dispose();
        sun!.shadow.map = null;
      }
      if (scene.children.length !== lastChildren || shadowOn !== shadows) {
        for (const child of scene.children) {
          if (
            child instanceof THREE.Light &&
            child !== sun &&
            child !== ambient &&
            !sourceLights.has(child)
          ) {
            sourceLights.set(child, child.visible);
            child.visible = false;
          }
        }
        if (shadows)
          scene.traverse((object) => {
            if (!(object instanceof THREE.Mesh) || object === sky || flags.has(object))
              return;
            const materials = Array.isArray(object.material)
              ? object.material
              : [object.material];
            if (
              materials.some((m) => m instanceof THREE.ShaderMaterial || m.transparent)
            )
              return;
            flags.set(object, {
              cast: object.castShadow,
              receive: object.receiveShadow,
            });
            object.receiveShadow = true;
            object.castShadow =
              object.castShadow ||
              (object instanceof THREE.InstancedMesh &&
                (object.name === "" || object.name.startsWith("kart-detail-")));
          });
        lastChildren = scene.children.length;
        shadowClock = 1;
      }
      renderer.shadowMap.enabled = shadows || saved.shadowEnabled;
      renderer.shadowMap.autoUpdate = shadows ? false : saved.shadowAuto;
      renderer.shadowMap.type = shadows ? THREE.PCFShadowMap : saved.shadowType;
      sun!.castShadow = shadows;
      shadowOn = shadows;
      const point: readonly [number, number, number] = frame.focus ?? [0, 0, 0];
      centre.set(Math.floor(point[0] / 8) * 8, point[1], Math.floor(point[2] / 8) * 8);
      if ((frame.paused || frame.reducedMotion) && Number.isFinite(lastCentre.x))
        centre.copy(lastCentre);
      sun!.position.copy(centre).addScaledVector(direction, 100);
      sun!.target.position.copy(centre);
      sun!.target.updateMatrixWorld();
      shadowClock += Math.max(0, Math.min(0.1, frame.dt ?? 1 / 60));
      if (shadows && shadowClock >= 0.1) {
        sun!.shadow.needsUpdate = true;
        renderer.shadowMap.needsUpdate = true;
        shadowClock = 0;
      }
      lastCentre.copy(centre);
      if (e.reflection > 0 && tier !== "low") {
        const key = `${e.sunElevation}:${e.sunAzimuth}:${e.intensity}:${e.sky}`;
        if (!reflection || reflectKey !== key) {
          const capture = new THREE.Scene();
          capture.add(new THREE.Mesh(geometry!, material!));
          const generator = new THREE.PMREMGenerator(renderer);
          let next: typeof reflection;
          try {
            next = generator.fromScene(capture, 0.02, 0.1, 1000);
          } finally {
            generator.dispose();
            capture.clear();
          }
          reflection?.dispose();
          reflection = next;
          reflectKey = key;
        }
        scene.environment = reflection!.texture;
        scene.environmentIntensity = e.reflection;
      } else clearReflection();
    },
    stats: () => ({
      active,
      sky: Boolean(active && sky?.visible),
      reflection: Boolean(reflection),
      shadows: shadowOn,
      shadowSize: shadowOn ? (sun?.shadow.map?.width ?? 0) : 0,
    }),
    dispose() {
      if (disposed) return;
      disable();
      disposed = true;
      if (sky) scene.remove(sky);
      if (sun) scene.remove(sun, sun.target);
      if (ambient) scene.remove(ambient);
      geometry?.dispose();
      material?.dispose();
      sun?.dispose();
    },
  };
}

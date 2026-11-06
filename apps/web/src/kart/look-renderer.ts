import type * as Native from "three";
import {
  kartHueBands,
  kartLookPresetSchema,
  neutralKartLook,
  type KartLookPreset,
} from "@26/shared";
import { hueCentres } from "./look-grade";
import { kartLookPolicy, type KartLookFrame } from "./look-policy";
export type { KartLookFrame } from "./look-policy";
import type { GraphicsTier } from "./graphics";
import { lookVertexShader, lookFragmentShader } from "./look-shader";
import { createNativeKartEnvironment, type LookPalette } from "./look-environment";

export type KartLookStats = {
  active: boolean;
  buffers: number;
  passes: number;
  width: number;
  height: number;
  hdr: boolean;
  samples: number;
  /** Colour targets and sampled depth attachments are counted separately. */
  depthTextures: number;
  /** Maximum texture reads per fragment in the combined optical/grade pass. */
  textureSamples: number;
  optics: Record<
    "wind" | "chromatic" | "lensDirt" | "bloom" | "ao" | "tiltShift",
    boolean
  >;
  environment?: ReturnType<ReturnType<typeof createNativeKartEnvironment>["stats"]>;
  calls?: number;
  triangles?: number;
  geometries?: number;
  textures?: number;
};
/** Native constructors only. Caller owns the existing renderer, camera and scene. */
export function createNativeKartLook(
  THREE: typeof Native,
  renderer: Native.WebGLRenderer,
  palette: LookPalette,
) {
  let preset: KartLookPreset = kartLookPresetSchema.parse(neutralKartLook),
    disposed = false;
  let target: Native.WebGLRenderTarget | undefined,
    material: Native.ShaderMaterial | undefined,
    geometry: Native.PlaneGeometry | undefined,
    quadScene: Native.Scene | undefined;
  let environment: ReturnType<typeof createNativeKartEnvironment> | undefined;
  const camera = new THREE.Camera(),
    size = new THREE.Vector2();
  const hdr = Boolean(renderer.extensions.has("EXT_color_buffer_float"));
  let opticalClock = 0;
  const inactiveOptics = {
    wind: false,
    chromatic: false,
    lensDirt: false,
    bloom: false,
    ao: false,
    tiltShift: false,
  };
  let last: KartLookStats = {
    active: false,
    buffers: 0,
    passes: 1,
    width: 0,
    height: 0,
    hdr,
    samples: 0,
    depthTextures: 0,
    textureSamples: 0,
    optics: { ...inactiveOptics },
  };
  function releaseTarget() {
    if (target) {
      // Detach before disposing: both native renderer versions dispose an
      // attached depth texture themselves. This owner releases it exactly once,
      // including a target that has not reached its first GPU render.
      const depth = target.depthTexture;
      target.depthTexture = null;
      target.dispose();
      depth?.dispose();
    }
    target = undefined;
  }
  function ensure() {
    if (material) return;
    material = new THREE.ShaderMaterial({
      vertexShader: lookVertexShader,
      fragmentShader: lookFragmentShader,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        sourceImage: { value: null },
        depthImage: { value: null },
        inverseResolution: { value: new THREE.Vector2() },
        opticsA: { value: new THREE.Vector4() },
        opticsB: { value: new THREE.Vector4() },
        focusDepth: { value: new THREE.Vector2() },
        cameraDepth: { value: new THREE.Vector3() },
        opticsTime: { value: 0 },
        gradeEnabled: { value: 0 },
        channelMixer: { value: new THREE.Matrix3() },
        gradeA: { value: new THREE.Vector4() },
        gradeB: { value: new THREE.Vector4() },
        gradeC: { value: new THREE.Vector3() },
        bands: { value: kartHueBands.map(() => new THREE.Vector3()) },
        centres: { value: [...hueCentres] },
        shadowColour: { value: new THREE.Color() },
        highlightColour: { value: new THREE.Color() },
        split: { value: new THREE.Vector2() },
      },
    });
    geometry = new THREE.PlaneGeometry(2, 2);
    quadScene = new THREE.Scene();
    const quad = new THREE.Mesh(geometry, material);
    quad.frustumCulled = false;
    quadScene.add(quad);
  }
  return {
    configure(value: unknown) {
      preset = kartLookPresetSchema.parse(value);
    },
    render(
      scene: Native.Scene,
      cameraSource: Native.Camera,
      tier: GraphicsTier,
      frame: KartLookFrame = {},
    ) {
      if (disposed) return;
      if (preset.environment.enabled && !environment)
        environment = createNativeKartEnvironment(THREE, renderer, scene, palette);
      environment?.update(preset, cameraSource, tier, frame);
      const environmentStats = environment?.stats();
      const depthCamera = cameraSource as Native.PerspectiveCamera;
      const perspective = Boolean(depthCamera.isPerspectiveCamera);
      const depthAvailable =
        (perspective ||
          (cameraSource as Native.OrthographicCamera).isOrthographicCamera) &&
        Number.isFinite(depthCamera.near) &&
        Number.isFinite(depthCamera.far) &&
        depthCamera.near >= 0 &&
        (!perspective || depthCamera.near > 0) &&
        depthCamera.far > depthCamera.near;
      const policy = kartLookPolicy(preset, tier, frame, Boolean(depthAvailable));
      const activeOptics = {
        wind: policy.optics.wind > 0,
        chromatic: policy.optics.chromatic > 0,
        lensDirt: policy.optics.lensDirt > 0,
        bloom: policy.optics.bloom > 0,
        ao: policy.optics.ao > 0,
        tiltShift: policy.optics.tiltShift > 0,
      };
      if (!policy.postprocessing) {
        releaseTarget();
        renderer.render(scene, cameraSource);
        last = {
          active: Boolean(environmentStats?.active),
          buffers: 0,
          passes: 1,
          width: 0,
          height: 0,
          hdr,
          samples: 0,
          depthTextures: 0,
          textureSamples: 0,
          optics: activeOptics,
          environment: environmentStats,
        };
        return;
      }
      ensure();
      renderer.getDrawingBufferSize(size);
      const cap = Math.max(
        1,
        Math.min(policy.maxEdge, renderer.capabilities.maxTextureSize),
      );
      const scale = Math.min(1, cap / Math.max(1, size.x, size.y));
      const width = Math.max(1, Math.round(size.x * scale)),
        height = Math.max(1, Math.round(size.y * scale));
      const samples = Math.max(
        0,
        Math.min(
          policy.depth ? 2 : tier === "high" ? 4 : tier === "balanced" ? 2 : 0,
          renderer.capabilities.maxSamples ?? 0,
        ),
      );
      const createDepth = () =>
        new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
      if (!target)
        target = new THREE.WebGLRenderTarget(width, height, {
          type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType,
          depthBuffer: true,
          stencilBuffer: false,
          samples,
          depthTexture: policy.depth ? createDepth() : null,
        });
      const resizing = target.width !== width || target.height !== height;
      if (
        resizing ||
        target.samples !== samples ||
        Boolean(target.depthTexture) !== policy.depth
      ) {
        const depth = target.depthTexture;
        target.depthTexture = null;
        target.samples = samples;
        if (resizing) target.setSize(width, height);
        else target.dispose();
        depth?.dispose();
        if (policy.depth) target.depthTexture = createDepth();
      }
      const g = preset.grading,
        u = material!.uniforms;
      u.sourceImage!.value = target.texture;
      u.depthImage!.value = target.depthTexture ?? target.texture;
      (u.inverseResolution!.value as Native.Vector2).set(1 / width, 1 / height);
      const o = policy.optics;
      (u.opticsA!.value as Native.Vector4).set(
        o.wind,
        o.chromatic,
        o.lensDirt,
        o.bloom,
      );
      (u.opticsB!.value as Native.Vector4).set(
        o.bloomThreshold,
        o.ao,
        o.aoRadius,
        o.tiltShift,
      );
      (u.focusDepth!.value as Native.Vector2).set(o.focusDistance, o.focusRange);
      (u.cameraDepth!.value as Native.Vector3).set(
        depthAvailable ? depthCamera.near : 0.1,
        depthAvailable ? depthCamera.far : 1_000,
        perspective ? 1 : 0,
      );
      if (!frame.paused && !frame.reducedMotion && Number.isFinite(frame.dt))
        opticalClock = (opticalClock + Math.max(0, Math.min(0.1, frame.dt!))) % 10_000;
      u.opticsTime!.value = opticalClock;
      u.gradeEnabled!.value = policy.grading ? 1 : 0;
      (u.channelMixer!.value as Native.Matrix3).set(
        ...(g.mixer as [
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
        ]),
      );
      (u.gradeA!.value as Native.Vector4).set(
        g.brightness,
        g.contrast,
        g.exposure,
        g.gamma,
      );
      (u.gradeB!.value as Native.Vector4).set(
        g.temperature,
        g.tint,
        g.hue,
        g.saturation,
      );
      (u.gradeC!.value as Native.Vector3).set(g.vibrance, 0, 0);
      for (let i = 0; i < 8; i++) {
        const band = g.hsl[kartHueBands[i]!];
        (u.bands!.value[i] as Native.Vector3).set(
          band.hue,
          band.saturation,
          band.lightness,
        );
      }
      (u.shadowColour!.value as Native.Color).copy(palette[g.shadows]);
      (u.highlightColour!.value as Native.Color).copy(palette[g.highlights]);
      (u.split!.value as Native.Vector2).set(g.splitAmount, g.splitBalance);
      const prior = renderer.getRenderTarget(),
        tone = renderer.toneMapping,
        reset = renderer.info.autoReset;
      const mapping = !policy.grading
        ? tone
        : {
            source: tone,
            linear: THREE.LinearToneMapping,
            reinhard: THREE.ReinhardToneMapping,
            aces: THREE.ACESFilmicToneMapping,
            agx: THREE.AgXToneMapping,
          }[g.toneMapping];
      try {
        renderer.info.autoReset = false;
        if (reset) renderer.info.reset();
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.setRenderTarget(target);
        renderer.render(scene, cameraSource);
        renderer.toneMapping = mapping;
        renderer.setRenderTarget(prior);
        renderer.render(quadScene!, camera);
        last = {
          active: true,
          buffers: 1,
          passes: 2,
          width,
          height,
          hdr,
          samples,
          depthTextures: target.depthTexture ? 1 : 0,
          textureSamples: policy.textureSamples,
          optics: activeOptics,
          environment: environmentStats,
        };
      } finally {
        renderer.setRenderTarget(prior);
        renderer.toneMapping = tone;
        renderer.info.autoReset = reset;
      }
    },
    stats: () => ({ ...last }),
    dispose() {
      if (disposed) return;
      disposed = true;
      environment?.dispose();
      releaseTarget();
      geometry?.dispose();
      material?.dispose();
      quadScene?.clear();
    },
  };
}

import type * as Native from "three";
import type { KartVfxPreset } from "@26/shared";
import type { createKartVfxPool, VfxTone } from "./vfx-budget";

/** Original alpha masks. Neutral texels are tinted only by theme palette roles. */
export function kartVfxMaskData() {
  const size = 32,
    masks = 6;
  const bytes = new Uint8Array(size * size * masks * 4);
  for (let mask = 0; mask < masks; mask++)
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const u = ((x + 0.5) / size) * 2 - 1,
          v = ((y + 0.5) / size) * 2 - 1;
        const r = Math.hypot(u, v);
        const ring = Math.max(0, 1 - Math.abs(r - 0.68) / 0.24);
        const alpha =
          mask === 0
            ? Math.max(0, 1 - r) ** 2
            : mask === 1
              ? Math.max(0, 1 - Math.min(Math.abs(u), Math.abs(v)) * 8) *
                Math.max(0, 1 - r)
              : mask === 2
                ? Math.max(0, 1 - Math.abs(u) / Math.max(0.05, (1 - v) * 0.4)) *
                  Math.max(0, 1 - Math.abs(v))
                : mask === 3
                  ? ring
                  : mask === 4
                    ? ring * Math.max(0, v + 0.5)
                    : 1;
        const offset = (y * size * masks + mask * size + x) * 4;
        bytes.set(
          [255, 255, 255, Math.round(Math.max(0, Math.min(1, alpha)) * 255)],
          offset,
        );
      }
  return { bytes, width: size * masks, height: size };
}

const vertexShader = `
attribute float vfxOpacity;
attribute float vfxMask;
varying vec2 effectUv;
varying vec3 effectColour;
varying float effectAlpha;
varying float effectMask;
void main() {
  effectUv = uv;
  effectAlpha = vfxOpacity;
  effectMask = vfxMask;
  effectColour = vec3(1.0);
  #ifdef USE_INSTANCING_COLOR
    effectColour = instanceColor;
  #endif
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const fragmentShader = `
uniform sampler2D effectTexture;
varying vec2 effectUv;
varying vec3 effectColour;
varying float effectAlpha;
varying float effectMask;
void main() {
  float alpha = texture2D(effectTexture, vec2((effectUv.x + effectMask) / 6.0, effectUv.y)).a * effectAlpha;
  if (alpha < 0.005) discard;
  gl_FragColor = vec4(effectColour, alpha);
  #include <colorspace_fragment>
}`;

/** All resources are native to the supplied scene. No cross-bundle Three instances. */
export function createNativeKartVfx(
  THREE: typeof Native,
  scene: Native.Scene,
  palette: Record<VfxTone, Native.Color>,
) {
  const atlas = kartVfxMaskData();
  const texture = new THREE.DataTexture(
    atlas.bytes,
    atlas.width,
    atlas.height,
    THREE.RGBAFormat,
  );
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  const material = new THREE.ShaderMaterial({
    uniforms: { effectTexture: { value: texture } },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const object = new THREE.Object3D();
  const tangent = new THREE.Vector3(),
    across = new THREE.Vector3(),
    normal = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const make = (geometry: Native.BufferGeometry, capacity: number, name: string) => {
    const alpha = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    const mask = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    alpha.setUsage(THREE.DynamicDrawUsage);
    mask.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("vfxOpacity", alpha);
    geometry.setAttribute("vfxMask", mask);
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, palette.accent);
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.name = name;
    scene.add(mesh);
    return { mesh, alpha, mask };
  };
  const quads = make(new THREE.PlaneGeometry(1, 1), 1024, "kart-vfx-particles");
  const solids = make(new THREE.BoxGeometry(1, 1, 0.4), 1024, "kart-vfx-solids");
  const marks = make(new THREE.PlaneGeometry(1, 1), 256, "kart-vfx-skids");
  let disposed = false;
  return {
    render(
      view: ReturnType<ReturnType<typeof createKartVfxPool>["view"]>,
      camera: Native.Camera,
      preset: KartVfxPreset,
    ) {
      if (disposed) return;
      const batch = preset.renderMode === "mesh" ? solids : quads;
      quads.mesh.count = solids.mesh.count = 0;
      batch.mesh.count = Math.min(1024, view.particles.length);
      view.particles.slice(0, 1024).forEach((p, i) => {
        const trail = p.kind === "trail";
        const flat = p.kind === "glow" || p.kind === "arc" || trail;
        object.position.set(p.x, p.y, p.z);
        object.quaternion.copy(camera.quaternion);
        if (flat) object.rotation.set(-Math.PI / 2, 0, -p.heading);
        else if (p.kind === "confetti")
          object.rotation.set(p.seed, p.seed * 0.3, p.seed * 0.5);
        const stretch =
          preset.renderMode === "stretch" || p.kind === "trail" || p.kind === "flame";
        object.scale.set(
          p.size * (stretch ? (trail ? 2.5 : 0.45) : 1),
          p.size * (stretch ? (trail ? 0.45 : 2.5) : 1),
          p.size,
        );
        object.updateMatrix();
        batch.mesh.setMatrixAt(i, object.matrix);
        batch.mesh.setColorAt(i, palette[p.tone]);
        batch.alpha.setX(i, p.opacity);
        batch.mask.setX(
          i,
          p.kind === "dust" || p.kind === "exhaust"
            ? 0
            : p.kind === "flame"
              ? 2
              : p.kind === "glow"
                ? 3
                : p.kind === "arc"
                  ? 4
                  : p.kind === "confetti"
                    ? 5
                    : 1,
        );
      });
      marks.mesh.count = Math.min(256, view.skids.length);
      view.skids.slice(0, 256).forEach((p, i) => {
        object.position.set((p.ax + p.bx) / 2, p.y, (p.az + p.bz) / 2);
        tangent.set(p.bx - p.ax, p.by - p.ay, p.bz - p.az).normalize();
        normal.set(...p.normal);
        across.crossVectors(normal, tangent).normalize();
        normal.crossVectors(tangent, across).normalize();
        object.quaternion.setFromRotationMatrix(
          basis.makeBasis(tangent, across, normal),
        );
        object.scale.set(Math.hypot(p.bx - p.ax, p.by - p.ay, p.bz - p.az), 0.12, 1);
        object.updateMatrix();
        marks.mesh.setMatrixAt(i, object.matrix);
        marks.mesh.setColorAt(i, palette.ink);
        marks.alpha.setX(i, p.opacity);
        marks.mask.setX(i, 5);
      });
      for (const part of [quads, solids, marks]) {
        part.mesh.instanceMatrix.needsUpdate = true;
        if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true;
        part.alpha.needsUpdate = part.mask.needsUpdate = true;
      }
    },
    stats: () => ({
      particles: quads.mesh.count + solids.mesh.count,
      skids: marks.mesh.count,
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const part of [quads, solids, marks]) {
        scene.remove(part.mesh);
        part.mesh.dispose();
        part.mesh.geometry.dispose();
      }
      material.dispose();
      texture.dispose();
    },
  };
}

// Reproducible collider audit of the pinned, unchanged upstream GLB.
// Road is Object_24, dirt is Object_11 and low kerbs are Object_25.
// Object_18 is the distant backdrop; Object_22 is an overhead sign.
// Slice substantial scenery/barriers at kart body height, not at the road surface.
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root));
const context = {
  console,
  process,
  require: createRequire(import.meta.url),
  __dirname: process.cwd(),
  WebAssembly,
  TextDecoder,
  TextEncoder,
  setTimeout,
  clearTimeout,
};
vm.runInNewContext(
  read("apps/kart-solo/public/draco/draco_wasm_wrapper.js").toString(),
  context,
);
const module = await context.DracoDecoderModule({
  wasmBinary: read("apps/kart-solo/public/draco/draco_decoder.wasm"),
});
const buffer = read("apps/kart-solo/public/models/mario-circuit-test-transformed.glb");
const length = buffer.readUInt32LE(12),
  document = JSON.parse(buffer.subarray(20, 20 + length).toString()),
  binary = buffer.subarray(28 + length);
const solidNodes = new Set(["Object_10", "Object_12", "Object_13", "Object_47"]);
const plane = -1.05,
  segments = new Map(),
  audit = { walls: [], road: [], dirt: [] };
const round = (n) => Math.round(n * 1000) / 1000;
for (const node of document.nodes.filter((n) => n.mesh !== undefined)) {
  if (!solidNodes.has(node.name) && !["Object_24", "Object_11"].includes(node.name))
    continue;
  const primitive = document.meshes[node.mesh].primitives[0],
    extension = primitive.extensions.KHR_draco_mesh_compression,
    view = document.bufferViews[extension.bufferView];
  const decoder = new module.Decoder(),
    source = new module.DecoderBuffer(),
    mesh = new module.Mesh();
  source.Init(
    new Int8Array(binary.subarray(view.byteOffset, view.byteOffset + view.byteLength)),
    view.byteLength,
  );
  const status = decoder.DecodeBufferToMesh(source, mesh);
  if (!status.ok()) throw new Error(`Cannot decode ${node.name}`);
  const values = new module.DracoFloat32Array(),
    face = new module.DracoInt32Array();
  decoder.GetAttributeFloatForAllPoints(
    mesh,
    decoder.GetAttributeByUniqueId(mesh, extension.attributes.POSITION),
    values,
  );
  const point = (i) => [
    values.GetValue(i * 3) * 0.08 + 155,
    values.GetValue(i * 3 + 1) * 0.08 - 28,
    values.GetValue(i * 3 + 2) * 0.08 + 15,
  ];
  let count = 0;
  for (let i = 0; i < mesh.num_faces(); i++) {
    decoder.GetFaceFromMesh(mesh, i, face);
    const p = [0, 1, 2].map((j) => point(face.GetValue(j)));
    if (!solidNodes.has(node.name)) {
      audit[node.name === "Object_24" ? "road" : "dirt"].push(
        p.map((v) => [round(v[0]), round(v[2])]),
      );
      continue;
    }
    const hits = [];
    for (let j = 0; j < 3; j++) {
      const a = p[j],
        b = p[(j + 1) % 3];
      if ((a[1] <= plane && b[1] > plane) || (b[1] <= plane && a[1] > plane)) {
        const t = (plane - a[1]) / (b[1] - a[1]);
        hits.push([round(a[0] + t * (b[0] - a[0])), round(a[2] + t * (b[2] - a[2]))]);
      }
    }
    if (
      hits.length !== 2 ||
      Math.hypot(hits[0][0] - hits[1][0], hits[0][1] - hits[1][1]) < 0.02
    )
      continue;
    hits.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    segments.set(hits.flat().join(","), hits.flat());
    count++;
  }
  console.log(`${node.name}: ${count} body-height solid edges`);
  for (const item of [values, face, mesh, source, decoder]) module.destroy(item);
}
const edges = [...segments.values()].sort(
  (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3],
);
const output = {
  sourceSha256: createHash("sha256").update(buffer).digest("hex"),
  sliceHeight: plane,
  solidNodes: [...solidNodes],
  edges,
};
fs.mkdirSync(new URL("packages/shared/src/", root), { recursive: true });
fs.writeFileSync(new URL("packages/shared/src/kart-circuit.json", root), JSON.stringify({ ...output, road: audit.road, dirt: audit.dirt }));
fs.mkdirSync(new URL("apps/kart-solo/src/track/", root), { recursive: true });
fs.writeFileSync(
  new URL("apps/kart-solo/src/track/colliders.json", root),
  JSON.stringify(output),
);
if (process.argv.includes("--audit")) {
  fs.mkdirSync(new URL("artifacts/kart/", root), { recursive: true });
  audit.walls = edges;
  fs.writeFileSync(
    new URL("artifacts/kart/geometry.json", root),
    JSON.stringify(audit),
  );
}
console.log(`${edges.length} pinned world-space wall edges; GLB unchanged.`);

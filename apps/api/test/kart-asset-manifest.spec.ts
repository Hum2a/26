import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { kartAssetManifest } from "@26/shared";

it("inventories every original kart model and decoder with exact hashes, including embedded textures", async () => {
  const base = resolve(process.cwd(), "../kart-solo/public");
  const files = [
    ...(await readdir(resolve(base, "models"))).map((f) => "models/" + f),
    ...(await readdir(resolve(base, "draco")))
      .filter((f) => f !== "LICENSE")
      .map((f) => "draco/" + f),
  ];
  expect(
    kartAssetManifest.assets.map((a) => a.path.replace("/kart-engine/", "")).sort(),
  ).toEqual(files.sort());
  for (const asset of kartAssetManifest.assets) {
    const data = await readFile(resolve(base, asset.path.replace("/kart-engine/", "")));
    expect(data.length).toBe(asset.bytes);
    expect(createHash("sha256").update(data).digest("hex")).toBe(asset.sha256);
    if (asset.kind !== "model") continue;
    const length = data.readUInt32LE(12);
    const gltf = JSON.parse(data.subarray(20, 20 + length).toString("utf8"));
    expect(gltf.images).toHaveLength(asset.textures.length);
    for (const [i, image] of gltf.images.entries()) {
      const view = gltf.bufferViews[image.bufferView];
      const start = 28 + length + (view.byteOffset ?? 0);
      const bytes = data.subarray(start, start + view.byteLength);
      expect(asset.textures[i]).toEqual({
        id: image.name ?? String(i),
        mimeType: image.mimeType,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  }
});

import { z } from "zod";
import inventory from "./kart-assets.json" with { type: "json" };

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const texture = z
  .object({
    id: z.string().min(1).max(100),
    mimeType: z.enum(["image/png", "image/webp", "image/jpeg"]),
    bytes: z.number().int().positive().max(4_000_000),
    sha256: hash,
  })
  .strict();
export const kartAssetSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,60}$/),
    path: z
      .string()
      .regex(
        /^\/kart-engine\/(models\/[a-z0-9-]+\.glb|draco\/draco_[a-z_]+\.(js|wasm))$/,
      ),
    kind: z.enum(["model", "decoder"]),
    bytes: z.number().int().positive().max(4_000_000),
    sha256: hash,
    source: z.url().max(300),
    notice: z.enum([
      "/kart-engine/THIRD_PARTY_NOTICES.md",
      "/kart-engine/draco/LICENSE",
    ]),
    usage: z.string().min(1).max(120),
    replacement: z.literal("retained"),
    textures: z.array(texture).max(64),
  })
  .strict();
export const kartAssetManifestSchema = z
  .object({
    version: z.literal("kart-assets-v1"),
    assets: z.array(kartAssetSchema).min(1).max(24),
    audio: z.array(z.never()).max(0),
    fallback: z
      .object({ connected: z.literal("map"), solo: z.literal("retry") })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    for (const key of ["id", "path"] as const)
      if (new Set(value.assets.map((asset) => asset[key])).size !== value.assets.length)
        context.addIssue({ code: "custom", message: `Duplicate asset ${key}.` });
  });
export type KartAssetManifest = z.infer<typeof kartAssetManifestSchema>;
export type KartAsset = z.infer<typeof kartAssetSchema>;
export const kartAssetManifest: KartAssetManifest =
  kartAssetManifestSchema.parse(inventory);
export const kartAssetPaths = {
  circuit: kartAssetManifest.assets.find((asset) => asset.id === "circuit-model")!.path,
  kart: kartAssetManifest.assets.find((asset) => asset.id === "kart-model")!.path,
  draco: "/kart-engine/draco/",
} as const;

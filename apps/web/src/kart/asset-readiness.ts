import { kartAssetManifestSchema, type KartAssetManifest } from "@26/shared";

export type AssetCheck = { id: string; status: "verified" | "failed"; detail: string };
/** Availability/integrity only; a verified download never claims GPU decode readiness. */
export async function checkKartAssets(
  manifest: KartAssetManifest,
  signal: AbortSignal,
  report: (value: AssetCheck) => void,
  fetchAsset: typeof fetch = fetch,
  digest: (data: ArrayBuffer) => Promise<string> = async (data) =>
    Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", data)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join(""),
) {
  const validated = kartAssetManifestSchema.parse(manifest);
  for (const asset of validated.assets) {
    if (signal.aborted) return;
    try {
      const response = await fetchAsset(asset.path, {
        signal,
        credentials: "omit",
        redirect: "error",
        cache: "no-cache",
      });
      if (!response.ok) throw new Error("File unavailable");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("File has no body");
      const bytes = new Uint8Array(asset.bytes);
      let received = 0;
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          if (signal.aborted || received + chunk.value.length > bytes.length) {
            await reader.cancel();
            throw new Error("File exceeds its declared size");
          }
          bytes.set(chunk.value, received);
          received += chunk.value.length;
        }
      } finally {
        reader.releaseLock();
      }
      const data = bytes.buffer;
      if (received !== asset.bytes || (await digest(data)) !== asset.sha256)
        throw new Error("File differs from the manifest");
      if (!signal.aborted)
        report({
          id: asset.id,
          status: "verified",
          detail: "Size and SHA-256 verified",
        });
    } catch {
      if (!signal.aborted)
        report({
          id: asset.id,
          status: "failed",
          detail: "Unavailable or changed — use the map or retry the circuit",
        });
    }
  }
}

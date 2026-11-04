import { expect, it, vi } from "vitest";
import { kartAssetManifest, kartAssetManifestSchema } from "@26/shared";
import { checkKartAssets } from "./asset-readiness";

it("rejects remote paths, stale manifests, duplicate assets and unknown metadata", () => {
  const first = kartAssetManifest.assets[0]!;
  for (const invalid of [
    { ...kartAssetManifest, version: "stale" },
    { ...kartAssetManifest, assets: [first, first] },
    {
      ...kartAssetManifest,
      assets: [{ ...first, path: "https://example.com/kart.glb" }],
    },
    { ...kartAssetManifest, credentials: "private" },
  ])
    expect(kartAssetManifestSchema.safeParse(invalid).success).toBe(false);
});
it("reports missing/invalid files honestly, allows retry and never reports an aborted check ready", async () => {
  const asset = kartAssetManifest.assets[0]!;
  const manifest = { ...kartAssetManifest, assets: [asset] };
  const report = vi.fn(),
    controller = new AbortController();
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 404 }))
    .mockResolvedValueOnce(new Response(new Uint8Array(asset.bytes)))
    .mockResolvedValueOnce(new Response(new Uint8Array(asset.bytes)));
  await checkKartAssets(
    manifest,
    controller.signal,
    report,
    request,
    async () => "wrong",
  );
  expect(report).toHaveBeenLastCalledWith(
    expect.objectContaining({ status: "failed" }),
  );
  await checkKartAssets(
    manifest,
    controller.signal,
    report,
    request,
    async () => "wrong",
  );
  expect(report.mock.calls.every(([r]) => r.status === "failed")).toBe(true);
  await checkKartAssets(
    manifest,
    controller.signal,
    report,
    request,
    async () => asset.sha256,
  );
  expect(report).toHaveBeenLastCalledWith(
    expect.objectContaining({ status: "verified" }),
  );
  controller.abort();
  const calls = report.mock.calls.length;
  await checkKartAssets(manifest, controller.signal, report, request);
  expect(report).toHaveBeenCalledTimes(calls);
});

it("refuses an overlong stream before digesting and never fetches a malformed manifest", async () => {
  const asset = kartAssetManifest.assets[0]!;
  const report = vi.fn(),
    digest = vi.fn(async () => asset.sha256);
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(new Uint8Array(asset.bytes + 1)));
  await checkKartAssets(
    { ...kartAssetManifest, assets: [asset] },
    new AbortController().signal,
    report,
    request,
    digest,
  );
  expect(digest).not.toHaveBeenCalled();
  expect(report).toHaveBeenLastCalledWith(
    expect.objectContaining({ status: "failed" }),
  );
  await expect(
    checkKartAssets(
      { ...kartAssetManifest, version: "bad" } as unknown as typeof kartAssetManifest,
      new AbortController().signal,
      report,
      request,
    ),
  ).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(1);
});

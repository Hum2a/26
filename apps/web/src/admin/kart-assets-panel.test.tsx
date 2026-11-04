import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { kartAssetManifest } from "@26/shared";
vi.mock("./sections-api", () => ({ readKartAssets: vi.fn() }));
vi.mock("../kart/asset-readiness", () => ({ checkKartAssets: vi.fn() }));
import { readKartAssets } from "./sections-api";
import { checkKartAssets } from "../kart/asset-readiness";
import { KartAssetsPanel } from "./kart-assets-panel";
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readKartAssets).mockResolvedValue(kartAssetManifest);
});
it("shows the validated inventory, checks real asset IDs and retains bounded local check history", async () => {
  vi.mocked(checkKartAssets).mockImplementation(async (manifest, _signal, report) => {
    for (const asset of manifest.assets)
      report({ id: asset.id, status: "verified", detail: "Size and SHA-256 verified" });
  });
  render(<KartAssetsPanel />);
  await screen.findByText(/kart-assets-v1/);
  expect(screen.getByText(/18 embedded textures/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Check kart files" }));
  await screen.findByText(/5\/5 files verified on this browser/);
  expect(checkKartAssets).toHaveBeenCalledWith(
    kartAssetManifest,
    expect.any(AbortSignal),
    expect.any(Function),
  );
  expect(screen.getByText(/not GPU decoding/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Refresh asset inventory" }));
  await waitFor(() => expect(readKartAssets).toHaveBeenCalledTimes(2));
});
it("reports unavailable inventory and retries without checking invented files", async () => {
  vi.mocked(readKartAssets).mockResolvedValueOnce({ error: "Inventory unavailable" });
  render(<KartAssetsPanel />);
  await screen.findByText("Inventory unavailable");
  expect(
    (screen.getByRole("button", { name: "Check kart files" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Refresh asset inventory" }));
  await screen.findByText(/kart-assets-v1/);
  expect(checkKartAssets).not.toHaveBeenCalled();
});
it("cancels an in-flight check and aborts when leaving the page", async () => {
  let signal: AbortSignal | undefined;
  vi.mocked(checkKartAssets).mockImplementation((_manifest, next) => {
    signal = next;
    return new Promise((resolve) => next.addEventListener("abort", () => resolve()));
  });
  const view = render(<KartAssetsPanel />);
  await screen.findByText(/kart-assets-v1/);
  fireEvent.click(screen.getByRole("button", { name: "Check kart files" }));
  fireEvent.click(screen.getByRole("button", { name: "Stop file check" }));
  await screen.findByText(/Stopped or timed out/);
  expect(signal?.aborted).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Check kart files" }));
  const second = signal;
  view.unmount();
  expect(second?.aborted).toBe(true);
});

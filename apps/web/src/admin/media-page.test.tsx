import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("./rooms-api", () => ({ readAdminRoom: vi.fn() }));
vi.mock("../live/room-socket", () => ({ openRoomSocket: vi.fn() }));
vi.mock("../live/room-api", () => ({ playRoom: vi.fn(), issueTransfer: vi.fn() }));
vi.mock("./sections-api", () => ({ readMediaPage: vi.fn() }));
import { readMediaPage } from "./sections-api";
import { playRoom } from "../live/room-api";
import { MediaPage } from "./media-page";
import {
  mountControls,
  playerId,
  secondId,
  setupControls,
  playingFixture,
} from "./controls.test-support";
import { compactJpeg } from "../media/photo-prepare";
vi.mock("../media/photo-prepare", () => ({ compactJpeg: vi.fn() }));
beforeEach(() => {
  setupControls();
  vi.mocked(readMediaPage).mockResolvedValue({
    items: [
      { mediaId: playerId, kind: "photo", nickname: "Amina", hidden: false },
      { mediaId: secondId, kind: "voice", nickname: "Bilal", hidden: false },
    ],
    nextCursor: "50",
  });
});
it.each([true, false])(
  "sends the host photo-bias command when enabled=%s",
  async (enabled) => {
    setupControls({
      ...playingFixture,
      photoBias: {
        enabled,
        revision: 1,
        iphonePhotos: 1,
        androidPhotos: 2,
        otherPhotos: 0,
        history: [{ atMs: 1, enabled }],
      },
    });
    await mountControls(<MediaPage />);
    expect(screen.getByText(/1 iPhone · 2 Android/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: enabled ? "Show clean photos" : "Enable photo bias",
      }),
    );
    await waitFor(() =>
      expect(playRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          action: enabled ? "photo-bias-off" : "photo-bias-on",
        }),
      ),
    );
  },
);

it("rehearses with the real processor endpoint and releases preview URLs", async () => {
  vi.mocked(compactJpeg).mockResolvedValue(new Blob(["jpeg"], { type: "image/jpeg" }));
  const fetcher = vi.fn(
    async () => new Response(new Blob(["image"], { type: "image/jpeg" })),
  );
  vi.stubGlobal("fetch", fetcher);
  const create = vi
    .fn()
    .mockReturnValueOnce("blob:clean")
    .mockReturnValueOnce("blob:rough");
  const revoke = vi.fn();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke });
  const view = await mountControls(<MediaPage />);
  fireEvent.click(screen.getByRole("button", { name: "Rehearse photo bias" }));
  expect(await screen.findByAltText("Rough iPhone sample")).toBeTruthy();
  expect(fetcher).toHaveBeenCalledWith(
    "/api/admin/media/photo-preview?treatment=rough",
    expect.objectContaining({ method: "POST", cache: "no-store" }),
  );
  view.unmount();
  expect(revoke).toHaveBeenCalledWith("blob:clean");
  expect(revoke).toHaveBeenCalledWith("blob:rough");
});
it("uses authorised previews, offers a bounded page and never autoplays audio", async () => {
  await mountControls(<MediaPage />);
  const image = await screen.findByAltText("Photo shared by Amina");
  expect(image.getAttribute("src")).toContain(
    `/api/admin/rooms/ABCDEFGH/media/${playerId}`,
  );
  const audio = screen.getByLabelText("Voice note shared by Bilal") as HTMLAudioElement;
  expect(audio.autoplay).toBe(false);
  expect(audio.preload).toBe("none");
  fireEvent.click(screen.getByRole("button", { name: "Older media" }));
  await waitFor(() => expect(readMediaPage).toHaveBeenCalledWith("ABCDEFGH", "50"));
});
it("handles failed previews and hides through the shared command provider", async () => {
  await mountControls(<MediaPage />);
  fireEvent.error(await screen.findByAltText("Photo shared by Amina"));
  expect(screen.getByText("Preview unavailable for Amina.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Retry preview" }));
  expect(screen.getByAltText("Photo shared by Amina")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Hide photo from Amina" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({ action: "hide-media", mediaId: playerId }),
    ),
  );
});
it("never loads a hidden item and offers recovery from a failed list", async () => {
  vi.mocked(readMediaPage)
    .mockResolvedValueOnce({ error: "Media list unavailable" })
    .mockResolvedValue({
      items: [{ mediaId: playerId, kind: "photo", nickname: "Amina", hidden: true }],
      nextCursor: null,
    });
  await mountControls(<MediaPage />);
  await screen.findByText("Media list unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Refresh media" }));
  await screen.findByText("Hidden · preview unavailable");
  expect(screen.queryByRole("img")).toBeNull();
  expect(
    (screen.getByRole("button", { name: "Hidden from screens" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

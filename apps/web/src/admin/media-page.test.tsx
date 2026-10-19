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
} from "./controls.test-support";
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

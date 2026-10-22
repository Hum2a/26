import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LobbySnapshot } from "@26/shared";
import { GuestWall } from "./guest-wall";

const sendWallPhoto = vi.fn();
vi.mock("./wall-upload", () => ({
  sendWallPhoto: (...args: unknown[]) => sendWallPhoto(...args),
}));
vi.mock("../device/haptics", () => ({ buzz: vi.fn() }));

type Wall = NonNullable<LobbySnapshot["wall"]>;

const base: Wall = { enabled: true, placement: "breaks", now: null, waiting: 0, mine: [] };
const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

function renderWall(wall: Partial<Wall> = {}) {
  const handlers = { onPost: vi.fn(), onWithdraw: vi.fn(), onReact: vi.fn() };
  render(
    <GuestWall
      wall={{ ...base, ...wall }}
      gameId="ROOM"
      selfNickname="Amina"
      {...handlers}
    />,
  );
  return handlers;
}

function pickPhoto() {
  const input = screen.getByLabelText(/Camera roll/) as HTMLInputElement;
  const file = new File(["x"], "party.jpg", { type: "image/jpeg" });
  fireEvent.change(input, { target: { files: [file] } });
}

describe("guest photo wall", () => {
  afterEach(() => {
    sendWallPhoto.mockReset();
  });

  it("previews the photo in its frame, then uploads and posts it", async () => {
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
    sendWallPhoto.mockResolvedValue({ mediaId: id(1) });
    const { onPost } = renderWall();
    pickPhoto();
    expect(await screen.findByRole("img", { name: "Photo from Amina" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Caption"), { target: { value: "  Cake time " } });
    fireEvent.click(screen.getByRole("button", { name: "Wanted" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send it" }));
    });
    expect(onPost).toHaveBeenCalledWith({
      mediaId: id(1),
      caption: "Cake time",
      frame: "wanted",
      keep: true,
    });
    expect(screen.getByText(/Sent!/)).toBeTruthy();
  });

  it("keeps the photo and offers Try again when the upload fails", async () => {
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
    sendWallPhoto.mockResolvedValueOnce({ error: "The upload did not finish." });
    sendWallPhoto.mockResolvedValueOnce({ mediaId: id(2) });
    const { onPost } = renderWall();
    pickPhoto();
    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "Send it" }));
    });
    expect(screen.getByRole("alert").textContent).toContain("did not finish");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(onPost).toHaveBeenCalledWith(expect.objectContaining({ mediaId: id(2) }));
  });

  it("shows each photo's status, place in the queue and a withdraw button", () => {
    const { onWithdraw } = renderWall({
      mine: [
        {
          postId: id(3),
          mediaId: id(4),
          caption: null,
          frame: "polaroid",
          status: "queued",
          position: 3,
          reactions: 0,
        },
        {
          postId: id(5),
          mediaId: id(6),
          caption: null,
          frame: "polaroid",
          status: "declined",
          position: null,
          reactions: 0,
        },
      ],
    });
    expect(screen.getByText("In the queue")).toBeTruthy();
    expect(screen.getByText("2 ahead of you")).toBeTruthy();
    expect(screen.getByText("Not shown this time")).toBeTruthy();
    const withdraw = screen.getAllByRole("button", { name: "Withdraw" });
    expect(withdraw).toHaveLength(1);
    fireEvent.click(withdraw[0]!);
    expect(onWithdraw).toHaveBeenCalledWith(id(3));
  });

  it("offers reactions for someone else's photo, but not your own", () => {
    const now = {
      postId: id(7),
      mediaId: id(8),
      nickname: "Bilal",
      caption: null,
      frame: "polaroid" as const,
      untilAt: Date.now() + 5_000,
      reactions: [],
    };
    const { onReact } = renderWall({ now });
    fireEvent.click(screen.getByRole("button", { name: "Fire" }));
    expect(onReact).toHaveBeenCalledWith(id(7), "fire");
  });

  it("explains when the wall is off", () => {
    renderWall({ enabled: false });
    expect(screen.getByText(/switched off/)).toBeTruthy();
    expect(screen.queryByLabelText(/Camera roll/)).toBeNull();
  });
});

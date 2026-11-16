import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("./rooms-api", () => ({ readAdminRoom: vi.fn() }));
vi.mock("../live/room-socket", () => ({ openRoomSocket: vi.fn() }));
vi.mock("../live/room-api", () => ({ playRoom: vi.fn(), issueTransfer: vi.fn() }));
vi.mock("@number-flow/react", () => ({
  default: ({ value, suffix }: { value: number; suffix?: string }) => (
    <span>
      {value}
      {suffix}
    </span>
  ),
}));
import { playRoom } from "../live/room-api";
import { VotersPage } from "./voters-page";
import {
  mountControls,
  playerId,
  playingFixture,
  secondId,
  setupControls,
} from "./controls.test-support";
import type { LobbySnapshot } from "@26/shared";

const photoId = "00000000-0000-4000-8000-0000000000f1";

function fixture(mode: "question" | "hidden"): LobbySnapshot {
  return {
    ...playingFixture,
    players: [
      { playerId, nickname: "Amina", avatarMediaId: photoId },
      { playerId: secondId, nickname: "Bilal" },
    ],
    voterDisplay: { mode, history: [{ atMs: 1, mode }], avatars: 1 },
    play: playingFixture.play
      ? {
          ...playingFixture.play,
          question: { ...playingFixture.play.question, attribution: "live" },
          voters: [
            { optionId: "one", playerIds: [playerId] },
            { optionId: "two", playerIds: [] },
          ],
        }
      : null,
  } as LobbySnapshot;
}

beforeEach(() => {
  setupControls(fixture("question"));
});

it.each([
  ["question", "Hide picks for every question", "voters-hidden"],
  ["hidden", "Show picks again", "voters-question"],
] as const)("sends the room switch from %s mode", async (mode, label, action) => {
  setupControls(fixture(mode));
  await mountControls(<VotersPage />);
  fireEvent.click(screen.getByRole("button", { name: label }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(expect.objectContaining({ action })),
  );
});

it("mirrors the live board and removes a guest's photo by player id", async () => {
  await mountControls(<VotersPage />);
  const board = screen.getByRole("region", { name: "Board right now" });
  expect(within(board).getByText("A test question?", { exact: false })).toBeTruthy();
  expect(within(board).getByRole("list", { name: /Picked by Amina/ })).toBeTruthy();
  expect(
    screen.getByText("1 of 2 players have a photo.", { exact: false }),
  ).toBeTruthy();
  // Only a player with a photo can have it removed.
  expect(screen.getAllByRole("button", { name: "Remove photo" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({ action: "avatar-clear", playerId }),
    ),
  );
});

it("rehearses the real board with stand-ins and never calls the room", async () => {
  await mountControls(<VotersPage />);
  vi.mocked(playRoom).mockClear();
  const rehearsal = screen.getByRole("region", { name: "Vote board rehearsal" });
  fireEvent.click(within(rehearsal).getByRole("button", { name: "Add a vote" }));
  fireEvent.click(within(rehearsal).getByRole("button", { name: "Add a vote" }));
  expect(within(rehearsal).getByText(/2 of 24 stand-ins have picked/)).toBeTruthy();
  expect(
    within(rehearsal).getAllByRole("list", { name: /Picked by Stand-in/ }).length,
  ).toBeGreaterThan(0);
  fireEvent.click(within(rehearsal).getByRole("button", { name: "Reveal" }));
  expect(within(rehearsal).getByText("Correct")).toBeTruthy();
  expect(playRoom).not.toHaveBeenCalled();
});

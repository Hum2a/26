import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("./rooms-api", () => ({ readAdminRoom: vi.fn() }));
vi.mock("../live/room-socket", () => ({ openRoomSocket: vi.fn() }));
vi.mock("../live/room-api", () => ({
  playRoom: vi.fn(),
  issueTransfer: vi.fn(),
  readDiagnostics: vi.fn(),
  downloadScoreSummary: vi.fn(),
}));
import { playRoom } from "../live/room-api";
import { DangerZone } from "./danger-zone";
import { CommandFeedback } from "./command-feedback";
import { roomFixture } from "./room-fixture.test-support";
import {
  mountControls,
  playingFixture,
  setupControls,
  success,
} from "./controls.test-support";

beforeEach(() => setupControls());

function mount() {
  return mountControls(
    <>
      <h1>Room</h1>
      <CommandFeedback scope="live" />
      <DangerZone />
    </>,
  );
}

it("ends a running game only after the host confirms", async () => {
  vi.mocked(playRoom).mockResolvedValue({ ...success, phase: "podium" });
  await mount();
  fireEvent.click(screen.getByRole("button", { name: "End game now" }));
  expect(playRoom).not.toHaveBeenCalled();
  const dialog = screen.getByRole("dialog", { name: "End the game now?" });
  fireEvent.click(within(dialog).getByRole("button", { name: "End game now" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({ action: "end-now", gameId: "ABCDEFGH" }),
    ),
  );
  await screen.findByText("The game has ended. The podium is on the stage.");
});

it("does not offer ending the game from the lobby", async () => {
  setupControls(roomFixture);
  await mount();
  expect(screen.queryByRole("button", { name: "End game now" })).toBeNull();
  expect(screen.getByRole("button", { name: "Destroy room…" })).toBeTruthy();
});

it("destroys the room only once its join code is typed", async () => {
  vi.mocked(playRoom).mockResolvedValue({ ...success, destroyed: true });
  await mount();
  fireEvent.click(screen.getByRole("button", { name: "Destroy room…" }));
  const dialog = screen.getByRole("dialog", {
    name: `Destroy room ${playingFixture.joinCode}?`,
  });
  const confirm = within(dialog).getByRole("button", {
    name: "Destroy room",
  }) as HTMLButtonElement;
  expect(confirm.disabled).toBe(true);
  const field = within(dialog).getByRole("textbox");
  fireEvent.change(field, { target: { value: "WRONG1" } });
  expect(confirm.disabled).toBe(true);
  fireEvent.change(field, { target: { value: playingFixture.joinCode.toLowerCase() } });
  expect(confirm.disabled).toBe(false);
  fireEvent.click(confirm);
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "destroy",
        confirmCode: playingFixture.joinCode.toUpperCase(),
      }),
    ),
  );
});

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";
import { playingFixture } from "../admin/controls.test-support";
import { advancePresenter, pairProjector } from "../live/room-api";
import { openRoomSocket } from "../live/room-socket";
import { PresenterPage } from "./presenter-page";

vi.mock("../live/room-api", () => ({
  advancePresenter: vi.fn(),
  pairProjector: vi.fn(),
}));
vi.mock("../live/room-socket", () => ({ openRoomSocket: vi.fn() }));

it("pairs with a presenter code and pins each action and retry to the cue on screen", async () => {
  const { gameId, joinCode } = playingFixture;
  vi.mocked(pairProjector).mockResolvedValue({
    gameId,
    joinCode,
    expiresAt: new Date().toISOString(),
  });
  const requestSnapshot = vi.fn();
  vi.mocked(openRoomSocket).mockReturnValue({
    close: vi.fn(),
    requestSnapshot,
  } as unknown as ReturnType<typeof openRoomSocket>);
  render(
    <MemoryRouter initialEntries={[`/presenter?code=${joinCode}`]}>
      <PresenterPage />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Presenter code"), {
    target: { value: "abcd-efgh" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Pair presenter phone" }));
  await waitFor(() =>
    expect(openRoomSocket).toHaveBeenCalledWith(
      expect.objectContaining({ gameId, role: "presenter" }),
    ),
  );
  expect(pairProjector).toHaveBeenCalledWith(
    expect.objectContaining({ joinCode, code: "ABCDEFGH" }),
    "presenter",
  );
  const live = vi.mocked(openRoomSocket).mock.calls[0]![0];
  act(() => {
    live.onConnection("open");
    live.onSnapshot({
      ...playingFixture,
      phase: "lobby",
      play: null,
      phaseGeneration: 1,
    });
  });
  expect(screen.getByText(/when Humza starts the show/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Open answering" })).toBeNull();

  act(() =>
    live.onSnapshot({
      ...playingFixture,
      phase: "prompt",
      deadlineAt: null,
      phaseGeneration: 3,
    }),
  );
  vi.mocked(advancePresenter)
    .mockResolvedValueOnce({ error: "Receipt lost", uncertain: true })
    .mockResolvedValueOnce({
      ok: true,
      phase: "collect",
      paused: false,
      held: false,
      stateVersion: 4,
    });
  fireEvent.click(screen.getByRole("button", { name: "Open answering" }));
  await screen.findByText("Receipt lost");
  expect(advancePresenter).toHaveBeenCalledWith(
    expect.objectContaining({ gameId, expectedPhaseGeneration: 3 }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Retry the same action" }));
  expect(await screen.findByRole("button", { name: "Updating room…" })).toHaveProperty(
    "disabled",
    true,
  );
  expect(vi.mocked(advancePresenter).mock.calls[1]).toEqual(
    vi.mocked(advancePresenter).mock.calls[0],
  );
  act(() =>
    live.onSnapshot({
      ...playingFixture,
      phase: "collect",
      deadlineAt: null,
      phaseGeneration: 4,
    }),
  );
  expect(screen.getByRole("button", { name: "Close answering" })).toHaveProperty(
    "disabled",
    false,
  );
  act(() => live.onConnection("closed"));
  expect(screen.getByRole("button", { name: "Close answering" })).toHaveProperty(
    "disabled",
    true,
  );
  act(() => live.onConnection("open"));
  expect(screen.getByRole("button", { name: "Close answering" })).toHaveProperty(
    "disabled",
    true,
  );
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("./rooms-api", () => ({ listRooms: vi.fn(), readCurrentRoom: vi.fn() }));
vi.mock("../live/room-api", () => ({ createLobby: vi.fn() }));
import { listRooms, readCurrentRoom } from "./rooms-api";
import { createLobby } from "../live/room-api";
import { RoomsPage } from "./rooms-page";
import { roomFixture } from "./room-fixture.test-support";
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listRooms).mockResolvedValue({ rooms: [], nextCursor: null });
  vi.mocked(readCurrentRoom).mockResolvedValue(null);
});
function mount() {
  render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<RoomsPage />} />
        <Route path="/admin/rooms/ABCDEFGH" element={<p>Opened existing room</p>} />
      </Routes>
    </MemoryRouter>,
  );
}
it("shows an honest empty registry and retries service failure", async () => {
  vi.mocked(listRooms).mockResolvedValueOnce({ error: "Unavailable", status: 503 });
  mount();
  expect(await screen.findByText("Unavailable")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Refresh rooms" }));
  expect(await screen.findByText("Your first room starts here.")).toBeTruthy();
});
it("recovers a selected room without using tab storage or creating another", async () => {
  vi.mocked(readCurrentRoom).mockResolvedValue(roomFixture);
  mount();
  fireEvent.click(await screen.findByRole("link", { name: "Return to room" }));
  expect(await screen.findByText("Opened existing room")).toBeTruthy();
  expect(createLobby).not.toHaveBeenCalled();
});
it("loads older registry pages without fabricating live phase or player counts", async () => {
  vi.mocked(listRooms)
    .mockResolvedValueOnce({
      rooms: [
        {
          gameId: "ABCDEFGH",
          joinCode: "ABCDEF",
          createdAt: "2026-10-19T00:00:00.000Z",
        },
      ],
      nextCursor: "2",
    })
    .mockResolvedValueOnce({
      rooms: [
        {
          gameId: "GHJKLMNP",
          joinCode: "GHJKLM",
          createdAt: "2026-10-18T00:00:00.000Z",
        },
      ],
      nextCursor: null,
    });
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Load older rooms" }));
  expect(await screen.findByRole("link", { name: "View room GHJKLM" })).toBeTruthy();
  expect(listRooms).toHaveBeenLastCalledWith("2");
  expect(screen.queryByText(/0 players/)).toBeNull();
});
it("reuses an uncertain create request when retried", async () => {
  vi.mocked(createLobby)
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({
      gameId: "ABCDEFGH",
      joinCode: "ABCDEF",
      phase: "lobby",
      questionSetVersion: "unreleased",
      scoringVersion: "unreleased",
      playerCount: 0,
    });
  mount();
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Create a lobby" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Create a lobby" }));
  await screen.findByText(/We couldn’t confirm creation/);
  fireEvent.click(screen.getByRole("button", { name: "Create a lobby" }));
  expect(await screen.findByText("Opened existing room")).toBeTruthy();
  expect(vi.mocked(createLobby).mock.calls[0]?.[0]).toBe(
    vi.mocked(createLobby).mock.calls[1]?.[0],
  );
});

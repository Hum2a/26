import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { expect, it, vi } from "vitest";
vi.mock("../live/room-api", () => ({ createLobby: vi.fn() }));
import { createLobby } from "../live/room-api";
import { RehearsalSetup } from "./rehearsal-setup";
it("keeps the creation request and exact setup across an uncertain retry, then opens developer tools", async () => {
  vi.spyOn(window, "open").mockReturnValue(null);
  vi.mocked(createLobby)
    .mockResolvedValueOnce({ error: "Uncertain creation" })
    .mockResolvedValueOnce({
      gameId: "ABCDEFGH",
      joinCode: "ABCDEF",
      phase: "lobby",
      questionSetVersion: "unreleased",
      scoringVersion: "unreleased",
      playerCount: 0,
    });
  render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<RehearsalSetup />} />
        <Route path="/admin/rooms/:gameId/developer" element={<p>Rehearsal ready</p>} />
      </Routes>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Load 25 bots" }));
  fireEvent.click(screen.getByRole("button", { name: "Start fresh rehearsal" }));
  await screen.findByText("Uncertain creation");
  fireEvent.click(screen.getByRole("button", { name: "Retry fresh rehearsal" }));
  await screen.findByText("Rehearsal ready");
  await waitFor(() => expect(createLobby).toHaveBeenCalledTimes(2));
  expect(vi.mocked(createLobby).mock.calls[0]).toEqual(
    vi.mocked(createLobby).mock.calls[1],
  );
  expect(vi.mocked(createLobby).mock.calls[0]?.[1]).toMatchObject({ botCount: 25 });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
import { appRoutes } from "./routes";
import { joinLobby, resumeGuest } from "./live/room-api";
import { openRoomSocket } from "./live/room-socket";

vi.mock("./admin/admin-api", () => ({
  fetchAdminSession: vi.fn(async () => ({ signedIn: false })),
}));
vi.mock("./live/room-api", () => ({ resumeGuest: vi.fn(), joinLobby: vi.fn() }));
vi.mock("./live/room-socket", () => ({
  openRoomSocket: vi.fn(() => ({ close: vi.fn() })),
}));

function mount(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}
beforeEach(() => {
  vi.mocked(resumeGuest).mockReset().mockResolvedValue(undefined);
  vi.mocked(joinLobby).mockReset();
  vi.mocked(openRoomSocket).mockClear();
  localStorage.clear();
});

it("routes the home choices to separate joining and admin login pages", async () => {
  mount("/");
  fireEvent.click(screen.getByRole("link", { name: /Join the party/ }));
  expect(await screen.findByRole("heading", { name: "Join the room" })).toBeTruthy();
  fireEvent.click(screen.getByRole("link", { name: "Admin sign in" }));
  expect(await screen.findByRole("heading", { name: "Admin sign in" })).toBeTruthy();
});

it.each(["/?room=ABCDEF", "/j/ABCDEF", "/join?room=ABCDEF"])(
  "preserves direct join code at %s",
  async (path) => {
    mount(path);
    expect(await screen.findByText("ABCDEF", { exact: true })).toBeTruthy();
  },
);

it("recovers a guest on /play even with a conflicting QR room", async () => {
  vi.mocked(resumeGuest).mockResolvedValue({
    gameId: "ABCDEFGH",
    playerId: "player-1",
    nickname: "Amina",
    joinCode: "ABCDEF",
    stateVersion: 0,
  });
  mount("/play?room=GHJKLM");
  expect(await screen.findByText("You are in. This phone is Amina.")).toBeTruthy();
  expect(joinLobby).not.toHaveBeenCalled();
  expect(openRoomSocket).toHaveBeenCalledWith(
    expect.objectContaining({ gameId: "ABCDEFGH", role: "guest" }),
  );
});

it("retains join values and idempotency key after a network failure", async () => {
  vi.mocked(joinLobby).mockRejectedValue(new Error("offline"));
  mount("/join");
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Join" }) as HTMLButtonElement).disabled,
    ).toBe(false),
  );
  fireEvent.change(screen.getByLabelText("Join code"), { target: { value: "ABCDEF" } });
  fireEvent.change(screen.getByLabelText("Nickname"), { target: { value: "Amina" } });
  fireEvent.click(screen.getByRole("button", { name: "Join" }));
  expect(await screen.findByText(/We couldn’t join the room/)).toBeTruthy();
  expect((screen.getByLabelText("Nickname") as HTMLInputElement).value).toBe("Amina");
  fireEvent.click(screen.getByRole("button", { name: "Join" }));
  await waitFor(() => expect(joinLobby).toHaveBeenCalledTimes(2));
  expect(vi.mocked(joinLobby).mock.calls[0]?.[0].requestId).toBe(
    vi.mocked(joinLobby).mock.calls[1]?.[0].requestId,
  );
});

it("recovers from a failed guest session check without disabling joining", async () => {
  vi.mocked(resumeGuest).mockRejectedValue(new Error("offline"));
  mount("/join");
  expect(
    await screen.findByText(/We couldn’t check for an existing game/),
  ).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Join" }) as HTMLButtonElement).disabled,
  ).toBe(false);
});

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { appRoutes } from "./routes";
import { joinLobby, redeemTransfer, resumeGuest } from "./live/room-api";
import { openRoomSocket } from "./live/room-socket";

vi.mock("./admin/admin-api", () => ({
  fetchAdminSession: vi.fn(async () => ({ signedIn: false })),
}));
vi.mock("./live/room-api", () => ({
  resumeGuest: vi.fn(),
  joinLobby: vi.fn(),
  redeemTransfer: vi.fn(),
}));
vi.mock("./live/room-socket", () => ({
  openRoomSocket: vi.fn(() => ({ close: vi.fn() })),
}));

// Transform the real screens before test timeouts start, as the former eager
// route imports did. Navigation itself still uses the lazy production routes.
beforeAll(async () => {
  await import("./guest/guest-page");
  await import("./admin/admin-login-page");
}, 30_000);

const mountedRouters: ReturnType<typeof createMemoryRouter>[] = [];
afterEach(() => mountedRouters.splice(0).forEach((router) => router.dispose()));

async function mount(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  mountedRouters.push(router);
  if (!router.state.initialized) {
    await new Promise<void>((resolve) => {
      const unsubscribe = router.subscribe((state) => {
        if (state.initialized) {
          unsubscribe();
          resolve();
        }
      });
    });
  }
  render(<RouterProvider router={router} />);
  await act(() => vi.dynamicImportSettled());
  return router;
}
beforeEach(() => {
  vi.mocked(resumeGuest).mockReset().mockResolvedValue(undefined);
  vi.mocked(joinLobby).mockReset();
  vi.mocked(redeemTransfer).mockReset();
  vi.mocked(openRoomSocket).mockClear();
  localStorage.clear();
});

it("routes the home choices to separate joining and admin login pages", async () => {
  await mount("/");
  fireEvent.click(screen.getByRole("link", { name: /Join the party/ }));
  await act(() => vi.dynamicImportSettled());
  expect(await screen.findByRole("heading", { name: "Join the room" })).toBeTruthy();
  fireEvent.click(screen.getByRole("link", { name: "Admin sign in" }));
  await act(() => vi.dynamicImportSettled());
  expect(await screen.findByRole("heading", { name: "Admin sign in" })).toBeTruthy();
});

it.each(["/?room=ABCDEF", "/j/ABCDEF", "/join?room=ABCDEF"])(
  "preserves direct join code at %s",
  async (path) => {
    await mount(path);
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
  await mount("/play?room=GHJKLM");
  expect(await screen.findByText("You are in. This phone is Amina.")).toBeTruthy();
  expect(joinLobby).not.toHaveBeenCalled();
  expect(openRoomSocket).toHaveBeenCalledWith(
    expect.objectContaining({ gameId: "ABCDEFGH", role: "guest" }),
  );
});

it("starts a fresh attempt after a definite refusal when joining reopens", async () => {
  vi.mocked(joinLobby).mockResolvedValue({
    error: "The host has closed joining.",
    uncertain: false,
  });
  await mount("/join");
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Join" }) as HTMLButtonElement).disabled,
    ).toBe(false),
  );
  fireEvent.change(screen.getByLabelText("Join code"), { target: { value: "ABCDEF" } });
  fireEvent.change(screen.getByLabelText("Nickname"), { target: { value: "Amina" } });
  fireEvent.click(screen.getByRole("button", { name: "Join" }));
  await screen.findByText("The host has closed joining.");
  const first = vi.mocked(joinLobby).mock.calls[0]![0].requestId;
  fireEvent.click(screen.getByRole("button", { name: "Join" }));
  await waitFor(() => expect(joinLobby).toHaveBeenCalledTimes(2));
  expect(vi.mocked(joinLobby).mock.calls[1]![0].requestId).not.toBe(first);
});

const recoveredSession = {
  gameId: "ABCDEFGH",
  playerId: "player-1",
  nickname: "Amina",
  joinCode: "ABCDEF",
  stateVersion: 3,
};

it("lets an unjoined phone recover a player without creating another identity", async () => {
  vi.mocked(redeemTransfer).mockResolvedValue(recoveredSession);
  await mount("/j/ABCDEF");
  fireEvent.click(await screen.findByRole("button", { name: "Changed phones?" }));
  fireEvent.change(screen.getByLabelText("Transfer code"), {
    target: { value: "recover1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Use this phone" }));
  await waitFor(() =>
    expect(redeemTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ joinCode: "ABCDEF", code: "RECOVER1" }),
    ),
  );
  await waitFor(() =>
    expect(openRoomSocket).toHaveBeenCalledWith(
      expect.objectContaining({ gameId: "ABCDEFGH", role: "guest" }),
    ),
  );
  expect(joinLobby).not.toHaveBeenCalled();
});

it("replaces the socket when recovery keeps the same player identity", async () => {
  vi.mocked(resumeGuest).mockResolvedValue(recoveredSession);
  vi.mocked(redeemTransfer).mockResolvedValue(recoveredSession);
  await mount("/play");
  await waitFor(() => expect(openRoomSocket).toHaveBeenCalledTimes(1));
  const oldSocket = vi.mocked(openRoomSocket).mock.results[0]!.value;
  // In a game, phone transfer lives in the personal menu behind the avatar.
  fireEvent.click(screen.getByRole("button", { name: /^You: / }));
  fireEvent.click(await screen.findByRole("button", { name: "Changed phones?" }));
  fireEvent.change(screen.getByLabelText("Transfer code"), {
    target: { value: "RECOVER1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Use this phone" }));
  await waitFor(() => expect(openRoomSocket).toHaveBeenCalledTimes(2));
  expect(oldSocket.close).toHaveBeenCalled();
});

it("keeps the transfer request after an uncertain response and releases its controls", async () => {
  vi.mocked(redeemTransfer).mockRejectedValue(new Error("offline"));
  await mount("/j/ABCDEF");
  fireEvent.click(await screen.findByRole("button", { name: "Changed phones?" }));
  fireEvent.change(screen.getByLabelText("Transfer code"), {
    target: { value: "RECOVER1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Use this phone" }));
  await screen.findByText(/We couldn’t confirm the phone transfer/);
  fireEvent.click(screen.getByRole("button", { name: "Use this phone" }));
  await waitFor(() => expect(redeemTransfer).toHaveBeenCalledTimes(2));
  expect(vi.mocked(redeemTransfer).mock.calls[1]![0]).toEqual(
    vi.mocked(redeemTransfer).mock.calls[0]![0],
  );
});

it("retains join values and idempotency key after a network failure", async () => {
  vi.mocked(joinLobby).mockRejectedValue(new Error("offline"));
  await mount("/join");
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
  await mount("/join");
  expect(
    await screen.findByText(/We couldn’t check for an existing game/),
  ).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Join" }) as HTMLButtonElement).disabled,
  ).toBe(false);
});

it("tells a phone its room closed, without a reconnecting banner, and lets it rejoin", async () => {
  vi.mocked(resumeGuest).mockResolvedValue(recoveredSession);
  await mount("/play");
  await waitFor(() => expect(openRoomSocket).toHaveBeenCalledTimes(1));
  const options = vi.mocked(openRoomSocket).mock.calls[0]![0];
  act(() => {
    options.onConnection("open");
    options.onReplaced?.("The host closed this room.");
    options.onConnection("closed");
  });
  expect(await screen.findByText("The host closed this room.")).toBeTruthy();
  expect(screen.queryByText(/Reconnecting/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Join another room" }));
  expect(await screen.findByRole("heading", { name: "Join the room" })).toBeTruthy();
});

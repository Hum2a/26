import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("./rooms-api", () => ({ readAdminRoom: vi.fn() }));
vi.mock("../live/room-socket", () => ({ openRoomSocket: vi.fn() }));
import { readAdminRoom } from "./rooms-api";
import { openRoomSocket } from "../live/room-socket";
import { AdminRoomProvider, useAdminRoom } from "./room-provider";
import { AdminShell } from "../ui/admin-shell";
import { roomFixture } from "./room-fixture.test-support";
const close = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readAdminRoom).mockResolvedValue(roomFixture);
  vi.mocked(openRoomSocket).mockReturnValue({
    close,
    requestSnapshot: vi.fn(),
    submitAnswer: vi.fn(),
    submitEstimate: vi.fn(),
    submitRank: vi.fn(),
    submitText: vi.fn(),
    submitBallot: vi.fn(),
    submitDuel: vi.fn(),
    submitTroll: vi.fn(),
    submitDraft: vi.fn(),
    submitKartInput: vi.fn(),
    submitTrollEscape: vi.fn(),
    submitReaction: vi.fn(),
    reconnectNow: vi.fn(),
    submitDriver: vi.fn(),
    submitWallPost: vi.fn(),
    submitWallWithdraw: vi.fn(),
    submitWallReact: vi.fn(),
    reportWallImageFailed: vi.fn(),
    submitChessMove: vi.fn(() => crypto.randomUUID()),
    submitChessResign: vi.fn(() => crypto.randomUUID()),
  });
});
function Probe() {
  const { snapshot } = useAdminRoom();
  return <p>Room code {snapshot.joinCode}</p>;
}
function mount() {
  const router = createMemoryRouter(
    [
      {
        element: (
          <AdminShell account={<p>Account</p>}>
            <Outlet />
          </AdminShell>
        ),
        children: [
          {
            path: "/admin/rooms/:gameId",
            element: (
              <AdminRoomProvider gameId="ABCDEFGH">
                <Outlet />
              </AdminRoomProvider>
            ),
            children: [
              { index: true, element: <Probe /> },
              { path: "live", element: <Probe /> },
            ],
          },
        ],
      },
    ],
    { initialEntries: ["/admin/rooms/ABCDEFGH"] },
  );
  const view = render(<RouterProvider router={router} />);
  return { ...view, router };
}
it("keeps one socket and the shared room state across nested navigation", async () => {
  const view = mount();
  await screen.findByText("Room code ABCDEF");
  fireEvent.click(screen.getByRole("link", { name: "Live controls" }));
  await waitFor(() =>
    expect(
      screen.getByRole("link", { name: "Live controls" }).getAttribute("aria-current"),
    ).toBe("page"),
  );
  expect(openRoomSocket).toHaveBeenCalledTimes(1);
  expect(readAdminRoom).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(close).toHaveBeenCalledTimes(1);
});
it("requires deliberate renewal when a room cookie expires", async () => {
  vi.mocked(readAdminRoom).mockResolvedValueOnce({
    error: "Open this room to renew its access.",
    status: 401,
  });
  mount();
  fireEvent.click(
    await screen.findByRole("button", { name: "Open room in this browser" }),
  );
  expect(await screen.findByText("Room code ABCDEF")).toBeTruthy();
  expect(readAdminRoom).toHaveBeenLastCalledWith("ABCDEFGH", expect.any(String));
});
it("blocks a stale tab and closes its socket after a switch", async () => {
  mount();
  await screen.findByText("Room code ABCDEF");
  await waitFor(() => expect(openRoomSocket).toHaveBeenCalledTimes(1));
  act(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "26-admin-room-change",
        newValue: "another-selection",
      }),
    ),
  );
  expect(await screen.findByText(/Room access changed in another tab/)).toBeTruthy();
  expect(screen.queryByText("Room code ABCDEF")).toBeNull();
  expect(close).toHaveBeenCalled();
});
it("shows missing rooms without opening a socket or creating a room", async () => {
  vi.mocked(readAdminRoom).mockResolvedValue({
    status: 404,
    error: "This room could not be found.",
  });
  mount();
  expect(await screen.findByText("This room could not be found.")).toBeTruthy();
  expect(openRoomSocket).not.toHaveBeenCalled();
});

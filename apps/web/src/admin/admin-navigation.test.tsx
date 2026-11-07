import { useEffect, useState, type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, Link, RouterProvider } from "react-router";
import { expect, it, vi } from "vitest";
vi.mock("./use-admin-session", () => ({
  useAdminSession: () => ({
    state: "ready",
    session: { signedIn: true, email: "host@example.com" },
  }),
}));
vi.mock("./rooms-api", () => ({ readCurrentRoom: async () => null }));
// Model AnimatePresence retaining the outgoing child while route context changes.
// Keeping both children explicit makes this independent of jsdom animation timing.
vi.mock("../ui/admin-shell", () => ({
  AdminShell: ({ children }: { children: ReactNode }) => {
    const [outgoing] = useState(children);
    return (
      <>
        <div aria-label="Retained outgoing page">{outgoing}</div>
        <div aria-label="Current page">{children}</div>
      </>
    );
  },
}));
import { AdminPage } from "./admin-page";

it("mounts incoming room controls once rather than inside the outgoing global page", async () => {
  const mounted = vi.fn();
  function RoomControls() {
    useEffect(() => {
      mounted();
    }, []);
    return <h1>Incoming room controls</h1>;
  }
  const router = createMemoryRouter(
    [
      {
        path: "/admin",
        element: <AdminPage />,
        children: [
          {
            path: "kart",
            element: <Link to="/admin/rooms/ABCDEFGH/live">Create room</Link>,
          },
          { path: "rooms/:gameId/live", element: <RoomControls /> },
        ],
      },
    ],
    { initialEntries: ["/admin/kart"] },
  );
  render(<RouterProvider router={router} />);
  fireEvent.click(screen.getAllByRole("link", { name: "Create room" }).at(-1)!);
  await screen.findAllByRole("heading", { name: "Incoming room controls" });
  expect(mounted).toHaveBeenCalledTimes(1);
});

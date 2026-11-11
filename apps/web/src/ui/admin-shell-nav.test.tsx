import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../admin/rooms-api", () => ({ readCurrentRoom: vi.fn() }));
import { readCurrentRoom } from "../admin/rooms-api";
import { roomFixture } from "../admin/room-fixture.test-support";
import { AdminShell } from "./admin-shell";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminShell account={null}>
        <p>Page</p>
      </AdminShell>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(readCurrentRoom).mockReset();
});

it("lists every room page from the admin home, linked to the selected room", async () => {
  vi.mocked(readCurrentRoom).mockResolvedValue({
    ...roomFixture,
    gameId: "ROOMABCD",
    joinCode: "XYZ123",
  });
  renderAt("/admin");
  const nav = screen.getByRole("navigation", { name: "Admin workspace" });
  await waitFor(() =>
    expect(
      nav.querySelector('a[href="/admin/rooms/ROOMABCD/analytics"]'),
    ).not.toBeNull(),
  );
  for (const page of ["analytics", "wall", "trolls", "players", "results", "health"]) {
    expect(
      nav.querySelector(`a[href="/admin/rooms/ROOMABCD/${page}"]`),
      page,
    ).not.toBeNull();
  }
  expect(screen.getByText("Room XYZ123")).toBeTruthy();
});

it("still shows the room pages with no room selected, and how to get one", async () => {
  vi.mocked(readCurrentRoom).mockResolvedValue(null);
  renderAt("/admin");
  expect(screen.getByText("Analytics")).toBeTruthy();
  expect(screen.getByText("Photo wall")).toBeTruthy();
  expect(screen.getByText("Tonight")).toBeTruthy();
  expect(screen.getByText("Catalogue")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Open a room first →" }).getAttribute("href"),
  ).toBe("/admin/rooms");
});

it("uses the room in the address inside a room, without asking the server", () => {
  renderAt("/admin/rooms/ROOMWXYZ/live");
  const nav = screen.getByRole("navigation", { name: "Admin workspace" });
  expect(nav.querySelector('a[href="/admin/rooms/ROOMWXYZ/analytics"]')).not.toBeNull();
  expect(readCurrentRoom).not.toHaveBeenCalled();
});

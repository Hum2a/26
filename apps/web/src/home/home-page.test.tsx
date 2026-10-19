import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
import { HomePage } from "./home-page";
import { fetchAdminSession } from "../admin/admin-api";
import { resumeGuest } from "../live/room-api";

vi.mock("../admin/admin-api", () => ({ fetchAdminSession: vi.fn() }));
vi.mock("../live/room-api", () => ({ resumeGuest: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchAdminSession).mockResolvedValue({ signedIn: false });
  vi.mocked(resumeGuest).mockResolvedValue(undefined);
});

it("offers join and admin destinations without a login dependency", () => {
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
  expect(
    screen.getByRole("link", { name: /Join the party/ }).getAttribute("href"),
  ).toBe("/join");
  expect(
    screen.getAllByRole("link", { name: "Admin sign in" })[0]?.getAttribute("href"),
  ).toBe("/admin/login");
});

it("offers verified admin and guest sessions a way back", async () => {
  vi.mocked(fetchAdminSession).mockResolvedValue({
    signedIn: true,
    email: "admin@example.test",
  });
  vi.mocked(resumeGuest).mockResolvedValue({
    gameId: "ABCDEFGH",
    playerId: "player-1",
    joinCode: "ABCDEF",
    nickname: "Amina",
    stateVersion: 0,
  });
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
  expect(
    (await screen.findAllByRole("link", { name: "Open admin" }))[0]?.getAttribute(
      "href",
    ),
  ).toBe("/admin");
  expect(
    (await screen.findByRole("link", { name: /Return to your game/ })).getAttribute(
      "href",
    ),
  ).toBe("/play");
});

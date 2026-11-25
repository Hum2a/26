import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("./rooms-api", () => ({ readAdminRoom: vi.fn() }));
vi.mock("../live/room-socket", () => ({ openRoomSocket: vi.fn() }));
vi.mock("../live/room-api", () => ({ playRoom: vi.fn(), issueTransfer: vi.fn() }));
import type { LobbySnapshot } from "@26/shared";
import { AnalyticsPage } from "./analytics-page";
import { analyticsRehearsal } from "./analytics-rehearsal";
import {
  mountControls,
  playingFixture,
  setupControls,
  update,
} from "./controls.test-support";

const id = (n: number) => `00000000-0000-4000-8000-0000000000b${n}`;

const fixture: LobbySnapshot = {
  ...playingFixture,
  highlights: [
    {
      id: "h1",
      factId: "h1",
      illustrative: false,
      display: "eligible",
      stage: "Most loved photo: Amina's, with 12 reactions.",
      results: "Most loved photo on the wall.",
    },
    {
      id: "h2",
      factId: "h2",
      illustrative: false,
      display: "suppressed",
      stage: "Small group.",
      results: "2 of the 3 iPad players chose it.",
    },
  ],
  trollHistory: [
    {
      effectId: id(1),
      label: "Confetti cannon",
      actorNickname: "Amina",
      targetNickname: "Bilal",
      status: "ended",
      createdAt: Date.now(),
    },
    {
      effectId: id(2),
      label: "Confetti cannon",
      actorNickname: "Bilal",
      targetNickname: "Amina",
      status: "active",
      createdAt: Date.now(),
    },
    {
      effectId: id(3),
      label: "DVD logo",
      actorNickname: "Chen",
      targetNickname: "Amina",
      status: "refunded",
      createdAt: Date.now(),
    },
  ],
};

beforeEach(() => setupControls(fixture));
afterEach(() => vi.unstubAllGlobals());

it("shows podium highlights, the ones held back, and troll totals", async () => {
  await mountControls(<AnalyticsPage />);
  const highlights = screen.getByRole("region", { name: "Podium highlights" });
  expect(
    within(highlights).getByText("Most loved photo: Amina's, with 12 reactions."),
  ).toBeTruthy();
  const held = screen.getByRole("region", { name: "Held back" });
  expect(within(held).getByText("2 of the 3 iPad players chose it.")).toBeTruthy();
  const trolls = screen.getByRole("region", { name: "Trolls by type" });
  // A refunded troll never ran, so it does not count.
  expect(trolls.textContent).toContain("Confetti cannon: 2");
  expect(trolls.textContent).not.toContain("DVD logo");
  expect(screen.getByRole("region", { name: "Totals" }).textContent).toContain(
    "Trolls sent2",
  );
});

it("loads private records only in the explorer and reads published metrics on demand", async () => {
  let published = false;
  const fetchData = vi.fn(async (path: string) => {
    if (path.endsWith("?archive=1")) {
      if (!published) return Response.json({ state: "unavailable" });
      return Response.json({
        state: "ready",
        revision: 12,
        facts: analyticsRehearsal.facts,
      });
    }
    if (path.endsWith("/results"))
      return Response.json(
        published ? { state: "ready", standings: [] } : { state: "preparing" },
      );
    return Response.json({ ...analyticsRehearsal, gameId: fixture.gameId });
  });
  vi.stubGlobal("fetch", fetchData);
  await mountControls(<AnalyticsPage />);
  expect(fetchData).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("link", { name: "Explore responses" }));
  expect(await screen.findByRole("table", { name: "Guest responses" })).toBeTruthy();
  expect(fetchData).toHaveBeenCalledWith(
    `/api/admin/rooms/${fixture.gameId}/analytics`,
    expect.objectContaining({ cache: "no-store" }),
  );

  fireEvent.click(screen.getByRole("button", { name: "Room" }));
  expect(
    await screen.findByText("The published report is unavailable for this room."),
  ).toBeTruthy();
  fireEvent.click(screen.getByText("Archived metric inputs and counts"));
  expect(
    await screen.findByText("No archived metric records are available."),
  ).toBeTruthy();
  published = true;
  update({
    ...fixture,
    stateVersion: fixture.stateVersion + 1,
    archive: { status: "completed", revision: 12, attempts: 1 },
  });

  expect(await screen.findByText("Archived podium highlights")).toBeTruthy();
  expect(
    await screen.findByText("1 retained metric from archive revision 12."),
  ).toBeTruthy();
});

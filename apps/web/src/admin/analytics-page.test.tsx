import { screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("./rooms-api", () => ({ readAdminRoom: vi.fn() }));
vi.mock("../live/room-socket", () => ({ openRoomSocket: vi.fn() }));
vi.mock("../live/room-api", () => ({ playRoom: vi.fn(), issueTransfer: vi.fn() }));
import type { LobbySnapshot } from "@26/shared";
import { AnalyticsPage } from "./analytics-page";
import { mountControls, playingFixture, setupControls } from "./controls.test-support";

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

it("shows podium highlights, the ones held back, and troll totals", async () => {
  await mountControls(<AnalyticsPage />);
  const highlights = screen.getByRole("region", { name: "Podium highlights" });
  expect(within(highlights).getByText("Most loved photo: Amina's, with 12 reactions.")).toBeTruthy();
  const held = screen.getByRole("region", { name: "Held back" });
  expect(within(held).getByText("2 of the 3 iPad players chose it.")).toBeTruthy();
  const trolls = screen.getByRole("region", { name: "Trolls by type" });
  // A refunded troll never ran, so it does not count.
  expect(trolls.textContent).toContain("Confetti cannon: 2");
  expect(trolls.textContent).not.toContain("DVD logo");
  expect(screen.getByRole("region", { name: "Totals" }).textContent).toContain("Trolls sent2");
});

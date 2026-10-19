import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("./rooms-api", () => ({ readAdminRoom: vi.fn() }));
vi.mock("../live/room-socket", () => ({ openRoomSocket: vi.fn() }));
vi.mock("../live/room-api", () => ({
  playRoom: vi.fn(),
  issueTransfer: vi.fn(),
  downloadScoreSummary: vi.fn(),
}));
vi.mock("./sections-api", () => ({ readSection: vi.fn() }));
import { readSection } from "./sections-api";
import { playRoom } from "../live/room-api";
import { AdminResultsPage } from "./results-page";
import { mountControls, playingFixture, setupControls } from "./controls.test-support";
beforeEach(() => {
  setupControls({
    ...playingFixture,
    phase: "podium",
    archive: { status: "pending", revision: 1, attempts: 1 },
  });
  vi.mocked(readSection).mockResolvedValue({ state: "preparing" });
});
it("keeps live totals visible while the final archive is pending", async () => {
  await mountControls(<AdminResultsPage />);
  await screen.findByText(/archive export is preparing/);
  expect(screen.getByText("100 points")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Open public results ↗" }).getAttribute("href"),
  ).toBe("/r/ABCDEFGH");
  expect(screen.queryByRole("button", { name: "Retry archive export" })).toBeNull();
});
it("reviews a failed archive retry without changing public or live scores", async () => {
  setupControls({
    ...playingFixture,
    phase: "podium",
    archive: { status: "failed", revision: 1, attempts: 2 },
  });
  vi.mocked(readSection).mockResolvedValue({ state: "preparing" });
  await mountControls(<AdminResultsPage />);
  fireEvent.click(screen.getByRole("button", { name: "Retry archive export" }));
  expect(playRoom).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("dialog").querySelectorAll("button")[1]!);
  await screen.findByText("The archive export will try again. The podium stays up.");
  expect(playRoom).toHaveBeenCalledWith(
    expect.objectContaining({ action: "retry-archive" }),
  );
});

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { createKartRace, projectKartRace, type RoomDiagnostics } from "@26/shared";
vi.mock("./rooms-api", () => ({ readAdminRoom: vi.fn() }));
vi.mock("../live/room-socket", () => ({ openRoomSocket: vi.fn() }));
vi.mock("../live/room-api", () => ({ playRoom: vi.fn(), issueTransfer: vi.fn() }));
vi.mock("./sections-api", () => ({ readSection: vi.fn() }));
import { readSection } from "./sections-api";
import { playRoom } from "../live/room-api";
import { HealthPage } from "./health-page";
import { mountControls, setupControls, playingFixture } from "./controls.test-support";
export const healthFixture: RoomDiagnostics = {
  gameId: "ABCDEFGH",
  phase: "collect",
  paused: false,
  held: false,
  questionId: "test",
  questionIndex: 0,
  questionSetVersion: "demo-2026-09-22",
  scoringVersion: "demo-2026-09-22",
  players: 1,
  connections: { guests: 1, stage: 0, control: 1 },
  scheduler: { alarmAt: null, pending: 1, failed: 0, jobs: [] },
  media: {
    open: 0,
    leased: 1,
    staged: 0,
    accepted: 0,
    rejected: 1,
    expired: 0,
    cancelled: 0,
    attention: [{ nickname: "Amina", status: "rejected", failure: "Invalid image" }],
  },
  archive: {
    status: "failed",
    targetRevision: 1,
    verifiedRevision: null,
    attempts: 2,
    lastError: "Archive unavailable",
  },
  delivery: {
    available: false,
    pending: 0,
    uncertain: 0,
    failed: 0,
    sent: 0,
    testRecipient: false,
  },
};
beforeEach(() => {
  setupControls();
  vi.mocked(readSection).mockResolvedValue(healthFixture);
});
it("shows accepted kart event history without claiming guest GPU readiness", async () => {
  const race = createKartRace("health", [{ playerId: "p", name: "Driver" }]);
  race.elapsedMs = 1000;
  race.ended = true;
  race.drivers[0]!.status = "DNF";
  setupControls({
    ...playingFixture,
    play: { ...playingFixture.play!, kart: projectKartRace(race, null, 100) },
  });
  vi.mocked(readSection).mockResolvedValue(healthFixture);
  await mountControls(<HealthPage />);
  expect(await screen.findByText("Contract 1 · kart-assets-v1")).toBeTruthy();
  expect(screen.getByText(/p · DNF · 1000 ms · event/)).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: "Check assets and rehearse rendering →" })
      .getAttribute("href"),
  ).toBe("/admin/kart");
  expect(screen.getByText(/not GPU or asset-readiness measurements/)).toBeTruthy();
});
it("distinguishes unavailable delivery counts and shows scoped failure details", async () => {
  await mountControls(<HealthPage />);
  await screen.findByText("Email job counts are unavailable. Refresh to check again.");
  expect(screen.queryByRole("button", { name: "Retry email jobs" })).toBeNull();
  expect(screen.getByText("Amina · rejected: Invalid image")).toBeTruthy();
  expect(screen.getByText(/Last checked/)).toBeTruthy();
});
it("confirms a recovery action, reuses shared commands and refreshes the report", async () => {
  await mountControls(<HealthPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Retry archive export" }));
  expect(playRoom).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm recovery action" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({ action: "retry-archive" }),
    ),
  );
  await waitFor(() => expect(readSection).toHaveBeenCalledTimes(2));
});
it("retains the last check as stale after failure and disables recovery", async () => {
  await mountControls(<HealthPage />);
  await screen.findByText("Archive unavailable");
  vi.mocked(readSection).mockResolvedValue({ error: "Could not refresh" });
  fireEvent.click(screen.getByRole("button", { name: "Refresh room health" }));
  await screen.findByText("Could not refresh");
  expect(screen.getByText(/These details may be out of date/)).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Release stuck media" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

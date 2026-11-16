import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../admin/rooms-api", () => ({ readAdminRoom: vi.fn() }));
vi.mock("../live/room-socket", () => ({ openRoomSocket: vi.fn() }));
vi.mock("../live/room-api", () => ({ playRoom: vi.fn(), issueTransfer: vi.fn() }));
vi.mock("./bot-fleet", () => ({
  readBotSessions: vi.fn().mockResolvedValue([]),
  createBotFleet: vi.fn(() => ({
    close: vi.fn(),
    configure: vi.fn(),
    burst: vi.fn(),
    resetMetrics: vi.fn(),
    deadlineBurst: vi.fn(),
  })),
  emptyFleetReport: {
    connected: 0,
    accepted: 0,
    refused: 0,
    pending: 0,
    p95Ms: 0,
    lastError: "",
  },
}));
import { playRoom } from "../live/room-api";
import {
  mountControls,
  setupControls,
  playingFixture,
  playerId,
  update,
} from "../admin/controls.test-support";
import { createBotFleet, readBotSessions } from "./bot-fleet";
import { safeAdminReturnTo } from "../admin/admin-return";
import { DeveloperPage } from "./developer-page";

beforeEach(() => {
  setupControls({ ...playingFixture, phase: "lobby", play: null });
  vi.mocked(readBotSessions).mockResolvedValue([]);
  vi.mocked(createBotFleet).mockReturnValue({
    close: vi.fn(),
    configure: vi.fn(),
    burst: vi.fn(),
    resetMetrics: vi.fn(),
    deadlineBurst: vi.fn(),
  });
});

it("sends staged totals, custom counts and removal through existing receipted commands", async () => {
  await mountControls(<DeveloperPage />);
  fireEvent.click(screen.getByRole("button", { name: "Set 25 bots" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({ action: "developer-bots", botCount: 25 }),
    ),
  );
  fireEvent.change(screen.getByLabelText("Bot count"), { target: { value: "12" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply bot count" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "developer-bots", botCount: 12 }),
    ),
  );
  update({
    ...playingFixture,
    developerTools: {
      revision: 1,
      bots: [{ playerId, nickname: "Bot 001" }],
      history: [{ atMs: 1000, count: 1 }],
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Remove all bots" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "developer-bots", botCount: 0 }),
    ),
  );
});

it("runs the existing show commands from the developer page", async () => {
  await mountControls(<DeveloperPage />);
  for (const [label, action] of [
    ["Start illustrative demo", "start"],
    ["Start birthday game", "start-birthday"],
  ]) {
    fireEvent.click(screen.getByRole("button", { name: label }));
    await waitFor(() =>
      expect(playRoom).toHaveBeenLastCalledWith(expect.objectContaining({ action })),
    );
  }
  update(playingFixture);
  for (const [label, action] of [
    ["Pause game", "pause"],
    ["Advance beat", "advance"],
    ["Skip question", "skip"],
  ]) {
    fireEvent.click(screen.getByRole("button", { name: label }));
    await waitFor(() =>
      expect(playRoom).toHaveBeenLastCalledWith(expect.objectContaining({ action })),
    );
  }
  update({ ...playingFixture, paused: true });
  fireEvent.click(screen.getByRole("button", { name: "Resume game" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "resume" }),
    ),
  );
});

it("starts a kart lobby in the same tab as the fleet and disables other pack starts", async () => {
  setupControls({
    ...playingFixture,
    phase: "lobby",
    play: null,
    kartLobby: { createdAt: 1000 },
  });
  await mountControls(<DeveloperPage />);
  expect(
    (
      screen.getByRole("button", {
        name: "Start illustrative demo",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(
    (screen.getByRole("button", { name: "Start birthday game" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Start kart race" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "start-kart" }),
    ),
  );
  update({ ...playingFixture, kartLobby: { createdAt: 1000 } });
  expect(
    (screen.getByRole("button", { name: "Start kart race" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

it("opens scoped sessions, configures real traffic, reconnects and closes everything on leaving", async () => {
  setupControls({
    ...playingFixture,
    developerTools: {
      revision: 1,
      bots: [{ playerId, nickname: "Bot 001" }],
      history: [],
    },
  });
  vi.mocked(readBotSessions).mockResolvedValue([]);
  vi.mocked(createBotFleet).mockReturnValue({
    close: vi.fn(),
    configure: vi.fn(),
    burst: vi.fn(),
    resetMetrics: vi.fn(),
    deadlineBurst: vi.fn(),
  });
  const view = await mountControls(<DeveloperPage />);
  await waitFor(() => expect(createBotFleet).toHaveBeenCalledTimes(1));
  const fleet = vi.mocked(createBotFleet).mock.results[0]!.value;
  fireEvent.click(screen.getByRole("button", { name: "Enable automatic answers" }));
  await waitFor(() =>
    expect(fleet.configure).toHaveBeenLastCalledWith(
      expect.objectContaining({ auto: true }),
    ),
  );
  fireEvent.change(screen.getByLabelText("Participation"), { target: { value: "50" } });
  await waitFor(() =>
    expect(fleet.configure).toHaveBeenLastCalledWith(
      expect.objectContaining({ participation: 50 }),
    ),
  );
  fireEvent.click(screen.getByRole("checkbox", { name: /Send kart controls/ }));
  await waitFor(() =>
    expect(fleet.configure).toHaveBeenLastCalledWith(
      expect.objectContaining({ kart: true }),
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Reconnect all bots" }));
  await waitFor(() => expect(readBotSessions).toHaveBeenCalledTimes(2));
  expect(fleet.close).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Disconnect bots" }));
  await waitFor(() =>
    expect(
      vi.mocked(createBotFleet).mock.results.at(-1)!.value.close,
    ).toHaveBeenCalled(),
  );
  view.unmount();
});

it("retains the developer destination through sign-in and prevents overflow beside a real guest", async () => {
  expect(safeAdminReturnTo("/admin/rooms/ABCDEFGH/developer")).toBe(
    "/admin/rooms/ABCDEFGH/developer",
  );
  await mountControls(<DeveloperPage />);
  expect(
    screen.getByRole("button", { name: "Set 100 bots" }).hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.change(screen.getByLabelText("Bot count"), { target: { value: "101" } });
  expect(
    screen.getByRole("button", { name: "Apply bot count" }).hasAttribute("disabled"),
  ).toBe(true);
});

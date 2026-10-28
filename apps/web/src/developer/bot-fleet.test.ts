import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("../live/room-socket", () => ({ openRoomSocket: vi.fn() }));
import { openRoomSocket } from "../live/room-socket";
import { playingFixture } from "../admin/controls.test-support";
import { createBotFleet } from "./bot-fleet";

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(openRoomSocket).mockReset();
  vi.mocked(openRoomSocket).mockImplementation(
    () =>
      ({
        close: vi.fn(),
        submitAnswer: vi.fn(() => crypto.randomUUID()),
        submitBallot: vi.fn(() => crypto.randomUUID()),
        submitKartInput: vi.fn(),
      }) as unknown as ReturnType<typeof openRoomSocket>,
  );
});
afterEach(() => vi.useRealTimers());

it("limits pending handshakes so a 100-bot ramp cannot flood browser connection throttling", () => {
  const sessions = Array.from({ length: 100 }, () => ({
    playerId: crypto.randomUUID(),
    secret: "x".repeat(43),
  }));
  const fleet = createBotFleet("ABCDEFGH", sessions, vi.fn());
  vi.advanceTimersByTime(3000);
  expect(openRoomSocket).toHaveBeenCalledTimes(4);
  vi.mocked(openRoomSocket).mock.calls[0]![0].onConnection("open");
  vi.advanceTimersByTime(30);
  expect(openRoomSocket).toHaveBeenCalledTimes(5);
  fleet.close();
});

it("stages connections, sends one answer per phase and measures server acknowledgements", () => {
  const report = vi.fn();
  const sessions = Array.from({ length: 10 }, () => ({
    playerId: crypto.randomUUID(),
    secret: "x".repeat(43),
  }));
  const fleet = createBotFleet("ABCDEFGH", sessions, report);
  fleet.configure({ auto: true, delayMs: 1000, participation: 50, kart: false });
  for (let i = 0; i < 10; i++) {
    vi.advanceTimersByTime(30);
    vi.mocked(openRoomSocket).mock.calls[i]![0].onConnection("open");
  }
  expect(openRoomSocket).toHaveBeenCalledTimes(10);
  for (const call of vi.mocked(openRoomSocket).mock.calls) {
    call[0].onConnection("open");
    call[0].onSnapshot(playingFixture);
  }
  vi.advanceTimersByTime(2500);
  const clients = vi.mocked(openRoomSocket).mock.results.map((result) => result.value);
  expect(
    clients
      .slice(0, 5)
      .every((client) => vi.mocked(client.submitAnswer).mock.calls.length === 1),
  ).toBe(true);
  expect(
    clients
      .slice(5)
      .every((client) => vi.mocked(client.submitAnswer).mock.calls.length === 0),
  ).toBe(true);
  // Repeated snapshots cannot duplicate a bot answer.
  for (const call of vi.mocked(openRoomSocket).mock.calls)
    call[0].onSnapshot(playingFixture);
  vi.advanceTimersByTime(2500);
  expect(
    clients
      .slice(0, 5)
      .every((client) => vi.mocked(client.submitAnswer).mock.calls.length === 1),
  ).toBe(true);
  const id = vi.mocked(clients[0]!.submitAnswer).mock.results[0]!.value;
  vi.mocked(openRoomSocket).mock.calls[0]![0].onAck({ requestId: id, accepted: true });
  vi.advanceTimersByTime(500);
  expect(report).toHaveBeenLastCalledWith(
    expect.objectContaining({ connected: 10, accepted: 1, pending: 4 }),
  );
  fleet.burst();
  expect(
    clients.every((client) => vi.mocked(client.submitAnswer).mock.calls.length === 1),
  ).toBe(true);
  fleet.close();
  expect(
    clients.every((client) => vi.mocked(client.close).mock.calls.length === 1),
  ).toBe(true);
});

it("cancels delayed answers on pause and closes pending connection timers", () => {
  const fleet = createBotFleet(
    "ABCDEFGH",
    [{ playerId: crypto.randomUUID(), secret: "x".repeat(43) }],
    vi.fn(),
  );
  fleet.configure({ auto: true, delayMs: 1000, participation: 100, kart: false });
  vi.advanceTimersByTime(30);
  const options = vi.mocked(openRoomSocket).mock.calls[0]![0];
  const client = vi.mocked(openRoomSocket).mock.results[0]!.value;
  options.onConnection("open");
  options.onSnapshot(playingFixture);
  options.onSnapshot({ ...playingFixture, paused: true });
  vi.advanceTimersByTime(2500);
  expect(client.submitAnswer).not.toHaveBeenCalled();
  options.onSnapshot(playingFixture);
  fleet.configure({ auto: false, delayMs: 1000, participation: 100, kart: false });
  vi.advanceTimersByTime(2500);
  expect(client.submitAnswer).not.toHaveBeenCalled();
  fleet.close();
  const other = createBotFleet(
    "ABCDEFGH",
    Array.from({ length: 100 }, () => ({
      playerId: crypto.randomUUID(),
      secret: "x".repeat(43),
    })),
    vi.fn(),
  );
  other.close();
  vi.advanceTimersByTime(4000);
  expect(openRoomSocket).toHaveBeenCalledTimes(1);
});

it("sends an unanswered bot just before the server deadline and does not double-submit", () => {
  const fleet = createBotFleet(
    "ABCDEFGH",
    [{ playerId: crypto.randomUUID(), secret: "x".repeat(43) }],
    vi.fn(),
  );
  vi.advanceTimersByTime(30);
  const options = vi.mocked(openRoomSocket).mock.calls[0]![0];
  options.onConnection("open");
  options.onSnapshot({ ...playingFixture, serverNow: 1000, deadlineAt: 6000 });
  fleet.deadlineBurst(250);
  const socket = vi.mocked(openRoomSocket).mock.results[0]!.value;
  vi.advanceTimersByTime(4749);
  expect(socket.submitAnswer).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(socket.submitAnswer).toHaveBeenCalledTimes(1);
  fleet.burst();
  expect(socket.submitAnswer).toHaveBeenCalledTimes(1);
  fleet.close();
});

it("fills a freed handshake slot immediately without waiting on a background-tab timer", async () => {
  const sessions = Array.from({ length: 10 }, () => ({
    playerId: crypto.randomUUID(),
    secret: "x".repeat(43),
  }));
  const fleet = createBotFleet("ABCDEFGH", sessions, vi.fn());
  vi.advanceTimersByTime(150);
  expect(openRoomSocket).toHaveBeenCalledTimes(4);
  vi.mocked(openRoomSocket).mock.calls[0]![0].onConnection("open");
  await Promise.resolve();
  expect(openRoomSocket).toHaveBeenCalledTimes(5);
  fleet.close();
});

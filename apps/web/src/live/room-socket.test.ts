import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createKartRace,
  projectKartRace,
  type KartFrame,
  type LobbySnapshot,
} from "@26/shared";
import { roomFixture } from "../admin/room-fixture.test-support";
import {
  applySnapshotPatch,
  mergeKartFrame,
  openRoomSocket,
  reconnectDelay,
} from "./room-socket";

function raceSnapshot(raceId: string, stateVersion = 4): LobbySnapshot {
  const kart = projectKartRace(
    createKartRace(raceId, [{ playerId: "p1", name: "Amina" }]),
    null,
    100,
  );
  return {
    ...roomFixture,
    phase: "collect",
    stateVersion,
    play: { kart, submissionCount: 0 } as unknown as LobbySnapshot["play"],
  };
}

function frame(raceId: string, stateVersion: number): KartFrame {
  const race = createKartRace(raceId, [{ playerId: "p1", name: "Amina" }]);
  race.elapsedMs = 600;
  return {
    kind: "kart",
    scope: "public",
    stateVersion,
    serverNow: 9_000,
    submissionCount: 1,
    kart: projectKartRace(race, null, 100),
  };
}

describe("mergeKartFrame", () => {
  it("replaces the race, finish count and clock and keeps everything else", () => {
    const base = raceSnapshot("race-1");
    const merged = mergeKartFrame(base, frame("race-1", 5));
    if (typeof merged === "string") throw new Error(merged);
    expect(merged.play?.kart?.elapsedMs).toBe(600);
    expect(merged.play?.submissionCount).toBe(1);
    expect(merged.serverNow).toBe(9_000);
    expect(merged.stateVersion).toBe(5);
    expect(merged.joinCode).toBe(base.joinCode);
  });

  it("asks for a snapshot when the phone has none for this race", () => {
    expect(mergeKartFrame(undefined, frame("race-1", 5))).toBe("missing");
    expect(mergeKartFrame(raceSnapshot("race-0"), frame("race-1", 5))).toBe("missing");
  });

  it("ignores a frame older than the snapshot it would replace", () => {
    expect(mergeKartFrame(raceSnapshot("race-1", 9), frame("race-1", 5))).toBe("stale");
  });

  it("cannot rewind elapsed time, restart a finished race or disturb a newer phase", () => {
    const base = raceSnapshot("race-1");
    base.play!.kart!.elapsedMs = 800;
    expect(mergeKartFrame(base, frame("race-1", 4))).toBe("stale");
    base.play!.kart!.elapsedMs = 600;
    base.play!.kart!.ended = true;
    expect(mergeKartFrame(base, frame("race-1", 5))).toBe("stale");
    expect(mergeKartFrame({ ...base, phase: "reveal" }, frame("race-1", 5))).toBe(
      "stale",
    );
    expect(mergeKartFrame(raceSnapshot("race-2", 9), frame("race-1", 5))).toBe("stale");
    expect(
      mergeKartFrame({ ...raceSnapshot("race-1"), paused: true }, frame("race-1", 5)),
    ).toBe("stale");
  });
});

describe("applySnapshotPatch", () => {
  const patch = {
    kind: "patch",
    scope: "public",
    base: "e.1",
    view: "e.2",
    set: {
      players: [{ playerId: crypto.randomUUID(), nickname: "Bilal" }],
      stateVersion: 2,
    },
    unset: [],
  };

  it("applies the changed fields to the view it was built against", () => {
    const next = applySnapshotPatch(roomFixture, "e.1", patch);
    expect(next?.players).toHaveLength(1);
    expect(next?.stateVersion).toBe(2);
    expect(next?.joinCode).toBe(roomFixture.joinCode);
    expect(next?.trolls).toBe(roomFixture.trolls);
    expect(next?.media).toBe(roomFixture.media);
    expect(next?.players).not.toBe(roomFixture.players);
  });

  it("keeps the existing question and players when only the clock changes", () => {
    const next = applySnapshotPatch(roomFixture, "e.1", {
      ...patch,
      set: { serverNow: roomFixture.serverNow + 1000 },
    });
    expect(next?.players).toBe(roomFixture.players);
    expect(next?.play).toBe(roomFixture.play);
    expect(next?.serverNow).toBe(roomFixture.serverNow + 1000);
  });

  it("still removes optional fields and rejects unknown input", () => {
    const next = applySnapshotPatch({ ...roomFixture, highlights: [] }, "e.1", {
      ...patch,
      set: {},
      unset: ["highlights"],
    });
    expect(next).toBeDefined();
    expect(next).not.toHaveProperty("highlights");
    expect(
      applySnapshotPatch(roomFixture, "e.1", {
        ...patch,
        set: { unexpected: "discard me" },
      }),
    ).toBeUndefined();
  });

  it("refuses a patch for a different view", () => {
    expect(applySnapshotPatch(roomFixture, "e.0", patch)).toBeUndefined();
    expect(applySnapshotPatch(undefined, "e.1", patch)).toBeUndefined();
  });

  it("refuses a patch whose result is not a valid snapshot", () => {
    expect(
      applySnapshotPatch(roomFixture, "e.1", {
        ...patch,
        set: {},
        unset: ["joinCode"],
      }),
    ).toBeUndefined();
    expect(
      applySnapshotPatch(roomFixture, "e.1", { ...patch, set: { phase: "nonsense" } }),
    ).toBeUndefined();
  });
});

describe("reconnectDelay", () => {
  it("spreads retries across the whole window and caps at about eight seconds", () => {
    expect(reconnectDelay(0, () => 0)).toBe(100);
    expect(reconnectDelay(0, () => 0.999)).toBeLessThan(400);
    expect(reconnectDelay(10, () => 0.999)).toBeLessThanOrEqual(8_100);
    expect(reconnectDelay(10, () => 0.5)).toBeGreaterThan(3_000);
  });
});

class FakeSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static instances: FakeSocket[] = [];
  readyState = FakeSocket.CONNECTING;
  bufferedAmount = 0;
  sent: string[] = [];
  closed: { code?: number; reason?: string } | null = null;
  private listeners = new Map<string, Set<(event: unknown) => void>>();
  url: string;
  constructor(url: string) {
    this.url = url;
    FakeSocket.instances.push(this);
  }
  addEventListener(type: string, listener: (event: unknown) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.get(type)?.delete(listener);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close(code?: number, reason?: string) {
    this.closed = { code, reason };
    this.readyState = 3;
    this.emit("close", { reason: reason ?? "" });
  }
  open() {
    this.readyState = FakeSocket.OPEN;
    this.emit("open", {});
  }
  emit(type: string, event: unknown) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

describe("openRoomSocket liveness", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeSocket);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function open(role: "guest" | "stage") {
    return openRoomSocket({
      gameId: "ABCDEFGH",
      role,
      onSnapshot: vi.fn(),
      onAck: vi.fn(),
      onReplaced: vi.fn(),
      onConnection: vi.fn(),
    });
  }

  it("replays a recovery with its original request id after reconnecting", () => {
    const client = open("guest");
    const first = FakeSocket.instances[0]!;
    first.open();
    const requestId = client.submitKartRecovery!("race-recovery");
    const command = first.sent.find((value) => value.includes('"kart-recover"'))!;
    expect(JSON.parse(command)).toMatchObject({
      name: "kart-recover",
      raceId: "race-recovery",
      requestId,
    });
    first.close(1006, "");
    window.dispatchEvent(new Event("online"));
    const next = FakeSocket.instances.at(-1)!;
    next.open();
    expect(next.sent).toContain(command);
    client.close();
  });

  it("replays item use with the original request id after reconnecting", () => {
    const client = open("guest"),
      first = FakeSocket.instances[0]!;
    first.open();
    const requestId = client.submitKartItem!("items"),
      command = first.sent.find((s) => s.includes('"kart-use-item"'))!;
    expect(JSON.parse(command)).toMatchObject({
      name: "kart-use-item",
      raceId: "items",
      requestId,
    });
    first.close(1006, "");
    window.dispatchEvent(new Event("online"));
    const next = FakeSocket.instances.at(-1)!;
    next.open();
    expect(next.sent).toContain(command);
    client.close();
  });

  it("does not retain accepted commands for replay, but keeps uncertain ones", () => {
    const client = open("guest");
    const first = FakeSocket.instances[0]!;
    first.open();
    for (let index = 0; index < 200; index++) {
      const requestId = client.submitReaction("player", "like");
      first.emit("message", {
        data: JSON.stringify({
          kind: "ack",
          scope: "private",
          requestId,
          accepted: true,
        }),
      });
    }
    const requestId = client.submitReaction("pending-player", "like");
    first.close(1006, "");
    window.dispatchEvent(new Event("online"));
    const next = FakeSocket.instances.at(-1)!;
    next.open();
    const replayed = next.sent
      .filter((value) => value.includes('"reaction"'))
      .map((value) => JSON.parse(value));
    expect(replayed).toEqual([
      expect.objectContaining({ requestId, targetId: "pending-player" }),
    ]);
    client.close();
  });

  it("closes a stage socket that stops answering pings, then reconnects", () => {
    const client = open("stage");
    FakeSocket.instances[0]!.open();
    vi.advanceTimersByTime(20_000);
    expect(FakeSocket.instances[0]!.sent).toContain("ping");
    vi.advanceTimersByTime(20_000);
    expect(FakeSocket.instances[0]!.closed?.code).toBe(4001);
    vi.advanceTimersByTime(9_000);
    expect(FakeSocket.instances).toHaveLength(2);
    client.close();
  });

  it("keeps a socket that answers its pings", () => {
    const client = open("stage");
    const socket = FakeSocket.instances[0]!;
    socket.open();
    for (let i = 0; i < 4; i += 1) {
      vi.advanceTimersByTime(20_000);
      socket.emit("message", { data: "pong" });
    }
    expect(socket.closed).toBeNull();
    client.close();
  });

  it("reconnects at once when the phone comes back online instead of waiting out the backoff", () => {
    const client = open("guest");
    FakeSocket.instances[0]!.open();
    FakeSocket.instances[0]!.close(1006, "");
    for (let i = 1; i < 6; i += 1) {
      vi.advanceTimersByTime(9_000);
      FakeSocket.instances[i]?.close(1006, "");
    }
    const before = FakeSocket.instances.length;
    window.dispatchEvent(new Event("online"));
    expect(FakeSocket.instances.length).toBe(before + 1);
    client.close();
  });
});

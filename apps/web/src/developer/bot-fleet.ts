import { botSessionsSchema, type BotSession, type LobbySnapshot } from "@26/shared";
import { clientApiHeaders } from "../api/client-key";
import { openRoomSocket } from "../live/room-socket";
import { planBot } from "./bot-plan";

export async function readBotSessions(
  gameId: string,
  signal: AbortSignal,
): Promise<BotSession[]> {
  const response = await fetch(`/api/rooms/${gameId}/bot-sessions`, {
    method: "POST",
    credentials: "same-origin",
    headers: clientApiHeaders(),
    cache: "no-store",
    signal,
  });
  if (!response.ok)
    throw new Error(
      "Bot connections could not be opened. Check room access and try again.",
    );
  return botSessionsSchema.parse(await response.json()).sessions;
}

type Socket = ReturnType<typeof openRoomSocket>;
type Peer = {
  socket?: Socket;
  snapshot?: LobbySnapshot;
  open: boolean;
  attempted: Set<string>;
  timer?: ReturnType<typeof setTimeout>;
  observedAt?: number;
};
export type FleetReport = {
  connected: number;
  accepted: number;
  refused: number;
  pending: number;
  p95Ms: number;
  lastError: string;
};
export const emptyFleetReport: FleetReport = {
  connected: 0,
  accepted: 0,
  refused: 0,
  pending: 0,
  p95Ms: 0,
  lastError: "",
};
export type FleetSettings = {
  auto: boolean;
  delayMs: number;
  participation: number;
  kart: boolean;
};

/** Runs real guest connections through the one existing socket client. Tab lifetime is explicit. */
export function createBotFleet(
  gameId: string,
  sessions: BotSession[],
  report: (value: FleetReport) => void,
) {
  let stopped = false;
  let settings: FleetSettings = {
    auto: false,
    delayMs: 1000,
    participation: 100,
    kart: false,
  };
  let totals = { ...emptyFleetReport };
  const peers = sessions.map((): Peer => ({ open: false, attempted: new Set() }));
  const pending = new Map<string, number>();
  const latencies: number[] = [];
  let sequence = 0;
  const publish = () => {
    const sorted = [...latencies].sort((a, b) => a - b);
    report({
      ...totals,
      connected: peers.filter((peer) => peer.open).length,
      pending: pending.size,
      p95Ms: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0,
    });
  };
  function answer(peer: Peer, ordinal: number) {
    if (!peer.open || !peer.socket || !peer.snapshot) return;
    const plan = planBot(peer.snapshot, ordinal);
    if (!plan || peer.attempted.has(plan.key)) return;
    peer.attempted.add(plan.key);
    // Keep memory bounded over arbitrarily long rehearsals.
    if (peer.attempted.size > 160)
      peer.attempted.delete(peer.attempted.values().next().value!);
    const action = plan.action;
    const id =
      action.name === "answer"
        ? peer.socket.submitAnswer(action.optionId)
        : action.name === "estimate"
          ? peer.socket.submitEstimate(action.value)
          : action.name === "duel"
            ? peer.socket.submitDuel(action.value)
            : action.name === "rank"
              ? peer.socket.submitRank(action.placements)
              : action.name === "text"
                ? peer.socket.submitText(action.body)
                : peer.socket.submitBallot(action.candidateId, action.epoch);
    pending.set(id, performance.now());
  }
  function schedule(peer: Peer, ordinal: number) {
    if (
      !settings.auto ||
      ordinal >= Math.ceil((peers.length * settings.participation) / 100) ||
      peer.timer ||
      !peer.snapshot ||
      !peer.open
    )
      return;
    const plan = planBot(peer.snapshot, ordinal);
    if (!plan || peer.attempted.has(plan.key)) return;
    peer.timer = setTimeout(
      () => {
        peer.timer = undefined;
        if (!stopped && settings.auto) answer(peer, ordinal);
      },
      settings.delayMs + ((ordinal * 137) % Math.max(1, settings.delayMs)),
    );
  }
  // Browsers throttle large numbers of pending WebSocket handshakes. Keep only
  // four in flight, while retaining an independent real connection for each bot.
  let nextConnection = 0;
  const opening = new Set<number>();
  function connectNext() {
    if (stopped || nextConnection >= sessions.length) {
      clearInterval(ramp);
      return;
    }
    if (opening.size >= 4) return;
    const ordinal = nextConnection++;
    const session = sessions[ordinal]!;
    const peer = peers[ordinal]!;
    opening.add(ordinal);
    peer.socket = openRoomSocket({
      gameId,
      role: "guest",
      botSession: session,
      onSnapshot(snapshot) {
        peer.snapshot = snapshot;
        peer.observedAt = performance.now();
        schedule(peer, ordinal);
      },
      onConnection(state) {
        peer.open = state === "open";
        if (state === "connecting") opening.add(ordinal);
        else {
          opening.delete(ordinal);
          queueMicrotask(connectNext);
        }
      },
      onReplaced(message) {
        opening.delete(ordinal);
        peer.open = false;
        totals.lastError = message;
      },
      onAck(ack) {
        const began = pending.get(ack.requestId);
        if (began === undefined) return;
        pending.delete(ack.requestId);
        latencies.push(Math.round(performance.now() - began));
        if (latencies.length > 1000) latencies.shift();
        if (ack.accepted) totals.accepted++;
        else {
          totals.refused++;
          totals.lastError = ack.error ?? "Answer refused.";
        }
      },
    });
  }
  const ramp = setInterval(connectNext, 30);
  const tick = setInterval(() => {
    if (stopped || !settings.auto || !settings.kart) return;
    sequence++;
    for (const [ordinal, peer] of peers.entries()) {
      const snapshot = peer.snapshot;
      const race = snapshot?.play?.kart;
      if (
        !peer.open ||
        !race ||
        snapshot?.phase !== "collect" ||
        snapshot.paused ||
        snapshot.held ||
        race.ended ||
        ordinal >= Math.ceil((peers.length * settings.participation) / 100)
      )
        continue;
      if (
        !race.participants.some(
          (driver) =>
            driver.playerId === sessions[ordinal]!.playerId &&
            driver.status === "RACING",
        )
      )
        continue;
      peer.socket?.submitKartInput({
        raceId: race.raceId,
        sequence,
        steer: ordinal % 3 === 0 ? 0.24 : -0.1,
        gas: true,
        brake: false,
        drift: false,
      });
    }
  }, 100);
  const repaint = setInterval(publish, 500);
  publish();
  return {
    configure(next: FleetSettings) {
      settings = next;
      peers.forEach((peer, ordinal) => {
        if (peer.timer) clearTimeout(peer.timer);
        peer.timer = undefined;
        schedule(peer, ordinal);
      });
    },
    burst() {
      peers.forEach((peer, ordinal) => answer(peer, ordinal));
      publish();
    },
    deadlineBurst(leadMs = 250) {
      peers.forEach((peer, ordinal) => {
        if (peer.timer) clearTimeout(peer.timer);
        const state = peer.snapshot;
        if (!state || state.deadlineAt == null || state.paused || state.held) return;
        const remaining =
          state.deadlineAt -
          state.serverNow -
          (performance.now() - (peer.observedAt ?? performance.now()));
        peer.timer = setTimeout(
          () => {
            peer.timer = undefined;
            if (!stopped) answer(peer, ordinal);
          },
          Math.max(0, remaining - leadMs),
        );
      });
    },
    resetMetrics() {
      totals = { ...emptyFleetReport };
      latencies.length = 0;
      publish();
    },
    close() {
      stopped = true;
      clearInterval(ramp);
      clearInterval(tick);
      clearInterval(repaint);
      peers.forEach((peer) => {
        if (peer.timer) clearTimeout(peer.timer);
        peer.socket?.close();
        peer.open = false;
      });
      pending.clear();
      publish();
    },
  };
}

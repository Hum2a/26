import { withClientApiKey } from "../api/client-key.ts";
import {
  lobbySnapshotSchema,
  movedSessionMessage,
  newerTabMessage,
  removedSessionMessage,
  publicVersionNeedsSnapshot,
  type LobbySnapshot,
} from "@26/shared";
import {
  noteRtt,
  noteSubmissionRetries,
  takeConnectionDelta,
} from "../device/connection-log";
import { readDeviceReport } from "../device/source";

export type RoomSocketRole = "guest" | "stage" | "control";

type CommandBody =
  | { kind: "command"; requestId: string; name: "snapshot" }
  | { kind: "command"; requestId: string; name: "answer"; optionId: string }
  | { kind: "command"; requestId: string; name: "estimate"; value: number }
  | {
      kind: "command";
      requestId: string;
      name: "rank";
      placements: { itemId: string; tierId: string }[];
    }
  | { kind: "command"; requestId: string; name: "text"; body: string }
  | { kind: "command"; requestId: string; name: "ballot"; candidateId: string }
  | { kind: "command"; requestId: string; name: "duel"; value: number }
  | {
      kind: "command";
      requestId: string;
      name: "troll";
      effect: string;
      targetId: string;
      mediaId?: string;
    }
  | { kind: "command"; requestId: string; name: "troll-escape"; effectId: string }
  | {
      kind: "command";
      requestId: string;
      name: "react";
      targetId: string;
      reaction: "like" | "dislike";
    };

type TrackedCommand = {
  state: "pending" | "sent" | "accepted";
  body: CommandBody;
};

/**
 * The only WebSocket client. Reconnect waits with jitter, replaces lobby
 * state from snapshots, and drops listeners when the socket closes.
 */
export function openRoomSocket(options: {
  gameId: string;
  role: RoomSocketRole;
  onSnapshot: (snapshot: LobbySnapshot) => void;
  onAck: (ack: { requestId: string; accepted: boolean; error?: string }) => void;
  onReplaced: (message: string) => void;
  onConnection: (state: "connecting" | "open" | "closed") => void;
}): {
  requestSnapshot: () => string;
  submitAnswer: (optionId: string) => string;
  submitEstimate: (value: number) => string;
  submitRank: (placements: { itemId: string; tierId: string }[]) => string;
  submitText: (body: string) => string;
  submitBallot: (candidateId: string) => string;
  submitDuel: (value: number) => string;
  submitTroll: (kind: string, targetId: string, mediaId?: string) => string;
  submitDraft: (text: string) => void;
  submitTrollEscape: (effectId: string) => string;
  submitReaction: (targetId: string, reaction: "like" | "dislike") => string;
  close: () => void;
} {
  let socket: WebSocket | undefined;
  let stopped = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastStateVersion = 0;
  const tracked = new Map<string, TrackedCommand>();
  let draftTimer: ReturnType<typeof setTimeout> | undefined;
  let draftPending = "";
  let pingTimer: ReturnType<typeof setInterval> | undefined;
  let summaryTimer: ReturnType<typeof setInterval> | undefined;
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  let pingSentAt = 0;
  let lastPhase = "";

  function clearTimer() {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  function clearHeartbeat() {
    if (pingTimer !== undefined) {
      clearInterval(pingTimer);
      pingTimer = undefined;
    }
    if (summaryTimer !== undefined) {
      clearInterval(summaryTimer);
      summaryTimer = undefined;
    }
    if (resizeTimer !== undefined) {
      clearTimeout(resizeTimer);
      resizeTimer = undefined;
    }
    pingSentAt = 0;
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    }
  }

  function startHeartbeat() {
    clearHeartbeat();
    pingTimer = setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        pingSentAt = Date.now();
        socket.send("ping");
      }
    }, 20_000);
    summaryTimer = setInterval(() => sendConnection(), 60_000);
    if (typeof window !== "undefined") {
      window.addEventListener("resize", onResize);
      window.addEventListener("orientationchange", onResize);
    }
  }

  function onResize() {
    if (resizeTimer !== undefined) {
      clearTimeout(resizeTimer);
    }
    resizeTimer = setTimeout(() => {
      resizeTimer = undefined;
      sendDevice("interval");
    }, 2_000);
  }

  function sendDevice(reason: "initial" | "phase" | "interval") {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(
      JSON.stringify({
        kind: "command",
        requestId: crypto.randomUUID(),
        name: "device",
        reason,
        report: readDeviceReport(),
      }),
    );
  }

  function sendConnection() {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    const delta = takeConnectionDelta();
    if (!delta) {
      return;
    }
    socket.send(
      JSON.stringify({
        kind: "command",
        requestId: crypto.randomUUID(),
        name: "connection",
        ...delta,
      }),
    );
  }

  function detach(current: WebSocket) {
    current.removeEventListener("open", onOpen);
    current.removeEventListener("message", onMessage);
    current.removeEventListener("close", onClose);
  }

  function connect() {
    if (stopped) {
      return;
    }
    options.onConnection("connecting");
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const current = new WebSocket(
      withClientApiKey(
        `${protocol}//${location.host}/ws/${options.gameId}?role=${options.role}`,
      ),
    );
    socket = current;
    current.addEventListener("open", onOpen);
    current.addEventListener("message", onMessage);
    current.addEventListener("close", onClose);
  }

  function onOpen() {
    options.onConnection("open");
    let resent = 0;
    for (const command of tracked.values()) {
      if (
        command.state !== "accepted" &&
        socket &&
        socket.readyState === WebSocket.OPEN
      ) {
        if (command.state === "sent") {
          resent += 1;
        }
        command.state = "sent";
        socket.send(JSON.stringify(command.body));
      }
    }
    noteSubmissionRetries(resent);
    attempt = 0;
    if (options.role === "guest") {
      sendDevice("initial");
      startHeartbeat();
    }
  }

  function onMessage(event: MessageEvent) {
    if (event.data === "pong") {
      if (pingSentAt > 0) {
        noteRtt(Date.now() - pingSentAt);
        pingSentAt = 0;
      }
      return;
    }
    let body: unknown;
    try {
      body = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (!body || typeof body !== "object") {
      return;
    }
    const record = body as Record<string, unknown>;
    if (record.kind === "replaced" && typeof record.message === "string") {
      stop(record.message);
      return;
    }
    if (
      record.kind === "ack" &&
      record.scope === "private" &&
      typeof record.requestId === "string"
    ) {
      const command = tracked.get(record.requestId);
      if (command && record.accepted === true) {
        command.state = "accepted";
      }
      options.onAck({
        requestId: record.requestId,
        accepted: record.accepted === true,
        error: typeof record.error === "string" ? record.error : undefined,
      });
      return;
    }
    if (
      record.kind === "version" &&
      record.scope === "public" &&
      typeof record.stateVersion === "number"
    ) {
      if (publicVersionNeedsSnapshot(lastStateVersion, record.stateVersion)) {
        requestSnapshot();
      }
      return;
    }
    if (record.kind !== "snapshot" || record.scope !== "public") {
      return;
    }
    const snapshot = lobbySnapshotSchema.safeParse(record.snapshot);
    if (!snapshot.success) {
      return;
    }
    const previous = lastStateVersion;
    lastStateVersion = snapshot.data.stateVersion;
    if (options.role === "guest" && snapshot.data.phase !== lastPhase) {
      lastPhase = snapshot.data.phase;
      sendDevice("phase");
      sendConnection();
    }
    options.onSnapshot(snapshot.data);
    if (publicVersionNeedsSnapshot(previous, snapshot.data.stateVersion)) {
      return;
    }
  }

  function onClose(event: CloseEvent) {
    clearHeartbeat();
    if (socket) {
      detach(socket);
    }
    if (
      event.reason === newerTabMessage ||
      event.reason === movedSessionMessage ||
      event.reason === removedSessionMessage
    ) {
      stop(event.reason);
      return;
    }
    options.onConnection("closed");
    if (!stopped) {
      const delay =
        Math.min(8000, 200 * 2 ** attempt) + Math.floor(Math.random() * 200);
      attempt += 1;
      timer = setTimeout(connect, delay);
    }
  }

  function stop(message: string) {
    stopped = true;
    clearTimer();
    clearHeartbeat();
    options.onReplaced(message);
    options.onConnection("closed");
    if (socket) {
      detach(socket);
      socket.close();
    }
  }

  function sendCommand(body: CommandBody): string {
    const open = socket !== undefined && socket.readyState === WebSocket.OPEN;
    tracked.set(body.requestId, { state: open ? "sent" : "pending", body });
    if (open) {
      socket?.send(JSON.stringify(body));
    }
    return body.requestId;
  }

  function requestSnapshot(): string {
    return sendCommand({
      kind: "command",
      requestId: crypto.randomUUID(),
      name: "snapshot",
    });
  }

  function submitAnswer(optionId: string): string {
    return sendCommand({
      kind: "command",
      requestId: crypto.randomUUID(),
      name: "answer",
      optionId,
    });
  }

  function submitEstimate(value: number): string {
    return sendCommand({
      kind: "command",
      requestId: crypto.randomUUID(),
      name: "estimate",
      value,
    });
  }

  function submitRank(placements: { itemId: string; tierId: string }[]): string {
    return sendCommand({
      kind: "command",
      requestId: crypto.randomUUID(),
      name: "rank",
      placements,
    });
  }

  function submitText(body: string): string {
    return sendCommand({
      kind: "command",
      requestId: crypto.randomUUID(),
      name: "text",
      body,
    });
  }

  function submitTroll(kind: string, targetId: string, mediaId?: string): string {
    return sendCommand({
      kind: "command",
      requestId: crypto.randomUUID(),
      name: "troll",
      effect: kind,
      targetId,
      ...(mediaId ? { mediaId } : {}),
    });
  }

  function submitDraft(text: string): void {
    draftPending = text.slice(0, 80);
    if (draftPending === "") {
      if (draftTimer !== undefined) {
        clearTimeout(draftTimer);
        draftTimer = undefined;
      }
      sendDraft("");
      return;
    }
    if (draftTimer !== undefined) {
      return;
    }
    draftTimer = setTimeout(() => {
      draftTimer = undefined;
      sendDraft(draftPending);
    }, 200);
  }

  function sendDraft(text: string): void {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ kind: "command", name: "draft", text }));
    }
  }

  function submitTrollEscape(effectId: string): string {
    return sendCommand({
      kind: "command",
      requestId: crypto.randomUUID(),
      name: "troll-escape",
      effectId,
    });
  }

  function submitDuel(value: number): string {
    return sendCommand({
      kind: "command",
      requestId: crypto.randomUUID(),
      name: "duel",
      value,
    });
  }

  function submitBallot(candidateId: string): string {
    return sendCommand({
      kind: "command",
      requestId: crypto.randomUUID(),
      name: "ballot",
      candidateId,
    });
  }

  function submitReaction(targetId: string, reaction: "like" | "dislike"): string {
    return sendCommand({
      kind: "command",
      requestId: crypto.randomUUID(),
      name: "react",
      targetId,
      reaction,
    });
  }

  function close() {
    stopped = true;
    clearTimer();
    if (socket) {
      detach(socket);
      socket.close();
      socket = undefined;
    }
  }

  connect();
  return {
    requestSnapshot,
    submitAnswer,
    submitEstimate,
    submitRank,
    submitText,
    submitBallot,
    submitDuel,
    submitTroll,
    submitDraft,
    submitTrollEscape,
    submitReaction,
    close,
  };
}

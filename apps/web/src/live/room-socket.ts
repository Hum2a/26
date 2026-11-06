import { withClientApiKey, noteMediaDisplayRevision } from "../api/client-key.ts";
import {
  kartFrameSchema,
  lobbySnapshotSchema,
  movedSessionMessage,
  newerTabMessage,
  removedSessionMessage,
  type LobbySnapshot,
  type KartFrame,
  type KartInput,
  type DriverStyle,
  type WallFrame,
  type WallReaction,
} from "@26/shared";
import {
  noteRtt,
  noteSubmissionRetries,
  takeConnectionDelta,
} from "../device/connection-log";
import { readDeviceReport } from "../device/source";
import { noteServerTime } from "./server-clock";

export type RoomSocketRole = "guest" | "stage" | "control";

const heartbeatMs = 20_000;
/** Round trips taken on connect, so the clock is right before the first question. */
const timeProbesOnOpen = 5;
/** A ping with no pong by the next heartbeat means the socket is dead. */
const staleAfterMs = 15_000;
/** After waking, a socket that cannot answer within this is replaced. */
const wakeProbeMs = 4_000;

/**
 * Full jitter: a random wait up to the capped exponential. When the venue
 * Wi-Fi drops, eighty phones spread their retries instead of arriving together.
 */
export function reconnectDelay(attempt: number, random = Math.random): number {
  return Math.floor(random() * Math.min(8_000, 250 * 2 ** attempt)) + 100;
}

/**
 * A race tick replaces only the race, its finish count and the clock in the
 * last full snapshot. "missing" means the phone needs a full snapshot first.
 */
export function mergeKartFrame(
  snapshot: LobbySnapshot | undefined,
  frame: KartFrame,
): LobbySnapshot | "missing" | "stale" {
  const play = snapshot?.play;
  if (snapshot && frame.stateVersion < snapshot.stateVersion) return "stale";
  if (!snapshot || !play?.kart || play.kart.raceId !== frame.kart.raceId) {
    return "missing";
  }
  if (
    snapshot.phase !== "collect" ||
    snapshot.paused ||
    snapshot.held ||
    (play.kart.ended && !frame.kart.ended) ||
    frame.kart.elapsedMs < play.kart.elapsedMs
  ) {
    return "stale";
  }
  return {
    ...snapshot,
    serverNow: frame.serverNow,
    stateVersion: frame.stateVersion,
    play: { ...play, kart: frame.kart, submissionCount: frame.submissionCount },
  };
}

/**
 * Applies the fields that changed since the view this screen holds. The result
 * is validated as a whole snapshot; anything off returns undefined and the
 * screen asks for a full snapshot instead.
 */
export function applySnapshotPatch(
  snapshot: LobbySnapshot | undefined,
  view: string | undefined,
  patch: Record<string, unknown>,
): LobbySnapshot | undefined {
  if (
    !snapshot ||
    !view ||
    patch.base !== view ||
    typeof patch.view !== "string" ||
    !patch.set ||
    typeof patch.set !== "object" ||
    !Array.isArray(patch.unset)
  ) {
    return undefined;
  }
  const next: Record<string, unknown> = { ...snapshot, ...(patch.set as object) };
  for (const key of patch.unset) {
    if (typeof key === "string") delete next[key];
  }
  const parsed = lobbySnapshotSchema.safeParse(next);
  if (!parsed.success) return undefined;
  // Zod clones nested data. Unchanged fields already came from a validated view;
  // retain their identities so a clock/count patch does not redraw every player,
  // photo and question control. Changed fields still use the validated result.
  const result = parsed.data;
  for (const key of Object.keys(snapshot) as (keyof LobbySnapshot)[]) {
    if (!Object.hasOwn(patch.set, key) && Object.hasOwn(result, key)) {
      Object.assign(result, { [key]: snapshot[key] });
    }
  }
  return result;
}

/**
 * Development only: `window.__26.dropSockets()` closes every room socket in
 * this tab, so a rehearsal can check the reconnect path.
 */
function registerDebugDrop(drop: () => void): (() => void) | undefined {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return undefined;
  }
  const host = window as unknown as {
    __26?: { drops: Set<() => void>; dropSockets: () => void };
  };
  host.__26 ??= {
    drops: new Set(),
    dropSockets() {
      for (const each of host.__26?.drops ?? []) each();
    },
  };
  host.__26.drops.add(drop);
  return () => host.__26?.drops.delete(drop);
}

type CommandBody =
  | {
      kind: "command";
      requestId: string;
      name: "kart-recover" | "kart-use-item";
      raceId: string;
    }
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
    }
  | {
      kind: "command";
      requestId: string;
      name: "wall-post";
      mediaId: string;
      caption: string;
      frame: WallFrame;
      keep: boolean;
    }
  | { kind: "command"; requestId: string; name: "wall-withdraw"; postId: string }
  | {
      kind: "command";
      requestId: string;
      name: "wall-react";
      postId: string;
      reaction: WallReaction;
    }
  | {
      kind: "command";
      requestId: string;
      name: "driver";
      style: DriverStyle;
      faceMediaId: string | null;
    };

type TrackedCommand = {
  state: "pending" | "sent";
  body: CommandBody;
};

/**
 * The only WebSocket client. Reconnect waits with jitter, replaces lobby
 * state from snapshots, and drops listeners when the socket closes.
 */
export function openRoomSocket(options: {
  gameId: string;
  /** Admin-issued synthetic guest only; never written to a URL or browser storage. */
  botSession?: { playerId: string; secret: string };
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
  submitBallot: (candidateId: string, epoch?: number) => string;
  submitDuel: (value: number) => string;
  submitTroll: (kind: string, targetId: string, mediaId?: string) => string;
  submitDraft: (text: string) => void;
  submitKartInput: (input: KartInput) => void;
  submitKartRecovery?: (raceId: string) => string;
  submitKartItem?: (raceId: string) => string;
  submitTrollEscape: (effectId: string) => string;
  submitReaction: (targetId: string, reaction: "like" | "dislike") => string;
  submitDriver: (style: DriverStyle, faceMediaId: string | null) => string;
  submitWallPost: (post: {
    mediaId: string;
    caption: string;
    frame: WallFrame;
    keep: boolean;
  }) => string;
  submitWallWithdraw: (postId: string) => string;
  submitWallReact: (postId: string, reaction: WallReaction) => string;
  reconnectNow: () => void;
  close: () => void;
} {
  let socket: WebSocket | undefined;
  let stopped = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastSnapshot: LobbySnapshot | undefined;
  let lastView: string | undefined;
  let snapshotRequested = false;
  const tracked = new Map<string, TrackedCommand>();
  let draftTimer: ReturnType<typeof setTimeout> | undefined;
  let draftPending = "";
  let pingTimer: ReturnType<typeof setInterval> | undefined;
  let summaryTimer: ReturnType<typeof setInterval> | undefined;
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  let pingSentAt = 0;
  let wakeCheck: ReturnType<typeof setTimeout> | undefined;
  let timeProbes: ReturnType<typeof setTimeout>[] = [];
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
    timeProbes.forEach((probeTimer) => clearTimeout(probeTimer));
    timeProbes = [];
    pingSentAt = 0;
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    }
  }

  function startHeartbeat() {
    clearHeartbeat();
    pingTimer = setInterval(probe, heartbeatMs);
    if (options.role !== "guest") {
      return;
    }
    summaryTimer = setInterval(() => sendConnection(), 60_000);
    if (typeof window !== "undefined") {
      window.addEventListener("resize", onResize);
      window.addEventListener("orientationchange", onResize);
    }
  }

  /**
   * A sleeping phone or a dropped access point can leave a socket that still
   * says OPEN but delivers nothing. An unanswered ping closes it so the
   * reconnect path runs.
   */
  function probe() {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    if (pingSentAt > 0 && Date.now() - pingSentAt >= staleAfterMs) {
      socket.close(4001, "No reply from the room.");
      return;
    }
    if (pingSentAt === 0) {
      pingSentAt = Date.now();
      socket.send("ping");
    }
    sendTimeProbe();
  }

  function sendTimeProbe() {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(`time:${Date.now()}`);
    }
  }

  /** Release controls immediately when the browser reports signal loss. */
  function onOffline() {
    if (stopped) return;
    clearTimer();
    clearHeartbeat();
    const previous = socket;
    socket = undefined;
    if (previous) {
      detach(previous);
      previous.close();
    }
    options.onConnection("closed");
  }

  function onWake(event: Event) {
    if (
      stopped ||
      (typeof document !== "undefined" && document.hidden && event.type !== "online")
    ) {
      return;
    }
    if (socket && socket.readyState === WebSocket.OPEN) {
      const current = socket;
      pingSentAt = Date.now();
      current.send("ping");
      clearTimeout(wakeCheck);
      wakeCheck = setTimeout(() => {
        if (socket === current && pingSentAt > 0) {
          current.close(4001, "No reply from the room.");
        }
      }, wakeProbeMs);
      return;
    }
    if (
      socket &&
      socket.readyState === WebSocket.CONNECTING &&
      event.type !== "online"
    ) {
      return;
    }
    reconnectNow();
  }

  function reconnectNow() {
    if (stopped) {
      return;
    }
    clearTimer();
    attempt = 0;
    if (socket && socket.readyState === WebSocket.OPEN) {
      return;
    }
    if (socket) {
      detach(socket);
      socket.close();
    }
    connect();
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
    if (options.botSession) return;
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
    if (options.botSession) return;
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
    const resume = lastView ? `&since=${encodeURIComponent(lastView)}` : "";
    const current = new WebSocket(
      withClientApiKey(
        `${protocol}//${location.host}/ws/${options.gameId}?role=${options.role}&patches=1&kartItems=2${resume}`,
      ),
      options.botSession
        ? [`26-bot.${options.botSession.playerId}.${options.botSession.secret}`]
        : undefined,
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
      if (socket && socket.readyState === WebSocket.OPEN) {
        if (command.state === "sent") {
          resent += 1;
        }
        command.state = "sent";
        socket.send(JSON.stringify(command.body));
      }
    }
    if (!options.botSession) noteSubmissionRetries(resent);
    attempt = 0;
    startHeartbeat();
    for (let index = 0; index < timeProbesOnOpen; index += 1) {
      timeProbes.push(setTimeout(sendTimeProbe, index * 250));
    }
    if (options.role === "guest") {
      sendDevice("initial");
    }
  }

  function onMessage(event: MessageEvent) {
    if (event.data === "pong") {
      if (pingSentAt > 0) {
        if (!options.botSession) noteRtt(Date.now() - pingSentAt);
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
    if (
      record.kind === "time" &&
      typeof record.sentAt === "number" &&
      typeof record.serverNow === "number"
    ) {
      if (!options.botSession)
        noteServerTime(record.sentAt, record.serverNow, Date.now());
      return;
    }
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
        tracked.delete(record.requestId);
      }
      options.onAck({
        requestId: record.requestId,
        accepted: record.accepted === true,
        error: typeof record.error === "string" ? record.error : undefined,
      });
      return;
    }
    if (record.kind === "kart" && record.scope === "public") {
      applyKartFrame(record);
      return;
    }
    if (record.kind === "patch" && record.scope === "public") {
      const patched = applySnapshotPatch(lastSnapshot, lastView, record);
      if (!patched) {
        // The base is not what this screen holds. Start again from a full view.
        lastView = undefined;
        if (!snapshotRequested) {
          snapshotRequested = true;
          requestSnapshot();
        }
        return;
      }
      acceptSnapshot(patched, record.view);
      return;
    }
    if (record.kind !== "snapshot" || record.scope !== "public") {
      return;
    }
    const snapshot = lobbySnapshotSchema.safeParse(record.snapshot);
    if (!snapshot.success) {
      return;
    }
    acceptSnapshot(snapshot.data, record.view);
  }

  function acceptSnapshot(snapshot: LobbySnapshot, view: unknown) {
    noteMediaDisplayRevision(snapshot.gameId, snapshot.mediaDisplayRevision);
    lastView = typeof view === "string" ? view : undefined;
    lastSnapshot = snapshot;
    snapshotRequested = false;
    if (options.role === "guest" && snapshot.phase !== lastPhase) {
      lastPhase = snapshot.phase;
      sendDevice("phase");
      sendConnection();
    }
    options.onSnapshot(snapshot);
  }

  function applyKartFrame(record: Record<string, unknown>) {
    const frame = kartFrameSchema.safeParse(record);
    const merged = frame.success ? mergeKartFrame(lastSnapshot, frame.data) : "missing";
    if (merged === "missing") {
      if (!snapshotRequested) {
        snapshotRequested = true;
        requestSnapshot();
      }
      return;
    }
    if (merged === "stale") {
      return;
    }
    lastSnapshot = merged;
    options.onSnapshot(merged);
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
      timer = setTimeout(connect, reconnectDelay(attempt));
      attempt += 1;
    }
  }

  function stop(message: string) {
    stopped = true;
    clearTimer();
    clearHeartbeat();
    removeWakeListeners();
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

  function submitKartInput(input: KartInput): void {
    if (socket?.readyState === WebSocket.OPEN && socket.bufferedAmount < 8192)
      socket.send(
        JSON.stringify({
          kind: "command",
          name: "kart-input",
          requestId: crypto.randomUUID(),
          input,
        }),
      );
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

  function submitBallot(candidateId: string, epoch?: number): string {
    return sendCommand({
      kind: "command",
      requestId: crypto.randomUUID(),
      name: "ballot",
      candidateId,
      ...(epoch === undefined ? {} : { epoch }),
    });
  }

  function submitDriver(style: DriverStyle, faceMediaId: string | null): string {
    return sendCommand({
      kind: "command",
      requestId: crypto.randomUUID(),
      name: "driver",
      style,
      faceMediaId,
    });
  }

  function submitWallPost(post: {
    mediaId: string;
    caption: string;
    frame: WallFrame;
    keep: boolean;
  }): string {
    return sendCommand({
      kind: "command",
      requestId: crypto.randomUUID(),
      name: "wall-post",
      ...post,
    });
  }

  function submitWallWithdraw(postId: string): string {
    return sendCommand({
      kind: "command",
      requestId: crypto.randomUUID(),
      name: "wall-withdraw",
      postId,
    });
  }

  function submitWallReact(postId: string, reaction: WallReaction): string {
    return sendCommand({
      kind: "command",
      requestId: crypto.randomUUID(),
      name: "wall-react",
      postId,
      reaction,
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
    clearHeartbeat();
    removeWakeListeners();
    if (socket) {
      detach(socket);
      socket.close();
      socket = undefined;
    }
  }

  function removeWakeListeners() {
    clearTimeout(wakeCheck);
    unregisterDebug?.();
    if (typeof window === "undefined") {
      return;
    }
    window.removeEventListener("online", onWake);
    window.removeEventListener("offline", onOffline);
    window.removeEventListener("pageshow", onWake);
    document.removeEventListener("visibilitychange", onWake);
  }

  if (typeof window !== "undefined") {
    window.addEventListener("online", onWake);
    window.addEventListener("offline", onOffline);
    window.addEventListener("pageshow", onWake);
    document.addEventListener("visibilitychange", onWake);
  }
  const unregisterDebug = registerDebugDrop(() =>
    socket?.close(4002, "Dropped for a rehearsal."),
  );
  connect();
  return {
    reconnectNow,
    requestSnapshot,
    submitAnswer,
    submitEstimate,
    submitRank,
    submitText,
    submitBallot,
    submitDuel,
    submitTroll,
    submitDraft,
    submitKartInput,
    submitKartRecovery: (raceId: string) =>
      sendCommand({
        kind: "command",
        requestId: crypto.randomUUID(),
        name: "kart-recover",
        raceId,
      }),
    submitKartItem: (raceId: string) =>
      sendCommand({
        kind: "command",
        requestId: crypto.randomUUID(),
        name: "kart-use-item",
        raceId,
      }),
    submitTrollEscape,
    submitReaction,
    submitDriver,
    submitWallPost,
    submitWallWithdraw,
    submitWallReact,
    close,
  };
}

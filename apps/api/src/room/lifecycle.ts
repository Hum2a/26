/**
 * Phase graph for every round. A plugin chooses whether `vote` is included.
 * Host commands cannot name an arbitrary phase.
 */
import type { BirthdayScript } from "../questions/birthday-order.ts";
export const roomPhases = [
  "lobby",
  "intro",
  "prompt",
  "predict",
  "collect",
  "vote",
  "reveal",
  "scores",
  "final",
  "facts",
  "podium",
] as const;

export type RoomPhase = (typeof roomPhases)[number];

export const roundPhases = [
  "intro",
  "prompt",
  "predict",
  "collect",
  "vote",
  "reveal",
  "scores",
] as const;

export type RoundPhase = (typeof roundPhases)[number];

export type JobType = "gameplay" | "background";
export type JobStatus = "pending" | "done" | "cancelled" | "failed";

/** Background wakeup for the Neon archive. The alarm leaves this job pending. */
export const archiveExportPayload = "archive-export";
export const archiveExportJobId = "archive-export";
/** Background wakeup that deletes archived device detail after its retain-until. */
export const archiveRetainPayload = "archive-retain";
export const archiveRetainJobId = "archive-retain";
/** Background wakeup that moves the photo wall on. Job id and payload match. */
export const wallAdvancePayload = "wall-advance";

export type ScheduledJob = {
  jobId: string;
  jobType: JobType;
  dueAt: number | null;
  remainingMs: number | null;
  scopeGeneration: number;
  phaseGeneration: number;
  phase: RoomPhase | null;
  status: JobStatus;
  retryCount: number;
  payload: string;
  createdAt: number;
};

export type RoundResource = {
  resourceId: string;
  roundId: string;
  phaseGeneration: number;
  releasedAt: number | null;
};

export type RoomClock = {
  phase: RoomPhase;
  phaseGeneration: number;
  scopeGeneration: number;
  paused: boolean;
  controllerPresent: boolean;
  stagePresent: boolean;
  hold: "controller" | null;
  roundId: string | null;
  phases: RoomPhase[];
  durations: Partial<Record<RoomPhase, number>>;
  fault: "enter" | null;
  questionIndex: number;
  questionCount: number;
  collectWindows: number[];
  finishAfterRound: boolean;
  /** Which fun-fact sentence the room is showing. Zero until the facts phase. */
  funFactIndex: number;
  /** Stored content version. `unreleased` is the lobby before a pack is chosen. */
  questionSetVersion: string;
  /** Server-only immutable script captured when an administrator starts a birthday game. */
  questionScript?: BirthdayScript;
};

export type GameStore = {
  readRoom(): RoomClock;
  writeRoom(room: RoomClock): void;
  casRoom(expectedGeneration: number, next: RoomClock): boolean;
  jobs(): ScheduledJob[];
  saveJob(job: ScheduledJob): void;
  resources(): RoundResource[];
  saveResource(resource: RoundResource): void;
  hasAnswer(playerId: string, phaseGeneration: number): boolean;
  saveAnswer(playerId: string, phaseGeneration: number, at: number): void;
  onEnterPhase?(room: RoomClock, now: number): void;
  nextPhaseOverride?(room: RoomClock, now: number): RoomPhase | undefined;
  /** How many fun-fact sentences this room can show. Absent on stores that do not play them. */
  funFactCount?(): number;
  nextQuestionIndex?(room: RoomClock): number | "final";
  onScheduledJob?(job: ScheduledJob, now: number): void;
  onBackgroundJob?(job: ScheduledJob, now: number): void;
};

export function isTrollPayload(payload: string): boolean {
  return payload.startsWith("effect:") || payload.startsWith("cue:");
}

export function isRoundJobPayload(payload: string): boolean {
  return isTrollPayload(payload) || payload === "kart-tick";
}

export type RoundPlugin = {
  kind: string;
  phases: readonly RoundPhase[];
  durations: Partial<Record<RoomPhase, number>>;
  questionCount?: number;
  collectWindows?: number[];
};

export const defaultFixtureDurations: Record<RoundPhase | "final", number> = {
  intro: 30_000,
  prompt: 30_000,
  predict: 20_000,
  collect: 30_000,
  vote: 30_000,
  reveal: 20_000,
  scores: 15_000,
  final: 20_000,
};

const maxScheduleRetries = 6;

export function fixturePlugin(options?: {
  includeVote?: boolean;
  durations?: Partial<Record<RoomPhase, number>>;
}): RoundPlugin {
  const phases: RoundPhase[] = ["intro", "prompt", "collect"];
  if (options?.includeVote !== false) {
    phases.push("vote");
  }
  phases.push("reveal", "scores");
  return {
    kind: "fixture",
    phases,
    durations: { ...defaultFixtureDurations, ...options?.durations },
  };
}

export function assertRoundPhases(phases: readonly RoomPhase[]): void {
  const required: RoomPhase[] = ["intro", "prompt", "collect", "reveal", "scores"];
  let cursor = 0;
  for (const phase of phases) {
    const legal = roundPhases.indexOf(phase as RoundPhase);
    if (legal < cursor || !roundPhases.includes(phase as RoundPhase)) {
      throw new Error("This round uses a phase the game does not allow.");
    }
    cursor = legal + 1;
  }
  for (const phase of required) {
    if (!phases.includes(phase)) {
      throw new Error("This round is missing a required phase.");
    }
  }
  if (phases.includes("vote")) {
    const collect = phases.indexOf("collect");
    const vote = phases.indexOf("vote");
    const reveal = phases.indexOf("reveal");
    if (!(collect < vote && vote < reveal)) {
      throw new Error("Voting has to sit between collection and the reveal.");
    }
  }
  if (phases.includes("predict")) {
    const prompt = phases.indexOf("prompt");
    const predict = phases.indexOf("predict");
    const collect = phases.indexOf("collect");
    if (!(prompt < predict && predict < collect)) {
      throw new Error("Predictions have to close before the duel starts.");
    }
  }
}

export function nextPhase(room: RoomClock): RoomPhase | null {
  if (room.phase === "podium" || room.phase === "facts") {
    return room.phase === "facts" ? "podium" : null;
  }
  if (room.phase === "lobby") {
    return room.phases[0] ?? null;
  }
  if (room.phase === "scores") {
    if (
      !room.finishAfterRound &&
      room.questionCount > 0 &&
      room.questionIndex + 1 < room.questionCount
    ) {
      return "intro";
    }
    return "final";
  }
  if (room.phase === "final") {
    return "podium";
  }
  const index = room.phases.indexOf(room.phase);
  if (index < 0) {
    return null;
  }
  return room.phases[index + 1] ?? null;
}

export function earliestDue(jobs: readonly ScheduledJob[]): number | null {
  const times = jobs
    .filter((job) => job.status === "pending" && job.dueAt !== null)
    .map((job) => job.dueAt as number);
  if (times.length === 0) {
    return null;
  }
  return Math.min(...times);
}

export function startRound(
  store: GameStore,
  now: number,
  plugin: RoundPlugin,
  roundId: string,
): void {
  assertRoundPhases(plugin.phases);
  const room = store.readRoom();
  if (room.phase !== "lobby") {
    throw new Error("A round can only start from the lobby.");
  }
  const expected = room.phaseGeneration;
  const next: RoomClock = {
    ...room,
    phase: "intro",
    phaseGeneration: expected + 1,
    scopeGeneration: room.scopeGeneration + 1,
    paused: false,
    hold: null,
    roundId,
    phases: [...plugin.phases],
    durations: { ...plugin.durations },
    fault: null,
    questionIndex: 0,
    questionCount: plugin.questionCount ?? 0,
    collectWindows: [...(plugin.collectWindows ?? [])],
    finishAfterRound: room.finishAfterRound,
  };
  if (!store.casRoom(expected, next)) {
    throw new Error("The lobby already moved.");
  }
  try {
    openPhase(store, next, now);
  } catch (error) {
    endPhase(store, next.roundId, now);
    store.writeRoom(room);
    throw error;
  }
}

export function pause(store: GameStore, now: number): void {
  const room = store.readRoom();
  if (room.paused || room.phase === "lobby" || room.phase === "podium") {
    return;
  }
  for (const job of store.jobs()) {
    if (job.jobType === "gameplay" && job.status === "pending" && job.dueAt !== null) {
      store.saveJob({
        ...job,
        remainingMs: Math.max(0, job.dueAt - now),
        dueAt: null,
      });
    }
  }
  store.writeRoom({ ...room, paused: true });
}

export function resume(store: GameStore, now: number): void {
  const room = store.readRoom();
  if (!room.paused) {
    return;
  }
  for (const job of store.jobs()) {
    if (
      job.jobType === "gameplay" &&
      job.status === "pending" &&
      job.remainingMs !== null
    ) {
      store.saveJob({
        ...job,
        dueAt: now + job.remainingMs,
        remainingMs: null,
      });
    }
  }
  store.writeRoom({ ...room, paused: false });
}

export function advance(store: GameStore, now: number): boolean {
  const room = store.readRoom();
  if (room.phase === "facts") {
    const count = store.funFactCount?.() ?? 0;
    if (count > 0 && room.funFactIndex + 1 < count) {
      return store.casRoom(room.phaseGeneration, {
        ...room,
        funFactIndex: room.funFactIndex + 1,
      });
    }
  }
  return changePhase(store, now, "advance");
}

export function skipQuestion(store: GameStore, now: number): boolean {
  const room = store.readRoom();
  if (
    room.phase === "lobby" ||
    room.phase === "podium" ||
    room.phase === "final" ||
    room.phase === "facts"
  ) {
    return false;
  }
  const nextQuestion =
    !room.finishAfterRound &&
    room.questionCount > 0 &&
    room.questionIndex + 1 < room.questionCount;
  return moveTo(store, now, nextQuestion ? "intro" : "final", {
    hold: false,
    nextQuestion,
    clearPause: true,
  });
}

export function finishGame(store: GameStore, now: number): boolean {
  const room = store.readRoom();
  if (room.phase === "lobby" || room.phase === "podium") {
    return false;
  }
  if (room.phase === "facts") {
    return moveTo(store, now, "podium", {
      hold: false,
      nextQuestion: false,
      clearPause: true,
    });
  }
  if (room.phase === "final") {
    const count = store.funFactCount?.() ?? 0;
    return moveTo(store, now, count > 0 ? "facts" : "podium", {
      hold: false,
      nextQuestion: false,
      clearPause: true,
    });
  }
  if (room.finishAfterRound) {
    return true;
  }
  store.writeRoom({ ...room, finishAfterRound: true });
  return true;
}

export function notePresence(
  store: GameStore,
  presence: { controller: boolean; stage: boolean },
  now: number,
): void {
  const room = store.readRoom();
  const releaseHold = room.hold === "controller" && presence.controller;
  const next: RoomClock = {
    ...room,
    controllerPresent: presence.controller,
    stagePresent: presence.stage,
    hold: releaseHold ? null : room.hold,
  };
  store.writeRoom(next);
  if (releaseHold) {
    scheduleGameplay(store, next, now);
  }
}

export function onAlarm(store: GameStore, now: number): void {
  const room = store.readRoom();
  const due = store
    .jobs()
    .filter((job) => job.status === "pending" && job.dueAt !== null && job.dueAt <= now)
    .sort(
      (left, right) =>
        (left.dueAt ?? 0) - (right.dueAt ?? 0) || left.jobId.localeCompare(right.jobId),
    );

  for (const job of due) {
    if (job.jobType === "background") {
      if (
        job.payload === archiveExportPayload ||
        job.payload === archiveRetainPayload
      ) {
        continue;
      }
      if (job.payload === wallAdvancePayload || job.payload === "developer-runner") {
        // Marked done first: the hook schedules the next wake-up under the same id.
        store.saveJob({ ...job, status: "done", dueAt: null });
        store.onBackgroundJob?.(job, now);
        continue;
      }
      if (job.payload === "telemetry-retention") {
        store.onBackgroundJob?.(job, now);
      }
      store.saveJob({ ...job, status: "done", dueAt: null });
    }
  }

  // A background rehearsal job can pause the room during this alarm.
  if (store.readRoom().paused) {
    return;
  }

  for (const job of due) {
    if (job.jobType !== "gameplay" || !isRoundJobPayload(job.payload)) {
      continue;
    }
    if (
      job.payload === "kart-tick" &&
      (job.phaseGeneration !== room.phaseGeneration ||
        job.scopeGeneration !== room.scopeGeneration ||
        job.phase !== room.phase ||
        room.hold)
    ) {
      store.saveJob({ ...job, status: "cancelled", dueAt: null, remainingMs: null });
      continue;
    }
    store.saveJob({ ...job, status: "done", dueAt: null, remainingMs: null });
    store.onScheduledJob?.(job, now);
  }

  if (store.readRoom().phaseGeneration !== room.phaseGeneration) return;

  const gameplay = due.find(
    (job) =>
      job.jobType === "gameplay" &&
      !isRoundJobPayload(job.payload) &&
      job.phase === room.phase &&
      job.phaseGeneration === room.phaseGeneration &&
      job.scopeGeneration === room.scopeGeneration,
  );

  for (const job of due) {
    if (
      job.jobType !== "gameplay" ||
      isRoundJobPayload(job.payload) ||
      job.jobId === gameplay?.jobId
    ) {
      continue;
    }
    if (
      job.phaseGeneration !== room.phaseGeneration ||
      job.scopeGeneration !== room.scopeGeneration
    ) {
      store.saveJob({ ...job, status: "cancelled", dueAt: null });
    }
  }

  if (!gameplay) {
    return;
  }

  try {
    const moved = changePhase(store, now, "deadline");
    if (!moved) {
      store.saveJob({ ...gameplay, status: "cancelled", dueAt: null });
      return;
    }
    store.saveJob({ ...gameplay, status: "done", dueAt: null });
  } catch {
    const retryCount = gameplay.retryCount + 1;
    if (retryCount >= maxScheduleRetries) {
      store.saveJob({
        ...gameplay,
        status: "failed",
        dueAt: null,
        remainingMs: null,
        retryCount,
      });
      return;
    }
    store.saveJob({
      ...gameplay,
      status: "pending",
      retryCount,
      dueAt: now + retryDelayMs(retryCount),
      remainingMs: null,
    });
  }
}

export function submissionGate(
  store: GameStore,
  now: number,
): { ok: true } | { ok: false; reason: "phase" | "paused" | "held" | "late" } {
  const room = store.readRoom();
  if (room.phase !== "collect" && room.phase !== "vote" && room.phase !== "predict") {
    return { ok: false, reason: "phase" };
  }
  if (room.paused) {
    return { ok: false, reason: "paused" };
  }
  if (room.hold) {
    return { ok: false, reason: "held" };
  }
  const deadline = store
    .jobs()
    .find(
      (job) =>
        job.jobType === "gameplay" &&
        job.status === "pending" &&
        job.phase === room.phase &&
        job.phaseGeneration === room.phaseGeneration,
    )?.dueAt;
  if (deadline !== null && deadline !== undefined && now >= deadline) {
    return { ok: false, reason: "late" };
  }
  return { ok: true };
}

export function acceptAnswer(
  store: GameStore,
  playerId: string,
  now: number,
):
  | { ok: true }
  | { ok: false; reason: "phase" | "paused" | "held" | "late" | "duplicate" } {
  const gate = submissionGate(store, now);
  if (!gate.ok) {
    return gate;
  }
  const room = store.readRoom();
  if (store.hasAnswer(playerId, room.phaseGeneration)) {
    return { ok: false, reason: "duplicate" };
  }
  store.saveAnswer(playerId, room.phaseGeneration, now);
  return { ok: true };
}

export function scheduleBackground(
  store: GameStore,
  input: { jobId: string; dueAt: number; now: number },
): void {
  const room = store.readRoom();
  store.saveJob({
    jobId: input.jobId,
    jobType: "background",
    dueAt: input.dueAt,
    remainingMs: null,
    scopeGeneration: room.scopeGeneration,
    phaseGeneration: room.phaseGeneration,
    phase: null,
    status: "pending",
    retryCount: 0,
    payload: "maintenance",
    createdAt: input.now,
  });
}

export function publicClock(store: GameStore): {
  phase: RoomPhase;
  paused: boolean;
  held: boolean;
  deadlineAt: number | null;
  remainingMs: number | null;
} {
  const room = store.readRoom();
  const job = store
    .jobs()
    .find(
      (item) =>
        item.jobType === "gameplay" &&
        !isRoundJobPayload(item.payload) &&
        item.status === "pending" &&
        item.phase === room.phase &&
        item.phaseGeneration === room.phaseGeneration,
    );
  return {
    phase: room.phase,
    paused: room.paused,
    held: room.hold !== null,
    deadlineAt: room.paused || room.hold ? null : (job?.dueAt ?? null),
    remainingMs: room.paused ? (job?.remainingMs ?? null) : null,
  };
}

function changePhase(
  store: GameStore,
  now: number,
  reason: "deadline" | "advance",
): boolean {
  const room = store.readRoom();
  const following = store.nextPhaseOverride?.(room, now) ?? nextPhase(room);
  if (!following || room.phase === "lobby" || room.phase === "podium") {
    return false;
  }
  const held =
    reason === "deadline" && room.phase === "collect" && !room.controllerPresent;
  return moveTo(store, now, following, {
    hold: held,
    nextQuestion: room.phase === "scores" && following === "intro",
  });
}

function moveTo(
  store: GameStore,
  now: number,
  following: RoomPhase,
  options: { hold: boolean; nextQuestion: boolean; clearPause?: boolean },
): boolean {
  const room = store.readRoom();
  if (room.phase === "podium") {
    return false;
  }
  const expected = room.phaseGeneration;
  let questionIndex = room.questionIndex;
  let phase = following;
  if (options.nextQuestion) {
    const jumped = store.nextQuestionIndex?.(room);
    if (jumped === "final") {
      phase = "final";
    } else {
      questionIndex = jumped ?? room.questionIndex + 1;
    }
  }
  const collect = room.collectWindows[questionIndex];
  const next: RoomClock = {
    ...room,
    phase,
    phaseGeneration: expected + 1,
    hold: options.hold ? "controller" : null,
    paused: options.clearPause ? false : room.paused,
    questionIndex,
    funFactIndex: phase === "facts" ? 0 : room.funFactIndex,
    durations:
      options.nextQuestion && phase !== "final" && collect !== undefined
        ? { ...room.durations, collect }
        : room.durations,
  };
  if (!store.casRoom(expected, next)) {
    return false;
  }
  try {
    endPhase(store, room.roundId, now);
    openPhase(store, next, now);
    cancelGameplay(store, expected);
    return true;
  } catch (error) {
    endPhase(store, next.roundId, now);
    cancelGameplay(store, next.phaseGeneration);
    store.writeRoom(room);
    throw error;
  }
}

/** Rehearsal caller enforces isolation and clears the selected question's records. */
export function restartQuestion(store: GameStore, index: number, now: number): void {
  const room = store.readRoom();
  if (!Number.isInteger(index) || index < 0 || index >= room.questionCount)
    throw new Error("Choose a question in this room's pack.");
  endPhase(store, room.roundId, now);
  for (const job of store.jobs())
    if (job.jobType === "gameplay" && job.status === "pending")
      store.saveJob({ ...job, status: "cancelled", dueAt: null, remainingMs: null });
  const next = {
    ...room,
    questionIndex: index,
    phase: "intro" as const,
    phaseGeneration: room.phaseGeneration + 1,
    scopeGeneration: room.scopeGeneration + 1,
    paused: false,
    hold: null,
    finishAfterRound: false,
    roundId: room.roundId ?? `rehearsal:${room.phaseGeneration + 1}`,
  };
  if (!store.casRoom(room.phaseGeneration, next))
    throw new Error("The room moved. Try again.");
  openPhase(store, next, now);
}

function openPhase(store: GameStore, room: RoomClock, now: number): void {
  if (!room.roundId) {
    throw new Error("This phase has no round.");
  }
  store.saveResource({
    resourceId: `${room.roundId}:${room.phase}:${room.phaseGeneration}`,
    roundId: room.roundId,
    phaseGeneration: room.phaseGeneration,
    releasedAt: null,
  });
  if (room.fault === "enter") {
    throw new Error("The phase could not be opened.");
  }
  scheduleGameplay(store, room, now);
  store.onEnterPhase?.(room, now);
}

function scheduleGameplay(store: GameStore, room: RoomClock, now: number): void {
  if (
    !room.roundId ||
    room.hold ||
    room.phase === "podium" ||
    room.phase === "lobby" ||
    room.phase === "facts"
  ) {
    return;
  }
  const duration = room.durations[room.phase];
  if (duration === undefined) {
    return;
  }
  const existing = store
    .jobs()
    .some(
      (job) =>
        job.jobType === "gameplay" &&
        !isRoundJobPayload(job.payload) &&
        job.phaseGeneration === room.phaseGeneration &&
        job.status === "pending",
    );
  if (existing) {
    return;
  }
  store.saveJob({
    jobId: `gameplay:${room.scopeGeneration}:${room.phaseGeneration}`,
    jobType: "gameplay",
    dueAt: room.paused ? null : now + duration,
    remainingMs: room.paused ? duration : null,
    scopeGeneration: room.scopeGeneration,
    phaseGeneration: room.phaseGeneration,
    phase: room.phase,
    status: "pending",
    retryCount: 0,
    payload: room.phase,
    createdAt: now,
  });
}

function endPhase(store: GameStore, roundId: string | null, now: number): void {
  if (!roundId) {
    return;
  }
  for (const resource of store.resources()) {
    if (resource.roundId === roundId && resource.releasedAt === null) {
      store.saveResource({ ...resource, releasedAt: now });
    }
  }
}

function cancelGameplay(store: GameStore, phaseGeneration: number): void {
  for (const job of store.jobs()) {
    if (
      job.jobType === "gameplay" &&
      job.status === "pending" &&
      !isRoundJobPayload(job.payload) &&
      job.phaseGeneration === phaseGeneration
    ) {
      store.saveJob({ ...job, status: "cancelled", dueAt: null, remainingMs: null });
    }
  }
}

function retryDelayMs(retryCount: number): number {
  return Math.min(60_000, 2_000 * 2 ** (retryCount - 1));
}

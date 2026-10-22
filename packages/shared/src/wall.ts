import { z } from "zod";

/**
 * Photo wall rules shared by the phone, the stage and the room.
 * Frames are drawn on the stage; they are never burned into the photo.
 */
export const wallFrames = [
  "polaroid",
  "birthday",
  "wanted",
  "tabloid",
  "magazine",
  "museum",
  "vhs",
] as const;

export type WallFrame = (typeof wallFrames)[number];

export const wallCaptionMax = 60;

/**
 * `pending` waits for the host. `queued` is approved and waiting for a break.
 * `declined` was refused by the host. `removed` was withdrawn or pulled.
 */
export const wallPostStatuses = [
  "pending",
  "queued",
  "showing",
  "shown",
  "declined",
  "removed",
] as const;

export type WallPostStatus = (typeof wallPostStatuses)[number];

export const wallFrameSchema = z.enum(wallFrames);

/** Phases where a photo would compete with a question. `breaks` placement waits. */
export const wallQuestionPhases = ["prompt", "predict", "collect", "vote", "reveal"] as const;

/** With more than this many waiting, each photo gets `wallRushShowMs`. */
export const wallRushQueue = 6;
export const wallRushShowMs = 5_000;

export type WallQueueState = {
  enabled: boolean;
  placement: "breaks" | "corner";
  showMs: number;
  phase: string;
  showing: { postId: string; playerId: string; untilAt: number } | null;
  /** Approved photos, any order. */
  queued: { postId: string; playerId: string; queuedAt: number }[];
  /** When each player last had a photo start. Missing means never. */
  lastShownAt: Record<string, number>;
};

/**
 * `tick` is any wake-up: the alarm, a phase change, a new approval.
 * `skip` ends the photo on screen now. `force` shows the next photo even
 * during a question.
 */
export type WallEvent = "tick" | "skip" | "force";

export type WallStep = {
  showing: WallQueueState["showing"];
  /** Post that just finished, now `shown`. */
  finished: string | null;
  /** Post that just started, now `showing`. */
  started: string | null;
  /** When the room must wake to move the wall on, or null to stay quiet. */
  wakeAt: number | null;
};

/**
 * Pure photo wall queue. Time is passed in.
 *
 * Fair order: the next photo belongs to the player whose last photo started
 * longest ago (never shown counts as longest), then the oldest approval.
 * Someone with three photos waiting takes turns with everyone else.
 */
export function nextWall(state: WallQueueState, event: WallEvent, now: number): WallStep {
  let showing = state.showing;
  let finished: string | null = null;
  if (showing && (!state.enabled || event !== "tick" || now >= showing.untilAt)) {
    finished = showing.postId;
    showing = null;
  }
  let started: string | null = null;
  const inQuestion = (wallQuestionPhases as readonly string[]).includes(state.phase);
  const allowed =
    state.enabled && (event === "force" || state.placement === "corner" || !inQuestion);
  if (!showing && allowed && state.queued.length > 0) {
    const next = [...state.queued].sort(
      (left, right) =>
        (state.lastShownAt[left.playerId] ?? -Infinity) -
          (state.lastShownAt[right.playerId] ?? -Infinity) ||
        left.queuedAt - right.queuedAt ||
        left.postId.localeCompare(right.postId),
    )[0]!;
    const ms = state.queued.length > wallRushQueue ? Math.min(state.showMs, wallRushShowMs) : state.showMs;
    showing = { postId: next.postId, playerId: next.playerId, untilAt: now + ms };
    started = next.postId;
  }
  return { showing, finished, started, wakeAt: showing?.untilAt ?? null };
}

/** Trims, removes control characters and caps the length. Empty becomes null. */
export function cleanWallCaption(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length === 0 ? null : [...cleaned].slice(0, wallCaptionMax).join("");
}

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

/**
 * Phases where a photo would compete with what is on stage: a question, or the
 * host-paced end-of-night facts. `breaks` placement waits through these.
 */
export const wallQuestionPhases = [
  "prompt",
  "predict",
  "collect",
  "vote",
  "reveal",
  "facts",
] as const;

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
export function nextWall(
  state: WallQueueState,
  event: WallEvent,
  now: number,
): WallStep {
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
    const next = pickNext(state.queued, state.lastShownAt)!;
    const ms =
      state.queued.length > wallRushQueue
        ? Math.min(state.showMs, wallRushShowMs)
        : state.showMs;
    showing = { postId: next.postId, playerId: next.playerId, untilAt: now + ms };
    started = next.postId;
  }
  return { showing, finished, started, wakeAt: showing?.untilAt ?? null };
}

/**
 * The order queued photos will be shown in, if nothing else is approved
 * first. Each pick counts as that player's latest showing, so turns rotate.
 */
export function wallQueueOrder(
  queued: WallQueueState["queued"],
  lastShownAt: WallQueueState["lastShownAt"],
  showingPlayerId: string | null = null,
): string[] {
  const remaining = [...queued];
  const shown: Record<string, number> = { ...lastShownAt };
  // The photo on screen now counts as its player's latest turn.
  let clock = Math.max(0, ...Object.values(shown)) + 1;
  if (showingPlayerId) {
    shown[showingPlayerId] = clock++;
  }
  const order: string[] = [];
  while (remaining.length > 0) {
    const next = pickNext(remaining, shown)!;
    order.push(next.postId);
    shown[next.playerId] = clock++;
    remaining.splice(remaining.indexOf(next), 1);
  }
  return order;
}

function pickNext(
  queued: WallQueueState["queued"],
  lastShownAt: WallQueueState["lastShownAt"],
): WallQueueState["queued"][number] | undefined {
  return [...queued].sort(
    (left, right) =>
      (lastShownAt[left.playerId] ?? -Infinity) -
        (lastShownAt[right.playerId] ?? -Infinity) ||
      left.queuedAt - right.queuedAt ||
      left.postId.localeCompare(right.postId),
  )[0];
}

/** wallCaptionMax counts characters; a schema counts UTF-16 units, so allow two per character. */
const wallCaptionUnits = wallCaptionMax * 2;

/** Reactions guests can send while a photo is on screen. Ids, not emoji. */
export const wallReactions = ["fire", "laugh", "love", "clap", "skull"] as const;
export type WallReaction = (typeof wallReactions)[number];

const wallPhotoSchema = z
  .object({
    postId: z.uuid(),
    mediaId: z.uuid(),
    nickname: z.string().min(1).max(24),
    caption: z.string().min(1).max(wallCaptionUnits).nullable(),
    frame: wallFrameSchema,
  })
  .strict();

const reactionCountsSchema = z
  .array(
    z
      .object({
        reaction: z.enum(wallReactions),
        count: z.number().int().nonnegative(),
      })
      .strict(),
  )
  .max(wallReactions.length);

/**
 * One `wall` section, filled per audience:
 * - everyone: `enabled`, `placement`, `now`, `waiting`;
 * - stage: `next`, the photo to preload, and `reel` at the podium;
 * - guest: `blocked`, `cooldownUntil`, `mine`;
 * - host: `queue` (pending and queued), `recent`, `settings`, `muted`.
 * A pending photo only ever appears in the host's `queue` and its owner's `mine`.
 */
export const wallSnapshotSchema = z
  .object({
    enabled: z.boolean(),
    placement: z.enum(["breaks", "corner"]),
    now: wallPhotoSchema
      .extend({ untilAt: z.number().int(), reactions: reactionCountsSchema })
      .nullable(),
    waiting: z.number().int().nonnegative(),
    next: z.object({ mediaId: z.uuid() }).strict().nullable().optional(),
    /** Stage, at the podium: photos shown tonight, for the closing filmstrip. */
    reel: z
      .array(
        z
          .object({
            mediaId: z.uuid(),
            nickname: z.string().min(1).max(24),
            frame: wallFrameSchema,
          })
          .strict(),
      )
      .max(40)
      .optional(),
    blocked: z.string().min(1).max(120).nullable().optional(),
    cooldownUntil: z.number().int().nullable().optional(),
    mine: z
      .array(
        z
          .object({
            postId: z.uuid(),
            mediaId: z.uuid(),
            caption: z.string().min(1).max(wallCaptionUnits).nullable(),
            frame: wallFrameSchema,
            status: z.enum(wallPostStatuses),
            position: z.number().int().positive().nullable(),
            reactions: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .max(30)
      .optional(),
    queue: z
      .array(
        wallPhotoSchema
          .extend({
            playerId: z.uuid(),
            status: z.enum(["pending", "queued"]),
            position: z.number().int().positive().nullable(),
          })
          .strict(),
      )
      .max(300)
      .optional(),
    recent: z
      .array(
        wallPhotoSchema
          .extend({
            playerId: z.uuid(),
            status: z.enum(["shown", "declined", "removed"]),
            reactions: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .max(30)
      .optional(),
    settings: z
      .object({
        moderation: z.enum(["approve", "direct"]),
        showMs: z.number().int().positive(),
        captions: z.boolean(),
      })
      .strict()
      .optional(),
    muted: z.array(z.uuid()).max(100).optional(),
  })
  .strict();

export type WallSnapshot = z.infer<typeof wallSnapshotSchema>;

/** Trims, removes control characters and caps the length. Empty becomes null. */
export function cleanWallCaption(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const cleaned = Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127 ? " " : character;
  })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length === 0 ? null : [...cleaned].slice(0, wallCaptionMax).join("");
}

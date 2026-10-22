import {
  cleanWallCaption,
  wallFrameSchema,
  type WallFrame,
  type WallPostStatus,
} from "@26/shared";
import {
  wallClosedMessage,
  wallCooldownMessage,
  wallCooldownMs,
  wallFrameMessage,
  wallMediaMessage,
  wallMutedMessage,
  wallPostMissingMessage,
  wallSentMessage,
  wallWaitingMessage,
  wallWaitingPerPlayer,
} from "../room/limits.ts";

/**
 * Photo wall records. The upload itself is ordinary `media_upload` with purpose
 * `wall`; this file owns what happens to it after it is accepted.
 */
export type WallSettings = {
  enabled: boolean;
  moderation: "approve" | "direct";
  placement: "breaks" | "corner";
  showMs: number;
  captions: boolean;
  muted: string[];
};

export const defaultWallSettings: WallSettings = {
  enabled: true,
  moderation: "approve",
  placement: "breaks",
  showMs: 8_000,
  captions: true,
  muted: [],
};

export type WallPost = {
  postId: string;
  mediaId: string;
  playerId: string;
  caption: string | null;
  frame: WallFrame;
  keep: boolean;
  status: WallPostStatus;
  createdAt: number;
};

type Result = { ok: true } | { ok: false; message: string };

export function readWallSettings(sql: SqlStorage): WallSettings {
  const row = sql
    .exec<{
      enabled: number;
      moderation: string;
      placement: string;
      show_ms: number;
      captions: number;
      muted_json: string;
    }>(`SELECT enabled, moderation, placement, show_ms, captions, muted_json FROM wall_setting`)
    .toArray()[0];
  if (!row) {
    return defaultWallSettings;
  }
  return {
    enabled: row.enabled === 1,
    moderation: row.moderation === "direct" ? "direct" : "approve",
    placement: row.placement === "corner" ? "corner" : "breaks",
    showMs: row.show_ms,
    captions: row.captions === 1,
    muted: readMuted(row.muted_json),
  };
}

/**
 * Why this player cannot start another wall photo right now, or null.
 * Checked when reserving the upload and again when posting it.
 */
export function wallSendBlock(
  sql: SqlStorage,
  playerId: string,
  now: number,
): string | null {
  const settings = readWallSettings(sql);
  if (!settings.enabled) {
    return wallClosedMessage;
  }
  if (settings.muted.includes(playerId)) {
    return wallMutedMessage;
  }
  const mine = sql
    .exec<{ last: number | null; waiting: number }>(
      `SELECT MAX(created_at) AS last,
              SUM(CASE WHEN status IN ('pending', 'queued') THEN 1 ELSE 0 END) AS waiting
       FROM wall_post WHERE player_id = ?`,
      playerId,
    )
    .toArray()[0];
  if ((mine?.waiting ?? 0) >= wallWaitingPerPlayer) {
    return wallWaitingMessage;
  }
  if (mine?.last != null && now - mine.last < wallCooldownMs) {
    return wallCooldownMessage;
  }
  return null;
}

/** Turns an accepted wall upload into a post. The host approves it next. */
export function createWallPost(
  sql: SqlStorage,
  playerId: string,
  input: { mediaId: unknown; caption: unknown; frame: unknown; keep: unknown },
  now: number,
): Result {
  if (typeof input.mediaId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.mediaId)) {
    return { ok: false, message: wallMediaMessage };
  }
  const frame = wallFrameSchema.safeParse(input.frame ?? "polaroid");
  if (!frame.success) {
    return { ok: false, message: wallFrameMessage };
  }
  const media = sql
    .exec<{ player_id: string; status: string; hidden: number; kind: string }>(
      `SELECT player_id, status, hidden, kind FROM media_upload
       WHERE media_id = ? AND purpose = 'wall'`,
      input.mediaId,
    )
    .toArray()[0];
  if (
    !media ||
    media.player_id !== playerId ||
    media.status !== "accepted" ||
    media.hidden === 1 ||
    media.kind !== "photo"
  ) {
    return { ok: false, message: wallMediaMessage };
  }
  const already = sql
    .exec(`SELECT post_id FROM wall_post WHERE media_id = ?`, input.mediaId)
    .toArray()[0];
  if (already) {
    return { ok: false, message: wallSentMessage };
  }
  const blocked = wallSendBlock(sql, playerId, now);
  if (blocked) {
    return { ok: false, message: blocked };
  }
  const settings = readWallSettings(sql);
  const status: WallPostStatus = settings.moderation === "direct" ? "queued" : "pending";
  sql.exec(
    `INSERT INTO wall_post (
       post_id, media_id, player_id, caption, frame, keep, status,
       queued_at, decided_by, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    crypto.randomUUID(),
    input.mediaId,
    playerId,
    cleanWallCaption(input.caption),
    frame.data,
    input.keep === false ? 0 : 1,
    status,
    status === "queued" ? now : null,
    status === "queued" ? "auto" : null,
    now,
  );
  touch(sql);
  return { ok: true };
}

/**
 * The guest takes their own photo back at any point. It leaves the queue and
 * the gallery, and the image is hidden so nobody can fetch it again.
 */
export function withdrawWallPost(
  sql: SqlStorage,
  playerId: string,
  postId: unknown,
): Result {
  if (typeof postId !== "string" || !/^[0-9a-f-]{36}$/i.test(postId)) {
    return { ok: false, message: wallPostMissingMessage };
  }
  const post = sql
    .exec<{ media_id: string; status: string }>(
      `SELECT media_id, status FROM wall_post WHERE post_id = ? AND player_id = ?`,
      postId,
      playerId,
    )
    .toArray()[0];
  if (!post || post.status === "removed") {
    return { ok: false, message: wallPostMissingMessage };
  }
  sql.exec(
    `UPDATE wall_post SET status = 'removed', keep = 0, until_at = NULL WHERE post_id = ?`,
    postId,
  );
  sql.exec(`UPDATE media_upload SET hidden = 1 WHERE media_id = ?`, post.media_id);
  touch(sql);
  return { ok: true };
}

export function readWallPosts(sql: SqlStorage, playerId?: string): WallPost[] {
  return sql
    .exec<{
      post_id: string;
      media_id: string;
      player_id: string;
      caption: string | null;
      frame: string;
      keep: number;
      status: string;
      created_at: number;
    }>(
      `SELECT post_id, media_id, player_id, caption, frame, keep, status, created_at
       FROM wall_post
       WHERE (? IS NULL OR player_id = ?)
       ORDER BY created_at`,
      playerId ?? null,
      playerId ?? null,
    )
    .toArray()
    .map((row) => ({
      postId: row.post_id,
      mediaId: row.media_id,
      playerId: row.player_id,
      caption: row.caption,
      frame: wallFrameSchema.catch("polaroid").parse(row.frame),
      keep: row.keep === 1,
      status: row.status as WallPostStatus,
      createdAt: row.created_at,
    }));
}

/**
 * Who may fetch a wall image. The host sees everything so they can moderate.
 * The owner sees their own. Anyone else, the stage included, only sees a photo
 * that is on screen or has been shown. A pending photo never leaves the room.
 */
export function wallMediaViewable(
  sql: SqlStorage,
  mediaId: string,
  viewer: { role: "control" } | { role: "presentation" } | { role: "guest"; playerId: string },
): boolean {
  if (viewer.role === "control") {
    return true;
  }
  const row = sql
    .exec<{ player_id: string; status: string | null }>(
      `SELECT media_upload.player_id, wall_post.status
       FROM media_upload
       LEFT JOIN wall_post ON wall_post.media_id = media_upload.media_id
       WHERE media_upload.media_id = ?`,
      mediaId,
    )
    .toArray()[0];
  if (!row) {
    return false;
  }
  if (viewer.role === "guest" && viewer.playerId === row.player_id) {
    return true;
  }
  return row.status === "showing" || row.status === "shown";
}

function readMuted(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function touch(sql: SqlStorage): void {
  sql.exec(`UPDATE room SET state_version = state_version + 1`);
}

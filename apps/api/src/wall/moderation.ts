import { z } from "zod";
import {
  playerMissingMessage,
  wallDecidedMessage,
  wallNothingShowingMessage,
  wallPostMissingMessage,
  wallSettingsMessage,
  wallShowMsMax,
  wallShowMsMin,
} from "../room/limits.ts";
import { syncWall } from "./queue.ts";
import { readWallSettings, type WallSettings } from "./store.ts";

/**
 * Host moderation for the photo wall. Each function throws a message on
 * failure, so the host command's transaction rolls back as a whole, and runs
 * the queue once on success so the wall reacts straight away.
 */

/** A pending photo joins the queue. */
export function approveWallPost(
  sql: SqlStorage,
  postId: string | undefined,
  now: number,
) {
  const post = readPost(sql, postId);
  if (post.status !== "pending") {
    throw new Error(wallDecidedMessage);
  }
  sql.exec(
    `UPDATE wall_post SET status = 'queued', queued_at = ?, decided_by = 'host' WHERE post_id = ?`,
    now,
    post.postId,
  );
  syncWall(sql, "tick", now);
}

/** A waiting photo is refused. The image is hidden so it cannot be fetched. */
export function declineWallPost(
  sql: SqlStorage,
  postId: string | undefined,
  now: number,
) {
  const post = readPost(sql, postId);
  if (post.status !== "pending" && post.status !== "queued") {
    throw new Error(wallDecidedMessage);
  }
  decline(sql, [post.postId]);
  syncWall(sql, "tick", now);
}

/**
 * Takes a photo off the wall for good: the one on screen, or one already
 * shown. It leaves the gallery and the image is hidden everywhere.
 */
export function pullWallPost(sql: SqlStorage, postId: string | undefined, now: number) {
  const post = readPost(sql, postId);
  if (
    post.status !== "showing" &&
    post.status !== "shown" &&
    post.status !== "queued"
  ) {
    throw new Error(wallDecidedMessage);
  }
  sql.exec(
    `UPDATE wall_post SET status = 'removed', keep = 0, until_at = NULL, decided_by = 'host'
     WHERE post_id = ?`,
    post.postId,
  );
  sql.exec(`UPDATE media_upload SET hidden = 1 WHERE media_id = ?`, post.mediaId);
  touch(sql);
  syncWall(sql, "tick", now);
}

/** Ends the photo on screen early. `next` also starts one during a question. */
export function moveWallOn(sql: SqlStorage, how: "skip" | "next", now: number) {
  const showing = sql
    .exec(`SELECT post_id FROM wall_post WHERE status = 'showing'`)
    .toArray()[0];
  const waiting = sql
    .exec(`SELECT post_id FROM wall_post WHERE status = 'queued' LIMIT 1`)
    .toArray()[0];
  if (!showing && (how === "skip" || !waiting)) {
    throw new Error(wallNothingShowingMessage);
  }
  syncWall(sql, how === "skip" ? "skip" : "force", now);
}

const settingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    moderation: z.enum(["approve", "direct"]).optional(),
    placement: z.enum(["breaks", "corner"]).optional(),
    showMs: z.number().int().min(wallShowMsMin).max(wallShowMsMax).optional(),
    captions: z.boolean().optional(),
  })
  .strict();

export type WallSettingsChange = z.infer<typeof settingsSchema>;

export function parseWallSettingsChange(value: unknown): WallSettingsChange | null {
  const parsed = settingsSchema.safeParse(value);
  return parsed.success && Object.keys(parsed.data).length > 0 ? parsed.data : null;
}

/**
 * Changes only the fields given. Switching to straight-to-screen does not
 * approve photos already waiting; the host still sees those. The change is
 * validated again here: the room does not trust its caller to have done it.
 */
export function changeWallSettings(sql: SqlStorage, value: unknown, now: number) {
  const change = parseWallSettingsChange(value);
  if (!change) {
    throw new Error(wallSettingsMessage);
  }
  writeSettings(sql, { ...readWallSettings(sql), ...change });
  syncWall(sql, "tick", now);
}

/**
 * Stops a player sending more photos and declines what they have waiting.
 * Photos already shown stay up unless the host pulls them.
 */
export function muteWallPlayer(
  sql: SqlStorage,
  playerId: string | undefined,
  muted: boolean,
  now: number,
) {
  if (!playerId || !playerExists(sql, playerId)) {
    throw new Error(playerMissingMessage);
  }
  const settings = readWallSettings(sql);
  const others = settings.muted.filter((id) => id !== playerId);
  writeSettings(sql, { ...settings, muted: muted ? [...others, playerId] : others });
  if (muted) {
    declineWaitingFor(sql, playerId);
  }
  syncWall(sql, "tick", now);
}

/** A removed player's waiting photos are declined. Called by kick. */
export function declineWaitingFor(sql: SqlStorage, playerId: string) {
  const waiting = sql
    .exec<{ post_id: string }>(
      `SELECT post_id FROM wall_post WHERE player_id = ? AND status IN ('pending', 'queued')`,
      playerId,
    )
    .toArray()
    .map((row) => row.post_id);
  decline(sql, waiting);
}

function decline(sql: SqlStorage, postIds: string[]) {
  for (const postId of postIds) {
    const row = sql
      .exec<{ media_id: string }>(
        `SELECT media_id FROM wall_post WHERE post_id = ?`,
        postId,
      )
      .toArray()[0];
    sql.exec(
      `UPDATE wall_post SET status = 'declined', keep = 0, decided_by = 'host' WHERE post_id = ?`,
      postId,
    );
    if (row) {
      sql.exec(`UPDATE media_upload SET hidden = 1 WHERE media_id = ?`, row.media_id);
    }
  }
  if (postIds.length > 0) {
    touch(sql);
  }
}

function readPost(sql: SqlStorage, postId: string | undefined) {
  const row = postId
    ? sql
        .exec<{ post_id: string; media_id: string; status: string }>(
          `SELECT post_id, media_id, status FROM wall_post WHERE post_id = ?`,
          postId,
        )
        .toArray()[0]
    : undefined;
  if (!row) {
    throw new Error(wallPostMissingMessage);
  }
  return { postId: row.post_id, mediaId: row.media_id, status: row.status };
}

function writeSettings(sql: SqlStorage, settings: WallSettings) {
  sql.exec(
    `INSERT INTO wall_setting (id, enabled, moderation, placement, show_ms, captions, muted_json)
     VALUES (1, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       enabled = excluded.enabled, moderation = excluded.moderation,
       placement = excluded.placement, show_ms = excluded.show_ms,
       captions = excluded.captions, muted_json = excluded.muted_json`,
    settings.enabled ? 1 : 0,
    settings.moderation,
    settings.placement,
    settings.showMs,
    settings.captions ? 1 : 0,
    JSON.stringify(settings.muted),
  );
  touch(sql);
}

function playerExists(sql: SqlStorage, playerId: string): boolean {
  return (
    sql.exec(`SELECT player_id FROM player WHERE player_id = ?`, playerId).toArray()
      .length > 0
  );
}

function touch(sql: SqlStorage) {
  sql.exec(`UPDATE room SET state_version = state_version + 1`);
}

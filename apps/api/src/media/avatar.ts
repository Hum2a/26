import { avatarPhotoMessage, playerMissingMessage } from "../room/limits.ts";

/**
 * A guest's profile photo. It is a `face` media row the guest uploaded and
 * the room accepted; the player row points at it. Hiding the photo in admin,
 * or the host's "Remove photo", takes it off every screen at once because the
 * snapshot only names a photo that is still accepted and visible.
 */

const visibleFace = `m.player_id = p.player_id
  AND m.purpose = 'face'
  AND m.status = 'accepted'
  AND m.hidden = 0`;

/** Every visible profile photo, by player. One query per snapshot build. */
export function readAvatars(sql: SqlStorage): Map<string, string> {
  const rows = sql
    .exec<{ player_id: string; media_id: string }>(
      `SELECT p.player_id, m.media_id
       FROM player p
       JOIN media_upload m ON m.media_id = p.avatar_media_id AND ${visibleFace}
       WHERE p.revoked_at IS NULL`,
    )
    .toArray();
  return new Map(rows.map((row) => [row.player_id, row.media_id]));
}

/**
 * The guest chose (or removed) their photo. Saved before the acknowledgement.
 * `mediaId` must be this guest's own accepted, visible face photo.
 */
export function saveAvatar(
  sql: SqlStorage,
  input: { playerId: string; mediaId: unknown },
): { ok: true } | { ok: false; message: string } {
  const mediaId = input.mediaId;
  if (
    mediaId !== null &&
    (typeof mediaId !== "string" || !/^[0-9a-f-]{36}$/i.test(mediaId))
  ) {
    return { ok: false, message: avatarPhotoMessage };
  }
  const player = sql
    .exec<{ revoked_at: string | null }>(
      `SELECT revoked_at FROM player WHERE player_id = ?`,
      input.playerId,
    )
    .toArray()[0];
  if (!player || player.revoked_at) {
    return { ok: false, message: playerMissingMessage };
  }
  if (mediaId !== null) {
    const owned = sql
      .exec<{ media_id: string }>(
        `SELECT m.media_id FROM media_upload m
         JOIN player p ON p.player_id = m.player_id
         WHERE m.media_id = ? AND p.player_id = ? AND ${visibleFace}`,
        mediaId,
        input.playerId,
      )
      .toArray()[0];
    if (!owned) {
      return { ok: false, message: avatarPhotoMessage };
    }
  }
  sql.exec(
    `UPDATE player SET avatar_media_id = ? WHERE player_id = ?`,
    mediaId,
    input.playerId,
  );
  sql.exec(`UPDATE room SET state_version = state_version + 1`);
  return { ok: true };
}

/**
 * Host: take a player's profile photo off every screen. The photo is hidden
 * as well, so the same picture cannot be chosen again; the guest may take a
 * new one. Returns false when there was nothing to remove.
 */
export function clearAvatar(sql: SqlStorage, playerId: string): boolean {
  const row = sql
    .exec<{ avatar_media_id: string | null; revoked_at: string | null }>(
      `SELECT avatar_media_id, revoked_at FROM player WHERE player_id = ?`,
      playerId,
    )
    .toArray()[0];
  if (!row) {
    throw new Error(playerMissingMessage);
  }
  if (row.revoked_at) {
    throw new Error(playerMissingMessage);
  }
  if (!row.avatar_media_id) {
    return false;
  }
  sql.exec(
    `UPDATE media_upload SET hidden = 1 WHERE media_id = ? AND purpose = 'face'`,
    row.avatar_media_id,
  );
  sql.exec(`UPDATE player SET avatar_media_id = NULL WHERE player_id = ?`, playerId);
  sql.exec(`UPDATE room SET state_version = state_version + 1`);
  return true;
}

import { wallNextMediaId } from "./snapshot.ts";

/**
 * Who may fetch a wall image. The host sees everything so they can moderate.
 * The owner sees their own. Anyone else, the stage included, only sees a photo
 * that is on screen or has been shown. The stage may also fetch the next
 * approved photo, so it can preload it. A pending photo never leaves the room.
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
  if (row.status === "showing" || row.status === "shown") {
    return true;
  }
  return viewer.role === "presentation" && row.status === "queued" && wallNextMediaId(sql) === mediaId;
}
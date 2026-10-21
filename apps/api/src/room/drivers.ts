import { defaultDriverStyle, driverChoiceSchema, type LobbyDriver } from "@26/shared";
import {
  driverClosedMessage,
  driverFaceMessage,
  driverStyleMessage,
  playerMissingMessage,
} from "./limits.ts";

/**
 * Kart drivers: a style per player and an optional face photo. The face is a
 * `face` media row owned by that player; hiding it in admin removes it here.
 */
export function readDrivers(sql: SqlStorage): Map<string, LobbyDriver> {
  const rows = sql
    .exec<{
      player_id: string;
      driver_style: string | null;
      face: string | null;
      ordinal: number;
    }>(
      `SELECT p.player_id, p.driver_style, m.media_id AS face,
              ROW_NUMBER() OVER (ORDER BY p.rowid) - 1 AS ordinal
       FROM player p
       LEFT JOIN media_upload m
         ON m.media_id = p.driver_face_media_id
        AND m.player_id = p.player_id
        AND m.purpose = 'face'
        AND m.status = 'accepted'
        AND m.hidden = 0
       WHERE p.revoked_at IS NULL`,
    )
    .toArray();
  const drivers = new Map<string, LobbyDriver>();
  for (const row of rows) {
    const style = driverChoiceSchema.shape.style.safeParse(row.driver_style);
    drivers.set(row.player_id, {
      style: style.success ? style.data : defaultDriverStyle(row.ordinal),
      ...(row.face ? { faceMediaId: row.face } : {}),
    });
  }
  return drivers;
}

export function saveDriver(
  sql: SqlStorage,
  input: { playerId: string; choice: unknown; phase: string },
): { ok: true } | { ok: false; message: string } {
  if (input.phase === "podium") {
    return { ok: false, message: driverClosedMessage };
  }
  const parsed = driverChoiceSchema.safeParse(input.choice);
  if (!parsed.success) {
    return { ok: false, message: driverStyleMessage };
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
  const face = parsed.data.faceMediaId;
  if (face) {
    const owned = sql
      .exec<{ media_id: string }>(
        `SELECT media_id FROM media_upload
         WHERE media_id = ? AND player_id = ? AND purpose = 'face'
           AND status = 'accepted' AND hidden = 0`,
        face,
        input.playerId,
      )
      .toArray()[0];
    if (!owned) {
      return { ok: false, message: driverFaceMessage };
    }
  }
  sql.exec(
    `UPDATE player SET driver_style = ?, driver_face_media_id = ? WHERE player_id = ?`,
    parsed.data.style,
    face,
    input.playerId,
  );
  sql.exec(`UPDATE room SET state_version = state_version + 1`);
  return { ok: true };
}

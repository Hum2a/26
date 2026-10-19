import { adminMediaSchema } from "@26/shared";

export function adminMedia(sql: SqlStorage, before?: number) {
  const rows = sql
    .exec<{
      cursor: number;
      media_id: string;
      kind: string;
      nickname: string;
      hidden: number;
    }>(
      `SELECT m.rowid AS cursor, m.media_id, m.kind, p.nickname, m.hidden
     FROM media_upload m JOIN player p ON p.player_id = m.player_id
     WHERE m.status = 'accepted' AND m.media_id IS NOT NULL AND m.rowid < ?
     ORDER BY m.rowid DESC LIMIT 51`,
      before ?? Number.MAX_SAFE_INTEGER,
    )
    .toArray();
  return adminMediaSchema.parse({
    items: rows.slice(0, 50).map((row) => ({
      mediaId: row.media_id,
      kind: row.kind,
      nickname: row.nickname,
      hidden: row.hidden === 1,
    })),
    nextCursor: rows.length > 50 ? String(rows[49]!.cursor) : null,
  });
}

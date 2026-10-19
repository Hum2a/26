import type { LobbySnapshot, PlaySnapshot } from "@26/shared";

/** Read accepted records, including removed players so the operator can recover
 * them. No score rules or identity heuristics live in this projection. */
export function adminPlayerRows(
  sql: SqlStorage,
  connected: ReadonlySet<string>,
  play: PlaySnapshot | null,
): NonNullable<LobbySnapshot["adminPlayers"]> {
  const answers = play?.hostAnswers ?? play?.hostResponses;
  const answered = answers ? new Set(answers.map((row) => row.playerId)) : undefined;
  return sql
    .exec<{
      player_id: string;
      nickname: string;
      revoked_at: string | null;
      points: number;
    }>(
      `SELECT player_id, nickname, revoked_at,
      COALESCE((SELECT SUM(points) FROM score_ledger WHERE player_id = player.player_id), 0)
      + COALESCE((SELECT SUM(points) FROM score_adjustment WHERE player_id = player.player_id), 0) AS points
     FROM player ORDER BY rowid ASC`,
    )
    .toArray()
    .map((row) => ({
      playerId: row.player_id,
      nickname: row.nickname,
      points: row.points,
      connected: !row.revoked_at && connected.has(row.player_id),
      removed: row.revoked_at !== null,
      answered: answered ? answered.has(row.player_id) : null,
    }));
}

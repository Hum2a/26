export function scoreSummaryMarkdown(sql: SqlStorage): string {
  const room = sql
    .exec<{
      game_id: string;
      join_code: string;
      phase: string;
      question_set_version: string;
      scoring_version: string;
    }>(
      `SELECT game_id, join_code, phase, question_set_version, scoring_version FROM room`,
    )
    .toArray()[0];
  if (!room) {
    throw new Error("This room does not exist.");
  }
  const rows = sql
    .exec<{ nickname: string; revoked_at: string | null; points: number }>(
      `SELECT player.nickname, player.revoked_at,
              COALESCE((
                SELECT SUM(score_ledger.points) FROM score_ledger
                WHERE score_ledger.player_id = player.player_id
              ), 0) AS points
       FROM player
       WHERE player.client_class = 'guest' OR player.client_class IS NULL
       ORDER BY points DESC, player.nickname ASC`,
    )
    .toArray();
  const lines = [
    "# Score summary",
    "",
    `Game ${room.game_id}`,
    `Join code ${room.join_code}`,
    `Phase ${room.phase}`,
    `Question set ${room.question_set_version}`,
    `Scoring ${room.scoring_version}`,
    "",
    "Position is by points. A removed phone keeps the points it had already scored.",
    "",
  ];
  if (rows.length === 0) {
    lines.push("No guests have joined.");
  }
  let position = 0;
  let previous: number | null = null;
  rows.forEach((row, index) => {
    if (previous === null || row.points !== previous) {
      position = index + 1;
      previous = row.points;
    }
    const removed = row.revoked_at ? " (removed)" : "";
    lines.push(`${position}. ${row.nickname}${removed} — ${row.points}`);
  });
  lines.push("");
  return lines.join("\n");
}

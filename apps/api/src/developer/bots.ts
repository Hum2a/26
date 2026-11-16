import { botCountSchema, roomPlayerLimit } from "@26/shared";
import { markKicked } from "../room/names.ts";
import { declineWaitingFor } from "../wall/moderation.ts";
import { syncWall } from "../wall/queue.ts";

export function developerDetails(sql: SqlStorage) {
  const row = sql
    .exec<{ revision: number; history: string }>(
      `SELECT revision, history FROM developer_tools WHERE id = 1`,
    )
    .toArray()[0];
  return {
    revision: row?.revision ?? 0,
    bots: sql
      .exec<{ player_id: string; nickname: string }>(
        `SELECT p.player_id, p.nickname FROM player p JOIN developer_bot b ON b.player_id = p.player_id
       WHERE p.revoked_at IS NULL ORDER BY b.ordinal`,
      )
      .toArray()
      .map((row) => ({ playerId: row.player_id, nickname: row.nickname })),
    history: JSON.parse(row?.history ?? "[]") as { atMs: number; count: number }[],
  };
}

/** Called inside the existing receipted host transaction. Target count, never additive. */
/** The room is running Humza's birthday script outside a dedicated rehearsal room. */
export function liveBirthdayGame(sql: SqlStorage): boolean {
  const script = sql
    .exec(
      `SELECT 1 FROM round_state WHERE question_id = '__pack' AND state_key = 'birthday-script'`,
    )
    .toArray().length;
  const rehearsal = sql
    .exec(`SELECT 1 FROM developer_rehearsal WHERE id = 1`)
    .toArray().length;
  return script > 0 && rehearsal === 0;
}

export function setBotCount(sql: SqlStorage, value: unknown, now: number) {
  const parsed = botCountSchema.safeParse(value);
  if (!parsed.success || !Number.isSafeInteger(now) || now < 0)
    throw new Error("Choose a whole bot count from 0 to 100.");
  const previous = developerDetails(sql);
  const count = parsed.data;
  const active = sql
    .exec<{ n: number }>(`SELECT COUNT(*) AS n FROM player WHERE revoked_at IS NULL`)
    .toArray()[0]!.n;
  if (active - previous.bots.length + count > roomPlayerLimit)
    throw new Error("Bots and guests together must fit within 100 players.");
  const phase = sql
    .exec<{ phase: string }>(`SELECT phase FROM room`)
    .toArray()[0]?.phase;
  if (count > 0 && (phase === "podium" || phase === "final" || phase === "facts"))
    throw new Error("Use a fresh room for another rehearsal.");
  // The real birthday game never takes bots; a dedicated rehearsal room may.
  if (count > previous.bots.length && liveBirthdayGame(sql))
    throw new Error(
      "Bots cannot join the live birthday game. Use a rehearsal room to test with bots.",
    );
  for (const bot of previous.bots.slice(count)) {
    markKicked(sql, bot.playerId, new Date(now).toISOString());
    declineWaitingFor(sql, bot.playerId);
  }
  let ordinal = sql
    .exec<{ n: number }>(`SELECT COALESCE(MAX(ordinal), 0) AS n FROM developer_bot`)
    .toArray()[0]!.n;
  for (let index = previous.bots.length; index < count; index++) {
    let nickname: string;
    do {
      ordinal++;
      nickname = `Bot ${String(ordinal).padStart(3, "0")}`;
    } while (
      sql
        .exec(
          `SELECT player_id FROM player WHERE nickname_key = ? AND revoked_at IS NULL`,
          nickname.toLowerCase(),
        )
        .toArray().length
    );
    const playerId = crypto.randomUUID();
    sql.exec(
      `INSERT INTO player (player_id, nickname, nickname_key, client_class, joined_at) VALUES (?, ?, ?, 'synthetic', ?)`,
      playerId,
      nickname,
      nickname.toLowerCase(),
      new Date(now).toISOString(),
    );
    sql.exec(
      `INSERT INTO developer_bot (player_id, ordinal) VALUES (?, ?)`,
      playerId,
      ordinal,
    );
  }
  sql.exec(
    `UPDATE developer_rehearsal SET payload=json_set(payload,'$.config.botCount',?) WHERE id=1`,
    count,
  );
  const history = [...previous.history, { atMs: now, count }].slice(-20);
  sql.exec(
    `INSERT INTO developer_tools (id, revision, history) VALUES (1, 1, ?)
    ON CONFLICT(id) DO UPDATE SET revision = revision + 1, history = excluded.history`,
    JSON.stringify(history),
  );
  sql.exec(`UPDATE room SET state_version = state_version + 1`);
  syncWall(sql, "tick", now);
}

export function isActiveBot(sql: SqlStorage, playerId: string): boolean {
  return (
    sql
      .exec(
        `SELECT b.player_id FROM developer_bot b JOIN player p ON p.player_id = b.player_id
    WHERE b.player_id = ? AND p.revoked_at IS NULL`,
        playerId,
      )
      .toArray().length === 1
  );
}

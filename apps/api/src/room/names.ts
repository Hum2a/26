import {
  adjustmentReasonMessage,
  maxNameReactions,
  maxPlayers,
  nicknameTakenMessage,
  playerMissingMessage,
  reactionClosedMessage,
  reactionLimitMessage,
  reactionSelfMessage,
} from "./limits.ts";

export type CloudName = {
  playerId: string;
  nickname: string;
  likes: number;
  dislikes: number;
};

export type NameReveal = {
  liked: { nickname: string; count: number }[];
  disliked: { nickname: string; count: number }[];
};

export function applyReaction(
  sql: SqlStorage,
  input: {
    voterId: string;
    targetId: string;
    reaction: "like" | "dislike";
    phase: string;
    now: number;
  },
): { ok: true } | { ok: false; message: string } {
  if (input.phase !== "lobby") {
    return { ok: false, message: reactionClosedMessage };
  }
  if (input.voterId === input.targetId) {
    return { ok: false, message: reactionSelfMessage };
  }
  const target = sql
    .exec<{ player_id: string }>(
      `SELECT player_id FROM player WHERE player_id = ? AND revoked_at IS NULL`,
      input.targetId,
    )
    .toArray()[0];
  if (!target) {
    return { ok: false, message: playerMissingMessage };
  }
  const existing = sql
    .exec<{ reaction: string }>(
      `SELECT reaction FROM name_reaction WHERE voter_id = ? AND target_id = ?`,
      input.voterId,
      input.targetId,
    )
    .toArray()[0];
  if (existing?.reaction === input.reaction) {
    sql.exec(
      `DELETE FROM name_reaction WHERE voter_id = ? AND target_id = ?`,
      input.voterId,
      input.targetId,
    );
    return { ok: true };
  }
  if (!existing) {
    const used = sql
      .exec<{ total: number }>(
        `SELECT COUNT(*) AS total FROM name_reaction WHERE voter_id = ?`,
        input.voterId,
      )
      .toArray()[0];
    if ((used?.total ?? 0) >= maxNameReactions) {
      return { ok: false, message: reactionLimitMessage };
    }
    sql.exec(
      `INSERT INTO name_reaction (
         voter_id, target_id, reaction, updated_at, device_context_id
       ) VALUES (?, ?, ?, ?, (SELECT device_context_id FROM player WHERE player_id = ?))`,
      input.voterId,
      input.targetId,
      input.reaction,
      input.now,
      input.voterId,
    );
    return { ok: true };
  }
  sql.exec(
    `UPDATE name_reaction SET reaction = ?, updated_at = ? WHERE voter_id = ? AND target_id = ?`,
    input.reaction,
    input.now,
    input.voterId,
    input.targetId,
  );
  return { ok: true };
}

export function cloudRows(sql: SqlStorage): CloudName[] {
  return sql
    .exec<{ player_id: string; nickname: string; likes: number; dislikes: number }>(
      `SELECT player.player_id, player.nickname,
              COALESCE(SUM(CASE WHEN name_reaction.reaction = 'like' THEN 1 ELSE 0 END), 0) AS likes,
              COALESCE(SUM(CASE WHEN name_reaction.reaction = 'dislike' THEN 1 ELSE 0 END), 0) AS dislikes
       FROM player
       LEFT JOIN name_reaction ON name_reaction.target_id = player.player_id
       WHERE player.revoked_at IS NULL
       GROUP BY player.player_id, player.nickname
       ORDER BY player.rowid ASC`,
    )
    .toArray()
    .map((row) => ({
      playerId: row.player_id,
      nickname: row.nickname,
      likes: Number(row.likes),
      dislikes: Number(row.dislikes),
    }));
}

const EMPTY_VOTER_REACTIONS: { playerId: string; reaction: "like" | "dislike" }[] =
  Object.freeze([]) as unknown as { playerId: string; reaction: "like" | "dislike" }[];

export function allVoterReactions(
  sql: SqlStorage,
): Map<string, { playerId: string; reaction: "like" | "dislike" }[]> {
  const rows = sql
    .exec<{ voter_id: string; target_id: string; reaction: string }>(
      `SELECT voter_id, target_id, reaction FROM name_reaction ORDER BY updated_at ASC`,
    )
    .toArray();
  const map = new Map<string, { playerId: string; reaction: "like" | "dislike" }[]>();
  for (const row of rows) {
    if (row.reaction !== "like" && row.reaction !== "dislike") continue;
    let list = map.get(row.voter_id);
    if (!list) {
      list = [];
      map.set(row.voter_id, list);
    }
    list.push({ playerId: row.target_id, reaction: row.reaction });
  }
  return map;
}

export { EMPTY_VOTER_REACTIONS };

export function voterReactions(
  sql: SqlStorage,
  voterId: string,
): { playerId: string; reaction: "like" | "dislike" }[] {
  return sql
    .exec<{ target_id: string; reaction: string }>(
      `SELECT target_id, reaction FROM name_reaction WHERE voter_id = ? ORDER BY updated_at ASC`,
      voterId,
    )
    .toArray()
    .flatMap((row) =>
      row.reaction === "like" || row.reaction === "dislike"
        ? [{ playerId: row.target_id, reaction: row.reaction }]
        : [],
    );
}

export function revealNames(
  sql: SqlStorage,
  precomputedCloud?: CloudName[],
): NameReveal {
  const rows = precomputedCloud ?? cloudRows(sql);
  return {
    liked: extremes(rows, "likes"),
    disliked: extremes(rows, "dislikes"),
  };
}

export function renamePlayer(
  sql: SqlStorage,
  playerId: string,
  nickname: string,
): { ok: true } | { ok: false; message: string } {
  const player = activePlayer(sql, playerId);
  if (!player) {
    return { ok: false, message: playerMissingMessage };
  }
  const key = nickname.toLowerCase();
  if (player.nickname_key === key) {
    return { ok: true };
  }
  const taken = sql
    .exec<{ player_id: string }>(
      `SELECT player_id FROM player WHERE revoked_at IS NULL AND nickname_key = ? AND player_id != ?`,
      key,
      playerId,
    )
    .toArray()[0];
  if (taken) {
    return { ok: false, message: nicknameTakenMessage };
  }
  sql.exec(
    `UPDATE player SET nickname = ?, nickname_key = ? WHERE player_id = ?`,
    nickname,
    key,
    playerId,
  );
  return { ok: true };
}

export function swapNicknames(
  sql: SqlStorage,
  firstId: string,
  secondId: string,
): { ok: true } | { ok: false; message: string } {
  if (firstId === secondId) {
    return { ok: false, message: playerMissingMessage };
  }
  const first = activePlayer(sql, firstId);
  const second = activePlayer(sql, secondId);
  if (!first || !second) {
    return { ok: false, message: playerMissingMessage };
  }
  sql.exec(
    `UPDATE player SET nickname_key = ? WHERE player_id = ?`,
    `swap-${firstId}`,
    firstId,
  );
  sql.exec(
    `UPDATE player SET nickname = ?, nickname_key = ? WHERE player_id = ?`,
    first.nickname,
    first.nickname_key,
    secondId,
  );
  sql.exec(
    `UPDATE player SET nickname = ?, nickname_key = ? WHERE player_id = ?`,
    second.nickname,
    second.nickname_key,
    firstId,
  );
  return { ok: true };
}

export function markKicked(sql: SqlStorage, playerId: string, now: string): boolean {
  const player = sql
    .exec<{ revoked_at: string | null }>(
      `SELECT revoked_at FROM player WHERE player_id = ?`,
      playerId,
    )
    .toArray()[0];
  if (!player || player.revoked_at) {
    return false;
  }
  sql.exec(`UPDATE player SET revoked_at = ? WHERE player_id = ?`, now, playerId);
  // A removed player's old transfer codes must never become valid on recovery.
  sql.exec(
    `UPDATE transfer SET consumed_at = ? WHERE player_id = ? AND consumed_at IS NULL`,
    now,
    playerId,
  );
  sql.exec(
    `UPDATE credential SET revoked_at = ? WHERE player_id = ? AND revoked_at IS NULL`,
    now,
    playerId,
  );
  sql.exec(
    `DELETE FROM name_reaction WHERE voter_id = ? OR target_id = ?`,
    playerId,
    playerId,
  );
  return true;
}

export function markRecovered(sql: SqlStorage, playerId: string): boolean {
  const player = sql
    .exec<{ revoked_at: string | null }>(
      `SELECT revoked_at FROM player WHERE player_id = ?`,
      playerId,
    )
    .toArray()[0];
  if (!player?.revoked_at) {
    return false;
  }
  const collision = sql
    .exec(
      `SELECT player_id FROM player WHERE revoked_at IS NULL AND nickname_key =
     (SELECT nickname_key FROM player WHERE player_id = ?)`,
      playerId,
    )
    .toArray()[0];
  if (collision) {
    throw new Error(
      "That nickname is now in use. Rename the active player before recovering this one.",
    );
  }
  sql.exec(`UPDATE player SET revoked_at = NULL WHERE player_id = ?`, playerId);
  return true;
}

export function insertAdjustment(
  sql: SqlStorage,
  input: {
    adjustmentId: string;
    playerId: string;
    points: number;
    reason: string;
    now: number;
  },
): { ok: true } | { ok: false; message: string } {
  const reason = input.reason.trim();
  if (reason.length < 3 || reason.length > 80) {
    return { ok: false, message: adjustmentReasonMessage };
  }
  if (
    !Number.isInteger(input.points) ||
    input.points === 0 ||
    Math.abs(input.points) > 1000
  ) {
    return { ok: false, message: adjustmentReasonMessage };
  }
  const player = sql
    .exec<{ player_id: string }>(
      `SELECT player_id FROM player WHERE player_id = ?`,
      input.playerId,
    )
    .toArray()[0];
  if (!player) {
    return { ok: false, message: playerMissingMessage };
  }
  sql.exec(
    `INSERT INTO score_adjustment (adjustment_id, player_id, points, reason, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    input.adjustmentId,
    input.playerId,
    input.points,
    reason,
    input.now,
  );
  return { ok: true };
}

export function recentAdjustments(sql: SqlStorage): {
  playerId: string;
  nickname: string;
  points: number;
  reason: string;
}[] {
  return sql
    .exec<{ player_id: string; nickname: string; points: number; reason: string }>(
      `SELECT score_adjustment.player_id, player.nickname, score_adjustment.points, score_adjustment.reason
       FROM score_adjustment
       JOIN player ON player.player_id = score_adjustment.player_id
       ORDER BY score_adjustment.created_at DESC
       LIMIT 20`,
    )
    .toArray()
    .map((row) => ({
      playerId: row.player_id,
      nickname: row.nickname,
      points: row.points,
      reason: row.reason,
    }))
    .reverse();
}

export function seedDemoNames(
  sql: SqlStorage,
  target: number,
  joinedAt: string,
): number {
  const limit = Math.min(maxPlayers, target);
  let guard = 0;
  while (activeCount(sql) < limit && guard < 200) {
    guard += 1;
    const nickname = `Demo ${String(guard).padStart(2, "0")}`;
    const key = nickname.toLowerCase();
    const taken = sql
      .exec<{ player_id: string }>(
        `SELECT player_id FROM player WHERE revoked_at IS NULL AND nickname_key = ?`,
        key,
      )
      .toArray()[0];
    if (taken) {
      continue;
    }
    sql.exec(
      `INSERT INTO player (
         player_id, nickname, nickname_key, revoked_at, device_context_id,
         device_context_version, client_class, joined_at
       ) VALUES (?, ?, ?, NULL, NULL, NULL, 'synthetic', ?)`,
      crypto.randomUUID(),
      nickname,
      key,
      joinedAt,
    );
  }
  return activeCount(sql);
}

export function activeCount(sql: SqlStorage): number {
  const row = sql
    .exec<{ total: number }>(
      `SELECT COUNT(*) AS total FROM player WHERE revoked_at IS NULL`,
    )
    .toArray()[0];
  return row?.total ?? 0;
}

function activePlayer(
  sql: SqlStorage,
  playerId: string,
): { nickname: string; nickname_key: string } | undefined {
  return sql
    .exec<{ nickname: string; nickname_key: string }>(
      `SELECT nickname, nickname_key FROM player WHERE player_id = ? AND revoked_at IS NULL`,
      playerId,
    )
    .toArray()[0];
}

function extremes(
  rows: CloudName[],
  field: "likes" | "dislikes",
): { nickname: string; count: number }[] {
  const best = rows.reduce((highest, row) => Math.max(highest, row[field]), 0);
  if (best <= 0) {
    return [];
  }
  return rows
    .filter((row) => row[field] === best)
    .slice(0, 3)
    .map((row) => ({ nickname: row.nickname, count: row[field] }));
}

import type { ScheduleStorage } from "../room/scheduler.ts";
import type { ArchiveDocument, PersonalArchive, PublicArchive } from "./document.ts";
import type { ArchiveWriteResult, ArchiveWriter } from "./store.ts";

/**
 * Local stand-in used only when APP_ENV is local and DATABASE_URL is unset.
 * Staging and production do not write these tables.
 */
export function sqliteMirror(storage: ScheduleStorage): ArchiveWriter {
  return {
    async write(document) {
      let result: ArchiveWriteResult = "stored";
      await storage.transaction(async () => {
        ensureMirror(storage.sql);
        const existing = storage.sql
          .exec(
            `SELECT revision FROM dev_archive_publication WHERE game_id = ? AND revision = ?`,
            document.gameId,
            document.revision,
          )
          .toArray()[0];
        if (existing) {
          result = "present";
          return;
        }
        insertMirror(storage.sql, document);
      });
      return result;
    },
    async purgeDeviceDetails(nowMs) {
      ensureMirror(storage.sql);
      const cutoff = new Date(nowMs).toISOString();
      const rows = storage.sql
        .exec<{ context_id: string }>(
          `DELETE FROM dev_archive_device_detail WHERE retain_until <= ? RETURNING context_id`,
          cutoff,
        )
        .toArray();
      return rows.length;
    },
    async readPublic(gameId) {
      ensureMirror(storage.sql);
      return readMirrorPublic(storage.sql, gameId);
    },
    async readPersonal(gameId, playerId) {
      ensureMirror(storage.sql);
      return readMirrorPersonal(storage.sql, gameId, playerId);
    },
  };
}

function ensureMirror(sql: SqlStorage): void {
  sql.exec(
    `CREATE TABLE IF NOT EXISTS dev_archive_publication (
      game_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      kind TEXT NOT NULL,
      question_set_version TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      PRIMARY KEY (game_id, revision)
    )`,
  );
  sql.exec(
    `CREATE TABLE IF NOT EXISTS dev_archive_standing (
      game_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      player_id TEXT NOT NULL,
      nickname TEXT NOT NULL,
      position INTEGER NOT NULL,
      points INTEGER NOT NULL,
      PRIMARY KEY (game_id, revision, player_id)
    )`,
  );
  sql.exec(
    `CREATE TABLE IF NOT EXISTS dev_archive_highlight (
      game_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      position INTEGER NOT NULL,
      card_json TEXT NOT NULL,
      PRIMARY KEY (game_id, revision, position)
    )`,
  );
  sql.exec(
    `CREATE TABLE IF NOT EXISTS dev_archive_media_ref (
      game_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      media_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      nickname TEXT NOT NULL,
      hidden INTEGER NOT NULL,
      PRIMARY KEY (game_id, revision, media_id)
    )`,
  );
  sql.exec(
    `CREATE TABLE IF NOT EXISTS dev_archive_player_detail (
      game_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      player_id TEXT NOT NULL,
      detail_json TEXT NOT NULL,
      PRIMARY KEY (game_id, revision, player_id)
    )`,
  );
  sql.exec(
    `CREATE TABLE IF NOT EXISTS dev_archive_device_detail (
      game_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      context_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      retain_until TEXT NOT NULL,
      report_json TEXT NOT NULL,
      PRIMARY KEY (game_id, revision, context_id)
    )`,
  );
  sql.exec(
    `CREATE TABLE IF NOT EXISTS dev_archive_fun_fact (
      game_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      position INTEGER NOT NULL,
      fact_id TEXT NOT NULL,
      card_json TEXT NOT NULL,
      PRIMARY KEY (game_id, revision, position)
    )`,
  );
  sql.exec(
    `CREATE TABLE IF NOT EXISTS dev_archive_fun_fact_member (
      game_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      fact_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      PRIMARY KEY (game_id, revision, fact_id, player_id)
    )`,
  );
}

function insertMirror(sql: SqlStorage, document: ArchiveDocument): void {
  sql.exec(
    `INSERT INTO dev_archive_publication (
       game_id, revision, kind, question_set_version, completed_at
     ) VALUES (?, ?, ?, ?, ?)`,
    document.gameId,
    document.revision,
    document.kind,
    document.questionSetVersion,
    document.completedAt,
  );
  for (const standing of document.standings) {
    sql.exec(
      `INSERT INTO dev_archive_standing (
         game_id, revision, player_id, nickname, position, points
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      document.gameId,
      document.revision,
      standing.playerId,
      standing.nickname,
      standing.position,
      standing.points,
    );
  }
  for (const [index, card] of document.highlights.entries()) {
    sql.exec(
      `INSERT INTO dev_archive_highlight (game_id, revision, position, card_json)
       VALUES (?, ?, ?, ?)`,
      document.gameId,
      document.revision,
      index,
      JSON.stringify(card),
    );
  }
  for (const media of document.media) {
    sql.exec(
      `INSERT INTO dev_archive_media_ref (
         game_id, revision, media_id, kind, nickname, hidden
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      document.gameId,
      document.revision,
      media.mediaId,
      media.kind,
      media.nickname,
      media.hidden ? 1 : 0,
    );
  }
  for (const player of document.players) {
    sql.exec(
      `INSERT INTO dev_archive_player_detail (game_id, revision, player_id, detail_json)
       VALUES (?, ?, ?, ?)`,
      document.gameId,
      document.revision,
      player.playerId,
      JSON.stringify({
        recap: player.recap,
        scores: player.scores,
        effects: player.effects,
      }),
    );
  }
  for (const [index, fact] of document.funFacts.entries()) {
    sql.exec(
      `INSERT INTO dev_archive_fun_fact (game_id, revision, position, fact_id, card_json)
       VALUES (?, ?, ?, ?, ?)`,
      document.gameId,
      document.revision,
      index,
      fact.card.id,
      JSON.stringify(fact.card),
    );
    for (const playerId of fact.memberIds) {
      sql.exec(
        `INSERT INTO dev_archive_fun_fact_member (game_id, revision, fact_id, player_id)
         VALUES (?, ?, ?, ?)`,
        document.gameId,
        document.revision,
        fact.card.id,
        playerId,
      );
    }
  }
  for (const device of document.devices) {
    sql.exec(
      `INSERT INTO dev_archive_device_detail (
         game_id, revision, context_id, player_id, retain_until, report_json
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      document.gameId,
      document.revision,
      device.contextId,
      device.playerId,
      device.retainUntil,
      device.reportJson,
    );
  }
}

function readMirrorPublic(sql: SqlStorage, gameId: string): PublicArchive | null {
  const row = sql
    .exec<{ revision: number; kind: string; question_set_version: string }>(
      `SELECT revision, kind, question_set_version
       FROM dev_archive_publication
       WHERE game_id = ?
       ORDER BY revision DESC
       LIMIT 1`,
      gameId,
    )
    .toArray()[0];
  if (!row) {
    return null;
  }
  const standings = sql
    .exec<{ player_id: string; nickname: string; position: number; points: number }>(
      `SELECT player_id, nickname, position, points
       FROM dev_archive_standing
       WHERE game_id = ? AND revision = ?
       ORDER BY position, nickname`,
      gameId,
      row.revision,
    )
    .toArray();
  const highlights = sql
    .exec<{ card_json: string }>(
      `SELECT card_json FROM dev_archive_highlight
       WHERE game_id = ? AND revision = ?
       ORDER BY position`,
      gameId,
      row.revision,
    )
    .toArray();
  const media = sql
    .exec<{ media_id: string; kind: string; nickname: string; hidden: number }>(
      `SELECT media_id, kind, nickname, hidden
       FROM dev_archive_media_ref
       WHERE game_id = ? AND revision = ?`,
      gameId,
      row.revision,
    )
    .toArray();
  return {
    gameId,
    revision: row.revision,
    kind: row.kind === "correction" ? "correction" : "final",
    questionSetVersion: row.question_set_version,
    standings: standings.map((standing) => ({
      playerId: standing.player_id,
      nickname: standing.nickname,
      position: standing.position,
      points: standing.points,
    })),
    highlights: highlights.map(
      (card) => JSON.parse(card.card_json) as PublicArchive["highlights"][number],
    ),
    funFacts: sql
      .exec<{ card_json: string }>(
        `SELECT card_json FROM dev_archive_fun_fact
         WHERE game_id = ? AND revision = ?
         ORDER BY position`,
        gameId,
        row.revision,
      )
      .toArray()
      .map((card) => JSON.parse(card.card_json) as PublicArchive["funFacts"][number]),
    media: media.map((item) => ({
      mediaId: item.media_id,
      kind: item.kind,
      nickname: item.nickname,
      hidden: item.hidden === 1,
    })),
  };
}

function readMirrorPersonal(
  sql: SqlStorage,
  gameId: string,
  playerId: string,
): PersonalArchive | null {
  const publication = sql
    .exec<{ revision: number }>(
      `SELECT revision FROM dev_archive_publication
       WHERE game_id = ?
       ORDER BY revision DESC
       LIMIT 1`,
      gameId,
    )
    .toArray()[0];
  if (!publication) {
    return null;
  }
  const standing = sql
    .exec<{ nickname: string; position: number; points: number }>(
      `SELECT nickname, position, points FROM dev_archive_standing
       WHERE game_id = ? AND revision = ? AND player_id = ?`,
      gameId,
      publication.revision,
      playerId,
    )
    .toArray()[0];
  const detail = sql
    .exec<{ detail_json: string }>(
      `SELECT detail_json FROM dev_archive_player_detail
       WHERE game_id = ? AND revision = ? AND player_id = ?`,
      gameId,
      publication.revision,
      playerId,
    )
    .toArray()[0];
  if (!standing || !detail) {
    return null;
  }
  const parsed = JSON.parse(detail.detail_json) as {
    recap?: PersonalArchive["recap"];
    scores?: PersonalArchive["scores"];
    effects?: PersonalArchive["effects"];
  };
  const funFacts = sql
    .exec<{ fact_id: string; card_json: string }>(
      `SELECT fact_id, card_json FROM dev_archive_fun_fact
       WHERE game_id = ? AND revision = ?
       ORDER BY position`,
      gameId,
      publication.revision,
    )
    .toArray();
  const mine = new Set(
    sql
      .exec<{ fact_id: string }>(
        `SELECT fact_id FROM dev_archive_fun_fact_member
         WHERE game_id = ? AND revision = ? AND player_id = ?`,
        gameId,
        publication.revision,
        playerId,
      )
      .toArray()
      .map((row) => row.fact_id),
  );
  return {
    playerId,
    nickname: standing.nickname,
    position: standing.position,
    points: standing.points,
    recap: parsed.recap ?? [],
    scores: parsed.scores ?? [],
    effects: parsed.effects ?? { given: 0, received: 0 },
    funFacts: funFacts.map((row) => ({
      ...(JSON.parse(row.card_json) as PersonalArchive["funFacts"][number]),
      appliesToYou: mine.has(row.fact_id),
    })),
  };
}

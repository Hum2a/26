import type { AppDatabase, SqlQuery } from "../auth/create-database.ts";
import { applyArchiveSchema } from "./schema.ts";
import type {
  ArchiveDocument,
  ArchiveKind,
  PersonalArchive,
  PublicArchive,
} from "./document.ts";

export type ArchiveWriteResult = "stored" | "present";

export type ArchiveWriter = {
  write(document: ArchiveDocument): Promise<ArchiveWriteResult>;
  purgeDeviceDetails(nowMs: number): Promise<number>;
  readPublic(gameId: string): Promise<PublicArchive | null>;
  readPersonal(gameId: string, playerId: string): Promise<PersonalArchive | null>;
  /** Releases the connection a writer opened for one attempt. */
  close?(): Promise<void>;
};

/** The database answered, but this process must not keep a connection string or a row dump. */
export class ArchiveUnavailable extends Error {
  readonly code = "unavailable";

  constructor() {
    super("The archive database is unavailable.");
    this.name = "ArchiveUnavailable";
  }
}

export function postgresArchive(database: AppDatabase): ArchiveWriter {
  const ready = applyArchiveSchema(database);
  return {
    close: () => database.close(),
    async write(document) {
      await ready;
      return database.executor.transaction((query) =>
        insertPublication(query, document),
      );
    },
    async purgeDeviceDetails(nowMs) {
      await ready;
      const rows = await database.executor.query(
        `DELETE FROM archive_device_detail
         WHERE retain_until <= $1
         RETURNING context_id`,
        [new Date(nowMs).toISOString()],
      );
      return rows.length;
    },
    async readPublic(gameId) {
      await ready;
      return readPublicArchive(database.executor.query, gameId);
    },
    async readPersonal(gameId, playerId) {
      await ready;
      return readPersonalArchive(database.executor.query, gameId, playerId);
    },
  };
}

export function unavailableArchive(): ArchiveWriter {
  return {
    async write() {
      throw new ArchiveUnavailable();
    },
    async purgeDeviceDetails() {
      throw new ArchiveUnavailable();
    },
    async readPublic() {
      throw new ArchiveUnavailable();
    },
    async readPersonal() {
      throw new ArchiveUnavailable();
    },
  };
}

async function insertPublication(
  query: SqlQuery,
  document: ArchiveDocument,
): Promise<ArchiveWriteResult> {
  const inserted = await query(
    `INSERT INTO archive_publication (
       game_id, revision, kind, question_set_version, completed_at
     ) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (game_id, revision) DO NOTHING
     RETURNING revision`,
    [
      document.gameId,
      document.revision,
      document.kind,
      document.questionSetVersion,
      document.completedAt,
    ],
  );
  if (inserted.length === 0) {
    return "present";
  }
  for (const standing of document.standings) {
    await query(
      `INSERT INTO archive_standing (
         game_id, revision, player_id, nickname, position, points
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        document.gameId,
        document.revision,
        standing.playerId,
        standing.nickname,
        standing.position,
        standing.points,
      ],
    );
  }
  for (const [index, card] of document.highlights.entries()) {
    await query(
      `INSERT INTO archive_highlight (game_id, revision, position, card_json)
       VALUES ($1, $2, $3, $4)`,
      [document.gameId, document.revision, index, JSON.stringify(card)],
    );
  }
  for (const [index, fact] of document.funFacts.entries()) {
    await query(
      `INSERT INTO archive_fun_fact (game_id, revision, position, fact_id, card_json)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        document.gameId,
        document.revision,
        index,
        fact.card.id,
        JSON.stringify(fact.card),
      ],
    );
    for (const playerId of fact.memberIds) {
      await query(
        `INSERT INTO archive_fun_fact_member (game_id, revision, fact_id, player_id)
         VALUES ($1, $2, $3, $4)`,
        [document.gameId, document.revision, fact.card.id, playerId],
      );
    }
  }
  for (const media of document.media) {
    await query(
      `INSERT INTO archive_media_ref (
         game_id, revision, media_id, kind, nickname, hidden
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        document.gameId,
        document.revision,
        media.mediaId,
        media.kind,
        media.nickname,
        media.hidden,
      ],
    );
  }
  for (const player of document.players) {
    await query(
      `INSERT INTO archive_player_detail (game_id, revision, player_id, detail_json)
       VALUES ($1, $2, $3, $4)`,
      [
        document.gameId,
        document.revision,
        player.playerId,
        JSON.stringify({
          recap: player.recap,
          scores: player.scores,
          effects: player.effects,
        }),
      ],
    );
  }
  for (const fact of document.facts) {
    await query(
      `INSERT INTO archive_stat_fact (game_id, revision, fact_id, fact_json)
       VALUES ($1, $2, $3, $4)`,
      [document.gameId, document.revision, fact.id, JSON.stringify(fact)],
    );
  }
  for (const device of document.devices) {
    await query(
      `INSERT INTO archive_device_detail (
         game_id, revision, context_id, player_id, retain_until, report_json
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        document.gameId,
        document.revision,
        device.contextId,
        device.playerId,
        device.retainUntil,
        device.reportJson,
      ],
    );
  }
  return "stored";
}

async function readPublicArchive(
  query: SqlQuery,
  gameId: string,
): Promise<PublicArchive | null> {
  const publication = await query(
    `SELECT revision, kind, question_set_version
     FROM archive_publication
     WHERE game_id = $1
     ORDER BY revision DESC
     LIMIT 1`,
    [gameId],
  );
  const row = publication[0];
  if (!row) {
    return null;
  }
  const revision = Number(row.revision);
  const standings = await query(
    `SELECT player_id, nickname, position, points
     FROM archive_standing
     WHERE game_id = $1 AND revision = $2
     ORDER BY position, nickname`,
    [gameId, revision],
  );
  const highlights = await query(
    `SELECT card_json FROM archive_highlight
     WHERE game_id = $1 AND revision = $2
     ORDER BY position`,
    [gameId, revision],
  );
  const media = await query(
    `SELECT media_id, kind, nickname, hidden
     FROM archive_media_ref
     WHERE game_id = $1 AND revision = $2
     ORDER BY media_id`,
    [gameId, revision],
  );
  return {
    gameId,
    revision,
    kind: row.kind === "correction" ? "correction" : "final",
    questionSetVersion: String(row.question_set_version),
    standings: standings.map((standing) => ({
      playerId: String(standing.player_id),
      nickname: String(standing.nickname),
      position: Number(standing.position),
      points: Number(standing.points),
    })),
    highlights: highlights.map((card) => JSON.parse(String(card.card_json))),
    funFacts: await readFunFactCards(query, gameId, revision),
    media: media.map((item) => ({
      mediaId: String(item.media_id),
      kind: String(item.kind),
      nickname: String(item.nickname),
      hidden: item.hidden === true || item.hidden === 1 || item.hidden === "t",
    })),
  };
}

async function readPersonalArchive(
  query: SqlQuery,
  gameId: string,
  playerId: string,
): Promise<PersonalArchive | null> {
  const publication = await query(
    `SELECT revision FROM archive_publication
     WHERE game_id = $1
     ORDER BY revision DESC
     LIMIT 1`,
    [gameId],
  );
  const revision = Number(publication[0]?.revision);
  if (!publication[0]) {
    return null;
  }
  const standing = await query(
    `SELECT nickname, position, points
     FROM archive_standing
     WHERE game_id = $1 AND revision = $2 AND player_id = $3`,
    [gameId, revision, playerId],
  );
  const detail = await query(
    `SELECT detail_json FROM archive_player_detail
     WHERE game_id = $1 AND revision = $2 AND player_id = $3`,
    [gameId, revision, playerId],
  );
  const row = standing[0];
  const stored = detail[0];
  if (!row || !stored) {
    return null;
  }
  const parsed = JSON.parse(String(stored.detail_json)) as {
    recap?: PersonalArchive["recap"];
    scores?: PersonalArchive["scores"];
    effects?: PersonalArchive["effects"];
  };
  const funFacts = await readPersonalFunFacts(query, gameId, revision, playerId);
  return {
    playerId,
    nickname: String(row.nickname),
    position: Number(row.position),
    points: Number(row.points),
    recap: parsed.recap ?? [],
    scores: parsed.scores ?? [],
    effects: parsed.effects ?? { given: 0, received: 0 },
    funFacts,
  };
}

async function readFunFactCards(query: SqlQuery, gameId: string, revision: number) {
  const rows = await query(
    `SELECT card_json FROM archive_fun_fact
     WHERE game_id = $1 AND revision = $2
     ORDER BY position`,
    [gameId, revision],
  );
  return rows.map((row) => JSON.parse(String(row.card_json)));
}

async function readPersonalFunFacts(
  query: SqlQuery,
  gameId: string,
  revision: number,
  playerId: string,
) {
  const cards = await query(
    `SELECT fact_id, card_json FROM archive_fun_fact
     WHERE game_id = $1 AND revision = $2
     ORDER BY position`,
    [gameId, revision],
  );
  const membership = await query(
    `SELECT fact_id FROM archive_fun_fact_member
     WHERE game_id = $1 AND revision = $2 AND player_id = $3`,
    [gameId, revision, playerId],
  );
  const mine = new Set(membership.map((row) => String(row.fact_id)));
  return cards.map((row) => ({
    ...(JSON.parse(String(row.card_json)) as {
      id: string;
      illustrative: boolean;
      text: string;
    }),
    appliesToYou: mine.has(String(row.fact_id)),
  }));
}

export function publicationCount(query: SqlQuery, gameId: string): Promise<number> {
  return query(`SELECT revision FROM archive_publication WHERE game_id = $1`, [
    gameId,
  ]).then((rows) => rows.length);
}

export function isArchiveKind(value: unknown): value is ArchiveKind {
  return value === "final" || value === "correction";
}

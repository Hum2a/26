import type { AppDatabase } from "../auth/create-database.ts";

/** Archive tables are version 3. A later migration must not rewrite a frozen publication. */
export const archiveSchemaVersion = 3;

/**
 * Public rows and personal rows are different tables.
 * A publication is immutable: a later correction inserts a new revision.
 */
export const archiveStatements: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS archive_schema (
    id integer PRIMARY KEY CHECK (id = 1),
    version integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS archive_publication (
    game_id text NOT NULL,
    revision integer NOT NULL,
    kind text NOT NULL CHECK (kind IN ('final', 'correction')),
    question_set_version text NOT NULL,
    completed_at timestamptz NOT NULL,
    PRIMARY KEY (game_id, revision)
  )`,
  `CREATE INDEX IF NOT EXISTS archive_publication_latest
    ON archive_publication (game_id, revision DESC)`,
  `CREATE TABLE IF NOT EXISTS archive_standing (
    game_id text NOT NULL,
    revision integer NOT NULL,
    player_id text NOT NULL,
    nickname text NOT NULL,
    position integer NOT NULL,
    points integer NOT NULL,
    PRIMARY KEY (game_id, revision, player_id),
    FOREIGN KEY (game_id, revision)
      REFERENCES archive_publication (game_id, revision)
  )`,
  `CREATE INDEX IF NOT EXISTS archive_standing_order
    ON archive_standing (game_id, revision, position)`,
  `CREATE TABLE IF NOT EXISTS archive_highlight (
    game_id text NOT NULL,
    revision integer NOT NULL,
    position integer NOT NULL,
    card_json text NOT NULL,
    PRIMARY KEY (game_id, revision, position),
    FOREIGN KEY (game_id, revision)
      REFERENCES archive_publication (game_id, revision)
  )`,
  `CREATE TABLE IF NOT EXISTS archive_media_ref (
    game_id text NOT NULL,
    revision integer NOT NULL,
    media_id text NOT NULL,
    kind text NOT NULL,
    nickname text NOT NULL,
    hidden boolean NOT NULL,
    PRIMARY KEY (game_id, revision, media_id),
    FOREIGN KEY (game_id, revision)
      REFERENCES archive_publication (game_id, revision)
  )`,
  `CREATE TABLE IF NOT EXISTS archive_player_detail (
    game_id text NOT NULL,
    revision integer NOT NULL,
    player_id text NOT NULL,
    detail_json text NOT NULL,
    PRIMARY KEY (game_id, revision, player_id),
    FOREIGN KEY (game_id, revision)
      REFERENCES archive_publication (game_id, revision)
  )`,
  `CREATE TABLE IF NOT EXISTS archive_stat_fact (
    game_id text NOT NULL,
    revision integer NOT NULL,
    fact_id text NOT NULL,
    fact_json text NOT NULL,
    PRIMARY KEY (game_id, revision, fact_id),
    FOREIGN KEY (game_id, revision)
      REFERENCES archive_publication (game_id, revision)
  )`,
  `CREATE TABLE IF NOT EXISTS archive_device_detail (
    game_id text NOT NULL,
    revision integer NOT NULL,
    context_id text NOT NULL,
    player_id text NOT NULL,
    retain_until timestamptz NOT NULL,
    report_json text NOT NULL,
    PRIMARY KEY (game_id, revision, context_id),
    FOREIGN KEY (game_id, revision)
      REFERENCES archive_publication (game_id, revision)
  )`,
  `CREATE INDEX IF NOT EXISTS archive_device_detail_retain
    ON archive_device_detail (retain_until)`,
  `INSERT INTO archive_schema (id, version) VALUES (1, 1)
   ON CONFLICT (id) DO NOTHING`,
];

/** Sentences shown at the end of the night. Membership stays off the public read. */
export const archiveFunFactStatements: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS archive_fun_fact (
    game_id text NOT NULL,
    revision integer NOT NULL,
    position integer NOT NULL,
    fact_id text NOT NULL,
    card_json text NOT NULL,
    PRIMARY KEY (game_id, revision, position),
    FOREIGN KEY (game_id, revision)
      REFERENCES archive_publication (game_id, revision)
  )`,
  `CREATE TABLE IF NOT EXISTS archive_fun_fact_member (
    game_id text NOT NULL,
    revision integer NOT NULL,
    fact_id text NOT NULL,
    player_id text NOT NULL,
    PRIMARY KEY (game_id, revision, fact_id, player_id),
    FOREIGN KEY (game_id, revision)
      REFERENCES archive_publication (game_id, revision)
  )`,
];

/** Delivery records. They do not alter a stored publication. */
export const archiveDeliveryStatements: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS archive_email_grant (
    grant_id text PRIMARY KEY,
    game_id text NOT NULL,
    player_id text NOT NULL,
    recipient text NOT NULL,
    purpose text NOT NULL CHECK (purpose IN ('verify', 'results')),
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS archive_email_grant_player
    ON archive_email_grant (game_id, player_id, purpose, recipient)`,
  `CREATE TABLE IF NOT EXISTS archive_delivery_job (
    job_id text PRIMARY KEY,
    game_id text NOT NULL,
    player_id text NOT NULL,
    purpose text NOT NULL CHECK (purpose IN ('verify', 'results')),
    recipient text NOT NULL,
    idempotency_key text NOT NULL UNIQUE,
    status text NOT NULL CHECK (status IN ('pending', 'uncertain', 'sent', 'failed')),
    attempts integer NOT NULL,
    body_text text,
    subject text,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    UNIQUE (game_id, player_id, purpose, recipient)
  )`,
];

export async function applyArchiveSchema(database: AppDatabase): Promise<void> {
  await database.executor.query(archiveStatements[0] ?? "");
  const existing = await database.executor.query(
    `SELECT version FROM archive_schema WHERE id = 1`,
  );
  if (existing.length === 0) {
    for (const statement of archiveStatements.slice(1)) {
      await database.executor.query(statement);
    }
  }
  const versionRow = await database.executor.query(
    `SELECT version FROM archive_schema WHERE id = 1`,
  );
  const version = Number(versionRow[0]?.version);
  if (version === 1) {
    for (const statement of archiveDeliveryStatements) {
      await database.executor.query(statement);
    }
    await database.executor.query(`UPDATE archive_schema SET version = 2 WHERE id = 1`);
  }
  if (version === 1 || version === 2) {
    for (const statement of archiveFunFactStatements) {
      await database.executor.query(statement);
    }
    await database.executor.query(`UPDATE archive_schema SET version = 3 WHERE id = 1`);
    return;
  }
  if (version !== archiveSchemaVersion) {
    throw new Error(`Unsupported archive schema version ${version}.`);
  }
}

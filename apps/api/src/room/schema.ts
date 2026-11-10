const partyStatements = [
  `CREATE TABLE IF NOT EXISTS developer_phone (player_id TEXT PRIMARY KEY)`,
  `CREATE TABLE IF NOT EXISTS developer_rehearsal (id INTEGER PRIMARY KEY CHECK (id=1), payload TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS developer_event (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, kind TEXT NOT NULL, actor TEXT NOT NULL, detail TEXT NOT NULL, status TEXT NOT NULL, phase TEXT NOT NULL, question_id TEXT)`,
  `CREATE TABLE IF NOT EXISTS developer_connection (player_id TEXT PRIMARY KEY, connected INTEGER NOT NULL, changed_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS developer_outage (principal TEXT PRIMARY KEY, until_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS developer_bot (player_id TEXT PRIMARY KEY, ordinal INTEGER NOT NULL UNIQUE)`,
  `CREATE TABLE IF NOT EXISTS developer_tools (id INTEGER PRIMARY KEY CHECK (id = 1), revision INTEGER NOT NULL, history TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS schema_meta (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS room (
    game_id TEXT PRIMARY KEY,
    join_code TEXT NOT NULL,
    phase TEXT NOT NULL,
    question_set_version TEXT NOT NULL,
    scoring_version TEXT NOT NULL,
    state_version INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS player (
    player_id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    nickname_key TEXT NOT NULL,
    revoked_at TEXT,
    device_context_id TEXT,
    device_context_version INTEGER
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS player_nickname_active
    ON player (nickname_key)
    WHERE revoked_at IS NULL`,
  `CREATE TABLE IF NOT EXISTS credential (
    id TEXT PRIMARY KEY,
    principal TEXT NOT NULL,
    player_id TEXT,
    secret_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS receipt (
    principal TEXT NOT NULL,
    request_id TEXT NOT NULL,
    payload_digest TEXT NOT NULL,
    result_json TEXT NOT NULL,
    PRIMARY KEY (principal, request_id)
  )`,
  `CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    principal TEXT NOT NULL,
    created_at TEXT NOT NULL,
    detail TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS transfer (
    code_hash TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    consumed_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS counter (
    scope TEXT NOT NULL,
    name TEXT NOT NULL,
    value INTEGER NOT NULL,
    PRIMARY KEY (scope, name)
  )`,
];

const registryStatements = [
  `CREATE TABLE IF NOT EXISTS pack_order (id TEXT PRIMARY KEY, payload TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS schema_meta (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS code (
    join_code TEXT PRIMARY KEY,
    game_id TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS receipt (
    principal TEXT NOT NULL,
    request_id TEXT NOT NULL,
    payload_digest TEXT NOT NULL,
    result_json TEXT NOT NULL,
    PRIMARY KEY (principal, request_id)
  )`,
];

const scheduleStatements = [
  `CREATE TABLE IF NOT EXISTS round_state (question_id TEXT NOT NULL, state_key TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY (question_id, state_key))`,
  `CREATE TABLE IF NOT EXISTS schedule_job (
    job_id TEXT PRIMARY KEY,
    job_type TEXT NOT NULL,
    due_at INTEGER,
    remaining_ms INTEGER,
    scope_generation INTEGER NOT NULL,
    phase_generation INTEGER NOT NULL,
    phase TEXT,
    status TEXT NOT NULL,
    retry_count INTEGER NOT NULL,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS schedule_job_due ON schedule_job (status, due_at)`,
  `CREATE TABLE IF NOT EXISTS chess_game (
    game_id TEXT PRIMARY KEY,
    round_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    fen TEXT NOT NULL,
    pgn TEXT NOT NULL,
    position_history TEXT NOT NULL,
    player_time_ms INTEGER NOT NULL,
    bot_time_ms INTEGER NOT NULL,
    last_move_at INTEGER NOT NULL,
    side_to_move TEXT NOT NULL,
    ply_count INTEGER NOT NULL,
    position_revision INTEGER NOT NULL,
    status TEXT NOT NULL,
    winner TEXT,
    terminated_at INTEGER,
    termination_reason TEXT,
    scored INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS chess_game_player ON chess_game (player_id)`,
  `CREATE INDEX IF NOT EXISTS chess_game_round ON chess_game (round_id)`,
  `CREATE INDEX IF NOT EXISTS chess_game_status ON chess_game (status)`,
  `CREATE TABLE IF NOT EXISTS room_archive (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    final_revision INTEGER NOT NULL,
    target_revision INTEGER NOT NULL,
    verified_revision INTEGER,
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL,
    last_error TEXT,
    kind TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS round_resource (
    resource_id TEXT PRIMARY KEY,
    round_id TEXT NOT NULL,
    phase_generation INTEGER NOT NULL,
    released_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS fixture_answer (
    player_id TEXT NOT NULL,
    phase_generation INTEGER NOT NULL,
    submitted_at INTEGER NOT NULL,
    PRIMARY KEY (player_id, phase_generation)
  )`,
  `CREATE TABLE IF NOT EXISTS choice_answer (
    player_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    phase_generation INTEGER NOT NULL,
    option_id TEXT NOT NULL,
    received_at INTEGER NOT NULL,
    deadline_at INTEGER NOT NULL,
    PRIMARY KEY (player_id, question_id)
  )`,
  `CREATE TABLE IF NOT EXISTS score_ledger (
    question_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    points INTEGER NOT NULL,
    detail TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (question_id, player_id)
  )`,
  `CREATE INDEX IF NOT EXISTS choice_answer_question ON choice_answer (question_id)`,
  `CREATE INDEX IF NOT EXISTS score_ledger_player ON score_ledger (player_id)`,
  `CREATE TABLE IF NOT EXISTS name_reaction (
    voter_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    reaction TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (voter_id, target_id)
  )`,
  `CREATE TABLE IF NOT EXISTS score_adjustment (
    adjustment_id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    points INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS name_reaction_target ON name_reaction (target_id)`,
  `CREATE INDEX IF NOT EXISTS score_adjustment_player ON score_adjustment (player_id)`,
  `CREATE TABLE IF NOT EXISTS round_response (
    player_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL,
    received_at INTEGER NOT NULL,
    deadline_at INTEGER NOT NULL,
    PRIMARY KEY (player_id, question_id)
  )`,
  `CREATE TABLE IF NOT EXISTS text_response (
    player_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    body TEXT NOT NULL,
    received_at INTEGER NOT NULL,
    deadline_at INTEGER NOT NULL,
    PRIMARY KEY (player_id, question_id)
  )`,
  `CREATE TABLE IF NOT EXISTS vote_candidate (
    question_id TEXT NOT NULL,
    candidate_id TEXT NOT NULL,
    owner_id TEXT,
    label TEXT NOT NULL,
    eligible INTEGER NOT NULL,
    included INTEGER NOT NULL,
    position INTEGER NOT NULL,
    PRIMARY KEY (question_id, candidate_id)
  )`,
  `CREATE TABLE IF NOT EXISTS vote_elector (
    question_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    PRIMARY KEY (question_id, player_id)
  )`,
  `CREATE TABLE IF NOT EXISTS vote_order (
    player_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    order_json TEXT NOT NULL,
    PRIMARY KEY (player_id, question_id)
  )`,
  `CREATE TABLE IF NOT EXISTS vote_ballot (
    player_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    candidate_id TEXT NOT NULL,
    received_at INTEGER NOT NULL,
    deadline_at INTEGER NOT NULL,
    PRIMARY KEY (player_id, question_id)
  )`,
  `CREATE TABLE IF NOT EXISTS vote_shortlist (
    question_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    PRIMARY KEY (question_id, player_id)
  )`,
  `CREATE TABLE IF NOT EXISTS vote_feature (
    question_id TEXT NOT NULL,
    candidate_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    PRIMARY KEY (question_id, candidate_id)
  )`,
  `CREATE TABLE IF NOT EXISTS vote_freeze (
    question_id TEXT PRIMARY KEY,
    seed TEXT NOT NULL,
    truth_id TEXT,
    frozen_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS duel_freeze (
    question_id TEXT PRIMARY KEY,
    seed TEXT NOT NULL,
    frozen_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS duel_pair (
    question_id TEXT NOT NULL,
    pair_index INTEGER NOT NULL,
    left_id TEXT NOT NULL,
    right_id TEXT,
    PRIMARY KEY (question_id, pair_index)
  )`,
  `CREATE TABLE IF NOT EXISTS duel_role (
    question_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    role TEXT NOT NULL,
    PRIMARY KEY (question_id, player_id)
  )`,
  `CREATE TABLE IF NOT EXISTS duel_answer (
    player_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    value REAL NOT NULL,
    received_at INTEGER NOT NULL,
    deadline_at INTEGER NOT NULL,
    PRIMARY KEY (player_id, question_id)
  )`,
  `CREATE TABLE IF NOT EXISTS duel_prediction (
    player_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    contestant_id TEXT NOT NULL,
    received_at INTEGER NOT NULL,
    deadline_at INTEGER NOT NULL,
    PRIMARY KEY (player_id, question_id)
  )`,
  `CREATE TABLE IF NOT EXISTS troll_token (
    player_id TEXT PRIMARY KEY,
    state TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS wall_post (
    post_id TEXT PRIMARY KEY,
    media_id TEXT NOT NULL UNIQUE,
    player_id TEXT NOT NULL,
    caption TEXT,
    frame TEXT NOT NULL,
    keep INTEGER NOT NULL,
    status TEXT NOT NULL,
    queued_at INTEGER,
    shown_at INTEGER,
    until_at INTEGER,
    decided_by TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS wall_post_player
    ON wall_post (player_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS wall_post_status
    ON wall_post (status, queued_at)`,
  `CREATE TABLE IF NOT EXISTS wall_reaction (
    post_id TEXT NOT NULL,
    emoji TEXT NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (post_id, emoji)
  )`,
  `CREATE TABLE IF NOT EXISTS wall_reactor (
    post_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    count INTEGER NOT NULL,
    last_at INTEGER NOT NULL,
    PRIMARY KEY (post_id, player_id)
  )`,
  `CREATE TABLE IF NOT EXISTS wall_setting (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled INTEGER NOT NULL,
    moderation TEXT NOT NULL,
    placement TEXT NOT NULL,
    show_ms INTEGER NOT NULL,
    captions INTEGER NOT NULL,
    muted_json TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS troll_switch (
    kind TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS troll_effect (
    effect_id TEXT PRIMARY KEY,
    actor_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    slot TEXT NOT NULL,
    status TEXT NOT NULL,
    question_index INTEGER NOT NULL,
    phase TEXT NOT NULL,
    phase_generation INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    started_at INTEGER,
    expires_at INTEGER,
    refunded INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS stage_cue (
    cue_id TEXT PRIMARY KEY,
    effect_id TEXT,
    label TEXT NOT NULL,
    asset_label TEXT NOT NULL,
    status TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    started_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS media_upload (
    upload_id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    question_index INTEGER NOT NULL,
    temp_key TEXT NOT NULL,
    final_key TEXT,
    media_id TEXT,
    status TEXT NOT NULL,
    source_etag TEXT,
    lease_until INTEGER,
    attempts INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    byte_length INTEGER,
    width INTEGER,
    height INTEGER,
    duration_ms INTEGER,
    content_type TEXT,
    hidden INTEGER NOT NULL,
    failure TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS media_upload_request
    ON media_upload (player_id, request_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS media_upload_media
    ON media_upload (media_id)
    WHERE media_id IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS device_context (
    context_id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    collector_version INTEGER NOT NULL,
    participating INTEGER NOT NULL,
    material_hash TEXT NOT NULL,
    phase_generation INTEGER,
    report_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS device_context_player
    ON device_context (player_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS connection_summary (
    player_id TEXT PRIMARY KEY,
    socket_opens INTEGER NOT NULL,
    reconnects INTEGER NOT NULL,
    rtt_count INTEGER NOT NULL,
    rtt_samples_json TEXT NOT NULL,
    rtt_median_ms INTEGER,
    rtt_upper_ms INTEGER,
    submission_retries INTEGER NOT NULL,
    upload_attempts INTEGER NOT NULL,
    upload_failures INTEGER NOT NULL,
    upload_duration_ms INTEGER NOT NULL,
    upload_duration_count INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS telemetry_aggregate (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    policy_version INTEGER NOT NULL,
    retention_days INTEGER NOT NULL,
    computed_at INTEGER NOT NULL,
    family_counts_json TEXT NOT NULL,
    player_count INTEGER NOT NULL,
    unknown_count INTEGER NOT NULL
  )`,
];

export function ensurePartySchema(sql: SqlStorage): void {
  for (const statement of [...partyStatements, ...scheduleStatements]) {
    sql.exec(statement);
  }
  addColumn(sql, "room", "phase_generation", "INTEGER NOT NULL DEFAULT 1");
  addColumn(sql, "room", "scope_generation", "INTEGER NOT NULL DEFAULT 1");
  addColumn(sql, "room", "paused", "INTEGER NOT NULL DEFAULT 0");
  addColumn(sql, "room", "controller_present", "INTEGER NOT NULL DEFAULT 0");
  addColumn(sql, "room", "stage_present", "INTEGER NOT NULL DEFAULT 0");
  addColumn(sql, "room", "hold", "TEXT");
  addColumn(sql, "room", "round_id", "TEXT");
  addColumn(sql, "room", "phases_json", "TEXT NOT NULL DEFAULT '[]'");
  addColumn(sql, "room", "durations_json", "TEXT NOT NULL DEFAULT '{}'");
  addColumn(sql, "room", "fault", "TEXT");
  addColumn(sql, "room", "question_index", "INTEGER NOT NULL DEFAULT 0");
  addColumn(sql, "room", "question_count", "INTEGER NOT NULL DEFAULT 0");
  addColumn(sql, "room", "collect_windows_json", "TEXT NOT NULL DEFAULT '[]'");
  addColumn(sql, "room", "finish_after", "INTEGER NOT NULL DEFAULT 0");
  addColumn(sql, "room", "opening", "TEXT");
  addColumn(sql, "room", "stage_hidden", "INTEGER NOT NULL DEFAULT 0");
  addColumn(sql, "room", "reveal_nonce", "INTEGER NOT NULL DEFAULT 0");
  const existing = sql
    .exec<{ version: number }>("SELECT version FROM schema_meta WHERE id = 1")
    .toArray()[0];
  addColumn(sql, "stage_cue", "media_id", "TEXT");
  addColumn(sql, "stage_cue", "audio_asset", "TEXT");
  addColumn(sql, "stage_cue", "media_kind", "TEXT");
  addColumn(sql, "stage_cue", "question_index", "INTEGER");
  // Troll lines that quote guests' answers record whose answers they quote
  // (JSON author ids for one question) and a line with no quote, so a stored cue
  // is checked against the host's Hide again whenever it is shown.
  addColumn(sql, "stage_cue", "quote_question_id", "TEXT");
  addColumn(sql, "stage_cue", "quote_authors", "TEXT");
  addColumn(sql, "stage_cue", "unquoted_label", "TEXT");
  // When the projector reported it could not display a wall photo; host only.
  addColumn(sql, "wall_post", "display_failed_at", "INTEGER");
  addColumn(sql, "room", "telemetry_retention_days", "INTEGER NOT NULL DEFAULT 30");
  addColumn(sql, "choice_answer", "device_context_id", "TEXT");
  addColumn(sql, "round_response", "device_context_id", "TEXT");
  addColumn(sql, "text_response", "device_context_id", "TEXT");
  addColumn(sql, "vote_ballot", "device_context_id", "TEXT");
  addColumn(sql, "duel_answer", "device_context_id", "TEXT");
  addColumn(sql, "duel_prediction", "device_context_id", "TEXT");
  addColumn(sql, "name_reaction", "device_context_id", "TEXT");
  addColumn(sql, "fixture_answer", "device_context_id", "TEXT");
  addColumn(sql, "troll_effect", "device_context_id", "TEXT");
  addColumn(sql, "player", "client_class", "TEXT NOT NULL DEFAULT 'guest'");
  addColumn(sql, "player", "joined_at", "TEXT");
  addColumn(sql, "media_upload", "purpose", "TEXT NOT NULL DEFAULT 'round'");
  addColumn(sql, "player", "driver_style", "TEXT");
  addColumn(sql, "player", "driver_face_media_id", "TEXT");
  // A guest's profile photo (a `face` media row) and the host's projector switch.
  addColumn(sql, "player", "avatar_media_id", "TEXT");
  addColumn(sql, "room", "voter_display", "TEXT NOT NULL DEFAULT 'question'");
  addColumn(sql, "room", "voter_display_history", "TEXT NOT NULL DEFAULT '[]'");
  addColumn(sql, "connection_summary", "script_errors", "INTEGER NOT NULL DEFAULT 0");
  addColumn(sql, "connection_summary", "last_script_error", "TEXT");
  addColumn(sql, "connection_summary", "last_script_error_at", "TEXT");
  addColumn(sql, "room", "fun_fact_index", "INTEGER NOT NULL DEFAULT 0");
  addColumn(sql, "room", "photo_bias_enabled", "INTEGER NOT NULL DEFAULT 1");
  addColumn(sql, "room", "photo_bias_revision", "INTEGER NOT NULL DEFAULT 0");
  addColumn(sql, "room", "photo_bias_history", "TEXT NOT NULL DEFAULT '[]'");
  addColumn(sql, "media_upload", "photo_family", "TEXT NOT NULL DEFAULT 'unknown'");
  if (!existing) {
    sql.exec("INSERT INTO schema_meta (id, version) VALUES (1, 15)");
    return;
  }
  if (existing.version >= 1 && existing.version <= 14) {
    sql.exec("UPDATE schema_meta SET version = 15 WHERE id = 1");
    return;
  }
  if (existing.version !== 15) {
    throw new Error(`Unsupported room schema version ${existing.version}.`);
  }
}

export function ensureRegistrySchema(sql: SqlStorage): void {
  ensure(sql, registryStatements);
}

function addColumn(
  sql: SqlStorage,
  table: string,
  column: string,
  definition: string,
): void {
  const present = sql
    .exec<{ name: string }>(`PRAGMA table_info(${table})`)
    .toArray()
    .some((row) => row.name === column);
  if (!present) {
    sql.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function ensure(sql: SqlStorage, statements: string[]): void {
  for (const statement of statements) {
    sql.exec(statement);
  }
  const existing = sql
    .exec<{ version: number }>("SELECT version FROM schema_meta WHERE id = 1")
    .toArray()[0];
  if (!existing) {
    sql.exec("INSERT INTO schema_meta (id, version) VALUES (1, 1)");
    return;
  }
  if (existing.version !== 1) {
    throw new Error(`Unsupported room schema version ${existing.version}.`);
  }
}

import { demoQuestionAt } from "../questions/demo-set.ts";
import {
  isTrollPayload,
  type GameStore,
  type RoomClock,
  type ScheduledJob,
} from "../room/lifecycle.ts";
import {
  answerPausedMessage,
  trollEscapeMessage,
  trollKindMessage,
  trollLockedMessage,
  trollMissingMessage,
  trollModifierMessage,
  trollPhaseMessage,
  trollSelfMessage,
  trollSlotMessage,
  trollAttributionMessage,
  trollSpentMessage,
  trollTargetMessage,
  trollVoiceMessage,
} from "../room/limits.ts";
import { createSqlStore } from "../room/sql-store.ts";
import {
  demoStingAsset,
  isTrollKind,
  slotDecision,
  themeCueCap,
  trollDefinitions,
  type TrollKind,
} from "./catalogue.ts";

const cueLimit = 3;

type EffectRow = {
  effect_id: string;
  actor_id: string;
  target_id: string;
  kind: string;
  slot: string;
  status: string;
  question_index: number;
  phase: string;
  phase_generation: number;
  created_at: number;
  started_at: number | null;
  expires_at: number | null;
  refunded: number;
};

export function acceptTroll(
  sql: SqlStorage,
  store: GameStore,
  actorId: string,
  kind: unknown,
  targetId: unknown,
  now: number,
  mediaId?: unknown,
): { ok: true } | { ok: false; message: string } {
  const room = store.readRoom();
  if (room.questionCount <= 0 || room.questionIndex < 1) {
    return { ok: false, message: trollLockedMessage };
  }
  if (room.paused) {
    return { ok: false, message: answerPausedMessage };
  }
  if (!isTrollKind(kind)) {
    return { ok: false, message: trollKindMessage };
  }
  const definition = trollDefinitions[kind];
  if (!definition.phases.includes(room.phase)) {
    return { ok: false, message: trollPhaseMessage };
  }
  if (typeof targetId !== "string" || !/^[0-9a-f-]{36}$/i.test(targetId)) {
    return { ok: false, message: trollTargetMessage };
  }
  if (targetId === actorId) {
    return { ok: false, message: trollSelfMessage };
  }
  if (!activePlayer(sql, targetId) || !activePlayer(sql, actorId)) {
    return { ok: false, message: trollTargetMessage };
  }
  if (kind === "double" && !questionAllowsDouble(room)) {
    return { ok: false, message: trollModifierMessage };
  }
  if (kind === "typing" && !questionAllowsTyping(room)) {
    return { ok: false, message: trollAttributionMessage };
  }
  const voiceMedia = kind === "voice" ? ownedVoice(sql, actorId, mediaId) : null;
  if (kind === "voice" && !voiceMedia) {
    return { ok: false, message: trollVoiceMessage };
  }
  if (tokenState(sql, actorId) === "spent") {
    return { ok: false, message: trollSpentMessage };
  }
  const sameSlot = effectsFor(sql, targetId, definition.slot);
  const decision = slotDecision({
    active: sameSlot.some((row) => row.status === "active"),
    queued: sameSlot.some((row) => row.status === "queued"),
  });
  if (decision === "occupied") {
    return { ok: false, message: trollSlotMessage };
  }
  const effectId = crypto.randomUUID();
  const stageBusy = kind === "typing" && roomHasActiveTyping(sql);
  const starting = decision === "start" && !stageBusy;
  sql.exec(
    `INSERT INTO troll_effect (
       effect_id, actor_id, target_id, kind, slot, status, question_index, phase,
       phase_generation, created_at, started_at, expires_at, refunded, device_context_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, (SELECT device_context_id FROM player WHERE player_id = ?))`,
    effectId,
    actorId,
    targetId,
    kind,
    definition.slot,
    starting ? "active" : "queued",
    room.questionIndex,
    room.phase,
    room.phaseGeneration,
    now,
    starting ? now : null,
    starting && definition.durationMs !== null ? now + definition.durationMs : null,
    actorId,
  );
  sql.exec(
    `INSERT INTO troll_token (player_id, state) VALUES (?, 'spent')
     ON CONFLICT (player_id) DO UPDATE SET state = 'spent'`,
    actorId,
  );
  if (starting) {
    armEffect(store, room, effectId, definition.durationMs, now);
    announceStart(
      sql,
      store,
      room,
      effectId,
      actorId,
      targetId,
      definition,
      voiceMedia,
      now,
    );
  } else if (voiceMedia) {
    holdVoice(sql, store, room, effectId, actorId, targetId, voiceMedia, now);
  }
  sql.exec(`UPDATE room SET state_version = state_version + 1`);
  return { ok: true };
}

export function escapeTroll(
  sql: SqlStorage,
  store: GameStore,
  playerId: string,
  effectId: unknown,
  now: number,
): { ok: true } | { ok: false; message: string } {
  if (typeof effectId !== "string") {
    return { ok: false, message: trollEscapeMessage };
  }
  const effect = readEffect(sql, effectId);
  if (!effect || effect.target_id !== playerId || effect.status !== "active") {
    return { ok: false, message: trollEscapeMessage };
  }
  if (!isTrollKind(effect.kind) || trollDefinitions[effect.kind].escape === null) {
    return { ok: false, message: trollEscapeMessage };
  }
  finishEffect(sql, store, effect, now, false);
  sql.exec(`UPDATE room SET state_version = state_version + 1`);
  return { ok: true };
}

export function cancelTroll(sql: SqlStorage, effectId: string, now: number): void {
  const store = createSqlStore(sql);
  const effect = readEffect(sql, effectId);
  if (!effect || (effect.status !== "active" && effect.status !== "queued")) {
    throw new Error(trollMissingMessage);
  }
  const started = effect.started_at !== null;
  if (!started) {
    refundEffect(sql, effect);
  }
  finishEffect(sql, store, effect, now, !started);
  sql.exec(`UPDATE room SET state_version = state_version + 1`);
}

export function dismissCue(sql: SqlStorage, now: number): void {
  const store = createSqlStore(sql);
  const playing = readCues(sql).find((cue) => cue.status === "playing");
  if (!playing) {
    throw new Error(trollMissingMessage);
  }
  sql.exec(`UPDATE stage_cue SET status = 'done' WHERE cue_id = ?`, playing.cue_id);
  cancelJob(store, `cue:${playing.cue_id}`);
  startNextCue(sql, store, store.readRoom(), now);
  sql.exec(`UPDATE room SET state_version = state_version + 1`);
}

export function settleTrolls(sql: SqlStorage, room: RoomClock, now: number): void {
  const store = createSqlStore(sql);
  if (!room.paused) {
    for (const job of store.jobs()) {
      if (
        job.status === "pending" &&
        isTrollPayload(job.payload) &&
        job.dueAt === null &&
        job.remainingMs !== null
      ) {
        store.saveJob({ ...job, dueAt: now + job.remainingMs, remainingMs: null });
      }
    }
  }
  for (const effect of readOpen(sql)) {
    const kind = isTrollKind(effect.kind) ? effect.kind : null;
    if (!kind) {
      continue;
    }
    const definition = trollDefinitions[kind];
    if (effect.status === "queued") {
      const sameQuestion = effect.question_index === room.questionIndex;
      const phaseOk = definition.phases.includes(room.phase);
      if (
        !sameQuestion ||
        !phaseOk ||
        effect.phase_generation !== room.phaseGeneration
      ) {
        refundEffect(sql, effect);
        closeEffect(sql, effect.effect_id, "expired", now);
      }
      continue;
    }
    if (definition.slot === "persistent") {
      if (definition.survivesQuestions) {
        if (room.phase === "podium" || room.phase === "lobby") {
          closeEffect(sql, effect.effect_id, "expired", now);
          cancelJob(store, `effect:${effect.effect_id}`);
        }
      } else if (effect.question_index !== room.questionIndex) {
        closeEffect(sql, effect.effect_id, "expired", now);
        cancelJob(store, `effect:${effect.effect_id}`);
      }
      continue;
    }
    if (effect.phase_generation !== room.phaseGeneration) {
      closeEffect(sql, effect.effect_id, "expired", now);
      cancelJob(store, `effect:${effect.effect_id}`);
    }
  }
  retireForeignCues(sql, store, room);
  promoteQueues(sql, store, room, now);
  releaseHeldCues(sql, store, room, now);
  enqueueThemeCues(sql, store, room, now);
}

export function completeScheduledTroll(
  sql: SqlStorage,
  job: ScheduledJob,
  now: number,
): void {
  const store = createSqlStore(sql);
  const room = store.readRoom();
  if (job.payload.startsWith("cue:")) {
    const cueId = job.payload.slice("cue:".length);
    sql.exec(
      `UPDATE stage_cue SET status = 'done' WHERE cue_id = ? AND status = 'playing'`,
      cueId,
    );
    startNextCue(sql, store, room, now);
    return;
  }
  if (!job.payload.startsWith("effect:")) {
    return;
  }
  const effect = readEffect(sql, job.payload.slice("effect:".length));
  if (!effect || effect.status !== "active") {
    return;
  }
  closeEffect(sql, effect.effect_id, "expired", now);
  promoteQueues(sql, store, room, now);
}

export function displayNickname(
  sql: SqlStorage,
  playerId: string,
  stored: string,
): string {
  const swap = sql
    .exec<{ actor_id: string; target_id: string }>(
      `SELECT actor_id, target_id FROM troll_effect
       WHERE kind = 'swap' AND status = 'active' AND (actor_id = ? OR target_id = ?)
       LIMIT 1`,
      playerId,
      playerId,
    )
    .toArray()[0];
  if (!swap) {
    return stored;
  }
  const otherId = swap.actor_id === playerId ? swap.target_id : swap.actor_id;
  const other = sql
    .exec<{ nickname: string }>(
      `SELECT nickname FROM player WHERE player_id = ?`,
      otherId,
    )
    .toArray()[0];
  return other?.nickname ?? stored;
}

export function hidesPersonalScore(sql: SqlStorage, playerId: string): boolean {
  return (
    sql
      .exec(
        `SELECT effect_id FROM troll_effect
         WHERE kind = 'hide-score' AND status = 'active' AND target_id = ?`,
        playerId,
      )
      .toArray().length > 0
  );
}

export function submissionDisrupted(
  sql: SqlStorage,
  playerId: string,
  receivedAt: number,
): boolean {
  return sql
    .exec<{ started_at: number; expires_at: number | null }>(
      `SELECT started_at, expires_at FROM troll_effect
       WHERE kind = 'yield' AND target_id = ? AND started_at IS NOT NULL`,
      playerId,
    )
    .toArray()
    .some(
      (row) =>
        row.started_at <= receivedAt &&
        (row.expires_at === null || receivedAt <= row.expires_at),
    );
}

export function activeModifierKinds(
  sql: SqlStorage,
  playerId: string,
  questionIndex: number,
): string[] {
  return sql
    .exec<{ kind: string }>(
      `SELECT kind FROM troll_effect
       WHERE target_id = ? AND question_index = ? AND slot = 'persistent' AND status = 'active'`,
      playerId,
      questionIndex,
    )
    .toArray()
    .map((row) => row.kind);
}

export function trollSnapshot(
  sql: SqlStorage,
  store: GameStore,
  audience: "guest" | "stage" | "control",
  selfPlayerId: string | undefined,
): {
  token: "locked" | "ready" | "spent";
  offers: { kind: TrollKind; label: string; enabled: boolean }[];
  active: {
    effectId: string;
    kind: TrollKind;
    role: "actor" | "target";
    status: "queued" | "active";
    expiresAt: number | null;
    label: string;
    escape: string | null;
    assetLabel: string;
  }[];
  announcement: {
    cueId: string;
    label: string;
    assetLabel: string;
    mediaId?: string;
    mediaKind?: "photo" | "voice";
    audioAsset?: string;
  } | null;
} {
  const room = store.readRoom();
  const locked = room.questionCount <= 0 || room.questionIndex < 1;
  const token = !selfPlayerId
    ? "locked"
    : locked
      ? "locked"
      : tokenState(sql, selfPlayerId) === "spent"
        ? "spent"
        : "ready";
  const offers =
    audience === "guest" && selfPlayerId && !locked
      ? Object.values(trollDefinitions).map((definition) => ({
          kind: definition.kind,
          label: definition.label,
          enabled:
            definition.phases.includes(room.phase) &&
            (definition.kind !== "double" || questionAllowsDouble(room)) &&
            (definition.kind !== "typing" || questionAllowsTyping(room)) &&
            token === "ready",
        }))
      : [];
  const active = selfPlayerId
    ? readOpen(sql)
        .filter(
          (effect) =>
            effect.actor_id === selfPlayerId || effect.target_id === selfPlayerId,
        )
        .flatMap((effect) => {
          if (!isTrollKind(effect.kind)) {
            return [];
          }
          const definition = trollDefinitions[effect.kind];
          return [
            {
              effectId: effect.effect_id,
              kind: effect.kind,
              role:
                effect.target_id === selfPlayerId
                  ? ("target" as const)
                  : ("actor" as const),
              status:
                effect.status === "queued" ? ("queued" as const) : ("active" as const),
              expiresAt: publicExpiry(store, effect),
              label: definition.label,
              escape: effect.status === "active" ? definition.escape : null,
              assetLabel: definition.assetLabel,
            },
          ];
        })
        .slice(0, 4)
    : [];
  const playing = readCues(sql).find((cue) => cue.status === "playing");
  return {
    token,
    offers,
    active,
    announcement:
      audience === "guest" || !playing
        ? null
        : {
            cueId: playing.cue_id,
            label: playing.label,
            assetLabel: playing.asset_label,
            ...(playing.media_id && playing.media_kind
              ? {
                  mediaId: playing.media_id,
                  mediaKind:
                    playing.media_kind === "voice"
                      ? ("voice" as const)
                      : ("photo" as const),
                }
              : {}),
            ...(playing.audio_asset ? { audioAsset: playing.audio_asset } : {}),
          },
  };
}

export function hostTrollRows(sql: SqlStorage): {
  effectId: string;
  label: string;
  actorNickname: string;
  targetNickname: string;
  status: "queued" | "active";
}[] {
  return readOpen(sql)
    .flatMap((effect) => {
      if (!isTrollKind(effect.kind)) {
        return [];
      }
      const actor = nicknameOf(sql, effect.actor_id);
      const target = nicknameOf(sql, effect.target_id);
      if (!actor || !target) {
        return [];
      }
      return [
        {
          effectId: effect.effect_id,
          label: trollDefinitions[effect.kind].label,
          actorNickname: actor,
          targetNickname: target,
          status:
            effect.status === "queued" ? ("queued" as const) : ("active" as const),
        },
      ];
    })
    .slice(0, 20);
}

function questionAllowsDouble(room: RoomClock): boolean {
  const question = demoQuestionAt(room.questionIndex);
  return question?.kind === "choice" && question.modifiers?.includes("double") === true;
}

function questionAllowsTyping(room: RoomClock): boolean {
  return demoQuestionAt(room.questionIndex)?.attribution === "live";
}

function roomHasActiveTyping(sql: SqlStorage): boolean {
  return readOpen(sql).some(
    (effect) => effect.kind === "typing" && effect.status === "active",
  );
}

function ownedVoice(
  sql: SqlStorage,
  playerId: string,
  mediaId: unknown,
): string | null {
  if (typeof mediaId !== "string" || !/^[0-9a-f-]{36}$/i.test(mediaId)) {
    return null;
  }
  const row = sql
    .exec<{ player_id: string; kind: string; status: string; hidden: number }>(
      `SELECT player_id, kind, status, hidden FROM media_upload WHERE media_id = ?`,
      mediaId,
    )
    .toArray()[0];
  if (
    !row ||
    row.player_id !== playerId ||
    row.kind !== "voice" ||
    row.status !== "accepted" ||
    row.hidden !== 0
  ) {
    return null;
  }
  return mediaId;
}

function voiceMediaFor(sql: SqlStorage, effectId: string): string | null {
  return (
    readCues(sql).find(
      (cue) => cue.effect_id === effectId && cue.media_kind === "voice",
    )?.media_id ?? null
  );
}

function tokenState(sql: SqlStorage, playerId: string): "ready" | "spent" {
  const row = sql
    .exec<{ state: string }>(
      `SELECT state FROM troll_token WHERE player_id = ?`,
      playerId,
    )
    .toArray()[0];
  return row?.state === "spent" ? "spent" : "ready";
}

function activePlayer(sql: SqlStorage, playerId: string): boolean {
  return (
    sql
      .exec(
        `SELECT player_id FROM player WHERE player_id = ? AND revoked_at IS NULL`,
        playerId,
      )
      .toArray().length > 0
  );
}

function effectsFor(sql: SqlStorage, targetId: string, slot: string): EffectRow[] {
  return sql
    .exec<EffectRow>(
      `SELECT effect_id, actor_id, target_id, kind, slot, status, question_index, phase,
              phase_generation, created_at, started_at, expires_at, refunded
       FROM troll_effect
       WHERE target_id = ? AND slot = ? AND status IN ('active', 'queued')`,
      targetId,
      slot,
    )
    .toArray();
}

function readOpen(sql: SqlStorage): EffectRow[] {
  return sql
    .exec<EffectRow>(
      `SELECT effect_id, actor_id, target_id, kind, slot, status, question_index, phase,
              phase_generation, created_at, started_at, expires_at, refunded
       FROM troll_effect
       WHERE status IN ('active', 'queued')
       ORDER BY created_at ASC`,
    )
    .toArray();
}

function readEffect(sql: SqlStorage, effectId: string): EffectRow | undefined {
  return sql
    .exec<EffectRow>(
      `SELECT effect_id, actor_id, target_id, kind, slot, status, question_index, phase,
              phase_generation, created_at, started_at, expires_at, refunded
       FROM troll_effect WHERE effect_id = ?`,
      effectId,
    )
    .toArray()[0];
}

function refundEffect(sql: SqlStorage, effect: EffectRow): void {
  if (effect.refunded === 1 || effect.started_at !== null) {
    return;
  }
  sql.exec(
    `UPDATE troll_effect SET refunded = 1, status = 'expired' WHERE effect_id = ?`,
    effect.effect_id,
  );
  sql.exec(
    `INSERT INTO troll_token (player_id, state) VALUES (?, 'ready')
     ON CONFLICT (player_id) DO UPDATE SET state = 'ready'`,
    effect.actor_id,
  );
}

function closeEffect(
  sql: SqlStorage,
  effectId: string,
  status: string,
  now: number,
): void {
  sql.exec(
    `UPDATE troll_effect
     SET status = ?, expires_at = COALESCE(expires_at, ?)
     WHERE effect_id = ? AND status IN ('active', 'queued')`,
    status,
    now,
    effectId,
  );
  sql.exec(
    `UPDATE stage_cue SET status = 'dropped' WHERE effect_id = ? AND status = 'held'`,
    effectId,
  );
}

function finishEffect(
  sql: SqlStorage,
  store: GameStore,
  effect: EffectRow,
  now: number,
  refunded: boolean,
): void {
  if (!refunded) {
    closeEffect(sql, effect.effect_id, "cancelled", now);
  }
  cancelJob(store, `effect:${effect.effect_id}`);
  const cue = readCues(sql).find(
    (item) => item.effect_id === effect.effect_id && item.status !== "done",
  );
  if (cue) {
    sql.exec(`UPDATE stage_cue SET status = 'dropped' WHERE cue_id = ?`, cue.cue_id);
    cancelJob(store, `cue:${cue.cue_id}`);
    startNextCue(sql, store, store.readRoom(), now);
  }
  promoteQueues(sql, store, store.readRoom(), now);
}

function promoteQueues(
  sql: SqlStorage,
  store: GameStore,
  room: RoomClock,
  now: number,
): void {
  const queued = readOpen(sql).filter((effect) => effect.status === "queued");
  for (const effect of queued) {
    if (!isTrollKind(effect.kind)) {
      continue;
    }
    const definition = trollDefinitions[effect.kind];
    if (
      !definition.phases.includes(room.phase) ||
      effect.question_index !== room.questionIndex
    ) {
      continue;
    }
    const occupied = effectsFor(sql, effect.target_id, effect.slot).some(
      (row) => row.status === "active",
    );
    if (occupied || (effect.kind === "typing" && roomHasActiveTyping(sql))) {
      continue;
    }
    const expires = definition.durationMs === null ? null : now + definition.durationMs;
    sql.exec(
      `UPDATE troll_effect
       SET status = 'active', started_at = ?, expires_at = ?, phase = ?, phase_generation = ?
       WHERE effect_id = ? AND status = 'queued'`,
      now,
      expires,
      room.phase,
      room.phaseGeneration,
      effect.effect_id,
    );
    armEffect(store, room, effect.effect_id, definition.durationMs, now);
    const voice = effect.kind === "voice" ? voiceMediaFor(sql, effect.effect_id) : null;
    announceStart(
      sql,
      store,
      room,
      effect.effect_id,
      effect.actor_id,
      effect.target_id,
      definition,
      voice,
      now,
    );
  }
}

function armEffect(
  store: GameStore,
  room: RoomClock,
  effectId: string,
  durationMs: number | null,
  now: number,
): void {
  if (durationMs === null) {
    return;
  }
  store.saveJob({
    jobId: `effect:${effectId}`,
    jobType: "gameplay",
    dueAt: room.paused ? null : now + durationMs,
    remainingMs: room.paused ? durationMs : null,
    scopeGeneration: room.scopeGeneration,
    phaseGeneration: room.phaseGeneration,
    phase: null,
    status: "pending",
    retryCount: 0,
    payload: `effect:${effectId}`,
    createdAt: now,
  });
}

type CueExtra = {
  mediaId?: string | null;
  mediaKind?: "photo" | "voice" | null;
  audioAsset?: string | null;
  questionIndex?: number | null;
  durationMs?: number;
  held?: boolean;
};

function announceStart(
  sql: SqlStorage,
  store: GameStore,
  room: RoomClock,
  effectId: string,
  actorId: string,
  targetId: string,
  definition: (typeof trollDefinitions)[TrollKind],
  voiceMedia: string | null,
  now: number,
): void {
  if (definition.announce === "now") {
    enqueueCue(
      sql,
      store,
      room,
      effectId,
      cueLabel(sql, actorId, targetId, definition.label),
      definition.assetLabel,
      now,
      { durationMs: definition.cueMs },
    );
    return;
  }
  if (voiceMedia) {
    holdVoice(sql, store, room, effectId, actorId, targetId, voiceMedia, now);
  }
}

function holdVoice(
  sql: SqlStorage,
  store: GameStore,
  room: RoomClock,
  effectId: string,
  actorId: string,
  targetId: string,
  mediaId: string,
  now: number,
): void {
  if (voiceMediaFor(sql, effectId)) {
    return;
  }
  enqueueCue(
    sql,
    store,
    room,
    effectId,
    cueLabel(sql, actorId, targetId, trollDefinitions.voice.label),
    trollDefinitions.voice.assetLabel,
    now,
    {
      mediaId,
      mediaKind: "voice",
      questionIndex: room.questionIndex,
      durationMs: trollDefinitions.voice.cueMs,
      held: true,
    },
  );
}

function retireForeignCues(sql: SqlStorage, store: GameStore, room: RoomClock): void {
  for (const cue of readCues(sql)) {
    if (
      cue.question_index === null ||
      cue.question_index === room.questionIndex ||
      (cue.status !== "playing" && cue.status !== "queued" && cue.status !== "held")
    ) {
      continue;
    }
    sql.exec(`UPDATE stage_cue SET status = 'dropped' WHERE cue_id = ?`, cue.cue_id);
    cancelJob(store, `cue:${cue.cue_id}`);
  }
}

function releaseHeldCues(
  sql: SqlStorage,
  store: GameStore,
  room: RoomClock,
  now: number,
): void {
  if (room.phase !== "reveal" && room.phase !== "scores") {
    return;
  }
  for (const cue of readCues(sql)) {
    if (cue.status !== "held" || cue.question_index !== room.questionIndex) {
      continue;
    }
    const effect = cue.effect_id ? readEffect(sql, cue.effect_id) : undefined;
    if (!effect || effect.status !== "active") {
      sql.exec(`UPDATE stage_cue SET status = 'dropped' WHERE cue_id = ?`, cue.cue_id);
      continue;
    }
    sql.exec(`UPDATE stage_cue SET status = 'queued' WHERE cue_id = ?`, cue.cue_id);
  }
  startNextCue(sql, store, room, now);
}

function enqueueThemeCues(
  sql: SqlStorage,
  store: GameStore,
  room: RoomClock,
  now: number,
): void {
  if (room.phase !== "scores") {
    return;
  }
  for (const effect of readOpen(sql)) {
    if (effect.kind !== "theme" || effect.status !== "active") {
      continue;
    }
    const cues = readCues(sql).filter((cue) => cue.effect_id === effect.effect_id);
    if (
      cues.some(
        (cue) => cue.question_index === room.questionIndex && cue.status !== "dropped",
      )
    ) {
      continue;
    }
    if (
      cues.filter((cue) => cue.audio_asset && cue.status !== "dropped").length >=
      themeCueCap
    ) {
      closeEffect(sql, effect.effect_id, "expired", now);
      continue;
    }
    const nickname = nicknameOf(sql, effect.target_id) ?? "A player";
    enqueueCue(
      sql,
      store,
      room,
      effect.effect_id,
      `${nickname}'s theme.`,
      "Demo sting",
      now,
      {
        audioAsset: demoStingAsset,
        questionIndex: room.questionIndex,
        durationMs: trollDefinitions.theme.cueMs,
      },
    );
  }
}

export function enqueuePhotoCue(
  sql: SqlStorage,
  mediaId: string,
  nickname: string,
  now: number,
): void {
  const store = createSqlStore(sql);
  const room = store.readRoom();
  enqueueCue(sql, store, room, null, `Photo from ${nickname}.`, "Demo caption", now, {
    mediaId,
    mediaKind: "photo",
    questionIndex: room.questionIndex,
    durationMs: 4_000,
  });
}

function enqueueCue(
  sql: SqlStorage,
  store: GameStore,
  room: RoomClock,
  effectId: string | null,
  label: string,
  assetLabel: string,
  now: number,
  extra: CueExtra = {},
): void {
  const duration = extra.durationMs ?? 4_000;
  const open = readCues(sql).filter(
    (cue) => cue.status === "playing" || cue.status === "queued",
  );
  const cueId = crypto.randomUUID();
  const held = extra.held === true;
  if (!held && open.length >= cueLimit) {
    insertCue(
      sql,
      cueId,
      effectId,
      label,
      assetLabel,
      "dropped",
      duration,
      now,
      null,
      extra,
    );
    return;
  }
  const playing = open.some((cue) => cue.status === "playing");
  const status = held ? "held" : playing ? "queued" : "playing";
  insertCue(
    sql,
    cueId,
    effectId,
    label,
    assetLabel,
    status,
    duration,
    now,
    status === "playing" ? now : null,
    extra,
  );
  if (status === "playing") {
    armCue(store, room, cueId, duration, now);
  }
}

function insertCue(
  sql: SqlStorage,
  cueId: string,
  effectId: string | null,
  label: string,
  assetLabel: string,
  status: string,
  duration: number,
  now: number,
  startedAt: number | null,
  extra: CueExtra,
): void {
  sql.exec(
    `INSERT INTO stage_cue (
       cue_id, effect_id, label, asset_label, status, duration_ms, created_at, started_at,
       media_id, audio_asset, media_kind, question_index
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    cueId,
    effectId,
    label,
    assetLabel,
    status,
    duration,
    now,
    startedAt,
    extra.mediaId ?? null,
    extra.audioAsset ?? null,
    extra.mediaKind ?? null,
    extra.questionIndex ?? null,
  );
}

function startNextCue(
  sql: SqlStorage,
  store: GameStore,
  room: RoomClock,
  now: number,
): void {
  if (readCues(sql).some((cue) => cue.status === "playing")) {
    return;
  }
  const next = readCues(sql)
    .filter((cue) => cue.status === "queued")
    .sort((left, right) => left.created_at - right.created_at)[0];
  if (!next) {
    return;
  }
  sql.exec(
    `UPDATE stage_cue SET status = 'playing', started_at = ? WHERE cue_id = ?`,
    now,
    next.cue_id,
  );
  armCue(store, room, next.cue_id, next.duration_ms, now);
}

function armCue(
  store: GameStore,
  room: RoomClock,
  cueId: string,
  durationMs: number,
  now: number,
): void {
  store.saveJob({
    jobId: `cue:${cueId}`,
    jobType: "gameplay",
    dueAt: room.paused ? null : now + durationMs,
    remainingMs: room.paused ? durationMs : null,
    scopeGeneration: room.scopeGeneration,
    phaseGeneration: room.phaseGeneration,
    phase: null,
    status: "pending",
    retryCount: 0,
    payload: `cue:${cueId}`,
    createdAt: now,
  });
}

function cancelJob(store: GameStore, jobId: string): void {
  const job = store
    .jobs()
    .find((item) => item.jobId === jobId && item.status === "pending");
  if (!job) {
    return;
  }
  store.saveJob({ ...job, status: "cancelled", dueAt: null, remainingMs: null });
}

function publicExpiry(store: GameStore, effect: EffectRow): number | null {
  if (store.readRoom().paused || effect.status !== "active") {
    return null;
  }
  const job = store.jobs().find((item) => item.jobId === `effect:${effect.effect_id}`);
  return job?.dueAt ?? effect.expires_at;
}

function cueLabel(
  sql: SqlStorage,
  actorId: string,
  targetId: string,
  label: string,
): string {
  const actor = nicknameOf(sql, actorId) ?? "A player";
  const target = nicknameOf(sql, targetId) ?? "a player";
  return `${actor} used ${label} on ${target}.`.slice(0, 120);
}

function nicknameOf(sql: SqlStorage, playerId: string): string | null {
  return (
    sql
      .exec<{ nickname: string }>(
        `SELECT nickname FROM player WHERE player_id = ?`,
        playerId,
      )
      .toArray()[0]?.nickname ?? null
  );
}

type CueRow = {
  cue_id: string;
  effect_id: string | null;
  label: string;
  asset_label: string;
  status: string;
  created_at: number;
  duration_ms: number;
  media_id: string | null;
  audio_asset: string | null;
  media_kind: string | null;
  question_index: number | null;
};

function readCues(sql: SqlStorage): CueRow[] {
  return sql
    .exec<CueRow>(
      `SELECT cue_id, effect_id, label, asset_label, status, created_at, duration_ms,
              media_id, audio_asset, media_kind, question_index
       FROM stage_cue ORDER BY created_at ASC`,
    )
    .toArray();
}

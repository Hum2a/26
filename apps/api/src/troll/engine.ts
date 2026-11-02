import { questionFor } from "../questions/registry.ts";
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
  trollQuestionMessage,
  trollPhotoMessage,
  trollSelfMessage,
  trollSlotMessage,
  trollAttributionMessage,
  trollSpentMessage,
  trollSwitchedOffMessage,
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
  zoomAssetLabel,
  type PointTransfer,
  type TrollDefinition,
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
  if (disabledTrollKinds(sql).includes(kind)) {
    return { ok: false, message: trollSwitchedOffMessage };
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
  if (
    (kind === "double" || definition.modifier) &&
    !questionAllowsModifier(room, kind)
  ) {
    return { ok: false, message: trollModifierMessage };
  }
  if (kind === "typing" && !questionAllowsTyping(room)) {
    return { ok: false, message: trollAttributionMessage };
  }
  if (!questionFits(definition, room)) {
    return { ok: false, message: trollQuestionMessage };
  }
  if (kind === "zoom-photo" && !zoomPhotoFor(sql, targetId)) {
    return { ok: false, message: trollPhotoMessage };
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
  enqueueTheatreCues(sql, store, room, now);
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

/** Silly names for the temporary nickname troll. The effect id picks one. */
const sillyNames = [
  "Sir Loses-a-Lot",
  "Captain Wrong",
  "Big Dave",
  "Toaster",
  "Mr Bean's Cousin",
  "Lord Snacks",
  "The Imposter",
  "Brenda from HR",
  "Wi-Fi Thief",
  "Lil Ketchup",
  "Professor Guess",
  "Soggy Biscuit",
] as const;

export function sillyNameFor(effectId: string): string {
  let hash = 0;
  for (const character of effectId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return sillyNames[hash % sillyNames.length]!;
}

/**
 * The name shown for a player on every screen. Active identity trolls win:
 * a silly name, then "Guest 14", then a nickname swap. Stored names, scores
 * and answers never change.
 */
export function displayNickname(
  sql: SqlStorage,
  playerId: string,
  stored: string,
): string {
  const renamed = sql
    .exec<{ effect_id: string; kind: string }>(
      `SELECT effect_id, kind FROM troll_effect
       WHERE kind IN ('temp-nickname', 'guest-14') AND status = 'active' AND target_id = ?
       ORDER BY started_at DESC LIMIT 1`,
      playerId,
    )
    .toArray()[0];
  if (renamed) {
    return renamed.kind === "guest-14" ? "Guest 14" : sillyNameFor(renamed.effect_id);
  }
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

/** Kinds that interfere with answering; see `disruptsSubmission`. */
const disruptingKinds = Object.values(trollDefinitions)
  .filter((definition) => definition.disruptsSubmission)
  .map((definition) => definition.kind);

export function submissionDisrupted(
  sql: SqlStorage,
  playerId: string,
  receivedAt: number,
): boolean {
  return sql
    .exec<{ started_at: number; expires_at: number | null }>(
      `SELECT started_at, expires_at FROM troll_effect
       WHERE target_id = ? AND started_at IS NOT NULL
         AND kind IN (${disruptingKinds.map(() => "?").join(", ")})`,
      playerId,
      ...disruptingKinds,
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
  disabled?: TrollKind[];
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
  const disabled = disabledTrollKinds(sql);
  const offers =
    audience === "guest" && selfPlayerId && !locked
      ? Object.values(trollDefinitions)
          .filter((definition) => !disabled.includes(definition.kind))
          .map((definition) => ({
            kind: definition.kind,
            label: definition.label,
            enabled:
              definition.phases.includes(room.phase) &&
              ((definition.kind !== "double" && !definition.modifier) ||
                questionAllowsModifier(room, definition.kind)) &&
              (definition.kind !== "typing" || questionAllowsTyping(room)) &&
              questionFits(definition, room) &&
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
              // Who sent it, for the target's own screen. The stage already announces it.
              ...(effect.target_id === selfPlayerId
                ? { fromPlayerId: effect.actor_id }
                : {}),
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
    ...(audience === "control" ? { disabled } : {}),
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

/** Every troll starts on. The host switches kinds off per room. */
export function disabledTrollKinds(sql: SqlStorage): TrollKind[] {
  return sql
    .exec<{ kind: string }>(`SELECT kind FROM troll_switch WHERE enabled = 0`)
    .toArray()
    .map((row) => row.kind)
    .filter(isTrollKind);
}

export function setTrollSwitch(sql: SqlStorage, kind: TrollKind, enabled: boolean) {
  sql.exec(
    `INSERT INTO troll_switch (kind, enabled) VALUES (?, ?)
     ON CONFLICT (kind) DO UPDATE SET enabled = excluded.enabled`,
    kind,
    enabled ? 1 : 0,
  );
}

/**
 * Every troll sent this game, newest first, for the host only. Ended means it
 * ran its course or was escaped; refunded means it never started.
 */
export function trollHistoryRows(sql: SqlStorage): {
  effectId: string;
  label: string;
  actorNickname: string;
  targetNickname: string;
  status: "queued" | "active" | "ended" | "cancelled" | "refunded";
  createdAt: number;
}[] {
  return sql
    .exec<{
      effect_id: string;
      kind: string;
      status: string;
      refunded: number;
      created_at: number;
      actor: string | null;
      target: string | null;
    }>(
      `SELECT troll_effect.effect_id, troll_effect.kind, troll_effect.status,
              troll_effect.refunded, troll_effect.created_at,
              actor.nickname AS actor, target.nickname AS target
       FROM troll_effect
       LEFT JOIN player AS actor ON actor.player_id = troll_effect.actor_id
       LEFT JOIN player AS target ON target.player_id = troll_effect.target_id
       ORDER BY troll_effect.created_at DESC
       LIMIT 100`,
    )
    .toArray()
    .flatMap((row) => {
      if (!isTrollKind(row.kind)) {
        return [];
      }
      const status =
        row.refunded === 1
          ? ("refunded" as const)
          : row.status === "queued" || row.status === "active"
            ? row.status
            : row.status === "cancelled"
              ? ("cancelled" as const)
              : ("ended" as const);
      return [
        {
          effectId: row.effect_id,
          label: trollDefinitions[row.kind].label,
          actorNickname: row.actor ?? "Removed player",
          targetNickname: row.target ?? "Removed player",
          status,
          createdAt: row.created_at,
        },
      ];
    });
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

/** A score troll needs the question to list it in `modifiers`. */
function questionAllowsModifier(room: RoomClock, kind: string): boolean {
  const question = questionFor(room);
  return (
    question?.kind === "choice" &&
    (question.modifiers as readonly string[] | undefined)?.includes(kind) === true
  );
}

/** Points-moving trolls that are active for this question, for the reveal. */
export function activeTransfers(
  sql: SqlStorage,
  questionIndex: number,
): PointTransfer[] {
  return sql
    .exec<{ kind: string; actor_id: string; target_id: string }>(
      `SELECT kind, actor_id, target_id FROM troll_effect
       WHERE status = 'active' AND question_index = ? AND kind IN ('steal', 'robin-hood', 'share')
       ORDER BY created_at, effect_id`,
      questionIndex,
    )
    .toArray()
    .map((row) => ({
      kind: row.kind as PointTransfer["kind"],
      actorId: row.actor_id,
      targetId: row.target_id,
    }));
}

/** A troll with `questionKinds` only fits those questions. */
function questionFits(definition: TrollDefinition, room: RoomClock): boolean {
  if (!definition.questionKinds) {
    return true;
  }
  const kind = questionFor(room)?.kind;
  return kind !== undefined && definition.questionKinds.includes(kind);
}

function questionAllowsTyping(room: RoomClock): boolean {
  return questionFor(room)?.attribution === "live";
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
      `SELECT player_id, kind, status, hidden FROM media_upload WHERE media_id = ? AND purpose = 'round'`,
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
  if (definition.kind === "fake-exit") {
    const nickname = nicknameOf(sql, targetId) ?? "A player";
    // The stage reads "<label> <asset>.", so the asset must not give the joke away.
    enqueueCue(
      sql,
      store,
      room,
      effectId,
      `${nickname} has left the party.`,
      "Breaking news",
      now,
      {
        durationMs: 3_500,
      },
    );
    enqueueCue(
      sql,
      store,
      room,
      effectId,
      `Only joking. ${nickname} is still here.`,
      "Breaking news",
      now,
      {
        durationMs: 3_000,
      },
    );
    return;
  }
  if (definition.kind === "zoom-photo") {
    const mediaId = zoomPhotoFor(sql, targetId);
    const nickname = nicknameOf(sql, targetId) ?? "A player";
    enqueueCue(
      sql,
      store,
      room,
      effectId,
      `${nickname}, up close.`,
      zoomAssetLabel,
      now,
      {
        ...(mediaId ? { mediaId, mediaKind: "photo" as const } : {}),
        durationMs: 7_000,
      },
    );
    return;
  }
  if (definition.announce === "now") {
    enqueueCue(
      sql,
      store,
      room,
      effectId,
      definition.kind === "sponsor"
        ? sponsorLine(nicknameOf(sql, targetId) ?? "A guest", effectId)
        : cueLabel(sql, actorId, targetId, definition.label),
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

/** Fake sponsors for the sponsor break. The effect id picks one, so a replay matches. */
const sponsorLines = [
  (name: string) => `This round is brought to you by ${name}'s overdraft.`,
  (name: string) => `Sponsored by ${name}'s screen time: 11 hours a day and counting.`,
  (name: string) => `Today's question is supported by ${name}'s unread group chat.`,
  (name: string) => `Brought to you by ${name}. Ask them about their crypto.`,
  (name: string) => `A word from our sponsor: ${name}'s mum says hello.`,
  (name: string) => `This break is paid for by ${name}'s Deliveroo habit.`,
  (name: string) => `${name} Airlines. Delays guaranteed.`,
  (name: string) => `Proudly sponsored by ${name}'s 47 open browser tabs.`,
];

export function sponsorLine(nickname: string, effectId: string): string {
  let hash = 0;
  for (const character of effectId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return sponsorLines[hash % sponsorLines.length]!(nickname);
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
      "Theme jingle",
      now,
      {
        audioAsset: demoStingAsset,
        questionIndex: room.questionIndex,
        durationMs: trollDefinitions.theme.cueMs,
      },
    );
  }
}

/**
 * Stage theatre that waits for its moment: an instant replay of the target's
 * answer at the reveal, and a call for a speech at the scores. Each plays once
 * and then ends.
 */
function enqueueTheatreCues(
  sql: SqlStorage,
  store: GameStore,
  room: RoomClock,
  now: number,
): void {
  const due: readonly string[] =
    room.phase === "reveal"
      ? ["replay", "public-vote", "misattributed"]
      : room.phase === "scores"
        ? ["speech"]
        : [];
  for (const effect of readOpen(sql)) {
    if (
      !due.includes(effect.kind) ||
      effect.status !== "active" ||
      effect.question_index !== room.questionIndex
    ) {
      continue;
    }
    const nickname = nicknameOf(sql, effect.target_id) ?? "A player";
    const [label, asset] =
      effect.kind === "replay"
        ? [replayLine(sql, room, effect.target_id, nickname), "Instant replay"]
        : effect.kind === "public-vote"
          ? [publicVoteLine(sql, room, effect.target_id, nickname), "Public vote"]
          : effect.kind === "misattributed"
            ? [misattributedLine(sql, room, effect, nickname), "Totally true"]
            : [`${nickname}, the floor is yours.`, "Speech! Speech!"];
    enqueueCue(sql, store, room, effect.effect_id, label, asset, now, {
      questionIndex: room.questionIndex,
      durationMs: effect.kind === "speech" ? 8_000 : 5_000,
    });
    closeEffect(sql, effect.effect_id, "expired", now);
  }
}

/** Who the target voted for on this vote question. */
function publicVoteLine(
  sql: SqlStorage,
  room: RoomClock,
  playerId: string,
  nickname: string,
): string {
  const question = questionFor(room);
  const ballot = sql
    .exec<{ label: string }>(
      `SELECT vote_candidate.label FROM vote_ballot
       JOIN vote_candidate ON vote_candidate.question_id = vote_ballot.question_id
         AND vote_candidate.candidate_id = vote_ballot.candidate_id
       WHERE vote_ballot.player_id = ? AND vote_ballot.question_id = ?`,
      playerId,
      question?.id ?? "",
    )
    .toArray()[0];
  return (
    ballot
      ? `${nickname} voted for "${ballot.label}".`
      : `${nickname} didn't vote. Coward.`
  ).slice(0, 120);
}

/**
 * Claims the target wrote another guest's answer to this question. Picked by
 * the effect id, so it is the same on every screen and replay.
 */
function misattributedLine(
  sql: SqlStorage,
  room: RoomClock,
  effect: { effect_id: string; target_id: string },
  nickname: string,
): string {
  const question = questionFor(room);
  const others = sql
    .exec<{ body: string }>(
      `SELECT body FROM text_response WHERE question_id = ? AND player_id != ?
       UNION ALL
       SELECT label AS body FROM vote_candidate
       WHERE question_id = ? AND owner_id IS NOT NULL AND owner_id != ?`,
      question?.id ?? "",
      effect.target_id,
      question?.id ?? "",
      effect.target_id,
    )
    .toArray()
    .map((row) => row.body)
    .filter((body) => body.trim().length > 0);
  if (others.length === 0) {
    return `${nickname} wrote nothing at all. Suspicious.`;
  }
  let hash = 0;
  for (const character of effect.effect_id) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return `${nickname} wrote "${others[hash % others.length]}".`.slice(0, 120);
}

/** What the target went with on this choice question. Not judged: the reveal does that. */
function replayLine(
  sql: SqlStorage,
  room: RoomClock,
  playerId: string,
  nickname: string,
): string {
  const question = questionFor(room);
  const answer = sql
    .exec<{ option_id: string }>(
      `SELECT option_id FROM choice_answer WHERE player_id = ? AND question_id = ?`,
      playerId,
      question?.id ?? "",
    )
    .toArray()[0];
  const option =
    question?.kind === "choice"
      ? question.options.find((item) => item.id === answer?.option_id)
      : undefined;
  return (
    option
      ? `${nickname} went with “${option.label}”.`
      : `${nickname} didn't answer at all.`
  ).slice(0, 120);
}

/**
 * The target's most recent photo the stage may show: a question photo, their
 * driver face, or a wall photo that has been on screen. Hidden photos never.
 */
export function zoomPhotoFor(sql: SqlStorage, playerId: string): string | null {
  return (
    sql
      .exec<{ media_id: string }>(
        `SELECT media_upload.media_id FROM media_upload
         LEFT JOIN wall_post ON wall_post.media_id = media_upload.media_id
         WHERE media_upload.player_id = ? AND media_upload.status = 'accepted'
           AND media_upload.hidden = 0 AND media_upload.kind = 'photo'
           AND media_upload.media_id IS NOT NULL
           AND (media_upload.purpose IN ('round', 'face')
                OR wall_post.status IN ('showing', 'shown'))
         ORDER BY media_upload.created_at DESC LIMIT 1`,
        playerId,
      )
      .toArray()[0]?.media_id ?? null
  );
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

import { noteArchiveCorrection, requeueFailedArchive } from "../archive/schedule.ts";
import { hideUpload, releaseStuckUploads } from "../media/records.ts";
import {
  createGameStore,
  multipleChoicePlugin,
  recordRevealScores,
} from "../questions/multiple-choice.ts";
import { rehearsalConfigSchema, rehearsalScenarioSchema } from "@26/shared";
import {
  configureRehearsal,
  changeRunner,
  jumpRehearsal,
  setRehearsalScenario,
} from "../developer/rehearsal.ts";
import type { TrollKindName } from "@26/shared";
import { cancelTroll, dismissCue, setTrollSwitch } from "../troll/engine.ts";
import {
  approveWallPost,
  changeWallSettings,
  declineWaitingFor,
  declineWallPost,
  moveWallOn,
  muteWallPlayer,
  pullWallPost,
  type WallSettingsChange,
} from "../wall/moderation.ts";
import { syncWall } from "../wall/queue.ts";
import { excludeAuthor, featureCandidate, includeAuthor } from "../questions/vote.ts";
import {
  hideClosedMessage,
  demoScoringVersion,
  mediaMissingMessage,
  maxTransfers,
  namesClosedMessage,
  playerActiveMessage,
  playerMissingMessage,
  revealClosedMessage,
  transferLimitMessage,
  trollKindMessage,
} from "./limits.ts";
import {
  insertAdjustment,
  markKicked,
  markRecovered,
  renamePlayer,
  swapNicknames,
} from "./names.ts";
import { createSqlStore } from "./sql-store.ts";
import {
  changeKartCourse,
  changeKartOpponents,
  changeKartEffects,
  changeKartStage,
} from "../questions/kart.ts";
import { changePhotoBias } from "../media/photo-bias.ts";
import { setBotCount } from "../developer/bots.ts";
import { changeAdmission } from "./admission.ts";
import { assertKartLobbyAction, readKartLobby } from "./kart-lobby.ts";
import { startRound } from "./lifecycle.ts";

const shownPhases = new Set(["reveal", "scores", "final", "podium"]);

export type HostActionInput = {
  action: string;
  botCount?: number;
  rehearsalConfig?: unknown;
  questionIndex?: number;
  scenario?: unknown;
  playerId?: string;
  otherPlayerId?: string;
  nickname?: string;
  points?: number;
  reason?: string;
  candidateId?: string;
  effectId?: string;
  mediaId?: string;
  trollKind?: TrollKindName;
  postId?: string;
  wallSettings?: WallSettingsChange;
  now: string;
  nowMs: number;
  transfer?: { code: string; codeHash: string; expiresAt: string };
};

export function applyHostAction(
  sql: SqlStorage,
  input: HostActionInput,
): { transferCode?: string; released?: number } {
  assertKartLobbyAction(sql, input.action);
  if (input.action === "start-kart") {
    const room = createSqlStore(sql).readRoom();
    const script = room.questionScript;
    if (
      !readKartLobby(sql) ||
      room.phase !== "lobby" ||
      !script ||
      script.version !== room.questionSetVersion ||
      script.questions.length !== 1 ||
      script.questions[0]?.kind !== "kart" ||
      !Number.isSafeInteger(input.nowMs) ||
      input.nowMs < 0
    )
      throw new Error("Open a fresh kart-only lobby before starting a race.");
    sql.exec(
      "UPDATE room SET opening = 'done', scoring_version = ?",
      demoScoringVersion,
    );
    startRound(
      createGameStore(sql),
      input.nowMs,
      {
        ...multipleChoicePlugin(),
        questionCount: 1,
        collectWindows: [script.questions[0].collectMs],
      },
      crypto.randomUUID(),
    );
    return {};
  }
  if (input.action === "open-joining" || input.action === "close-joining") {
    changeAdmission(sql, input.action === "open-joining", input.nowMs);
    return {};
  }
  if (input.action === "developer-configure") {
    configureRehearsal(
      sql,
      rehearsalConfigSchema.parse(input.rehearsalConfig),
      input.nowMs,
      createGameStore(sql),
      multipleChoicePlugin(),
    );
    return {};
  }
  if (input.action === "developer-run" || input.action === "developer-stop") {
    changeRunner(
      sql,
      createGameStore(sql),
      input.action === "developer-run",
      input.nowMs,
    );
    return {};
  }
  if (input.action === "developer-jump" || input.action === "developer-repeat") {
    jumpRehearsal(
      sql,
      createGameStore(sql),
      input.action === "developer-repeat"
        ? createSqlStore(sql).readRoom().questionIndex
        : (input.questionIndex ?? -1),
      input.nowMs,
    );
    return {};
  }
  if (input.action === "developer-scenario") {
    setRehearsalScenario(
      sql,
      rehearsalScenarioSchema.parse(input.scenario),
      input.nowMs,
    );
    return {};
  }
  if (input.action === "developer-bots") {
    setBotCount(sql, input.botCount, input.nowMs);
    return {};
  }
  if (input.action === "photo-bias-on" || input.action === "photo-bias-off") {
    changePhotoBias(sql, input.action === "photo-bias-on", input.nowMs);
    return {};
  }
  if (input.action === "kart-opponents-on" || input.action === "kart-opponents-off") {
    changeKartOpponents(sql, input.action === "kart-opponents-on", input.nowMs);
    touch(sql);
    return {};
  }
  if (input.action === "kart-effects-on" || input.action === "kart-effects-off") {
    changeKartEffects(sql, input.action === "kart-effects-on", input.nowMs);
    touch(sql);
    return {};
  }
  if (
    [
      "kart-stage-map",
      "kart-stage-overview",
      "kart-stage-follow",
      "kart-stage-director",
    ].includes(input.action)
  ) {
    changeKartStage(sql, input.action.slice("kart-stage-".length), input.nowMs);
    touch(sql);
    return {};
  }
  if (input.action === "kart-course-on" || input.action === "kart-course-off") {
    changeKartCourse(sql, input.action === "kart-course-on", input.nowMs);
    touch(sql);
    return {};
  }
  if (input.action === "reveal-names") {
    const room = createSqlStore(sql).readRoom();
    if (room.phase !== "lobby") {
      throw new Error(namesClosedMessage);
    }
    sql.exec(`UPDATE room SET opening = 'showing', state_version = state_version + 1`);
    return {};
  }
  if (input.action === "hide" || input.action === "show") {
    requireShown(sql, hideClosedMessage);
    sql.exec(
      `UPDATE room SET stage_hidden = ?, state_version = state_version + 1`,
      input.action === "hide" ? 1 : 0,
    );
    return {};
  }
  if (input.action === "rereveal") {
    requireShown(sql, revealClosedMessage);
    const room = createSqlStore(sql).readRoom();
    recordRevealScores(sql, room, input.nowMs);
    sql.exec(
      `UPDATE room SET stage_hidden = 0, reveal_nonce = reveal_nonce + 1, state_version = state_version + 1`,
    );
    return {};
  }
  if (input.action === "hide-media") {
    if (!input.mediaId) {
      throw new Error(mediaMissingMessage);
    }
    hideUpload(sql, input.mediaId);
    noteArchiveCorrection(sql, input.nowMs);
    return {};
  }
  if (input.action === "rename") {
    if (!input.playerId || !input.nickname) {
      throw new Error(playerMissingMessage);
    }
    const renamed = renamePlayer(sql, input.playerId, input.nickname);
    if (!renamed.ok) {
      throw new Error(renamed.message);
    }
    touch(sql);
    return {};
  }
  if (input.action === "swap") {
    if (!input.playerId || !input.otherPlayerId) {
      throw new Error(playerMissingMessage);
    }
    const swapped = swapNicknames(sql, input.playerId, input.otherPlayerId);
    if (!swapped.ok) {
      throw new Error(swapped.message);
    }
    touch(sql);
    return {};
  }
  if (input.action === "kick") {
    if (!input.playerId || !markKicked(sql, input.playerId, input.now)) {
      throw new Error(playerMissingMessage);
    }
    declineWaitingFor(sql, input.playerId);
    syncWall(sql, "tick", input.nowMs);
    touch(sql);
    return {};
  }
  if (input.action === "recover") {
    if (!input.playerId || !input.transfer) {
      throw new Error(playerMissingMessage);
    }
    if (!markRecovered(sql, input.playerId)) {
      throw new Error(playerActiveMessage);
    }
    const issued = readTransferCount(sql);
    if (issued >= maxTransfers) {
      throw new Error(transferLimitMessage);
    }
    sql.exec(
      `INSERT INTO transfer (code_hash, player_id, expires_at, consumed_at) VALUES (?, ?, ?, NULL)`,
      input.transfer.codeHash,
      input.playerId,
      input.transfer.expiresAt,
    );
    writeTransferCount(sql, issued + 1);
    touch(sql);
    return { transferCode: input.transfer.code };
  }
  if (input.action === "include") {
    if (!input.playerId) {
      throw new Error(playerMissingMessage);
    }
    includeAuthor(sql, input.playerId);
    return {};
  }
  if (input.action === "exclude") {
    if (!input.playerId) {
      throw new Error(playerMissingMessage);
    }
    excludeAuthor(sql, input.playerId);
    return {};
  }
  if (input.action === "feature") {
    if (!input.candidateId) {
      throw new Error(playerMissingMessage);
    }
    featureCandidate(sql, input.candidateId);
    return {};
  }
  if (input.action === "cancel-effect") {
    if (!input.effectId) {
      throw new Error(playerMissingMessage);
    }
    cancelTroll(sql, input.effectId, input.nowMs);
    return {};
  }
  if (input.action === "wall-approve") {
    approveWallPost(sql, input.postId, input.nowMs);
    return {};
  }
  if (input.action === "wall-decline") {
    declineWallPost(sql, input.postId, input.nowMs);
    return {};
  }
  if (input.action === "wall-pull") {
    pullWallPost(sql, input.postId, input.nowMs);
    return {};
  }
  if (input.action === "wall-skip" || input.action === "wall-next") {
    moveWallOn(sql, input.action === "wall-skip" ? "skip" : "next", input.nowMs);
    return {};
  }
  if (input.action === "wall-settings") {
    changeWallSettings(sql, input.wallSettings, input.nowMs);
    return {};
  }
  if (input.action === "wall-mute" || input.action === "wall-unmute") {
    muteWallPlayer(sql, input.playerId, input.action === "wall-mute", input.nowMs);
    return {};
  }
  if (input.action === "troll-on" || input.action === "troll-off") {
    if (!input.trollKind) {
      throw new Error(trollKindMessage);
    }
    setTrollSwitch(sql, input.trollKind, input.action === "troll-on");
    touch(sql);
    return {};
  }
  if (input.action === "dismiss-cue") {
    dismissCue(sql, input.nowMs);
    return {};
  }
  if (input.action === "adjust") {
    if (!input.playerId || input.points === undefined || !input.reason) {
      throw new Error(playerMissingMessage);
    }
    const adjusted = insertAdjustment(sql, {
      adjustmentId: crypto.randomUUID(),
      playerId: input.playerId,
      points: input.points,
      reason: input.reason,
      now: input.nowMs,
    });
    if (!adjusted.ok) {
      throw new Error(adjusted.message);
    }
    touch(sql);
    noteArchiveCorrection(sql, input.nowMs);
    return {};
  }
  if (input.action === "retry-archive") {
    if (!requeueFailedArchive(sql, input.nowMs)) {
      throw new Error("The archive export is not waiting for a retry.");
    }
    return {};
  }
  if (input.action === "release-stuck-media") {
    return { released: releaseStuckUploads(sql, input.nowMs) };
  }
  throw new Error(playerMissingMessage);
}

function requireShown(sql: SqlStorage, message: string): void {
  const room = createSqlStore(sql).readRoom();
  if (!shownPhases.has(room.phase)) {
    throw new Error(message);
  }
}

function touch(sql: SqlStorage): void {
  sql.exec(`UPDATE room SET state_version = state_version + 1`);
}

function readTransferCount(sql: SqlStorage): number {
  const row = sql
    .exec<{ value: number }>(
      `SELECT value FROM counter WHERE scope = ? AND name = ?`,
      "room",
      "transfers",
    )
    .toArray()[0];
  return row?.value ?? 0;
}

function writeTransferCount(sql: SqlStorage, value: number): void {
  sql.exec(
    `INSERT INTO counter (scope, name, value) VALUES (?, ?, ?)
     ON CONFLICT (scope, name) DO UPDATE SET value = excluded.value`,
    "room",
    "transfers",
    value,
  );
}

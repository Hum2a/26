import { noteArchiveCorrection, requeueFailedArchive } from "../archive/schedule.ts";
import { hideUpload, releaseStuckUploads } from "../media/records.ts";
import { recordRevealScores } from "../questions/multiple-choice.ts";
import { cancelTroll, dismissCue } from "../troll/engine.ts";
import { excludeAuthor, featureCandidate, includeAuthor } from "../questions/vote.ts";
import {
  hideClosedMessage,
  mediaMissingMessage,
  maxTransfers,
  namesClosedMessage,
  playerActiveMessage,
  playerMissingMessage,
  revealClosedMessage,
  transferLimitMessage,
} from "./limits.ts";
import {
  insertAdjustment,
  markKicked,
  markRecovered,
  renamePlayer,
  swapNicknames,
} from "./names.ts";
import { createSqlStore } from "./sql-store.ts";

const shownPhases = new Set(["reveal", "scores", "final", "podium"]);

export type HostActionInput = {
  action: string;
  playerId?: string;
  otherPlayerId?: string;
  nickname?: string;
  points?: number;
  reason?: string;
  candidateId?: string;
  effectId?: string;
  mediaId?: string;
  now: string;
  nowMs: number;
  transfer?: { code: string; codeHash: string; expiresAt: string };
};

export function applyHostAction(
  sql: SqlStorage,
  input: HostActionInput,
): { transferCode?: string; released?: number } {
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

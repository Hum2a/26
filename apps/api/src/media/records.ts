import {
  mediaAttemptMessage,
  mediaBusyMessage,
  mediaClosedMessage,
  mediaExpiredMessage,
  mediaLateMessage,
  mediaLeaseMs,
  mediaMissingMessage,
  mediaOwnerMessage,
  mediaQuotaMessage,
  mediaRoomQuotaMessage,
  faceQuotaMessage,
  mediaUrlMs,
  playerFaceSlots,
  playerMediaSlots,
  roomFaceSlots,
  roomMediaSlots,
  temporaryPhotoBytes,
  voiceMaxBytes,
} from "../room/limits.ts";
import { acceptedKey, temporaryKey } from "./keys.ts";

export type MediaKind = "photo" | "voice";
/**
 * `round` media belongs to the running question. A `face` is a kart driver's
 * photo: allowed from the lobby, kept across questions, and never part of the
 * question media, stats, trolls or the results gallery.
 */
export type MediaPurpose = "round" | "face";

export type MediaFailure = {
  ok: false;
  error:
    | "unauthenticated"
    | "forbidden"
    | "invalid"
    | "conflict"
    | "full"
    | "expired"
    | "not_found";
  message: string;
  finalKey?: string;
  tempKey?: string;
};

type UploadRow = {
  upload_id: string;
  request_id: string;
  player_id: string;
  kind: string;
  question_index: number;
  temp_key: string;
  final_key: string | null;
  media_id: string | null;
  status: string;
  source_etag: string | null;
  lease_until: number | null;
  attempts: number;
  created_at: number;
  byte_length: number | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  content_type: string | null;
  hidden: number;
  failure: string | null;
  purpose: string;
};

export type ReservedUpload = {
  ok: true;
  uploadId: string;
  kind: MediaKind;
  tempKey: string;
  expiresAt: number;
  contentType: "image/jpeg" | "audio/wav";
};

export function reserveUpload(
  sql: SqlStorage,
  input: {
    playerId: string;
    requestId: string;
    kind: MediaKind;
    purpose?: MediaPurpose;
    nowMs: number;
  },
): ReservedUpload | MediaFailure {
  const purpose = input.purpose ?? "round";
  const room = readRoom(sql);
  if (
    !room ||
    (purpose === "face" && input.kind !== "photo") ||
    room.phase === "podium" ||
    (purpose === "round" && (room.question_count < 1 || room.phase === "lobby"))
  ) {
    return fail("invalid", mediaClosedMessage);
  }
  const existing = sql
    .exec<UploadRow>(
      `SELECT ${columns} FROM media_upload WHERE player_id = ? AND request_id = ?`,
      input.playerId,
      input.requestId,
    )
    .toArray()[0];
  if (existing) {
    if (existing.kind !== input.kind || existing.purpose !== purpose) {
      return fail("conflict", "That request was already saved with different details.");
    }
    return reserved(existing);
  }
  sql.exec(
    `UPDATE media_upload SET status = 'expired'
     WHERE player_id = ? AND status = 'open' AND created_at + ? < ?`,
    input.playerId,
    mediaUrlMs,
    input.nowMs,
  );
  // Faces have their own small allowance, so retaking a face never uses up a
  // guest's question photos and voice clips.
  const playerCount = count(
    sql,
    `SELECT COUNT(*) AS n FROM media_upload
     WHERE player_id = ? AND purpose = ? AND status NOT IN ('rejected', 'cancelled', 'expired')`,
    input.playerId,
    purpose,
  );
  if (playerCount >= (purpose === "face" ? playerFaceSlots : playerMediaSlots)) {
    return fail("full", purpose === "face" ? faceQuotaMessage : mediaQuotaMessage);
  }
  const roomCount = count(
    sql,
    `SELECT COUNT(*) AS n FROM media_upload
     WHERE purpose = ? AND status NOT IN ('rejected', 'cancelled', 'expired')`,
    purpose,
  );
  if (roomCount >= (purpose === "face" ? roomFaceSlots : roomMediaSlots)) {
    return fail("full", mediaRoomQuotaMessage);
  }
  const uploadId = crypto.randomUUID();
  const tempKey = temporaryKey(room.game_id, uploadId);
  sql.exec(
    `INSERT INTO media_upload (
      upload_id, request_id, player_id, kind, question_index, temp_key, status, attempts, created_at, hidden, purpose
    ) VALUES (?, ?, ?, ?, ?, ?, 'open', 0, ?, 0, ?)`,
    uploadId,
    input.requestId,
    input.playerId,
    input.kind,
    room.question_index,
    tempKey,
    input.nowMs,
    purpose,
  );
  const row = mustRow(sql, uploadId);
  return reserved(row);
}

export type ClaimedUpload = {
  ok: true;
  done: boolean;
  repeated: boolean;
  staged: boolean;
  uploadId: string;
  mediaId: string;
  kind: MediaKind;
  tempKey: string;
  finalKey: string;
  sourceEtag: string | null;
  tempByteLimit: number;
  contentType: "image/jpeg" | "audio/wav" | null;
  byteLength: number | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

export function claimUpload(
  sql: SqlStorage,
  input: { playerId: string; uploadId: string; nowMs: number },
): ClaimedUpload | MediaFailure {
  const row = findRow(sql, input.uploadId);
  if (!row) {
    return fail("not_found", mediaMissingMessage);
  }
  if (row.player_id !== input.playerId) {
    return fail("forbidden", mediaOwnerMessage);
  }
  if (row.status === "accepted" && row.media_id && row.final_key) {
    return claimed(row, true, true);
  }
  if (
    row.status === "rejected" ||
    row.status === "cancelled" ||
    row.status === "expired"
  ) {
    return {
      ...fail("invalid", row.failure ?? mediaLateMessage),
      ...(row.final_key ? { finalKey: row.final_key } : {}),
      ...(row.status === "expired" ? { tempKey: row.temp_key } : {}),
    };
  }
  if (row.status === "staged" && row.media_id && row.final_key) {
    return claimed(row, false, false);
  }
  if (row.status === "leased" && (row.lease_until ?? 0) > input.nowMs) {
    return fail("conflict", mediaBusyMessage);
  }
  if (row.status === "open" && row.created_at + mediaUrlMs < input.nowMs) {
    sql.exec(
      `UPDATE media_upload SET status = 'expired', failure = ? WHERE upload_id = ?`,
      mediaExpiredMessage,
      row.upload_id,
    );
    return { ...fail("expired", mediaExpiredMessage), tempKey: row.temp_key };
  }
  if (row.attempts >= 5) {
    sql.exec(
      `UPDATE media_upload SET status = 'rejected', failure = ? WHERE upload_id = ?`,
      mediaAttemptMessage,
      row.upload_id,
    );
    return fail("invalid", mediaAttemptMessage);
  }
  const room = readRoom(sql);
  if (!room) {
    return fail("not_found", mediaMissingMessage);
  }
  const mediaId = row.media_id ?? crypto.randomUUID();
  const finalKey = row.final_key ?? acceptedKey(room.game_id, mediaId);
  sql.exec(
    `UPDATE media_upload
     SET media_id = ?, final_key = ?, status = 'leased', lease_until = ?, attempts = attempts + 1
     WHERE upload_id = ?`,
    mediaId,
    finalKey,
    input.nowMs + mediaLeaseMs,
    row.upload_id,
  );
  return claimed(mustRow(sql, row.upload_id), false, false);
}

export function rememberSource(sql: SqlStorage, uploadId: string, etag: string): void {
  sql.exec(
    `UPDATE media_upload SET source_etag = ? WHERE upload_id = ? AND status = 'leased'`,
    etag,
    uploadId,
  );
}

export function clearPrepared(sql: SqlStorage, uploadId: string): void {
  sql.exec(`UPDATE media_upload SET source_etag = NULL WHERE upload_id = ?`, uploadId);
}

export function stageUpload(
  sql: SqlStorage,
  input: {
    uploadId: string;
    byteLength: number;
    width: number | null;
    height: number | null;
    durationMs: number | null;
    contentType: string;
  },
): void {
  sql.exec(
    `UPDATE media_upload
     SET status = 'staged', byte_length = ?, width = ?, height = ?, duration_ms = ?, content_type = ?
     WHERE upload_id = ? AND status = 'leased'`,
    input.byteLength,
    input.width,
    input.height,
    input.durationMs,
    input.contentType,
    input.uploadId,
  );
}

export function commitUpload(
  sql: SqlStorage,
  input: { uploadId: string },
):
  | { ok: true; mediaId: string; kind: MediaKind; repeated: boolean }
  | { ok: false; cancelled: true; finalKey: string; message: string }
  | MediaFailure {
  const row = findRow(sql, input.uploadId);
  if (!row || !row.media_id || !row.final_key) {
    return fail("not_found", mediaMissingMessage);
  }
  if (row.status === "accepted") {
    return { ok: true, mediaId: row.media_id, kind: kindOf(row.kind), repeated: true };
  }
  if (row.status !== "staged") {
    return fail("conflict", mediaBusyMessage);
  }
  const room = readRoom(sql);
  const late =
    row.purpose === "face"
      ? !room || room.phase === "podium"
      : !room ||
        room.question_index !== row.question_index ||
        room.phase === "podium" ||
        room.phase === "lobby";
  if (late) {
    sql.exec(
      `UPDATE media_upload SET status = 'cancelled', failure = ? WHERE upload_id = ?`,
      mediaLateMessage,
      row.upload_id,
    );
    return {
      ok: false,
      cancelled: true,
      finalKey: row.final_key,
      message: mediaLateMessage,
    };
  }
  sql.exec(
    `UPDATE media_upload SET status = 'accepted' WHERE upload_id = ?`,
    row.upload_id,
  );
  sql.exec(`UPDATE room SET state_version = state_version + 1`);
  return { ok: true, mediaId: row.media_id, kind: kindOf(row.kind), repeated: false };
}

export function releaseStuckUploads(sql: SqlStorage, nowMs: number): number {
  const rows = sql
    .exec<{ upload_id: string }>(
      `SELECT upload_id FROM media_upload
       WHERE status = 'leased' AND (lease_until IS NULL OR lease_until <= ?)`,
      nowMs,
    )
    .toArray();
  for (const row of rows) {
    releaseUpload(sql, row.upload_id);
  }
  return rows.length;
}

export function releaseUpload(sql: SqlStorage, uploadId: string): void {
  sql.exec(
    `UPDATE media_upload
     SET status = 'open', lease_until = NULL, source_etag = NULL
     WHERE upload_id = ? AND status = 'leased'`,
    uploadId,
  );
}

export function rejectUpload(sql: SqlStorage, uploadId: string, message: string): void {
  sql.exec(
    `UPDATE media_upload SET status = 'rejected', failure = ?, lease_until = NULL WHERE upload_id = ?`,
    message,
    uploadId,
  );
}

export function hideUpload(sql: SqlStorage, mediaId: string): void {
  const row = sql
    .exec<{ media_id: string }>(
      `SELECT media_id FROM media_upload WHERE media_id = ? AND status = 'accepted'`,
      mediaId,
    )
    .toArray()[0];
  if (!row) {
    throw new Error(mediaMissingMessage);
  }
  sql.exec(`UPDATE media_upload SET hidden = 1 WHERE media_id = ?`, mediaId);
  sql.exec(`UPDATE room SET state_version = state_version + 1`);
}

export function listUploads(
  sql: SqlStorage,
  audience: "guest" | "stage" | "control",
): { mediaId: string; kind: MediaKind; nickname: string; hidden?: boolean }[] {
  const rows = sql
    .exec<{ media_id: string; kind: string; nickname: string; hidden: number }>(
      `SELECT m.media_id, m.kind, p.nickname, m.hidden
       FROM media_upload m
       JOIN player p ON p.player_id = m.player_id
       WHERE m.status = 'accepted' AND m.media_id IS NOT NULL AND m.purpose = 'round'
       ORDER BY m.created_at ASC
       LIMIT 20`,
    )
    .toArray();
  return rows
    .filter((row) => audience === "control" || row.hidden === 0)
    .map((row) => ({
      mediaId: row.media_id,
      kind: kindOf(row.kind),
      nickname: row.nickname,
      ...(audience === "control" ? { hidden: row.hidden === 1 } : {}),
    }));
}

export function readServable(
  sql: SqlStorage,
  mediaId: string,
): { finalKey: string; contentType: string; hidden: boolean } | null {
  const row = sql
    .exec<{
      final_key: string | null;
      content_type: string | null;
      hidden: number;
      status: string;
    }>(
      `SELECT final_key, content_type, hidden, status FROM media_upload WHERE media_id = ?`,
      mediaId,
    )
    .toArray()[0];
  if (!row || row.status !== "accepted" || !row.final_key || !row.content_type) {
    return null;
  }
  return {
    finalKey: row.final_key,
    contentType: row.content_type,
    hidden: row.hidden === 1,
  };
}

export function temporaryWrite(
  sql: SqlStorage,
  input: { playerId: string; uploadId: string; nowMs: number },
):
  | { ok: true; tempKey: string; contentType: "image/jpeg" | "audio/wav" }
  | MediaFailure {
  const row = findRow(sql, input.uploadId);
  if (!row) {
    return fail("not_found", mediaMissingMessage);
  }
  if (row.player_id !== input.playerId) {
    return fail("forbidden", mediaOwnerMessage);
  }
  if (row.created_at + mediaUrlMs < input.nowMs) {
    return fail("expired", mediaExpiredMessage);
  }
  if (
    row.status === "rejected" ||
    row.status === "cancelled" ||
    row.status === "expired"
  ) {
    return fail("invalid", row.failure ?? mediaExpiredMessage);
  }
  return {
    ok: true,
    tempKey: row.temp_key,
    contentType: row.kind === "voice" ? "audio/wav" : "image/jpeg",
  };
}

const columns = `upload_id, request_id, player_id, kind, question_index, temp_key, final_key, media_id, status, source_etag, lease_until, attempts, created_at, byte_length, width, height, duration_ms, content_type, hidden, failure, purpose`;

function reserved(row: UploadRow): ReservedUpload {
  return {
    ok: true,
    uploadId: row.upload_id,
    kind: kindOf(row.kind),
    tempKey: row.temp_key,
    expiresAt: row.created_at + mediaUrlMs,
    contentType: row.kind === "voice" ? "audio/wav" : "image/jpeg",
  };
}

function claimed(row: UploadRow, done: boolean, repeated: boolean): ClaimedUpload {
  return {
    ok: true,
    done,
    repeated,
    staged: row.status === "staged",
    uploadId: row.upload_id,
    mediaId: row.media_id ?? "",
    kind: kindOf(row.kind),
    tempKey: row.temp_key,
    finalKey: row.final_key ?? "",
    sourceEtag: row.source_etag,
    tempByteLimit: row.kind === "voice" ? voiceMaxBytes : temporaryPhotoBytes,
    contentType:
      row.content_type === "audio/wav" || row.content_type === "image/jpeg"
        ? row.content_type
        : null,
    byteLength: row.byte_length,
    width: row.width,
    height: row.height,
    durationMs: row.duration_ms,
  };
}

function findRow(sql: SqlStorage, uploadId: string): UploadRow | undefined {
  return sql
    .exec<UploadRow>(
      `SELECT ${columns} FROM media_upload WHERE upload_id = ?`,
      uploadId,
    )
    .toArray()[0];
}

function mustRow(sql: SqlStorage, uploadId: string): UploadRow {
  const row = findRow(sql, uploadId);
  if (!row) {
    throw new Error(mediaMissingMessage);
  }
  return row;
}

function readRoom(
  sql: SqlStorage,
):
  | { game_id: string; phase: string; question_index: number; question_count: number }
  | undefined {
  return sql
    .exec<{
      game_id: string;
      phase: string;
      question_index: number;
      question_count: number;
    }>(`SELECT game_id, phase, question_index, question_count FROM room`)
    .toArray()[0];
}

function count(sql: SqlStorage, query: string, ...args: string[]): number {
  const row = sql.exec<{ n: number }>(query, ...args).toArray()[0];
  return row?.n ?? 0;
}

function kindOf(kind: string): MediaKind {
  return kind === "voice" ? "voice" : "photo";
}

function fail(error: MediaFailure["error"], message: string): MediaFailure {
  return { ok: false, error, message };
}

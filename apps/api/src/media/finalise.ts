import { galleryCacheSeconds } from "@26/shared";
import { mediaChangedMessage, mediaLargeMessage } from "../room/limits.ts";
import type { PhotoCheck } from "./photo.ts";
import type { ClaimedUpload, MediaFailure } from "./records.ts";
import type { ObjectStore } from "./store.ts";
import { validateWav } from "./wav.ts";

export type MediaHandoff =
  "after-read" | "after-source" | "after-write" | "after-stage" | "after-commit";

export type MediaBook = {
  claimUpload(input: {
    playerId: string;
    uploadId: string;
    nowMs: number;
  }): Promise<ClaimedUpload | MediaFailure>;
  rememberSource(uploadId: string, etag: string): Promise<void>;
  clearPrepared(uploadId: string): Promise<void>;
  stageUpload(input: {
    uploadId: string;
    byteLength: number;
    width: number | null;
    height: number | null;
    durationMs: number | null;
    contentType: string;
  }): Promise<void>;
  commitUpload(input: {
    uploadId: string;
  }): Promise<
    | { ok: true; mediaId: string; kind: "photo" | "voice"; repeated: boolean }
    | { ok: false; cancelled: true; finalKey: string; message: string }
    | MediaFailure
  >;
  releaseUpload(uploadId: string): Promise<void>;
  rejectUpload(uploadId: string, message: string): Promise<void>;
};

export async function finaliseUpload(input: {
  book: MediaBook;
  store: ObjectStore;
  uploadId: string;
  playerId: string;
  nowMs: number;
  photo: (bytes: Uint8Array) => Promise<PhotoCheck>;
  interrupt?: (point: MediaHandoff) => void | Promise<void>;
}): Promise<
  | { ok: true; mediaId: string; kind: "photo" | "voice"; repeated: boolean }
  | MediaFailure
> {
  const claim = await input.book.claimUpload({
    playerId: input.playerId,
    uploadId: input.uploadId,
    nowMs: input.nowMs,
  });
  if (!claim.ok) {
    if (claim.finalKey) {
      await input.store.delete(claim.finalKey);
    }
    if (claim.tempKey) {
      await input.store.delete(claim.tempKey);
    }
    return { ok: false, error: claim.error, message: claim.message };
  }
  if (claim.done) {
    await input.store.delete(claim.tempKey);
    return { ok: true, mediaId: claim.mediaId, kind: claim.kind, repeated: true };
  }
  if (claim.staged) {
    return finish(input, claim);
  }

  const head = await input.store.head(claim.tempKey);
  if (!head) {
    await input.book.releaseUpload(claim.uploadId);
    return { ok: false, error: "invalid", message: "That file has not arrived." };
  }
  if (head.size > claim.tempByteLimit || head.size < 1) {
    await input.book.rejectUpload(claim.uploadId, mediaLargeMessage);
    await input.store.delete(claim.tempKey);
    await input.store.delete(claim.finalKey);
    return { ok: false, error: "invalid", message: mediaLargeMessage };
  }
  if (claim.sourceEtag && claim.sourceEtag !== head.etag) {
    await input.store.delete(claim.finalKey);
    await input.book.clearPrepared(claim.uploadId);
    await input.book.releaseUpload(claim.uploadId);
    return { ok: false, error: "conflict", message: mediaChangedMessage };
  }
  const object = await input.store.get(claim.tempKey, {
    etagMatches: head.etag,
    maxBytes: claim.tempByteLimit,
  });
  if (
    !object ||
    object.preconditionFailed ||
    !object.bytes ||
    object.size > claim.tempByteLimit
  ) {
    await input.store.delete(claim.finalKey);
    await input.book.clearPrepared(claim.uploadId);
    await input.book.releaseUpload(claim.uploadId);
    return { ok: false, error: "conflict", message: mediaChangedMessage };
  }
  await input.interrupt?.("after-read");
  await input.book.rememberSource(claim.uploadId, head.etag);
  await input.interrupt?.("after-source");

  const checked =
    claim.kind === "voice"
      ? validateWav(object.bytes)
      : await input.photo(object.bytes);
  if (!checked.ok) {
    await input.book.rejectUpload(claim.uploadId, checked.message);
    await input.store.delete(claim.tempKey);
    await input.store.delete(claim.finalKey);
    return { ok: false, error: "invalid", message: checked.message };
  }
  const existing = await input.store.head(claim.finalKey);
  if (!existing) {
    const written = await input.store.put(claim.finalKey, checked.bytes, {
      contentType: checked.contentType,
      ifNoneMatch: true,
    });
    if (!written) {
      return { ok: false, error: "conflict", message: mediaChangedMessage };
    }
  }
  await input.interrupt?.("after-write");
  await input.book.stageUpload({
    uploadId: claim.uploadId,
    byteLength: checked.bytes.byteLength,
    width: "width" in checked ? checked.width : null,
    height: "height" in checked ? checked.height : null,
    durationMs: "durationMs" in checked ? checked.durationMs : null,
    contentType: checked.contentType,
  });
  await input.interrupt?.("after-stage");
  return finish(input, claim);
}

async function finish(
  input: {
    book: MediaBook;
    store: ObjectStore;
    interrupt?: (point: MediaHandoff) => void | Promise<void>;
  },
  claim: ClaimedUpload,
): Promise<
  | { ok: true; mediaId: string; kind: "photo" | "voice"; repeated: boolean }
  | MediaFailure
> {
  const committed = await input.book.commitUpload({ uploadId: claim.uploadId });
  await input.interrupt?.("after-commit");
  if (!committed.ok && "cancelled" in committed) {
    await input.store.delete(committed.finalKey);
    await input.store.delete(claim.tempKey);
    return { ok: false, error: "invalid", message: committed.message };
  }
  if (!committed.ok) {
    return committed;
  }
  await input.store.delete(claim.tempKey);
  return committed;
}

export function hiddenMediaHeaders(): Headers {
  const headers = new Headers();
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  return headers;
}

export function galleryMediaHeaders(contentType: string): Headers {
  const headers = new Headers();
  headers.set("content-type", contentType);
  headers.set(
    "cache-control",
    `public, max-age=${galleryCacheSeconds}, must-revalidate`,
  );
  headers.set("x-content-type-options", "nosniff");
  return headers;
}

export function acceptedMediaHeaders(contentType: string): Headers {
  const headers = new Headers();
  headers.set("content-type", contentType);
  headers.set("cache-control", "private, no-store");
  headers.set("x-content-type-options", "nosniff");
  return headers;
}

export async function readAcceptedBytes(
  store: ObjectStore,
  finalKey: string,
): Promise<Uint8Array | null> {
  const head = await store.head(finalKey);
  if (!head) {
    return null;
  }
  const object = await store.get(finalKey, {
    etagMatches: head.etag,
    maxBytes: head.size,
  });
  if (!object?.bytes) {
    return null;
  }
  return object.bytes;
}

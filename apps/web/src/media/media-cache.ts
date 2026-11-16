import { useEffect, useSyncExternalStore } from "react";

/** Bounded in-memory blob cache size across active room media (avatars + wall). */
export const MEDIA_CACHE_MAX_ENTRIES = 96;

const ROOM_MEDIA_RE = /^\/api\/rooms\/([^/?#]+)\/media\/[^/?#]+/;

type CacheEntry = {
  blobUrl: string;
  gameId: string;
};

const entries = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<string | null>>();
const listeners = new Map<string, Set<() => void>>();

let activeRoomScope: string | null = null;
let roomEpoch = 0;

function noopUnsubscribe() {}

function parseRoomMediaGameId(url: string): string | null {
  const match = ROOM_MEDIA_RE.exec(url);
  return match ? match[1]! : null;
}

/** True when running in a browser environment capable of memory-cached blob URLs. */
export function supportsBlobMediaCache(): boolean {
  return (
    typeof fetch === "function" &&
    typeof URL !== "undefined" &&
    typeof URL.createObjectURL === "function" &&
    typeof URL.revokeObjectURL === "function"
  );
}

function notifyUrl(url: string): void {
  const subs = listeners.get(url);
  if (!subs) return;
  for (const listener of subs) listener();
}

function subscribeMediaUrl(url: string, listener: () => void): () => void {
  let subs = listeners.get(url);
  if (!subs) {
    subs = new Set();
    listeners.set(url, subs);
  }
  subs.add(listener);
  return () => {
    const current = listeners.get(url);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) listeners.delete(url);
  };
}

function getCachedMediaUrlSnapshot(url: string): string | null {
  return entries.get(url)?.blobUrl ?? null;
}

/** Moves an existing cached URL to most-recently-used without touching the network. */
export function touchMediaUrl(url: string): string | null {
  const existing = entries.get(url);
  if (!existing) return null;
  entries.delete(url);
  entries.set(url, existing);
  return existing.blobUrl;
}

/** Returns the cached `blob:` URL if present (refreshing LRU recency), otherwise null. */
export function getCachedMediaUrl(url: string): string | null {
  return touchMediaUrl(url);
}

function revokeEntry(url: string, entry: CacheEntry): void {
  entries.delete(url);
  if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    try {
      URL.revokeObjectURL(entry.blobUrl);
    } catch {
      // Ignore invalid/already-revoked object URLs during teardown.
    }
  }
  notifyUrl(url);
}

function storeBlobEntry(url: string, gameId: string, blobUrl: string): void {
  const previous = entries.get(url);
  if (previous && previous.blobUrl !== blobUrl) {
    revokeEntry(url, previous);
  } else {
    entries.delete(url);
  }
  entries.set(url, { blobUrl, gameId });
  while (entries.size > MEDIA_CACHE_MAX_ENTRIES) {
    const oldest = entries.entries().next();
    if (oldest.done) break;
    const [oldestUrl, oldestEntry] = oldest.value;
    revokeEntry(oldestUrl, oldestEntry);
  }
  notifyUrl(url);
}

/** Drops and revokes a single cached media URL, e.g. if an element fails to load it. */
export function evictMediaUrl(url: string): void {
  const existing = entries.get(url);
  if (!existing) return;
  revokeEntry(url, existing);
}

/**
 * Clears cached blob URLs when switching rooms or resetting state.
 * Pass `keepGameId` to keep entries belonging to the active room and revoke
 * entries from previous rooms; omit or pass `null` to revoke every entry.
 */
export function clearRoomMediaCache(keepGameId?: string | null): void {
  activeRoomScope = keepGameId ?? null;
  roomEpoch += 1;
  for (const [url, entry] of [...entries.entries()]) {
    if (!keepGameId || entry.gameId !== keepGameId) {
      revokeEntry(url, entry);
    }
  }
}

/**
 * Fetches a private room media URL once and stores an in-memory `blob:` URL so
 * repeat renders (`StageWall` preload -> now -> reel, `PlayerAvatar` across
 * screens) never re-fetch `private, no-store` assets over the network.
 */
export async function preloadMediaUrl(url: string): Promise<string | null> {
  const gameId = parseRoomMediaGameId(url);
  if (!gameId || !supportsBlobMediaCache()) return null;

  const existing = touchMediaUrl(url);
  if (existing) return existing;

  const pending = inFlight.get(url);
  if (pending) return pending;

  const startedEpoch = roomEpoch;
  let task: Promise<string | null> | undefined = undefined;
  task = (async (): Promise<string | null> => {
    try {
      const response = await fetch(url, { credentials: "same-origin" });
      if (!response.ok) return null;
      const blob = await response.blob();
      if (blob.size <= 0) return null;
      // If a room switch occurred while the request was in flight, discard
      // any response belonging to a previous room instead of leaking a blob.
      if (
        roomEpoch !== startedEpoch &&
        activeRoomScope !== null &&
        activeRoomScope !== gameId
      ) {
        return null;
      }
      const blobUrl = URL.createObjectURL(blob);
      storeBlobEntry(url, gameId, blobUrl);
      return blobUrl;
    } catch {
      return null;
    } finally {
      if (inFlight.get(url) === task) {
        inFlight.delete(url);
      }
    }
  })();

  inFlight.set(url, task);
  return task;
}

/**
 * Resolves a room media URL to an in-memory `blob:` URL once cached, while
 * immediately returning `rawSrc` on initial uncached renders so images start
 * cleanly and test environments without `URL.createObjectURL` keep working.
 */
export function useCachedMediaSrc(
  rawSrc: string | null,
  options?: { preload?: boolean },
): string | null {
  const preload = options?.preload ?? true;
  const cached = useSyncExternalStore(
    (listener) => (rawSrc ? subscribeMediaUrl(rawSrc, listener) : noopUnsubscribe),
    () => (rawSrc ? getCachedMediaUrlSnapshot(rawSrc) : null),
    () => null,
  );

  useEffect(() => {
    if (!rawSrc) return;
    if (preload) {
      void preloadMediaUrl(rawSrc);
    } else {
      touchMediaUrl(rawSrc);
    }
  }, [preload, rawSrc]);

  if (!rawSrc) return null;
  return cached ?? rawSrc;
}


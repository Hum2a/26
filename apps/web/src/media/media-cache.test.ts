import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MEDIA_CACHE_MAX_ENTRIES,
  clearRoomMediaCache,
  evictMediaUrl,
  getCachedMediaUrl,
  preloadMediaUrl,
  useCachedMediaSrc,
} from "./media-cache";

function roomMedia(gameId: string, id: string) {
  return `/api/rooms/${gameId}/media/${id}`;
}

describe("room media blob cache", () => {
  let nextBlob = 0;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nextBlob = 0;
    createObjectURL = vi.fn(() => `blob:cached-${++nextBlob}`);
    revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });
    fetchMock = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["jpeg-bytes"], { type: "image/jpeg" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    clearRoomMediaCache();
  });

  afterEach(() => {
    clearRoomMediaCache();
    vi.unstubAllGlobals();
  });

  it("caches room media URLs in memory, deduplicating in-flight and repeat loads", async () => {
    const url = roomMedia("ABCDEFGH", "photo-1");
    const [first, second] = await Promise.all([
      preloadMediaUrl(url),
      preloadMediaUrl(url),
    ]);

    expect(first).toBe("blob:cached-1");
    expect(second).toBe("blob:cached-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getCachedMediaUrl(url)).toBe("blob:cached-1");

    expect(await preloadMediaUrl(url)).toBe("blob:cached-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ignores non-room URLs and falls back cleanly when fetches fail", async () => {
    expect(await preloadMediaUrl("/static/sample.jpg")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce({ ok: false, blob: async () => new Blob() });
    const failing = roomMedia("ABCDEFGH", "missing");
    expect(await preloadMediaUrl(failing)).toBeNull();
    expect(getCachedMediaUrl(failing)).toBeNull();

    const { result } = renderHook(() =>
      useCachedMediaSrc(failing, { preload: false }),
    );
    expect(result.current).toBe(failing);
  });

  it("evicts and revokes the least-recently-used object URL beyond the capacity bound", async () => {
    for (let index = 0; index < MEDIA_CACHE_MAX_ENTRIES; index++) {
      await preloadMediaUrl(roomMedia("ABCDEFGH", `item-${index}`));
    }
    // Touch item-0 so item-1 becomes the least recently used entry.
    expect(getCachedMediaUrl(roomMedia("ABCDEFGH", "item-0"))).toBe("blob:cached-1");

    await preloadMediaUrl(roomMedia("ABCDEFGH", "item-overflow"));

    expect(getCachedMediaUrl(roomMedia("ABCDEFGH", "item-0"))).toBe("blob:cached-1");
    expect(getCachedMediaUrl(roomMedia("ABCDEFGH", "item-1"))).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:cached-2");
  });

  it("revokes evicted entries on error and clears prior room entries on room switch", async () => {
    const roomA1 = roomMedia("ROOMA", "a1");
    const roomA2 = roomMedia("ROOMA", "a2");
    const roomB1 = roomMedia("ROOMB", "b1");

    await preloadMediaUrl(roomA1);
    await preloadMediaUrl(roomA2);
    await preloadMediaUrl(roomB1);

    evictMediaUrl(roomA1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:cached-1");
    expect(getCachedMediaUrl(roomA1)).toBeNull();

    clearRoomMediaCache("ROOMB");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:cached-2");
    expect(getCachedMediaUrl(roomA2)).toBeNull();
    expect(getCachedMediaUrl(roomB1)).toBe("blob:cached-3");
  });

  it("serves rawSrc immediately when uncached and updates subscribed hooks once cached", async () => {
    const url = roomMedia("ABCDEFGH", "avatar-1");
    const { result } = renderHook(() => useCachedMediaSrc(url, { preload: true }));

    expect(result.current).toBe(url);
    await waitFor(() => {
      expect(result.current).toBe("blob:cached-1");
    });

    evictMediaUrl(url);
    await waitFor(() => {
      expect(result.current).toBe(url);
    });
  });
});


import type { RoomDiagnostics } from "@26/shared";

type Series = { total: number; totalBytes: number; buckets: Bucket[] };
type Bucket = { second: number; count: number; bytes: number };

const bucketCount = 60;
export const realtimeWindowMs = 10_000;

/**
 * Counts and bytes of room socket traffic, kept in memory for diagnostics only.
 * Workers do not advance the clock during synchronous work, so this records
 * volumes rather than durations. The load harness measures latency.
 */
export function createRealtimeMeter() {
  const series = new Map<string, Series>();

  function add(name: string, bytes: number, now: number): void {
    let entry = series.get(name);
    if (!entry) {
      entry = { total: 0, totalBytes: 0, buckets: [] };
      series.set(name, entry);
    }
    entry.total += 1;
    entry.totalBytes += bytes;
    const second = Math.floor(now / 1000);
    const slot = second % bucketCount;
    const bucket = entry.buckets[slot];
    if (bucket && bucket.second === second) {
      bucket.count += 1;
      bucket.bytes += bytes;
    } else {
      entry.buckets[slot] = { second, count: 1, bytes };
    }
  }

  function summary(now: number): NonNullable<RoomDiagnostics["realtime"]> {
    const newest = Math.floor(now / 1000);
    const oldest = newest - realtimeWindowMs / 1000;
    return {
      windowMs: realtimeWindowMs,
      series: [...series.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .slice(0, 16)
        .map(([name, entry]) => {
          let windowCount = 0;
          let windowBytes = 0;
          for (const bucket of entry.buckets) {
            if (bucket && bucket.second > oldest && bucket.second <= newest) {
              windowCount += bucket.count;
              windowBytes += bucket.bytes;
            }
          }
          return {
            name,
            total: entry.total,
            totalBytes: entry.totalBytes,
            windowCount,
            windowBytes,
          };
        }),
    };
  }

  return { add, summary };
}

export type RealtimeMeter = ReturnType<typeof createRealtimeMeter>;

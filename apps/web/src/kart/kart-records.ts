import { z } from "zod";
import { kartTrialRecordSchema, type KartTrialRecord } from "@26/shared";

export const kartRecordsKey = "26-kart-trials-v1";
const schema = z
  .object({
    version: z.literal(1),
    enabled: z.boolean(),
    records: z.array(kartTrialRecordSchema).max(20),
  })
  .strict();
export type KartRecords = z.infer<typeof schema>;
export const emptyKartRecords = (): KartRecords => ({
  version: 1,
  enabled: false,
  records: [],
});
type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export const browserKartRecordStorage: StoragePort = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
};
export function readKartRecords(storage: StoragePort): {
  data: KartRecords;
  notice: string;
} {
  try {
    const raw = storage.getItem(kartRecordsKey);
    if (!raw) return { data: emptyKartRecords(), notice: "" };
    if (raw.length > 40_000) throw new Error("Oversized records");
    const result = schema.safeParse(JSON.parse(raw));
    return result.success
      ? { data: result.data, notice: "" }
      : {
          data: emptyKartRecords(),
          notice: "Older or incompatible records were ignored",
        };
  } catch {
    return {
      data: emptyKartRecords(),
      notice: "Local records unavailable — driving still works",
    };
  }
}
export function writeKartRecords(storage: StoragePort, data: KartRecords): string {
  try {
    if (data.enabled)
      storage.setItem(kartRecordsKey, JSON.stringify(schema.parse(data)));
    else storage.removeItem(kartRecordsKey);
    return "";
  } catch {
    return "Could not save local records — your result is still shown";
  }
}
export function kartRecordKey(
  record: Pick<KartTrialRecord, "config" | "quality">,
): string {
  const { config: c } = record;
  return JSON.stringify([
    c.version,
    c.track,
    c.physics,
    c.handling,
    c.laps,
    c.assists,
    c.items,
    c.course.boosts,
    c.course.ramps,
    c.course.hazards,
    record.quality,
  ]);
}
export function addKartRecord(
  data: KartRecords,
  candidate: KartTrialRecord,
): KartRecords {
  const parsed = kartTrialRecordSchema.safeParse(candidate);
  if (!data.enabled || !parsed.success) return data;
  const key = kartRecordKey(parsed.data);
  // Total and best lap can belong to different attempts with identical settings.
  // Retain at most two actual runs per profile, never a fabricated combined run.
  const matching = [
    ...data.records.filter((record) => kartRecordKey(record) === key),
    parsed.data,
  ];
  const bestTotal = matching.reduce((a, b) => (a.totalMs <= b.totalMs ? a : b));
  const bestLap = matching.reduce((a, b) =>
    Math.min(...a.lapsMs) <= Math.min(...b.lapsMs) ? a : b,
  );
  if (data.records.includes(bestTotal) && data.records.includes(bestLap)) return data;
  return {
    ...data,
    records: [
      ...data.records.filter((record) => kartRecordKey(record) !== key),
      bestTotal,
      ...(bestLap === bestTotal ? [] : [bestLap]),
    ].slice(-20),
  };
}

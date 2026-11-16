import { expect, it } from "vitest";
import { type KartTrialRecord } from "@26/shared";
import {
  addKartRecord,
  emptyKartRecords,
  kartRecordKey,
  kartRecordsKey,
  readKartRecords,
  writeKartRecords,
} from "./kart-records";
const run: KartTrialRecord = {
  config: {
    version: 1,
    track: "mario-circuit-v1",
    physics: "arcade-v2",
    handling: "slide-v1",
    laps: 3,
    assists: "none",
    items: false,
    course: { boosts: false, ramps: false, hazards: false },
  },
  quality: "clean",
  totalMs: 60000,
  lapsMs: [20000, 20000, 20000],
};
it("defaults off, persists only when opted in and forgets on switch-off", () => {
  localStorage.clear();
  let data = emptyKartRecords();
  expect(addKartRecord(data, run)).toBe(data);
  data = addKartRecord({ ...data, enabled: true }, run);
  expect(writeKartRecords(localStorage, data)).toBe("");
  expect(readKartRecords(localStorage).data).toEqual(data);
  writeKartRecords(localStorage, emptyKartRecords());
  expect(localStorage.getItem(kartRecordsKey)).toBeNull();
});
it("retains actual best-total and best-lap attempts separately and caps retained runs", () => {
  let data = addKartRecord({ ...emptyKartRecords(), enabled: true }, run);
  data = addKartRecord(data, { ...run, totalMs: 61000, lapsMs: [19000, 21000, 21000] });
  expect(data.records).toHaveLength(2);
  data = addKartRecord(data, { ...run, totalMs: 62000, lapsMs: [22000, 20000, 20000] });
  expect(data.records).toHaveLength(2);
  expect(data.records.map((r) => r.totalMs)).toEqual([60000, 61000]);
  const seed = { ...data, records: Array.from({ length: 20 }, () => run) };
  expect(addKartRecord(seed, { ...run, quality: "assisted" }).records).toHaveLength(20);
});
it("separates handling, laps, course, items and recovery; refuses invalid or mismatched versions", () => {
  const key = kartRecordKey(run);
  for (const other of [
    { ...run, quality: "assisted" as const },
    { ...run, config: { ...run.config, handling: "bounce-v1" as const } },
    { ...run, config: { ...run.config, items: true } },
    { ...run, config: { ...run.config, laps: 1 as const } },
    {
      ...run,
      config: { ...run.config, course: { ...run.config.course, boosts: true } },
    },
  ])
    expect(kartRecordKey(other)).not.toBe(key);
  const data = { ...emptyKartRecords(), enabled: true };
  expect(addKartRecord(data, { ...run, totalMs: 1 })).toBe(data);
  localStorage.setItem(
    kartRecordsKey,
    JSON.stringify({ version: 2, enabled: true, records: [run] }),
  );
  expect(readKartRecords(localStorage).data).toEqual(emptyKartRecords());
});
it("survives denied storage, malformed and oversized records without affecting driving", () => {
  const denied = {
    getItem() {
      throw Error("denied");
    },
    setItem() {
      throw Error("denied");
    },
    removeItem() {
      throw Error("denied");
    },
  };
  expect(readKartRecords(denied).data.enabled).toBe(false);
  expect(writeKartRecords(denied, { ...emptyKartRecords(), enabled: true })).toContain(
    "Could not save",
  );
  for (const raw of ["{", "x".repeat(40001)]) {
    localStorage.setItem(kartRecordsKey, raw);
    expect(readKartRecords(localStorage).data.records).toEqual([]);
  }
});

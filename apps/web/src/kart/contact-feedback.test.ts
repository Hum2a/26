import { expect, it } from "vitest";
import {
  createContactFeedbackCursor,
  type KartContactSample,
} from "./contact-feedback";
const sample = (
  elapsedMs: number,
  contact: boolean,
  active = true,
  raceId = "race",
): KartContactSample => ({ elapsedMs, contact, active, raceId });
it("plays only fresh contact edges, never initial, duplicate, paused or reconnected state", () => {
  const cursor = createContactFeedbackCursor();
  expect(cursor.read(sample(0, true))).toBe(false);
  expect(cursor.read(sample(20, true))).toBe(false);
  expect(cursor.read(sample(40, false))).toBe(false);
  expect(cursor.read(sample(60, true))).toBe(true);
  expect(cursor.read(sample(60, true))).toBe(false);
  expect(cursor.read(sample(80, true, false))).toBe(false);
  expect(cursor.read(sample(80, true))).toBe(false);
  expect(cursor.read(sample(100, true))).toBe(false);
  cursor.reset();
  expect(cursor.read(sample(200, true))).toBe(false);
  expect(cursor.read(sample(220, false))).toBe(false);
  expect(cursor.read(sample(240, true))).toBe(true);
});
it("bounds repeated effects, handles rewind/new races and rejects invalid elapsed samples", () => {
  const cursor = createContactFeedbackCursor();
  cursor.read(sample(0, false));
  expect(cursor.read(sample(20, true))).toBe(true);
  cursor.read(sample(40, false));
  expect(cursor.read(sample(60, true))).toBe(false);
  cursor.read(sample(400, false));
  expect(cursor.read(sample(420, true))).toBe(true);
  expect(cursor.read(sample(0, true))).toBe(false);
  expect(cursor.read(sample(600, true, true, "new"))).toBe(false);
  expect(cursor.read(sample(NaN, true))).toBe(false);
  expect(cursor.read(sample(-1, true))).toBe(false);
});

it("uses accepted event IDs for a short impact between snapshots, without stale or out-of-order replay", () => {
  const cursor = createContactFeedbackCursor();
  const frame = (
    elapsedMs: number,
    eventId?: number,
    atMs = elapsedMs,
  ): KartContactSample => ({
    ...sample(elapsedMs, false),
    eventMode: true,
    event: eventId === undefined ? undefined : { eventId, atMs },
  });
  expect(cursor.read(frame(0))).toBe(false);
  expect(cursor.read(frame(200, 2001, 20))).toBe(true);
  expect(cursor.read(frame(400, 2001, 20))).toBe(false);
  expect(cursor.read(frame(600, 60001, 600))).toBe(true);
  expect(cursor.read(frame(700, 2001, 20))).toBe(false);
  expect(cursor.read(frame(800, 60001, 600))).toBe(false);
  cursor.reset();
  expect(cursor.read(frame(1000, 60001, 600))).toBe(false);
  expect(cursor.read(frame(2500, 100001, 1000))).toBe(false);
  expect(cursor.read(frame(2600, 260001, 2600))).toBe(true);
  expect(cursor.read(frame(2700, 260002, 2900))).toBe(false);
});

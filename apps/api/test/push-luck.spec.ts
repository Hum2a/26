import { describe, expect, it } from "vitest";
import {
  assertPushOutcome,
  pushLineAt,
  pushPoints,
} from "../src/questions/push-luck.ts";
import { birthdayPack } from "../src/questions/packs/birthday/manifest.ts";
import { toPlayable } from "../src/questions/authoring.ts";
import { questionPreview } from "../src/room/question-preview.ts";
import type { PushOutcome } from "../src/questions/definition.ts";

const outcome: PushOutcome = {
  kind: "push",
  lines: ["one", "two", "three", "four"],
  lineMs: 6_000,
  banks: [100, 250, 450, 700],
  raidAfter: [2, 3, 4, null],
};
const collectMs = 30_000;
const deadlineAt = 100_000;
const opened = deadlineAt - collectMs;
const bailAt = (ms: number) => ({
  optionId: "bail",
  receivedAt: opened + ms,
  deadlineAt,
});

describe("push your luck", () => {
  it("reads the line from the room's receipt time", () => {
    expect(pushLineAt(outcome, opened, deadlineAt, collectMs)).toBe(0);
    expect(pushLineAt(outcome, opened + 6_000, deadlineAt, collectMs)).toBe(1);
    expect(pushLineAt(outcome, opened + 29_000, deadlineAt, collectMs)).toBe(3);
  });

  it("banks the showing line before the Raid and nothing after it", () => {
    expect(pushPoints(outcome, bailAt(1_000), 2, collectMs)).toEqual({
      points: 100,
      detail: "banked-1",
    });
    expect(pushPoints(outcome, bailAt(7_000), 2, collectMs)).toEqual({
      points: 250,
      detail: "banked-2",
    });
    // The Raid after line 2 hits at 12 seconds.
    expect(pushPoints(outcome, bailAt(12_000), 2, collectMs)).toEqual({
      points: 0,
      detail: "raided",
    });
    expect(pushPoints(outcome, undefined, 3, collectMs)).toEqual({
      points: 0,
      detail: "raided",
    });
  });

  it("pays the last bank to everyone still in when no Raid comes", () => {
    expect(pushPoints(outcome, undefined, null, collectMs)).toEqual({
      points: 700,
      detail: "held",
    });
    expect(
      pushPoints(outcome, { ...bailAt(0), optionId: "hold" }, null, collectMs),
    ).toEqual({ points: 700, detail: "held" });
    expect(pushPoints(outcome, bailAt(19_000), null, collectMs).points).toBe(700);
  });

  it("refuses rounds that cannot be played fairly", () => {
    expect(() => assertPushOutcome(outcome, collectMs)).not.toThrow();
    expect(() => assertPushOutcome(outcome, 20_000)).toThrow(/before answering closes/);
    expect(() =>
      assertPushOutcome({ ...outcome, banks: [100, 90, 450, 700] }, collectMs),
    ).toThrow(/rise/);
    expect(() => assertPushOutcome({ ...outcome, raidAfter: [5] }, collectMs)).toThrow(
      /Raid/,
    );
  });

  it("makes Cursed search history ready without exposing the Raid", () => {
    const question = birthdayPack.catalogue.find(
      (item) => item.id === "cursed-search-history",
    )!;
    expect(question.status).toBe("ready");
    expect(birthdayPack.order).not.toContain("cursed-search-history");
    expect(toPlayable(question)).toMatchObject({
      kind: "choice",
      outcome: { kind: "push" },
    });
    const preview = questionPreview(birthdayPack, question);
    expect(preview.interactive).toBe(true);
    expect(preview.question).toMatchObject({
      outcome: "push",
      push: { lineMs: 6_000, banks: [100, 250, 450, 700] },
    });
    expect(JSON.stringify(preview)).not.toContain("raidAfter");
  });
});

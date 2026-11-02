import { describe, expect, it } from "vitest";
import { emptyWordleBoard, markWordle, reduceWordle } from "@26/shared";
import { completeAWordle } from "../src/questions/packs/birthday/complete-a-wordle.ts";
import { birthdayPack } from "../src/questions/packs/birthday/manifest.ts";
import { questionPreview } from "../src/room/question-preview.ts";
import { previewWordle, readWordlePreviewBody } from "../src/room/wordle-preview.ts";
import { isWordleWord } from "../src/questions/wordle.ts";
import { toPlayable, wordleQuestion } from "../src/questions/authoring.ts";
import { publicWordleQuestion } from "../src/questions/wordle.ts";
import { validatePack } from "../src/questions/validate.ts";

const rules = { answer: "VULGY", isWord: isWordleWord, deadline: 120_000 };
describe("Glyph birthday Wordle", () => {
  it("consumes exact matches before allocating repeated letters", () => {
    expect(markWordle("ALLEY", "APPLE")).toEqual([
      "correct",
      "present",
      "absent",
      "present",
      "absent",
    ]);
    expect(markWordle("GEESE", "THOSE")).toEqual([
      "absent",
      "absent",
      "absent",
      "correct",
      "correct",
    ]);
    expect(markWordle("PUPPY", "APPLE")).toEqual([
      "present",
      "absent",
      "correct",
      "absent",
      "absent",
    ]);
  });
  it("rejects invalid and repeated guesses without spending an attempt or mutating the board", () => {
    const board = emptyWordleBoard();
    for (const word of [null, "CAT", "A1BCD", "ZZZZZ", "<img>"]) {
      expect(reduceWordle(board, word, rules, 1).ok).toBe(false);
      expect(board.guesses).toHaveLength(0);
    }
    const first = reduceWordle(board, " apple ", rules, 1);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(first.message);
    expect(first.state.guesses[0]?.word).toBe("APPLE");
    expect(reduceWordle(first.state, "APPLE", rules, 2).ok).toBe(false);
    expect(first.state.guesses).toHaveLength(1);
  });
  it("accepts the supplied custom answer, closes on a solve, and enforces the deadline", () => {
    const solved = reduceWordle(
      emptyWordleBoard(),
      "vulgy",
      { ...rules, isWord: () => false },
      119_999,
    );
    expect(solved.ok && solved.state.status).toBe("won");
    if (!solved.ok) throw new Error(solved.message);
    expect(solved.state.guesses[0]?.marks).toEqual(Array(5).fill("correct"));
    expect(reduceWordle(solved.state, "APPLE", rules, 119_999).ok).toBe(false);
    expect(reduceWordle(emptyWordleBoard(), "VULGY", rules, 120_000).ok).toBe(false);
  });
  it("stops after six valid guesses and never adds the secret to a losing board", () => {
    let board = emptyWordleBoard();
    for (const word of ["APPLE", "CRANE", "SLATE", "HOUSE", "TRAIN", "MOUSE"]) {
      const result = reduceWordle(board, word, rules, 1);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.message);
      board = result.state;
    }
    expect(board.status).toBe("lost");
    expect(JSON.stringify(board)).not.toContain("VULGY");
    expect(reduceWordle(board, "VULGY", rules, 2).ok).toBe(false);
  });
  it("readies the existing question without releasing the catalogue; public projections omit the target", () => {
    const playable = toPlayable(completeAWordle);
    if (playable?.kind !== "wordle") throw new Error("Wordle is ready");
    expect(playable.collectMs).toBe(120_000);
    expect(playable.points).toBe(100);
    expect(birthdayPack.release).toBe("draft");
    expect(birthdayPack.order).toContain(playable.id);
    expect(JSON.stringify(publicWordleQuestion(playable, 1, 1))).not.toContain("VULGY");
    const preview = questionPreview(birthdayPack, completeAWordle);
    expect(preview.interactive).toBe(true);
    expect(JSON.stringify(preview)).not.toContain("VULGY");
    const invalid = wordleQuestion({
      id: "bad-word",
      title: "Bad word",
      prompt: "Find it",
      answer: { known: "LONGER" },
    });
    const report = validatePack({ ...birthdayPack, catalogue: [invalid], order: [] });
    expect(JSON.stringify(report)).toContain("five uppercase letters");
  });
  it("replays preview history on the server and rejects forged histories", () => {
    const result = previewWordle(completeAWordle, {
      history: ["APPLE"],
      word: "VULGY",
    });
    expect(result.ok && result.state.status).toBe("won");
    expect(result.ok && result.state.guesses).toHaveLength(2);
    for (const history of [
      ["ZZZZZ"],
      ["APPLE", "APPLE"],
      ["VULGY"],
      Array(6).fill("APPLE"),
    ])
      expect(previewWordle(completeAWordle, { history, word: "CRANE" }).ok).toBe(false);
  });
  it("bounds streamed preview requests and rejects malformed JSON", async () => {
    expect(
      await readWordlePreviewBody(
        new Request("https://example.com", { method: "POST", body: "x".repeat(1025) }),
      ),
    ).toBeUndefined();
    expect(
      await readWordlePreviewBody(
        new Request("https://example.com", { method: "POST", body: "{" }),
      ),
    ).toBeUndefined();
    expect(
      await readWordlePreviewBody(
        new Request("https://example.com", {
          method: "POST",
          body: '{"history":[],"word":"APPLE"}',
        }),
      ),
    ).toEqual({ history: [], word: "APPLE" });
  });
});

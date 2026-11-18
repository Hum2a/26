import { describe, expect, it } from "vitest";
import { publicQuestionSchema, playSnapshotSchema } from "@26/shared";
import {
  edOrHumza,
  edOrHumzaQuotes,
  makeEdOrHumza,
} from "../src/questions/packs/birthday/ed-or-humza.ts";
import { birthdayPack } from "../src/questions/packs/birthday/manifest.ts";
import { toPlayable } from "../src/questions/authoring.ts";
import type { RankQuestion } from "../src/questions/definition.ts";
import { validatePack } from "../src/questions/validate.ts";
import {
  assertRankQuestion,
  checkRanking,
  pointsForRanking,
  publicRankQuestion,
} from "../src/questions/rank.ts";
import { questionPreview } from "../src/room/question-preview.ts";

function fixture(count = 18): RankQuestion {
  const authored = makeEdOrHumza(
    Array.from({ length: count }, (_, index) => ({
      id: `quote-${index + 1}`,
      quote: `Stand-in quotation ${index + 1}. `.repeat(5),
      speaker: index % 2 === 0 ? ("ed" as const) : ("humza" as const),
    })),
  );
  const question = toPlayable(authored, false);
  if (!question || question.kind !== "rank")
    throw new Error("Expected a ready sorting fixture");
  return question;
}

function validateFixture(question: RankQuestion) {
  return validatePack({
    ...birthdayPack,
    catalogue: [{ ...question, status: "ready", truth: { known: question.truth } }],
    order: [question.id],
  });
}

describe("Ed or Humza whole-list sorting", () => {
  it("preserves all 18 supplied quotes unassigned and keeps the draft out of the running order", () => {
    expect(edOrHumzaQuotes).toHaveLength(18);
    expect(edOrHumzaQuotes.every((entry) => entry.speaker === null)).toBe(true);
    expect(edOrHumza.items.map((entry) => entry.label)).toEqual(
      edOrHumzaQuotes.map((entry) => entry.quote),
    );
    expect(edOrHumza.status).toBe("draft");
    expect(toPlayable(edOrHumza, false)).toBeUndefined();
    expect(birthdayPack.catalogue).toContain(edOrHumza);
    expect(birthdayPack.order).not.toContain(edOrHumza.id);
    expect(
      validatePack({ ...birthdayPack, catalogue: [edOrHumza], order: [] }).filter(
        (issue) => issue.level === "error",
      ),
    ).toEqual([]);
  });

  it("rehearses the full list without leaking an answer key or inventing assignments", () => {
    const preview = questionPreview(birthdayPack, edOrHumza);
    expect(preview.interactive).toBe(true);
    expect(edOrHumza.presentation).toBe("ed-or-humza");
    expect(preview.question).toMatchObject({
      input: "buckets",
      scoring: "placement",
      presentation: "ed-or-humza",
      tiers: [
        { id: "ed", label: "Ed" },
        { id: "humza", label: "Humza" },
      ],
    });
    expect(preview.question?.kind === "rank" && preview.question.items).toHaveLength(
      18,
    );
    expect(preview.limitation).toContain("incomplete");
    expect(JSON.stringify(preview)).not.toContain('"truth"');
    expect(JSON.stringify(preview)).not.toContain('"speaker"');
    const privateQuestion = fixture();
    const publicQuestion = publicRankQuestion(privateQuestion, 1, 1);
    expect(publicQuestionSchema.safeParse(publicQuestion).success).toBe(true);
    expect(JSON.stringify(publicQuestion)).not.toContain('"truth"');
  });

  it("scores independent correct assignments rather than the order of people or quotes", () => {
    const question = fixture();
    assertRankQuestion(question);
    expect(validateFixture(question)).toEqual([]);
    const correct = question.truth.flatMap((group) =>
      group.itemIds.map((itemId) => ({ itemId, tierId: group.tierId })),
    );
    expect(checkRanking(question, correct).ok).toBe(true);
    expect(pointsForRanking(question, correct.reverse())).toEqual({
      points: 80,
      detail: "placed-18/18",
    });
    expect(
      pointsForRanking(
        question,
        question.items.map((item) => ({ itemId: item.id, tierId: "ed" })),
      ),
    ).toEqual({ points: 40, detail: "placed-9/18" });
    expect(
      pointsForRanking(
        question,
        correct.map((entry) => ({
          ...entry,
          tierId: entry.tierId === "ed" ? "humza" : "ed",
        })),
      ).points,
    ).toBe(0);
    expect(pointsForRanking(question, undefined).points).toBe(0);
    const sameSpeaker = {
      ...question,
      truth: [{ tierId: "ed", itemIds: question.items.map((item) => item.id) }],
    };
    expect(
      pointsForRanking(
        sameSpeaker,
        question.items.map((item) => ({ itemId: item.id, tierId: "humza" })),
      ).points,
    ).toBe(0);
    expect(checkRanking(question, correct.slice(1)).ok).toBe(false);
    expect(checkRanking(question, [...correct.slice(1), correct[1]]).ok).toBe(false);
    expect(
      checkRanking(
        question,
        correct.map((entry, index) =>
          index ? entry : { ...entry, tierId: "unknown" },
        ),
      ).ok,
    ).toBe(false);
  });

  it("supports more quotes with bounded payloads while ordinary rankings retain their limits", () => {
    const question = fixture(40);
    expect(validateFixture(question)).toEqual([]);
    const publicQuestion = publicRankQuestion(question, 1, 1);
    expect(publicQuestionSchema.safeParse(publicQuestion).success).toBe(true);
    expect(
      publicQuestionSchema.safeParse({
        ...publicQuestion,
        items: [...publicQuestion.items, { id: "overflow", label: "Extra" }],
      }).success,
    ).toBe(false);
    expect(
      publicQuestionSchema.safeParse({
        ...publicQuestion,
        input: undefined,
        scoring: undefined,
      }).success,
    ).toBe(false);
    expect(
      publicQuestionSchema.safeParse({
        ...publicQuestion,
        items: publicQuestion.items
          .slice(0, 2)
          .map((item) => ({ ...item, label: "x".repeat(301) })),
      }).success,
    ).toBe(false);
    expect(
      validateFixture({
        ...question,
        truth: [
          { tierId: "ed", itemIds: question.items.map((item) => item.id) },
          { tierId: "humza", itemIds: [question.items[0]!.id] },
        ],
      }).some((issue) => issue.level === "error"),
    ).toBe(true);
    // Accepted answers and reveals must also carry the whole supported list.
    const placements = question.items.map((item) => ({
      itemId: item.id,
      tierId: "ed",
    }));
    const play = {
      question: publicQuestion,
      selfAnswer: { kind: "rank", placements },
      reveal: {
        kind: "rank",
        order: [
          { tierId: "ed", label: "Ed", itemIds: question.items.map((item) => item.id) },
        ],
        rankings: [],
      },
    };
    expect(playSnapshotSchema.shape.selfAnswer.safeParse(play.selfAnswer).success).toBe(
      true,
    );
    expect(playSnapshotSchema.shape.reveal.safeParse(play.reveal).success).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import {
  demoQuestions,
  type RankQuestion,
  type SliderQuestion,
} from "../src/questions/demo-set.ts";
import {
  assertRankQuestion,
  checkRanking,
  pointsForRanking,
} from "../src/questions/rank.ts";
import {
  estimateInvalidMessage,
  estimateStepMessage,
  rankDuplicateMessage,
  rankMissingMessage,
  rankPartialMessage,
  rankTieMessage,
  rankUnknownMessage,
} from "../src/room/limits.ts";
import {
  assertSliderQuestion,
  checkEstimate,
  pointsForEstimate,
} from "../src/questions/slider.ts";

const letters = sliderQuestion("letters");
const lineup = rankQuestion("lineup");

describe("slider and ranking scores", () => {
  it("scores an estimate from the narrowest matching band", () => {
    expect(pointsForEstimate(letters, 8)).toEqual({ points: 100, detail: "exact" });
    expect(pointsForEstimate(letters, 10)).toEqual({ points: 40, detail: "within-2" });
    expect(pointsForEstimate(letters, 6)).toEqual({ points: 40, detail: "within-2" });
    expect(pointsForEstimate(letters, 11)).toEqual({ points: 0, detail: "miss" });
    expect(pointsForEstimate(letters, 5)).toEqual({ points: 0, detail: "miss" });
    expect(pointsForEstimate(letters, undefined)).toEqual({
      points: 0,
      detail: "missing",
    });

    const widerPaysMore: SliderQuestion = {
      ...letters,
      bands: [
        { within: 2, points: 100 },
        { within: 0, points: 10 },
      ],
    };
    expect(pointsForEstimate(widerPaysMore, 8).points).toBe(10);
    expect(pointsForEstimate(widerPaysMore, 8).points).toBeGreaterThanOrEqual(0);
  });

  it("rejects a number that is not finite, in range, and on the step", () => {
    expect(checkEstimate(letters, "8").ok).toBe(false);
    expect(checkEstimate(letters, null)).toEqual({
      ok: false,
      message: estimateInvalidMessage,
    });
    expect(checkEstimate(letters, Number.NaN).ok).toBe(false);
    expect(checkEstimate(letters, Number.POSITIVE_INFINITY).ok).toBe(false);
    expect(checkEstimate(letters, 21)).toEqual({
      ok: false,
      message: estimateInvalidMessage,
    });
    expect(checkEstimate(letters, -1).ok).toBe(false);
    expect(checkEstimate(letters, 8.5)).toEqual({
      ok: false,
      message: estimateStepMessage,
    });
    expect(checkEstimate(letters, 8)).toEqual({ ok: true, value: 8 });
  });

  it("rejects a zero-width or invalid slider scale", () => {
    expect(() => assertSliderQuestion({ ...letters, minimum: 4, maximum: 4 })).toThrow(
      /wider than zero/,
    );
    expect(() => assertSliderQuestion({ ...letters, minimum: 10, maximum: 4 })).toThrow(
      /wider than zero/,
    );
    expect(() => assertSliderQuestion({ ...letters, step: 0 })).toThrow(
      /greater than zero/,
    );
    expect(() => assertSliderQuestion({ ...letters, step: -1 })).toThrow(
      /greater than zero/,
    );
    expect(() => assertSliderQuestion({ ...letters, maximum: 20.5 })).toThrow(
      /both ends/,
    );
    expect(() =>
      assertSliderQuestion({
        ...letters,
        bands: [{ within: 0, points: -1 }],
      }),
    ).toThrow(/inside that question's points/);
    expect(() =>
      assertSliderQuestion({
        ...letters,
        bands: [{ within: 0, points: letters.points + 1 }],
      }),
    ).toThrow(/inside that question's points/);
  });

  it("maps ranking agreement onto that question's own points", () => {
    expect(pointsForRanking(lineup, partyOrder())).toEqual({
      points: 80,
      detail: "agree-6/6",
    });
    expect(
      pointsForRanking(lineup, [
        { itemId: "candles", tierId: "first" },
        { itemId: "song", tierId: "second" },
        { itemId: "cake", tierId: "third" },
        { itemId: "friends", tierId: "fourth" },
      ]),
    ).toEqual({ points: 0, detail: "agree-0/6" });
    expect(
      pointsForRanking(lineup, [
        { itemId: "cake", tierId: "first" },
        { itemId: "friends", tierId: "second" },
        { itemId: "song", tierId: "third" },
        { itemId: "candles", tierId: "fourth" },
      ]).points,
    ).toBe(66);
    expect(pointsForRanking(lineup, undefined)).toEqual({
      points: 0,
      detail: "missing",
    });

    const partial: RankQuestion = { ...lineup, id: "partial", mode: "partial" };
    const partialScore = pointsForRanking(partial, [
      { itemId: "friends", tierId: "first" },
      { itemId: "cake", tierId: "second" },
    ]);
    expect(partialScore.points).toBe(Math.floor(80 / 6));
    expect(partialScore.points).toBeLessThan(lineup.points);
    expect(partialScore.points).toBeGreaterThanOrEqual(0);

    const tied = tiedQuestion();
    const tiedScore = pointsForRanking(tied, [
      { itemId: "a", tierId: "high" },
      { itemId: "b", tierId: "high" },
      { itemId: "c", tierId: "low" },
    ]);
    expect(tiedScore.points).toBe(30);
    expect(tiedScore.points).toBeGreaterThanOrEqual(0);
    expect(tiedScore.points).toBeLessThanOrEqual(tied.points);

    const unordered = unorderedQuestion();
    expect(
      pointsForRanking(unordered, [
        { itemId: "a", tierId: "only" },
        { itemId: "b", tierId: "only" },
      ]),
    ).toEqual({ points: 40, detail: "unordered" });
    expect(pointsForRanking(unordered, undefined).points).toBe(0);
  });

  it("rejects duplicate, missing, and unknown ranking items for the chosen mode", () => {
    expect(checkRanking(lineup, "nope")).toEqual({
      ok: false,
      message: rankUnknownMessage,
    });
    expect(
      checkRanking(lineup, [
        { itemId: "friends", tierId: "first" },
        { itemId: "friends", tierId: "second" },
        { itemId: "song", tierId: "third" },
        { itemId: "candles", tierId: "fourth" },
      ]),
    ).toEqual({ ok: false, message: rankDuplicateMessage });
    expect(checkRanking(lineup, partyOrder().slice(0, 3))).toEqual({
      ok: false,
      message: rankMissingMessage,
    });
    expect(
      checkRanking(lineup, [
        { itemId: "nope", tierId: "first" },
        { itemId: "cake", tierId: "second" },
        { itemId: "song", tierId: "third" },
        { itemId: "candles", tierId: "fourth" },
      ]),
    ).toEqual({ ok: false, message: rankUnknownMessage });
    expect(
      checkRanking(lineup, [
        { itemId: "friends", tierId: "first" },
        { itemId: "cake", tierId: "first" },
        { itemId: "song", tierId: "third" },
        { itemId: "candles", tierId: "fourth" },
      ]),
    ).toEqual({ ok: false, message: rankTieMessage });

    const partial: RankQuestion = { ...lineup, id: "partial", mode: "partial" };
    expect(checkRanking(partial, [])).toEqual({
      ok: false,
      message: rankPartialMessage,
    });
    expect(checkRanking(partial, [{ itemId: "friends", tierId: "first" }]).ok).toBe(
      true,
    );
    expect(
      checkRanking(tiedQuestion(), [
        { itemId: "b", tierId: "low" },
        { itemId: "c", tierId: "low" },
        { itemId: "a", tierId: "high" },
      ]).ok,
    ).toBe(true);
    expect(() =>
      assertRankQuestion({
        ...lineup,
        truth: [{ tierId: "first", itemIds: ["friends", "cake"] }],
      }),
    ).toThrow(/ties are forbidden/);
  });
});

function sliderQuestion(id: string): SliderQuestion {
  const question = demoQuestions.find((item) => item.id === id);
  if (!question || question.kind !== "slider") {
    throw new Error(`Missing slider ${id}.`);
  }
  return question;
}

function rankQuestion(id: string): RankQuestion {
  const question = demoQuestions.find((item) => item.id === id);
  if (!question || question.kind !== "rank") {
    throw new Error(`Missing ranking ${id}.`);
  }
  return question;
}

function partyOrder() {
  return [
    { itemId: "friends", tierId: "first" },
    { itemId: "cake", tierId: "second" },
    { itemId: "song", tierId: "third" },
    { itemId: "candles", tierId: "fourth" },
  ];
}

function tiedQuestion(): RankQuestion {
  return {
    kind: "rank",
    id: "tied",
    prompt: "Illustrative tie.",
    points: 60,
    collectMs: 20_000,
    attribution: "after",
    mode: "complete",
    ties: "shared",
    items: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
      { id: "c", label: "C" },
    ],
    tiers: [
      { id: "high", label: "High" },
      { id: "low", label: "Low" },
    ],
    truth: [
      { tierId: "high", itemIds: ["a"] },
      { tierId: "low", itemIds: ["b", "c"] },
    ],
  };
}

function unorderedQuestion(): RankQuestion {
  return {
    kind: "rank",
    id: "unordered",
    prompt: "Illustrative unordered pair.",
    points: 40,
    collectMs: 20_000,
    attribution: "after",
    mode: "partial",
    ties: "shared",
    items: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ],
    tiers: [{ id: "only", label: "Only" }],
    truth: [{ tierId: "only", itemIds: ["a", "b"] }],
  };
}

import { describe, expect, it } from "vitest";
import {
  analyseTrends,
  formatValue,
  pickStageCards,
  publicTrendCard,
  questionTrendsSchema,
  selfTrendLines,
  trendCardSchema,
  trendFacetIds,
  type TrendDevice,
  type TrendInput,
  type TrendPlayer,
  type TrendQuestion,
  type TrendResponse,
} from "@26/shared";
import { toPlayable } from "../src/questions/authoring.ts";
import { birthdayPack } from "../src/questions/packs/birthday/manifest.ts";
import { hasRightAndWrong } from "../src/stats/trend-source.ts";

const iphone: TrendDevice = {
  family: "iphone",
  os: "iOS",
  osMajor: 18,
  browser: "safari",
  colorScheme: "dark",
  reducedMotion: "no-preference",
  language: "en-GB",
  timeZone: "Europe/London",
  shortEdge: 430,
  pixelRatio: 3,
  orientation: "portrait",
  memoryGb: null,
  quality: "4g",
  saveData: false,
};

const android: TrendDevice = {
  ...iphone,
  family: "android",
  os: "Android",
  osMajor: 14,
  browser: "chrome",
  colorScheme: "light",
  shortEdge: 390,
  memoryGb: 8,
};

function player(
  index: number,
  device: TrendDevice | null,
  extra: Partial<TrendPlayer> = {},
): TrendPlayer {
  return {
    playerId: `p${index}`,
    nickname: `Guest${index}`,
    joinOrder: index,
    device,
    reconnects: 0,
    rttMs: 60,
    scoreBefore: 0,
    trollsSent: 0,
    trollsReceived: 0,
    sharedPhoto: false,
    hasAvatar: false,
    previousCorrect: null,
    ...extra,
  };
}

const choice: TrendQuestion = {
  questionId: "favourite-pokemon",
  kind: "choice",
  prompt: "Favourite Pokémon",
  options: [
    { id: "mudkip", label: "Mudkip" },
    { id: "tepig", label: "Tepig" },
    { id: "turtwig", label: "Turtwig" },
  ],
  pickVerb: "picked",
  numeric: null,
  scored: true,
  success: "got it right",
  timed: true,
};

function response(
  who: TrendPlayer,
  pick: string,
  correct: boolean | null,
  elapsedMs = 5_000,
): TrendResponse {
  return {
    playerId: who.playerId,
    picks: [pick],
    value: null,
    correct,
    points: correct ? 100 : 0,
    elapsedMs,
    windowMs: 20_000,
    device: who.device,
  };
}

/** Six iPhones who all pick Mudkip (right), six Androids who all pick Tepig. */
function splitRoom(): TrendInput {
  const iphones = Array.from({ length: 6 }, (_, i) => player(i, iphone));
  const androids = Array.from({ length: 6 }, (_, i) => player(i + 6, android));
  return {
    question: choice,
    players: [...iphones, ...androids],
    responses: [
      ...iphones.map((p, i) => response(p, "mudkip", true, 2_000 + i * 500)),
      ...androids.map((p, i) => response(p, "tepig", false, 12_000 + i * 500)),
    ],
    history: [
      { questionId: "earlier-a", accuracy: 0.7 },
      { questionId: "earlier-b", accuracy: 0.6 },
    ],
  };
}

describe("answer trends", () => {
  it("finds the iPhone against Android split the host asked for", () => {
    const analysis = analyseTrends(splitRoom());
    const platform = analysis.cards.filter((card) => card.facet === "platform");
    expect(platform.map((card) => card.headline)).toContain(
      "Team iPhone out-thought Team Android",
    );
    const pick = platform.find((card) => card.id.includes(":pick:"));
    expect(pick?.detail).toMatch(/100% of iPhone users picked Mudkip/);
    expect(pick?.bars.map((bar) => bar.value)).toEqual([100, 0]);
  });

  it("covers devices, behaviour, records and the answer itself", () => {
    const analysis = analyseTrends(splitRoom());
    const facets = new Set(analysis.cards.map((card) => card.facet));
    for (const facet of [
      "answer",
      "platform",
      "browser",
      "theme",
      "screen",
      "speed",
      "fastest",
    ]) {
      expect(facets.has(facet), facet).toBe(true);
    }
    // Every facet the engine knows is listed for the host's legend.
    expect(trendFacetIds).toEqual(
      expect.arrayContaining(["platform", "standing", "trolls"]),
    );
  });

  it("never names a guest on a device or behaviour card", () => {
    const analysis = analyseTrends(splitRoom());
    for (const card of analysis.cards) {
      if (card.tone === "device" || card.tone === "behaviour") {
        expect(`${card.headline} ${card.detail}`).not.toMatch(/Guest\d/);
      }
    }
    const fastest = analysis.cards.find((card) => card.facet === "fastest");
    expect(fastest?.headline).toBe("Fastest finger: Guest0");
  });

  it("keeps groups under three people out of comparisons", () => {
    const input = splitRoom();
    const small: TrendInput = {
      ...input,
      players: input.players.slice(0, 8),
      responses: input.responses.slice(0, 8),
    };
    // Six iPhones and two Androids: too few Androids to compare.
    const cards = analyseTrends(small).cards;
    expect(cards.some((card) => card.facet === "platform")).toBe(false);
  });

  it("puts an overview first and uses each facet once on the projector", () => {
    const analysis = analyseTrends(splitRoom());
    const stage = pickStageCards(analysis);
    expect(stage.length).toBeGreaterThan(2);
    expect(stage.length).toBeLessThanOrEqual(6);
    expect(stage[0]?.tone).toBe("answer");
    expect(new Set(stage.map((card) => card.facet)).size).toBe(stage.length);
    const hidden = new Set([stage[1]!.id]);
    expect(pickStageCards(analysis, hidden).map((card) => card.id)).not.toContain(
      stage[1]!.id,
    );
    const parsed = questionTrendsSchema.parse({
      questionId: analysis.questionId,
      responses: analysis.responses,
      cards: stage.map(publicTrendCard),
    });
    expect(parsed.cards[0]).not.toHaveProperty("members");
  });

  it("reports the hardest question so far against the game history", () => {
    const input = splitRoom();
    const accuracy = analyseTrends(input).cards.find(
      (card) => card.facet === "accuracy",
    );
    expect(accuracy?.headline).toBe("The hardest question so far");
    expect(accuracy?.detail).toBe("6 of 12 got it right. A new low for the room.");
  });

  it("gives each phone its own lines, including the spotlight on screen", () => {
    const analysis = analyseTrends(splitRoom());
    const stage = pickStageCards(analysis);
    const lines = selfTrendLines(analysis, "p0", stage) ?? [];
    expect(lines[0]?.text).toBe("You were one of the 50% who got it right.");
    expect(lines.map((line) => line.text)).toContain(
      "100% of your fellow iPhone users got it right.",
    );
    expect(lines.some((line) => line.text === "The fastest answer in the room.")).toBe(
      true,
    );
    expect(selfTrendLines(analysis, "nobody")).toBeNull();
  });

  it("compares price guesses: closest guess, bias and sharper groups", () => {
    const iphones = Array.from({ length: 5 }, (_, i) => player(i, iphone));
    const androids = Array.from({ length: 5 }, (_, i) => player(i + 5, android));
    const guess = (who: TrendPlayer, value: number): TrendResponse => ({
      playerId: who.playerId,
      picks: [],
      value,
      correct: Math.abs(value - 35) <= 3,
      points: 0,
      elapsedMs: 6_000,
      windowMs: 20_000,
      device: who.device,
    });
    const analysis = analyseTrends({
      question: {
        ...choice,
        questionId: "inflation-freddo",
        kind: "slider",
        options: [],
        pickVerb: "guessed",
        numeric: { noun: "guess", unit: "p", better: "closer", truth: 35 },
      },
      players: [...iphones, ...androids],
      responses: [
        ...iphones.map((p, i) => guess(p, 34 + i)),
        ...androids.map((p, i) => guess(p, 60 + i * 5)),
      ],
      history: [],
    });
    const closest = analysis.cards.find((card) => card.facet === "closest");
    // Guest1 guessed 35p exactly.
    expect(closest?.headline).toBe("Bullseye: Guest1 got it exactly");
    expect(analysis.cards.find((card) => card.facet === "bias")?.headline).toMatch(
      /^The room guessed \d+% too high$/,
    );
    const sharper = analysis.cards.find(
      (card) => card.facet === "platform" && card.id.endsWith(":miss:iphone"),
    );
    expect(sharper?.headline).toBe("iPhone users were the sharper guessers");
  });

  it("formats money, pence, seconds and guesses", () => {
    expect(formatValue(8.8, "£")).toBe("£8.80");
    expect(formatValue(1002, "£")).toBe("£1,002");
    expect(formatValue(35.4, "p")).toBe("35p");
    expect(formatValue(175, "p/litre")).toBe("175p a litre");
    expect(formatValue(52.34, "s")).toBe("52.3s");
    expect(formatValue(1, "guesses")).toBe("1 guess");
  });

  it("is deterministic and every card fits the public schema", () => {
    const first = analyseTrends(splitRoom());
    const second = analyseTrends(splitRoom());
    expect(second.cards).toEqual(first.cards);
    for (const card of first.cards) {
      expect(() => trendCardSchema.parse(publicTrendCard(card))).not.toThrow();
    }
  });

  it("counts every right-or-wrong mechanic in the game's accuracy history", () => {
    const scored = birthdayPack.catalogue
      .map((question) => toPlayable(question))
      .filter(
        (question): question is NonNullable<typeof question> => question !== undefined,
      );
    const byKind = (kind: string) =>
      scored.filter((question) => question.kind === kind);
    for (const kind of ["chess", "kart", "wordle", "slider", "typed"]) {
      expect(byKind(kind).every(hasRightAndWrong), kind).toBe(true);
    }
    const voterGuesses = byKind("guess").filter(
      (question) => question.kind === "guess" && question.award !== "nominees",
    );
    expect(voterGuesses.length).toBeGreaterThan(0);
    expect(voterGuesses.every(hasRightAndWrong)).toBe(true);
    const nomineeGuesses = byKind("guess").filter(
      (question) => question.kind === "guess" && question.award === "nominees",
    );
    expect(nomineeGuesses.length).toBeGreaterThan(0);
    expect(nomineeGuesses.some(hasRightAndWrong)).toBe(false);
    expect(byKind("vote").some(hasRightAndWrong)).toBe(false);
    expect(byKind("rank").some(hasRightAndWrong)).toBe(false);
    const polls = scored.filter(
      (question) => question.kind === "choice" && question.outcome.kind === "poll",
    );
    expect(polls.length).toBeGreaterThan(0);
    expect(polls.some(hasRightAndWrong)).toBe(false);
  });

  it("stays quiet for an empty question", () => {
    const analysis = analyseTrends({
      question: choice,
      players: [player(0, iphone)],
      responses: [],
      history: [],
    });
    expect(analysis.cards).toEqual([]);
    expect(pickStageCards(analysis)).toEqual([]);
  });
});

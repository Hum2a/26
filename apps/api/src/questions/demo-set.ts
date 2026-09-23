/**
 * Illustrative demo questions. This is not the party set and not a CMS.
 * Correct options stay in this module. Guest JavaScript must not import it.
 */
export const demoAnswerKeyMarker = "demo-answer-key-v1";

export type AttributionMode = "never" | "after" | "live";

type QuestionCore = {
  id: string;
  prompt: string;
  points: number;
  collectMs: number;
  attribution: AttributionMode;
};

export type ChoiceQuestion = QuestionCore & {
  kind: "choice";
  options: { id: string; label: string }[];
  correctOptionId: string;
  speedBonus: { maxPoints: number } | null;
  modifiers?: readonly "double"[];
  suppressSpeedBonus?: boolean;
};

export type SliderBand = { within: number; points: number };

export type SliderQuestion = QuestionCore & {
  kind: "slider";
  minimum: number;
  maximum: number;
  step: number;
  unit: string;
  initial: number;
  truth: number;
  bands: SliderBand[];
};

export type RankPlacement = { itemId: string; tierId: string };

export type RankQuestion = QuestionCore & {
  kind: "rank";
  mode: "complete" | "partial";
  ties: "forbidden" | "shared";
  items: { id: string; label: string }[];
  tiers: { id: string; label: string }[];
  truth: { tierId: string; itemIds: string[] }[];
};

export type VoteQuestion = QuestionCore & {
  kind: "vote";
  voteMs: number;
  candidateMode: "all" | "shortlist";
  selfVote: "forbidden" | "allowed";
  votes: 1;
  tie: "shared";
  award: "authors" | "voters";
  lateJoin: "ineligible";
};

export type GuessQuestion = QuestionCore & {
  kind: "guess";
  roster: "room" | "shortlist";
  shortlist: string[];
  selfVote: "forbidden" | "allowed";
  tie: "shared";
  scoring: "named" | "majority" | "none";
  lateJoin: "ineligible";
  truthNickname: string | null;
};

type DuelScale = {
  minimum: number;
  maximum: number;
  step: number;
  target: number;
  within: number;
  tie: "shared";
  absence: "forfeit";
  lateJoin: "ineligible";
  tieBreak: "off" | "tied";
};

export type DuelQuestion = QuestionCore &
  DuelScale & {
    kind: "duel";
    odd: "solo";
  };

export type FinaleQuestion = QuestionCore &
  DuelScale & {
    kind: "finale";
    contestants: readonly [string, string];
    predictionPoints: number;
    predictMs: number;
  };

export type DemoQuestion =
  | ChoiceQuestion
  | SliderQuestion
  | RankQuestion
  | VoteQuestion
  | GuessQuestion
  | DuelQuestion
  | FinaleQuestion;

export const demoQuestions: readonly DemoQuestion[] = [
  {
    kind: "choice",
    id: "shape",
    prompt: "Illustrative demo: which of these is a circle?",
    options: [
      { id: "square", label: "Square" },
      { id: "circle", label: "Circle" },
      { id: "triangle", label: "Triangle" },
      { id: "star", label: "Star" },
    ],
    correctOptionId: "circle",
    points: 100,
    collectMs: 20_000,
    speedBonus: { maxPoints: 50 },
    attribution: "after",
  },
  {
    kind: "choice",
    id: "colour",
    prompt: "Illustrative demo: which colour is the night sky in this drawing?",
    options: [
      { id: "blue", label: "Blue" },
      { id: "green", label: "Green" },
      { id: "orange", label: "Orange" },
    ],
    correctOptionId: "blue",
    points: 80,
    collectMs: 15_000,
    speedBonus: null,
    modifiers: ["double"],
    attribution: "never",
  },
  {
    kind: "choice",
    id: "candles",
    prompt: "Illustrative demo: how many candles are on this cake?",
    options: [
      { id: "sixteen", label: "16" },
      { id: "twenty-one", label: "21" },
      { id: "twenty-six", label: "26" },
      { id: "thirty", label: "30" },
    ],
    correctOptionId: "twenty-six",
    points: 120,
    collectMs: 30_000,
    speedBonus: { maxPoints: 40 },
    suppressSpeedBonus: true,
    attribution: "live",
  },
  {
    kind: "slider",
    id: "letters",
    prompt: "Illustrative demo: how many letters are in birthday?",
    minimum: 0,
    maximum: 20,
    step: 1,
    unit: "letters",
    initial: 10,
    truth: 8,
    points: 100,
    collectMs: 20_000,
    attribution: "after",
    bands: [
      { within: 0, points: 100 },
      { within: 2, points: 40 },
    ],
  },
  {
    kind: "rank",
    id: "lineup",
    prompt: "Illustrative demo: put these in the party order.",
    points: 80,
    collectMs: 30_000,
    attribution: "after",
    mode: "complete",
    ties: "forbidden",
    items: [
      { id: "cake", label: "Cake" },
      { id: "candles", label: "Candles" },
      { id: "song", label: "Song" },
      { id: "friends", label: "Friends" },
    ],
    tiers: [
      { id: "first", label: "1st" },
      { id: "second", label: "2nd" },
      { id: "third", label: "3rd" },
      { id: "fourth", label: "4th" },
    ],
    truth: [
      { tierId: "first", itemIds: ["friends"] },
      { tierId: "second", itemIds: ["cake"] },
      { tierId: "third", itemIds: ["song"] },
      { tierId: "fourth", itemIds: ["candles"] },
    ],
  },
  {
    kind: "vote",
    id: "toast",
    prompt: "Illustrative demo: write a short toast.",
    points: 60,
    collectMs: 20_000,
    voteMs: 20_000,
    attribution: "after",
    candidateMode: "all",
    selfVote: "forbidden",
    votes: 1,
    tie: "shared",
    award: "authors",
    lateJoin: "ineligible",
  },
  {
    kind: "vote",
    id: "picks",
    prompt: "Illustrative demo: write a spare line.",
    points: 40,
    collectMs: 20_000,
    voteMs: 20_000,
    attribution: "never",
    candidateMode: "shortlist",
    selfVote: "forbidden",
    votes: 1,
    tie: "shared",
    award: "authors",
    lateJoin: "ineligible",
  },
  {
    kind: "guess",
    id: "who",
    prompt: "Illustrative demo: who is holding the playlist?",
    points: 80,
    collectMs: 20_000,
    attribution: "after",
    roster: "room",
    shortlist: [],
    selfVote: "forbidden",
    tie: "shared",
    scoring: "named",
    lateJoin: "ineligible",
    truthNickname: "Bilal",
  },
  {
    kind: "duel",
    id: "clash",
    prompt: "Illustrative demo: get closer to 26 than your opponent.",
    points: 50,
    collectMs: 20_000,
    attribution: "after",
    minimum: 0,
    maximum: 50,
    step: 1,
    target: 26,
    within: 2,
    odd: "solo",
    tie: "shared",
    absence: "forfeit",
    lateJoin: "ineligible",
    tieBreak: "off",
  },
  {
    kind: "finale",
    id: "finale",
    prompt: "Illustrative demo: the final duel.",
    points: 70,
    collectMs: 20_000,
    predictMs: 20_000,
    attribution: "after",
    minimum: 0,
    maximum: 50,
    step: 1,
    target: 26,
    within: 2,
    tie: "shared",
    absence: "forfeit",
    lateJoin: "ineligible",
    tieBreak: "tied",
    contestants: ["Amina", "Bilal"],
    predictionPoints: 30,
  },
];

export function assertCollectWindow(ms: number): void {
  if (!Number.isInteger(ms) || ms < 15_000 || ms > 45_000) {
    throw new Error("A collection window has to be between 15 and 45 seconds.");
  }
}

for (const question of demoQuestions) {
  assertCollectWindow(question.collectMs);
  if (question.prompt.includes(demoAnswerKeyMarker)) {
    throw new Error("The illustrative prompt must not carry the answer-key marker.");
  }
  if (
    question.kind === "choice" &&
    !question.options.some((option) => option.id === question.correctOptionId)
  ) {
    throw new Error("The illustrative set has a missing answer.");
  }
}

export function demoQuestionAt(index: number): DemoQuestion | undefined {
  return demoQuestions[index];
}

export function demoCollectWindows(): number[] {
  return demoQuestions.map((question) => question.collectMs);
}

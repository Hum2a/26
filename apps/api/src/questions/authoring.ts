import { ordinaryDefaults } from "./defaults.ts";
import {
  isKnown,
  missingRequirements,
  type Answer,
  type AttributionMode,
  type AuthoredChoice,
  type AuthoredDuel,
  type AuthoredFinale,
  type AuthoredGuess,
  type AuthoredQuestion,
  type AuthoredRank,
  type AuthoredSlider,
  type AuthoredTyped,
  type AuthoredWordle,
  type AuthoredVote,
  type ChoiceOutcome,
  type ChoiceQuestion,
  type DuelQuestion,
  type FinaleQuestion,
  type GuessQuestion,
  type MediaRef,
  type MissingRequirement,
  type Question,
  type QuestionStatus,
  type RankQuestion,
  type SliderBand,
  type SliderQuestion,
  type TypedQuestion,
  type VoteQuestion,
} from "./definition.ts";

type SharedInput = {
  id: string;
  title: string;
  status?: QuestionStatus;
  prompt?: string;
  instructions?: string;
  points?: number;
  collectMs?: number;
  attribution?: AttributionMode;
  presentation?: string;
  notes?: string;
  explanation?: string;
  media?: readonly MediaRef[];
  requirements?: readonly MissingRequirement[];
};

function shared(input: SharedInput, points: number) {
  return {
    id: input.id,
    title: input.title,
    status: "draft" as const,
    prompt: input.prompt ?? "",
    instructions: input.instructions,
    points,
    collectMs: input.collectMs ?? ordinaryDefaults.collectMs,
    attribution: input.attribution ?? ordinaryDefaults.attribution,
    presentation: input.presentation ?? ordinaryDefaults.presentation,
    notes: input.notes,
    explanation: input.explanation,
    media: input.media,
    requirements: input.requirements,
  };
}

function finish<T extends AuthoredQuestion>(
  question: T,
  requested?: QuestionStatus,
): T {
  if (requested) {
    return { ...question, status: requested };
  }
  const status = missingRequirements(question).length > 0 ? "draft" : "ready";
  return { ...question, status };
}

const missingPerson: MissingRequirement = {
  code: "correct-answer",
  name: "person",
  detail: "The correct person has not been named.",
};

const missingChoice: MissingRequirement = {
  code: "correct-answer",
  name: "correct-option",
  detail: "The correct choice has not been chosen.",
};

const missingAccepted: MissingRequirement = {
  code: "correct-answer",
  name: "accepted",
  detail: "The accepted answer has not been supplied.",
};

const missingTruth: MissingRequirement = {
  code: "truth",
  name: "truth",
  detail: "The true value has not been supplied.",
};

const missingOrder: MissingRequirement = {
  code: "truth",
  name: "order",
  detail: "The correct order has not been supplied.",
};

const missingContestants: MissingRequirement = {
  code: "contestants",
  name: "contestants",
  detail: "The two contestants have not been named.",
};

/**
 * A poll scores nothing, so its points default to 0. A threshold outcome
 * names who scores, so it has no single correct option.
 */
export function choiceQuestion(
  input: SharedInput & {
    options?: { id: string; label: string }[];
    outcome?: ChoiceOutcome;
    correctOption?: Answer<string>;
    speedBonus?: { maxPoints: number } | null;
    modifiers?: readonly "double"[];
    suppressSpeedBonus?: boolean;
  },
): AuthoredChoice {
  const outcome = input.outcome ?? { kind: "correct" };
  const points =
    input.points ??
    (outcome.kind === "poll"
      ? ordinaryDefaults.pollPoints
      : ordinaryDefaults.choicePoints);
  return finish(
    {
      ...shared(input, points),
      kind: "choice",
      outcome,
      options: input.options ?? [],
      correctOption:
        outcome.kind === "correct"
          ? (input.correctOption ?? { missing: missingChoice })
          : { known: null },
      speedBonus:
        input.speedBonus === undefined ? ordinaryDefaults.speedBonus : input.speedBonus,
      modifiers: input.modifiers,
      suppressSpeedBonus: input.suppressSpeedBonus,
    },
    input.status,
  );
}

export function sliderQuestion(
  input: SharedInput & {
    minimum?: number;
    maximum?: number;
    step?: number;
    unit?: string;
    initial?: number;
    truth?: Answer<number>;
    bands?: SliderBand[];
  },
): AuthoredSlider {
  const points = input.points ?? ordinaryDefaults.sliderPoints;
  return finish(
    {
      ...shared(input, points),
      kind: "slider",
      minimum: input.minimum ?? Number.NaN,
      maximum: input.maximum ?? Number.NaN,
      step: input.step ?? 1,
      unit: input.unit ?? "",
      initial: input.initial ?? Number.NaN,
      truth: input.truth ?? { missing: missingTruth },
      bands: input.bands ?? [{ within: 0, points }],
    },
    input.status,
  );
}

/** Guests type a short answer. Matching ignores case, accents, punctuation, and a small typo. */
export function typedQuestion(
  input: SharedInput & {
    accepted?: Answer<readonly string[]>;
    maxLength?: number;
  },
): AuthoredTyped {
  return finish(
    {
      ...shared(input, input.points ?? ordinaryDefaults.typedPoints),
      kind: "typed",
      maxLength: input.maxLength ?? ordinaryDefaults.typedMaxLength,
      accepted: input.accepted ?? { missing: missingAccepted },
    },
    input.status,
  );
}

export function wordleQuestion(
  input: SharedInput & { answer?: Answer<string> },
): AuthoredWordle {
  return finish(
    {
      ...shared(
        { ...input, collectMs: input.collectMs ?? ordinaryDefaults.wordleCollectMs },
        input.points ?? ordinaryDefaults.wordlePoints,
      ),
      kind: "wordle",
      wordLength: 5,
      maxGuesses: 6,
      answer: input.answer ?? {
        missing: {
          code: "correct-answer",
          name: "target-word",
          detail: "The five-letter target has not been supplied.",
        },
      },
    },
    input.status,
  );
}

export function rankQuestion(
  input: SharedInput & {
    mode?: "complete" | "partial";
    ties?: "forbidden" | "shared";
    items?: { id: string; label: string }[];
    tiers?: { id: string; label: string }[];
    truth?: Answer<{ tierId: string; itemIds: string[] }[]>;
  },
): AuthoredRank {
  return finish(
    {
      ...shared(input, input.points ?? ordinaryDefaults.rankPoints),
      kind: "rank",
      mode: input.mode ?? ordinaryDefaults.rankMode,
      ties: input.ties ?? ordinaryDefaults.rankTies,
      items: input.items ?? [],
      tiers: input.tiers ?? [],
      truth: input.truth ?? { missing: missingOrder },
    },
    input.status,
  );
}

export function voteQuestion(
  input: SharedInput & {
    voteMs?: number;
    candidateMode?: "all" | "shortlist";
    selfVote?: "forbidden" | "allowed";
    award?: "authors" | "voters";
  },
): AuthoredVote {
  return finish(
    {
      ...shared(input, input.points ?? ordinaryDefaults.votePoints),
      kind: "vote",
      voteMs: input.voteMs ?? ordinaryDefaults.voteMs,
      candidateMode: input.candidateMode ?? ordinaryDefaults.voteCandidateMode,
      selfVote: input.selfVote ?? ordinaryDefaults.selfVote,
      votes: 1,
      tie: ordinaryDefaults.tie,
      award: input.award ?? ordinaryDefaults.voteAward,
      lateJoin: ordinaryDefaults.lateJoin,
    },
    input.status,
  );
}

export function guessQuestion(
  input: SharedInput & {
    roster?: "room" | "shortlist";
    shortlist?: string[];
    selfVote?: "forbidden" | "allowed";
    scoring?: "named" | "majority" | "none";
    truth?: Answer<string | null>;
  },
): AuthoredGuess {
  const scoring = input.scoring ?? ordinaryDefaults.guessScoring;
  return finish(
    {
      ...shared(input, input.points ?? ordinaryDefaults.guessPoints),
      kind: "guess",
      roster: input.roster ?? ordinaryDefaults.guessRoster,
      shortlist: input.shortlist ?? [],
      selfVote: input.selfVote ?? ordinaryDefaults.selfVote,
      tie: ordinaryDefaults.tie,
      scoring,
      lateJoin: ordinaryDefaults.lateJoin,
      truth:
        input.truth ??
        (scoring === "named" ? { missing: missingPerson } : { known: null }),
    },
    input.status,
  );
}

type ScaleInput = {
  minimum?: number;
  maximum?: number;
  step?: number;
  target?: number;
  within?: number;
  tieBreak?: "off" | "tied";
};

function scale(input: ScaleInput) {
  return {
    minimum: input.minimum ?? Number.NaN,
    maximum: input.maximum ?? Number.NaN,
    step: input.step ?? 1,
    target: input.target ?? Number.NaN,
    within: input.within ?? ordinaryDefaults.within,
    tie: ordinaryDefaults.tie,
    absence: ordinaryDefaults.absence,
    lateJoin: ordinaryDefaults.lateJoin,
    tieBreak: input.tieBreak ?? ordinaryDefaults.tieBreak,
  };
}

export function duelQuestion(input: SharedInput & ScaleInput): AuthoredDuel {
  return finish(
    {
      ...shared(input, input.points ?? ordinaryDefaults.duelPoints),
      kind: "duel",
      odd: ordinaryDefaults.odd,
      ...scale(input),
    },
    input.status,
  );
}

export function finaleQuestion(
  input: SharedInput &
    ScaleInput & {
      contestants?: Answer<readonly [string, string]>;
      predictionPoints?: number;
      predictMs?: number;
    },
): AuthoredFinale {
  return finish(
    {
      ...shared(input, input.points ?? ordinaryDefaults.finalePoints),
      kind: "finale",
      ...scale(input),
      contestants: input.contestants ?? { missing: missingContestants },
      predictionPoints: input.predictionPoints ?? ordinaryDefaults.predictionPoints,
      predictMs: input.predictMs ?? ordinaryDefaults.predictMs,
    },
    input.status,
  );
}

function playableCore(question: AuthoredQuestion, illustrative: boolean) {
  return {
    id: question.id,
    title: question.title,
    status: "ready" as const,
    prompt: question.prompt,
    instructions: question.instructions,
    points: question.points,
    collectMs: question.collectMs,
    attribution: question.attribution,
    presentation: question.presentation,
    notes: question.notes,
    explanation: question.explanation,
    media: question.media,
    requirements: question.requirements,
    illustrative,
  };
}

/** Unwrap a ready question. A draft, or a ready question that is still missing facts, returns undefined. */
export function toPlayable(
  question: AuthoredQuestion | undefined,
  illustrative = false,
): Question | undefined {
  if (
    !question ||
    question.status !== "ready" ||
    missingRequirements(question).length > 0
  ) {
    return undefined;
  }
  const core = playableCore(question, illustrative);
  if (question.kind === "choice") {
    if (!isKnown(question.correctOption)) {
      return undefined;
    }
    const playable: ChoiceQuestion = {
      ...core,
      kind: "choice",
      outcome: question.outcome,
      options: question.options,
      correctOptionId: question.correctOption.known,
      speedBonus: question.speedBonus,
      modifiers: question.modifiers,
      suppressSpeedBonus: question.suppressSpeedBonus,
    };
    return playable;
  }
  if (question.kind === "slider") {
    if (!isKnown(question.truth)) {
      return undefined;
    }
    const playable: SliderQuestion = {
      ...core,
      kind: "slider",
      minimum: question.minimum,
      maximum: question.maximum,
      step: question.step,
      unit: question.unit,
      initial: question.initial,
      truth: question.truth.known,
      bands: question.bands,
    };
    return playable;
  }
  if (question.kind === "wordle") {
    return isKnown(question.answer)
      ? {
          ...core,
          kind: "wordle",
          wordLength: 5,
          maxGuesses: 6,
          answer: question.answer.known,
        }
      : undefined;
  }
  if (question.kind === "typed") {
    if (!isKnown(question.accepted)) {
      return undefined;
    }
    const playable: TypedQuestion = {
      ...core,
      kind: "typed",
      maxLength: question.maxLength,
      accepted: question.accepted.known,
    };
    return playable;
  }
  if (question.kind === "rank") {
    if (!isKnown(question.truth)) {
      return undefined;
    }
    const playable: RankQuestion = {
      ...core,
      kind: "rank",
      mode: question.mode,
      ties: question.ties,
      items: question.items,
      tiers: question.tiers,
      truth: question.truth.known,
    };
    return playable;
  }
  if (question.kind === "vote") {
    const playable: VoteQuestion = {
      ...core,
      ...question,
      status: "ready",
      illustrative,
    };
    return playable;
  }
  if (question.kind === "guess") {
    if (!isKnown(question.truth)) {
      return undefined;
    }
    const playable: GuessQuestion = {
      ...core,
      kind: "guess",
      roster: question.roster,
      shortlist: question.shortlist,
      selfVote: question.selfVote,
      tie: question.tie,
      scoring: question.scoring,
      lateJoin: question.lateJoin,
      truthNickname: question.truth.known,
    };
    return playable;
  }
  if (question.kind === "duel") {
    const playable: DuelQuestion = {
      ...core,
      ...question,
      status: "ready",
      illustrative,
    };
    return playable;
  }
  if (!isKnown(question.contestants)) {
    return undefined;
  }
  const playable: FinaleQuestion = {
    ...core,
    kind: "finale",
    minimum: question.minimum,
    maximum: question.maximum,
    step: question.step,
    target: question.target,
    within: question.within,
    tie: question.tie,
    absence: question.absence,
    lateJoin: question.lateJoin,
    tieBreak: question.tieBreak,
    predictionPoints: question.predictionPoints,
    predictMs: question.predictMs,
    contestants: question.contestants.known,
  };
  return playable;
}

import { contentLimits } from "@26/shared";

/**
 * Server-side question documents. Guest JavaScript must not import this module.
 * Correct answers, presenter notes, and reveal copy stay here until a projection allows them.
 */
export const demoAnswerKeyMarker = "demo-answer-key-v1";

export type AttributionMode = "never" | "after" | "live";

export type QuestionStatus = "draft" | "ready";

export type MissingCode =
  | "correct-answer"
  | "media"
  | "options"
  | "prompt"
  | "contestants"
  | "shortlist"
  | "scale"
  | "items"
  | "truth";

export type MissingRequirement = {
  code: MissingCode;
  name: string;
  detail: string;
};

/** A supplied answer, or an explicit gap. Never a placeholder id. */
export type Answer<T> = { known: T } | { missing: MissingRequirement };

export type MediaRef = {
  name: string;
  kind: "image" | "audio";
  /** Set when the file is already in the repository. */
  asset?: string;
  required: boolean;
};

export type PackProfile = "illustrative" | "party";

export type QuestionPackId = "demo" | "birthday";

type AuthorFields = {
  id: string;
  title: string;
  status: QuestionStatus;
  prompt: string;
  instructions?: string;
  points: number;
  collectMs: number;
  attribution: AttributionMode;
  presentation: string;
  notes?: string;
  explanation?: string;
  media?: readonly MediaRef[];
  requirements?: readonly MissingRequirement[];
};

export type ChoiceBody = {
  kind: "choice";
  options: { id: string; label: string }[];
  speedBonus: { maxPoints: number } | null;
  modifiers?: readonly "double"[];
  suppressSpeedBonus?: boolean;
};

export type SliderBand = { within: number; points: number };

export type SliderBody = {
  kind: "slider";
  minimum: number;
  maximum: number;
  step: number;
  unit: string;
  initial: number;
  bands: SliderBand[];
};

export type RankPlacement = { itemId: string; tierId: string };

export type RankBody = {
  kind: "rank";
  mode: "complete" | "partial";
  ties: "forbidden" | "shared";
  items: { id: string; label: string }[];
  tiers: { id: string; label: string }[];
};

export type VoteBody = {
  kind: "vote";
  voteMs: number;
  candidateMode: "all" | "shortlist";
  selfVote: "forbidden" | "allowed";
  votes: 1;
  tie: "shared";
  award: "authors" | "voters";
  lateJoin: "ineligible";
};

export type GuessBody = {
  kind: "guess";
  roster: "room" | "shortlist";
  shortlist: string[];
  selfVote: "forbidden" | "allowed";
  tie: "shared";
  scoring: "named" | "majority" | "none";
  lateJoin: "ineligible";
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

export type DuelBody = DuelScale & {
  kind: "duel";
  odd: "solo";
};

export type FinaleBody = DuelScale & {
  kind: "finale";
  predictionPoints: number;
  predictMs: number;
};

export type AuthoredChoice = AuthorFields &
  ChoiceBody & {
    correctOption: Answer<string>;
  };

export type AuthoredSlider = AuthorFields &
  SliderBody & {
    truth: Answer<number>;
  };

export type AuthoredRank = AuthorFields &
  RankBody & {
    truth: Answer<{ tierId: string; itemIds: string[] }[]>;
  };

export type AuthoredVote = AuthorFields & VoteBody;

export type AuthoredGuess = AuthorFields &
  GuessBody & {
    truth: Answer<string | null>;
  };

export type AuthoredDuel = AuthorFields & DuelBody;

export type AuthoredFinale = AuthorFields &
  FinaleBody & {
    contestants: Answer<readonly [string, string]>;
  };

export type AuthoredQuestion =
  | AuthoredChoice
  | AuthoredSlider
  | AuthoredRank
  | AuthoredVote
  | AuthoredGuess
  | AuthoredDuel
  | AuthoredFinale;

type PlayableFields = AuthorFields & {
  status: "ready";
  /** Copied from the pack. Party questions are false. */
  illustrative: boolean;
};

export type ChoiceQuestion = PlayableFields &
  ChoiceBody & {
    correctOptionId: string;
  };

export type SliderQuestion = PlayableFields &
  SliderBody & {
    truth: number;
  };

export type RankQuestion = PlayableFields &
  RankBody & {
    truth: { tierId: string; itemIds: string[] }[];
  };

export type VoteQuestion = PlayableFields & VoteBody;

export type GuessQuestion = PlayableFields &
  GuessBody & {
    truthNickname: string | null;
  };

export type DuelQuestion = PlayableFields & DuelBody;

export type FinaleQuestion = PlayableFields &
  FinaleBody & {
    contestants: readonly [string, string];
  };

/** A question the engine can score. Drafts are not this type. */
export type Question =
  | ChoiceQuestion
  | SliderQuestion
  | RankQuestion
  | VoteQuestion
  | GuessQuestion
  | DuelQuestion
  | FinaleQuestion;

export type QuestionPack = {
  packId: QuestionPackId;
  version: string;
  release: "draft" | "released";
  profile: PackProfile;
  illustrative: boolean;
  /** Playable running order. Draft ids must not appear here. */
  order: readonly string[];
  catalogue: readonly AuthoredQuestion[];
};

export function isKnown<T>(answer: Answer<T> | undefined): answer is { known: T } {
  return answer !== undefined && "known" in answer;
}

export function missingRequirements(question: AuthoredQuestion): MissingRequirement[] {
  const items: MissingRequirement[] = [];
  const seen = new Set<string>();
  const add = (requirement: MissingRequirement) => {
    const key = `${requirement.code}:${requirement.name}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    items.push(requirement);
  };
  for (const requirement of question.requirements ?? []) {
    add(requirement);
  }
  if (!question.prompt.trim()) {
    add({
      code: "prompt",
      name: "prompt",
      detail: "The stage prompt has not been written.",
    });
  }
  for (const media of question.media ?? []) {
    if (media.required && !media.asset) {
      add({
        code: "media",
        name: media.name,
        detail: `${media.name} has not been supplied.`,
      });
    }
  }
  if (question.kind === "choice") {
    if (question.options.length < 2) {
      add({
        code: "options",
        name: "options",
        detail: "The choices have not been supplied.",
      });
    }
    if (!isKnown(question.correctOption)) {
      add(question.correctOption.missing);
    }
  }
  if (question.kind === "slider") {
    if (!Number.isFinite(question.minimum) || !Number.isFinite(question.maximum)) {
      add({
        code: "scale",
        name: "scale",
        detail: "The slider scale has not been set.",
      });
    }
    if (!isKnown(question.truth)) {
      add(question.truth.missing);
    }
  }
  if (question.kind === "rank") {
    if (question.items.length < 2) {
      add({
        code: "items",
        name: "items",
        detail: "The ranking items have not been supplied.",
      });
    }
    if (!isKnown(question.truth)) {
      add(question.truth.missing);
    }
  }
  if (question.kind === "guess" && question.scoring === "named") {
    if (!isKnown(question.truth) || question.truth.known === null) {
      add(
        isKnown(question.truth)
          ? {
              code: "correct-answer",
              name: "person",
              detail: "The correct person has not been named.",
            }
          : question.truth.missing,
      );
    }
  }
  if (
    question.kind === "guess" &&
    question.roster === "shortlist" &&
    question.shortlist.length === 0
  ) {
    add({
      code: "shortlist",
      name: "shortlist",
      detail: "The shortlist of names has not been supplied.",
    });
  }
  if (question.kind === "finale" && !isKnown(question.contestants)) {
    add(question.contestants.missing);
  }
  if (question.kind === "duel" || question.kind === "finale") {
    if (!Number.isFinite(question.minimum) || !Number.isFinite(question.maximum)) {
      add({
        code: "scale",
        name: "scale",
        detail: "The scale has not been set.",
      });
    }
    if (!Number.isFinite(question.target)) {
      add({
        code: "truth",
        name: "target",
        detail: "The target number has not been supplied.",
      });
    }
  }
  return items;
}

export function assertCollectWindow(ms: number): void {
  if (
    !Number.isInteger(ms) ||
    ms < contentLimits.collectMinMs ||
    ms > contentLimits.collectMaxMs
  ) {
    throw new Error("A collection window has to be between 15 and 45 seconds.");
  }
}

import type { ChoiceOutcome } from "./definition.ts";

/**
 * Who scores on a choice, decided from every accepted answer at the reveal.
 * `everyone` means every guest who answered. A guest with no answer never scores.
 */
export type ChoiceSettlement = {
  outcome: ChoiceOutcome["kind"];
  everyone: boolean;
  optionIds: readonly string[];
  /** Threshold only: whether the measured option passed its share. */
  met: boolean | null;
};

export function settleChoice(
  question: {
    outcome: ChoiceOutcome;
    correctOptionId: string | null;
  },
  answers: readonly string[],
): ChoiceSettlement {
  const outcome = question.outcome;
  if (outcome.kind === "correct") {
    return {
      outcome: "correct",
      everyone: false,
      optionIds: question.correctOptionId ? [question.correctOptionId] : [],
      met: null,
    };
  }
  if (outcome.kind === "multiple")
    return {
      outcome: "multiple",
      everyone: false,
      optionIds: [...outcome.optionIds],
      met: null,
    };
  if (outcome.kind === "poll") {
    return { outcome: "poll", everyone: false, optionIds: [], met: null };
  }
  const picked = answers.filter((optionId) => optionId === outcome.optionId).length;
  const met = answers.length > 0 && picked / answers.length > outcome.above;
  const winners = met ? outcome.met : outcome.otherwise;
  return {
    outcome: "threshold",
    everyone: winners === "everyone",
    optionIds: winners === "everyone" ? [] : [...winners],
    met,
  };
}

export function choiceWins(settlement: ChoiceSettlement, optionId: string): boolean {
  return settlement.everyone || settlement.optionIds.includes(optionId);
}

/** One count per option, in option order. */
export function choiceTally(
  options: readonly { id: string }[],
  answers: readonly string[],
): { optionId: string; count: number }[] {
  return options.map((option) => ({
    optionId: option.id,
    count: answers.filter((optionId) => optionId === option.id).length,
  }));
}

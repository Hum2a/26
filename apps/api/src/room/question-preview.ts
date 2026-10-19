import { adminQuestionPreviewSchema, type AdminQuestionPreview } from "@26/shared";
import {
  isKnown,
  type AuthoredQuestion,
  type QuestionPack,
} from "../questions/definition.ts";

/** Authenticated rehearsal. Only fields the phone can draw, with no invented scales or answers. */
export function questionPreview(
  pack: QuestionPack,
  q: AuthoredQuestion,
): AdminQuestionPreview {
  const core = {
    id: q.id,
    index: Math.max(1, pack.order.indexOf(q.id) + 1),
    total: Math.max(1, pack.order.length || pack.catalogue.length),
    prompt: q.prompt,
    points: q.points,
    illustrative: pack.illustrative,
    attribution: q.attribution,
    presentation: q.presentation,
    ...(q.instructions ? { instructions: q.instructions } : {}),
  };
  let fields: object;
  switch (q.kind) {
    case "choice":
      fields = {
        kind: q.kind,
        options: q.options.map(({ id, label }) => ({ id, label })),
        speedBonus: Boolean(q.speedBonus),
        modifiers: q.modifiers ?? [],
        suppressSpeedBonus: Boolean(q.suppressSpeedBonus),
        ...(q.outcome.kind !== "correct" ? { outcome: q.outcome.kind } : {}),
      };
      break;
    case "wordle":
      fields = { kind: q.kind, wordLength: q.wordLength, maxGuesses: q.maxGuesses };
      break;
    case "typed":
      fields = { kind: q.kind, maxLength: q.maxLength };
      break;
    case "slider":
      fields = {
        kind: q.kind,
        minimum: q.minimum,
        maximum: q.maximum,
        step: q.step,
        initial: q.initial,
        unit: q.unit,
      };
      break;
    case "rank":
      fields = {
        kind: q.kind,
        mode: q.mode,
        ties: q.ties,
        items: q.items.map(({ id, label }) => ({ id, label })),
        tiers: q.tiers.map(({ id, label }) => ({ id, label })),
      };
      break;
    case "vote":
      fields = {
        kind: q.kind,
        candidateMode: q.candidateMode,
        selfVote: q.selfVote,
        votes: 1,
        tie: q.tie,
        award: q.award,
        lateJoin: q.lateJoin,
      };
      break;
    case "guess":
      fields = {
        kind: q.kind,
        roster: q.roster,
        selfVote: q.selfVote,
        tie: q.tie,
        scoring: q.scoring,
        lateJoin: q.lateJoin,
        search: true,
      };
      break;
    case "duel":
    case "finale":
      fields = {
        kind: q.kind,
        minimum: q.minimum,
        maximum: q.maximum,
        step: q.step,
        target: q.target,
        within: q.within,
        tie: q.tie,
        absence: q.absence,
        lateJoin: q.lateJoin,
        tieBreak: q.tieBreak,
        ...(q.kind === "duel"
          ? { odd: q.odd }
          : {
              contestants: isKnown(q.contestants) ? q.contestants.known : [],
              predictionPoints: q.predictionPoints,
            }),
      };
      break;
  }
  // A known placeholder mechanic is labelled, never presented as the finished game.
  const unsupported = q.requirements?.some((item) =>
    ["ranking-mechanic", "wordle-mechanic", "multiple-selection"].includes(item.name),
  );
  const limitation = unsupported
    ? "Draft layout only. The requested interaction is not implemented yet; this shows the current placeholder mechanic."
    : q.kind === "guess" || q.kind === "duel" || q.kind === "finale"
      ? "Player names in this preview are stand-ins. No room is connected."
      : null;
  const parsed = adminQuestionPreviewSchema.safeParse({
    question: { ...core, ...fields },
    limitation,
    interactive: !unsupported,
  });
  return parsed.success
    ? parsed.data
    : {
        question: null,
        interactive: false,
        limitation:
          "The phone layout cannot be rendered until the prompt, options or numeric scale are supplied. Check the missing requirements. No placeholder values have been invented.",
      };
}

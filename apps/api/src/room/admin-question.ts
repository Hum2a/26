import { adminQuestionDetailSchema, type AdminQuestionDetail } from "@26/shared";
import {
  isKnown,
  missingRequirements,
  type AuthoredQuestion,
  type QuestionPack,
} from "../questions/definition.ts";

/** A deliberate private projection, never an authored object or client question pack. */
export function adminQuestion(
  pack: QuestionPack,
  question: AuthoredQuestion,
): AdminQuestionDetail | null {
  const settings = [
    { label: "Points", value: String(question.points) },
    { label: "Answer window", value: `${question.collectMs / 1000} seconds` },
    { label: "Attribution", value: question.attribution },
  ];
  const add = (label: string, value: unknown) =>
    settings.push({
      label,
      value:
        typeof value === "number" && !Number.isFinite(value)
          ? "Not set"
          : String(value),
    });
  if (question.kind === "kart") {
    add("Track", question.trackId);
    add("Race", "One lap, 45-second server cutoff; DNF scores zero. Ties share place.");
  } else if (question.kind === "choice") {
    add("Outcome", question.outcome.kind);
    add(
      "Speed bonus",
      question.speedBonus ? `Up to ${question.speedBonus.maxPoints} points` : "Off",
    );
    add("Modifiers", question.modifiers?.join(", ") || "None");
    add("Suppress speed bonus", question.suppressSpeedBonus ? "Yes" : "No");
  } else if (question.kind === "wordle") {
    add("Guesses", question.maxGuesses);
    add("Letters", question.wordLength);
    add("Scoring", "Full points for solving within the time; no speed bonus");
  } else if (question.kind === "typed")
    add("Maximum length", `${question.maxLength} characters`);
  else if (
    question.kind === "slider" ||
    question.kind === "duel" ||
    question.kind === "finale"
  ) {
    add("Minimum", question.minimum);
    add("Maximum", question.maximum);
    add("Step", question.step);
    if (question.kind === "slider") {
      add("Units", question.unit || "Not set");
      add("Starting value", question.initial);
      add(
        "Scoring bands",
        question.bands
          .map((band) => `Within ${band.within}: ${band.points} points`)
          .join("; "),
      );
    } else {
      add("Tolerance", question.within);
      add("Ties", question.tie);
      add("Absence", question.absence);
      add("Late joining", question.lateJoin);
      add("Tie break", question.tieBreak);
      if (question.kind === "finale") {
        add("Prediction points", question.predictionPoints);
        add("Prediction window", `${question.predictMs / 1000} seconds`);
      } else add("Odd player", question.odd);
    }
  } else if (question.kind === "rank") {
    add("Ranking", question.mode);
    add("Ties", question.ties);
    add("Tiers", question.tiers.map((tier) => tier.label).join(", ") || "Not set");
  } else if (question.kind === "vote") {
    add("Voting window", `${question.voteMs / 1000} seconds`);
    add("Candidates", question.candidateMode);
    add("Self vote", question.selfVote);
    add("Award", question.award);
    add("Ties", question.tie);
  } else if (question.kind === "guess") {
    add("Roster", question.roster);
    add("Scoring", question.scoring);
    add("Self vote", question.selfVote);
    if (question.shortlist.length) add("Shortlist", question.shortlist.join(", "));
  }
  const parsed = adminQuestionDetailSchema.safeParse({
    version: pack.version,
    release: pack.release,
    question: {
      id: question.id,
      title: question.title,
      prompt: question.prompt,
      mechanic: question.kind,
      presentation: question.presentation,
      status: question.status,
      order: pack.order.includes(question.id)
        ? pack.order.indexOf(question.id) + 1
        : null,
      missing: missingRequirements(question).map(({ code, name, detail }) => ({
        code,
        name,
        detail,
      })),
      instructions: question.instructions ?? null,
      notes: question.notes ?? null,
      explanation: question.explanation ?? null,
      options:
        question.kind === "choice"
          ? question.options.map(({ id, label }) => ({ id, label }))
          : question.kind === "rank"
            ? question.items.map(({ id, label }) => ({ id, label }))
            : [],
      settings,
      answer: answerFor(question),
      media: (question.media ?? []).map((item) => ({
        name: item.name,
        kind: item.kind,
        required: item.required,
        supplied: Boolean(item.asset),
      })),
    },
  });
  return parsed.success ? parsed.data : null;
}

function answerFor(
  question: AuthoredQuestion,
): AdminQuestionDetail["question"]["answer"] {
  const missing = {
    status: "missing" as const,
    lines: ["No supported answer is recorded yet. See the missing requirements."],
  };
  const recorded = (lines: string[]) => ({ status: "recorded" as const, lines });
  if (question.kind === "kart")
    return recorded([
      "Server-verified lap times. All eight gates in order, one lap, 45 seconds. DNF scores zero; equal times share place.",
    ]);
  if (question.kind === "choice") {
    const label = (id: string) =>
      question.options.find((option) => option.id === id)?.label ?? id;
    if (question.outcome.kind === "multiple")
      return recorded(question.outcome.optionIds.map(label));
    if (question.outcome.kind === "poll")
      return {
        status: "not-applicable",
        lines: ["Poll: no correct answer and no points."],
      };
    if (question.outcome.kind === "threshold") {
      const rule = question.outcome;
      const who = (value: "everyone" | readonly string[]) =>
        value === "everyone" ? "Everyone who answered" : value.map(label).join(", ");
      return recorded([
        `More than ${rule.above * 100}% choose ${label(rule.optionId)}: ${who(rule.met)}. Otherwise: ${who(rule.otherwise)}.`,
      ]);
    }
    return isKnown(question.correctOption) && question.correctOption.known !== null
      ? recorded([label(question.correctOption.known)])
      : missing;
  }
  if (question.kind === "wordle")
    return isKnown(question.answer) ? recorded([question.answer.known]) : missing;
  if (question.kind === "typed" && question.scoring === "commonness")
    return recorded([
      "Match other guests: case and outer spaces ignored; repeated internal spaces collapse. Unique entries score zero. Ties share points; matched groups scale to 100 for the largest group.",
    ]);
  if (
    (question.kind === "slider" || question.kind === "rank") &&
    question.scoring === "consensus"
  )
    return recorded([
      "The target is the room consensus, settled once from eligible accepted responses at reveal.",
    ]);
  if (question.kind === "typed")
    return isKnown(question.accepted)
      ? recorded([...question.accepted.known])
      : missing;
  if (question.kind === "slider")
    return isKnown(question.truth)
      ? recorded([`${question.truth.known} ${question.unit}`.trim()])
      : missing;
  if (question.kind === "rank")
    return isKnown(question.truth)
      ? recorded(
          question.truth.known.map(
            (group) =>
              `${question.tiers.find((tier) => tier.id === group.tierId)?.label ?? group.tierId}: ${group.itemIds.map((id) => question.items.find((item) => item.id === id)?.label ?? id).join(", ")}`,
          ),
        )
      : missing;
  if (question.kind === "guess")
    return isKnown(question.truth) && question.truth.known !== null
      ? recorded([question.truth.known])
      : question.scoring === "named"
        ? missing
        : {
            status: "not-applicable",
            lines: [`Scoring follows the ${question.scoring} rule.`],
          };
  if (question.kind === "duel" || question.kind === "finale")
    return Number.isFinite(question.target)
      ? recorded([
          `Target: ${question.target}`,
          ...(question.kind === "finale" && isKnown(question.contestants)
            ? [`Contestants: ${question.contestants.known.join(" and ")}`]
            : []),
        ])
      : missing;
  return {
    status: "not-applicable",
    lines: ["Guests vote; the server awards points using the configured voting rules."],
  };
}

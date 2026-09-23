import { demoQuestionSetVersion } from "../room/limits.ts";
import { implementedTrollKinds } from "../troll/catalogue.ts";
import type { DemoQuestion } from "./demo-set.ts";

/** Effects named in the plan that this build still rejects. */
export const unsupportedEffects = [
  "screen-recording",
  "battery",
  "update-prompt",
  "airdrop",
  "overheating",
  "inverted-slider",
  "reshuffle",
  "reverse-typing",
  "autocorrect",
  "steal",
  "redirect",
] as const;

export const illustrativeStingAsset = "apps/web/public/assets/demo-sting.wav";

export type ContentIssue = {
  level: "error";
  code: string;
  message: string;
};

export function preflightContent(input: {
  questions: readonly DemoQuestion[];
  missingAssets: readonly string[];
}): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const seen = new Set<string>();
  if (!demoQuestionSetVersion) {
    issues.push(issue("version", "The question set needs a version."));
  }
  for (const name of unsupportedEffects) {
    if ((implementedTrollKinds as readonly string[]).includes(name)) {
      issues.push(
        issue("effect", `${name} is listed as unsupported and must not be selectable.`),
      );
    }
  }
  if (!input.questions.some((question) => question.attribution === "live")) {
    issues.push(
      issue("attribution", "Live typing needs one question whose attribution is live."),
    );
  }
  if (
    !input.questions.some(
      (question) =>
        question.kind === "choice" && question.modifiers?.includes("double"),
    )
  ) {
    issues.push(
      issue("troll", "Double or nothing needs one choice that lists that modifier."),
    );
  }
  for (const asset of input.missingAssets) {
    issues.push(issue("asset", `Missing asset: ${asset}`));
  }
  for (const question of input.questions) {
    if (seen.has(question.id)) {
      issues.push(issue("id", `Question id ${question.id} is repeated.`));
    }
    seen.add(question.id);
    if (!/^[a-z0-9-]{1,40}$/.test(question.id)) {
      issues.push(
        issue("id", `Question id ${question.id} must be a short lowercase slug.`),
      );
    }
    if (!question.prompt.startsWith("Illustrative demo:")) {
      issues.push(
        issue(
          "label",
          `${question.id} must stay labelled as an illustrative demo until Humza supplies the party line.`,
        ),
      );
    }
    if (
      !Number.isInteger(question.collectMs) ||
      question.collectMs < 15_000 ||
      question.collectMs > 45_000
    ) {
      issues.push(
        issue("duration", `${question.id} collection must be 15 to 45 seconds.`),
      );
    }
    if (!Number.isInteger(question.points) || question.points < 0) {
      issues.push(
        issue("score", `${question.id} points must be a whole number from 0.`),
      );
    }
    issues.push(...checkQuestion(question));
  }
  const kinds = new Set(input.questions.map((question) => question.kind));
  for (const kind of [
    "choice",
    "slider",
    "rank",
    "vote",
    "guess",
    "duel",
    "finale",
  ] as const) {
    if (!kinds.has(kind)) {
      issues.push(issue("pack", `The demo pack is missing a ${kind} round.`));
    }
  }
  return issues;
}

function checkQuestion(question: DemoQuestion): ContentIssue[] {
  if (question.kind === "choice") {
    const ids = new Set(question.options.map((option) => option.id));
    if (ids.size !== question.options.length || question.options.length < 2) {
      return [issue("choice", `${question.id} needs distinct options.`)];
    }
    if (!ids.has(question.correctOptionId)) {
      return [issue("choice", `${question.id} correct option is not in the list.`)];
    }
    if (question.speedBonus && question.speedBonus.maxPoints < 0) {
      return [issue("score", `${question.id} speed bonus cannot be negative.`)];
    }
    return [];
  }
  if (question.kind === "slider") {
    if (question.minimum >= question.maximum || question.step <= 0) {
      return [issue("slider", `${question.id} scale is not usable.`)];
    }
    if (question.truth < question.minimum || question.truth > question.maximum) {
      return [issue("slider", `${question.id} truth sits outside the scale.`)];
    }
    return [];
  }
  if (question.kind === "rank") {
    const items = new Set(question.items.map((item) => item.id));
    const tiers = new Set(question.tiers.map((tier) => tier.id));
    const placed = question.truth.flatMap((group) => group.itemIds);
    if (question.mode === "complete" && placed.length !== items.size) {
      return [issue("rank", `${question.id} does not place every item once.`)];
    }
    if (question.truth.some((group) => !tiers.has(group.tierId))) {
      return [issue("rank", `${question.id} uses a tier that is not on the question.`)];
    }
    return [];
  }
  if (question.kind === "vote") {
    if (
      !Number.isInteger(question.voteMs) ||
      question.voteMs < 15_000 ||
      question.voteMs > 45_000
    ) {
      return [
        issue("duration", `${question.id} vote window must be 15 to 45 seconds.`),
      ];
    }
    return [];
  }
  if (question.kind === "guess") {
    if (question.roster === "shortlist" && question.shortlist.length === 0) {
      return [issue("guess", `${question.id} shortlist is empty.`)];
    }
    return [];
  }
  if (question.kind === "finale") {
    if (question.contestants.length !== 2) {
      return [issue("finale", `${question.id} needs two fixture contestants.`)];
    }
    if (
      !Number.isInteger(question.predictMs) ||
      question.predictMs < 15_000 ||
      question.predictMs > 45_000
    ) {
      return [
        issue("duration", `${question.id} prediction window must be 15 to 45 seconds.`),
      ];
    }
  }
  if (question.target < question.minimum || question.target > question.maximum) {
    return [issue("duel", `${question.id} target sits outside the scale.`)];
  }
  return [];
}

function issue(code: string, message: string): ContentIssue {
  return { level: "error", code, message };
}

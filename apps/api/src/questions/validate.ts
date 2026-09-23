import { contentLimits } from "@26/shared";
import { implementedTrollKinds } from "../troll/catalogue.ts";
import { toPlayable } from "./authoring.ts";
import {
  demoAnswerKeyMarker,
  isKnown,
  missingRequirements,
  type AuthoredQuestion,
  type PackProfile,
  type Question,
  type QuestionPack,
} from "./definition.ts";
import { isSupportedPresentation } from "./presentation.ts";

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
  level: "error" | "incomplete";
  code: string;
  message: string;
};

const questionKinds = [
  "choice",
  "slider",
  "rank",
  "vote",
  "guess",
  "duel",
  "finale",
] as const;

export function validateRuntimeEffects(): ContentIssue[] {
  const issues: ContentIssue[] = [];
  for (const name of unsupportedEffects) {
    if ((implementedTrollKinds as readonly string[]).includes(name)) {
      issues.push(
        issue(
          "error",
          "effect",
          `${name} is listed as unsupported and must not be selectable.`,
        ),
      );
    }
  }
  return issues;
}

export function validatePack(
  pack: QuestionPack,
  missingAssets: readonly string[] = [],
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  if (!contentLimits.questionId.test(pack.version)) {
    issues.push(
      issue("error", "version", `Version ${pack.version} is not a usable id.`),
    );
  }
  const seen = new Set<string>();
  const byId = new Map<string, AuthoredQuestion>();
  for (const question of pack.catalogue) {
    if (seen.has(question.id)) {
      issues.push(
        issue("error", "duplicate", `Question id ${question.id} is repeated.`),
      );
    }
    seen.add(question.id);
    byId.set(question.id, question);
    issues.push(...validateAuthored(question, pack.profile));
  }
  if (pack.order.length > contentLimits.packMax) {
    issues.push(
      issue("error", "pack", "A running order can contain at most 40 questions."),
    );
  }
  const ordered: Question[] = [];
  const orderedIds = new Set<string>();
  for (const id of pack.order) {
    if (orderedIds.has(id)) {
      issues.push(
        issue("error", "duplicate", `Running order lists ${id} more than once.`),
      );
    }
    orderedIds.add(id);
    const question = byId.get(id);
    if (!question) {
      issues.push(
        issue(
          "error",
          "manifest",
          `Running order names ${id}, which is not in the catalogue.`,
        ),
      );
      continue;
    }
    const playable = toPlayable(question, pack.illustrative);
    if (!playable) {
      issues.push(
        issue(
          "error",
          "draft-in-order",
          `${id} is in the running order but is not ready to play.`,
        ),
      );
      continue;
    }
    ordered.push(playable);
  }
  if (pack.profile === "illustrative") {
    issues.push(...illustrativeCoverage(ordered));
  }
  for (const asset of missingAssets) {
    issues.push(issue("error", "asset", `Missing asset: ${asset}`));
  }
  return issues;
}

/** Checks a playable list. Illustrative coverage applies only when profile is illustrative. */
export function preflightContent(input: {
  questions: readonly Question[];
  missingAssets: readonly string[];
  profile?: PackProfile;
}): ContentIssue[] {
  const profile = input.profile ?? "illustrative";
  return [
    ...validateRuntimeEffects(),
    ...validatePlayableQuestions(input.questions, profile),
    ...(profile === "illustrative" ? illustrativeCoverage(input.questions) : []),
    ...input.missingAssets.map((asset) =>
      issue("error", "asset", `Missing asset: ${asset}`),
    ),
  ];
}

function validateAuthored(
  question: AuthoredQuestion,
  profile: PackProfile,
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  issues.push(...suppliedIssues(question, profile));
  if (question.status !== "ready") {
    issues.push(...knownAnswerIssues(question));
  }
  const gaps = missingRequirements(question);
  if (question.status === "ready") {
    for (const requirement of gaps) {
      issues.push(
        issue(
          "error",
          requirement.code === "media" ? "asset" : "ready",
          `${question.id} is ready but ${requirement.detail}`,
        ),
      );
    }
    if (!isSupportedPresentation(question.presentation)) {
      issues.push(
        issue(
          "error",
          "presentation",
          `${question.id} uses presentation ${question.presentation}, which is not registered.`,
        ),
      );
    }
  } else {
    for (const requirement of gaps) {
      issues.push(
        issue(
          "incomplete",
          "incomplete",
          `${question.id} still needs ${requirement.detail}`,
        ),
      );
    }
    if (!isSupportedPresentation(question.presentation)) {
      issues.push(
        issue(
          "error",
          "presentation",
          `${question.id} uses presentation ${question.presentation}, which is not registered.`,
        ),
      );
    }
  }
  if (question.status === "ready") {
    const playable = toPlayable(question, false);
    if (playable) {
      issues.push(
        ...validatePlayableQuestions([playable], profile).filter(
          (item) => item.code !== "pack",
        ),
      );
    }
  }
  return issues;
}

function suppliedIssues(
  question: AuthoredQuestion,
  profile: PackProfile,
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  if (!contentLimits.questionId.test(question.id)) {
    issues.push(
      issue(
        "error",
        "id",
        `Question id ${question.id} must be a short lowercase slug.`,
      ),
    );
  }
  if (!question.title.trim() || question.title.length > contentLimits.titleMax) {
    issues.push(
      issue(
        "error",
        "title",
        `${question.id} needs a working title of 1 to 80 characters.`,
      ),
    );
  }
  if (question.prompt.length > contentLimits.promptMax) {
    issues.push(
      issue("error", "prompt", `${question.id} prompt is longer than 200 characters.`),
    );
  }
  if (question.prompt.includes(demoAnswerKeyMarker)) {
    issues.push(
      issue("error", "label", `${question.id} must not carry the answer-key marker.`),
    );
  }
  if (
    profile === "illustrative" &&
    question.prompt.trim() &&
    !question.prompt.startsWith("Illustrative demo:")
  ) {
    issues.push(
      issue(
        "error",
        "label",
        `${question.id} must stay labelled as an illustrative demo until Humza supplies the party line.`,
      ),
    );
  }
  if (
    question.instructions &&
    question.instructions.length > contentLimits.instructionsMax
  ) {
    issues.push(
      issue(
        "error",
        "prompt",
        `${question.id} phone instructions are longer than 200 characters.`,
      ),
    );
  }
  if (question.notes && question.notes.length > contentLimits.notesMax) {
    issues.push(
      issue(
        "error",
        "notes",
        `${question.id} presenter notes are longer than 500 characters.`,
      ),
    );
  }
  if (
    question.explanation &&
    question.explanation.length > contentLimits.explanationMax
  ) {
    issues.push(
      issue(
        "error",
        "reveal",
        `${question.id} reveal explanation is longer than 400 characters.`,
      ),
    );
  }
  if (
    !contentLimits.questionId.test(question.presentation) &&
    question.presentation !== ""
  ) {
    issues.push(
      issue(
        "error",
        "presentation",
        `${question.id} presentation id is not a short slug.`,
      ),
    );
  }
  issues.push(...windowIssue(question.id, "collection", question.collectMs));
  if (
    !Number.isInteger(question.points) ||
    question.points < contentLimits.pointsMin ||
    question.points > contentLimits.pointsMax
  ) {
    issues.push(
      issue(
        "error",
        "score",
        `${question.id} points must be a whole number from 0 to 1000.`,
      ),
    );
  }
  return issues;
}

function knownAnswerIssues(question: AuthoredQuestion): ContentIssue[] {
  if (question.kind === "choice" && isKnown(question.correctOption)) {
    const ids = new Set(question.options.map((option) => option.id));
    if (question.options.length > 0 && !ids.has(question.correctOption.known)) {
      return [
        issue("error", "choice", `${question.id} correct option is not in the list.`),
      ];
    }
  }
  return [];
}

function validatePlayableQuestions(
  questions: readonly Question[],
  profile: PackProfile,
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const seen = new Set<string>();
  for (const question of questions) {
    if (seen.has(question.id)) {
      issues.push(issue("error", "id", `Question id ${question.id} is repeated.`));
    }
    seen.add(question.id);
    if (!contentLimits.questionId.test(question.id)) {
      issues.push(
        issue(
          "error",
          "id",
          `Question id ${question.id} must be a short lowercase slug.`,
        ),
      );
    }
    if (
      profile === "illustrative" &&
      !question.prompt.startsWith("Illustrative demo:")
    ) {
      issues.push(
        issue(
          "error",
          "label",
          `${question.id} must stay labelled as an illustrative demo until Humza supplies the party line.`,
        ),
      );
    }
    if (question.prompt.length > contentLimits.promptMax) {
      issues.push(
        issue(
          "error",
          "prompt",
          `${question.id} prompt is longer than 200 characters.`,
        ),
      );
    }
    issues.push(...windowIssue(question.id, "collection", question.collectMs));
    if (
      !Number.isInteger(question.points) ||
      question.points < contentLimits.pointsMin ||
      question.points > contentLimits.pointsMax
    ) {
      issues.push(
        issue(
          "error",
          "score",
          `${question.id} points must be a whole number from 0 to 1000.`,
        ),
      );
    }
    if (!isSupportedPresentation(question.presentation)) {
      issues.push(
        issue(
          "error",
          "presentation",
          `${question.id} uses presentation ${question.presentation}, which is not registered.`,
        ),
      );
    }
    issues.push(...checkPlayable(question));
  }
  return issues;
}

function illustrativeCoverage(questions: readonly Question[]): ContentIssue[] {
  const issues: ContentIssue[] = [];
  if (!questions.some((question) => question.attribution === "live")) {
    issues.push(
      issue(
        "error",
        "attribution",
        "Live typing needs one question whose attribution is live.",
      ),
    );
  }
  if (
    !questions.some(
      (question) =>
        question.kind === "choice" && question.modifiers?.includes("double"),
    )
  ) {
    issues.push(
      issue(
        "error",
        "troll",
        "Double or nothing needs one choice that lists that modifier.",
      ),
    );
  }
  const kinds = new Set(questions.map((question) => question.kind));
  for (const kind of questionKinds) {
    if (!kinds.has(kind)) {
      issues.push(issue("error", "pack", `The demo pack is missing a ${kind} round.`));
    }
  }
  return issues;
}

function checkPlayable(question: Question): ContentIssue[] {
  if (question.kind === "choice") {
    const ids = new Set(question.options.map((option) => option.id));
    if (
      ids.size !== question.options.length ||
      question.options.length < contentLimits.optionMin ||
      question.options.length > contentLimits.optionMax
    ) {
      return [issue("error", "choice", `${question.id} needs distinct options.`)];
    }
    for (const option of question.options) {
      if (
        !contentLimits.optionId.test(option.id) ||
        option.label.length < 1 ||
        option.label.length > contentLimits.labelMax
      ) {
        return [
          issue(
            "error",
            "choice",
            `${question.id} has an option id or label outside the limit.`,
          ),
        ];
      }
    }
    if (!ids.has(question.correctOptionId)) {
      return [
        issue("error", "choice", `${question.id} correct option is not in the list.`),
      ];
    }
    if (question.speedBonus && question.speedBonus.maxPoints < 0) {
      return [
        issue("error", "score", `${question.id} speed bonus cannot be negative.`),
      ];
    }
    return [];
  }
  if (question.kind === "slider") {
    if (
      question.minimum >= question.maximum ||
      question.step <= 0 ||
      !question.unit.trim()
    ) {
      return [issue("error", "slider", `${question.id} scale is not usable.`)];
    }
    if (question.truth < question.minimum || question.truth > question.maximum) {
      return [issue("error", "slider", `${question.id} truth sits outside the scale.`)];
    }
    return [];
  }
  if (question.kind === "rank") {
    const items = new Set(question.items.map((item) => item.id));
    const tiers = new Set(question.tiers.map((tier) => tier.id));
    const placed = question.truth.flatMap((group) => group.itemIds);
    if (question.mode === "complete" && placed.length !== items.size) {
      return [issue("error", "rank", `${question.id} does not place every item once.`)];
    }
    if (question.truth.some((group) => !tiers.has(group.tierId))) {
      return [
        issue(
          "error",
          "rank",
          `${question.id} uses a tier that is not on the question.`,
        ),
      ];
    }
    return [];
  }
  if (question.kind === "vote") {
    return windowIssue(question.id, "vote", question.voteMs);
  }
  if (question.kind === "guess") {
    if (question.roster === "shortlist" && question.shortlist.length === 0) {
      return [issue("error", "guess", `${question.id} shortlist is empty.`)];
    }
    return [];
  }
  if (question.kind === "finale") {
    if (question.contestants.length !== 2) {
      return [
        issue("error", "finale", `${question.id} needs two fixture contestants.`),
      ];
    }
    const window = windowIssue(question.id, "prediction", question.predictMs);
    if (window.length > 0) {
      return window;
    }
  }
  if (question.target < question.minimum || question.target > question.maximum) {
    return [issue("error", "duel", `${question.id} target sits outside the scale.`)];
  }
  return [];
}

function windowIssue(id: string, label: string, ms: number): ContentIssue[] {
  if (
    !Number.isInteger(ms) ||
    ms < contentLimits.collectMinMs ||
    ms > contentLimits.collectMaxMs
  ) {
    return [issue("error", "duration", `${id} ${label} must be 15 to 45 seconds.`)];
  }
  return [];
}

function issue(
  level: ContentIssue["level"],
  code: string,
  message: string,
): ContentIssue {
  return { level, code, message };
}

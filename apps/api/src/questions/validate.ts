import { assertPushOutcome, pushBailOptionId } from "./push-luck.ts";
import { contentLimits, questionOptionImageSchema } from "@26/shared";
import { implementedTrollKinds } from "../troll/catalogue.ts";
import { toPlayable } from "./authoring.ts";
import {
  demoAnswerKeyMarker,
  isKnown,
  missingRequirements,
  type AuthoredQuestion,
  type ChoiceOutcome,
  type PackProfile,
  type Question,
  type QuestionPack,
} from "./definition.ts";
import { isSupportedPresentation } from "./presentation.ts";

/** Effects named in the plan that this build still rejects. */
/**
 * Troll ideas that are not built and must not be selectable. Every former
 * candidate is now implemented (see apps/api/src/troll/README.md), so this is
 * empty. Add a name here to park an idea; the preflight fails if it becomes
 * selectable before it is removed from this list.
 */
export const unsupportedEffects: readonly string[] = [];

export const illustrativeStingAsset = "apps/web/public/assets/theme-song.mp3";

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
      issue("error", "pack", "A running order can contain at most 80 questions."),
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
  if (question.kind === "choice") {
    for (const option of question.options)
      if (
        option.image !== undefined &&
        !questionOptionImageSchema.safeParse(option.image).success
      )
        issues.push(
          issue(
            "error",
            "asset",
            `${question.id} has an invalid option image for ${option.id}. Use a local question PNG.`,
          ),
        );
  }
  if (
    question.kind === "kart" &&
    (!validKart(question) || question.attribution !== "live")
  )
    issues.push(
      issue(
        "error",
        "kart",
        `${question.id} needs the supported track, matching race window and live participant names.`,
      ),
    );
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
  issues.push(
    ...windowIssue(
      question.id,
      "collection",
      question.collectMs,
      question.kind === "wordle" || question.kind === "kart"
        ? 180_000
        : contentLimits.collectMaxMs,
    ),
  );
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
  if (question.kind === "wordle") {
    const answer = isKnown(question.answer) ? question.answer.known : null;
    return answer === null || /^[A-Z]{5}$/.test(answer)
      ? []
      : [issue("error", "wordle", `${question.id} needs five uppercase letters.`)];
  }
  if (question.kind === "typed") {
    return typedIssues(
      question.id,
      question.maxLength,
      isKnown(question.accepted) ? question.accepted.known : [],
    );
  }
  if (question.kind !== "choice") {
    return [];
  }
  const outcome = outcomeIssues(question);
  if (outcome.length > 0) {
    return outcome;
  }
  if (isKnown(question.correctOption) && question.correctOption.known !== null) {
    const ids = new Set(question.options.map((option) => option.id));
    if (question.options.length > 0 && !ids.has(question.correctOption.known)) {
      return [
        issue("error", "choice", `${question.id} correct option is not in the list.`),
      ];
    }
  }
  return [];
}

/**
 * A poll scores 0 and has no speed bonus. A threshold names options on the
 * question, and its share sits strictly between 0 and 1.
 */
function outcomeIssues(question: {
  id: string;
  outcome: ChoiceOutcome;
  options: { id: string }[];
  points: number;
  speedBonus: { maxPoints: number } | null;
  collectMs?: number;
}): ContentIssue[] {
  const outcome = question.outcome;
  if (outcome.kind === "correct") {
    return [];
  }
  if (question.speedBonus) {
    return [
      issue(
        "error",
        "choice",
        `${question.id} ${outcome.kind} cannot have a speed bonus.`,
      ),
    ];
  }
  if (outcome.kind === "poll") {
    return question.points === 0
      ? []
      : [issue("error", "score", `${question.id} is a poll, so its points must be 0.`)];
  }
  const ids = new Set(question.options.map((option) => option.id));
  if (outcome.kind === "multiple")
    return outcome.optionIds.length > 0 &&
      outcome.optionIds.length <= 6 &&
      new Set(outcome.optionIds).size === outcome.optionIds.length &&
      outcome.optionIds.every((id) => ids.has(id))
      ? []
      : [
          issue(
            "error",
            "choice",
            `${question.id} needs a unique non-empty answer set from its options.`,
          ),
        ];
  if (outcome.kind === "push") {
    if (!ids.has(pushBailOptionId)) {
      return [
        issue(
          "error",
          "choice",
          `${question.id} push-your-luck needs a "bail" option.`,
        ),
      ];
    }
    try {
      assertPushOutcome(outcome, question.collectMs ?? 0);
    } catch (error) {
      return [
        issue(
          "error",
          "choice",
          `${question.id}: ${error instanceof Error ? error.message : "invalid push-your-luck round"}`,
        ),
      ];
    }
    return [];
  }
  const named = [
    outcome.optionId,
    ...(outcome.met === "everyone" ? [] : outcome.met),
    ...(outcome.otherwise === "everyone" ? [] : outcome.otherwise),
  ];
  if (question.options.length > 0 && named.some((id) => !ids.has(id))) {
    return [
      issue(
        "error",
        "choice",
        `${question.id} threshold names an option that is not in the list.`,
      ),
    ];
  }
  if (!Number.isFinite(outcome.above) || outcome.above <= 0 || outcome.above >= 1) {
    return [
      issue(
        "error",
        "choice",
        `${question.id} threshold share must be between 0 and 1.`,
      ),
    ];
  }
  return [];
}

function typedIssues(
  id: string,
  maxLength: number,
  accepted: readonly string[],
): ContentIssue[] {
  if (
    !Number.isInteger(maxLength) ||
    maxLength < 1 ||
    maxLength > contentLimits.typedMax
  ) {
    return [issue("error", "typed", `${id} answer box must hold 1 to 80 characters.`)];
  }
  if (accepted.some((answer) => answer.trim().length > contentLimits.typedMax)) {
    return [
      issue("error", "typed", `${id} accepted answer is longer than 80 characters.`),
    ];
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
    issues.push(
      ...windowIssue(
        question.id,
        "collection",
        question.collectMs,
        question.kind === "wordle" || question.kind === "kart"
          ? 180_000
          : contentLimits.collectMaxMs,
      ),
    );
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
  if (question.kind === "kart")
    return validKart(question)
      ? []
      : [
          issue(
            "error",
            "kart",
            `${question.id} has an unsupported race configuration.`,
          ),
        ];
  if (question.kind === "choice") {
    const ids = new Set(question.options.map((option) => option.id));
    if (
      ids.size !== question.options.length ||
      question.options.length < contentLimits.optionMin ||
      question.options.length >
        (question.outcome.kind === "poll"
          ? contentLimits.pollOptionMax
          : contentLimits.optionMax)
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
    const outcome = outcomeIssues(question);
    if (outcome.length > 0) {
      return outcome;
    }
    if (
      question.outcome.kind === "correct" &&
      (question.correctOptionId === null || !ids.has(question.correctOptionId))
    ) {
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
    if (question.scoring === "consensus" && question.truth !== null)
      return [
        issue(
          "error",
          "slider",
          `${question.id} consensus must not carry a fixed personal target.`,
        ),
      ];
    if (question.input === "number" && question.scoring !== "under")
      return [
        issue(
          "error",
          "slider",
          `${question.id} numeric price entry needs its closest-under rule.`,
        ),
      ];
    if (
      question.scoring !== "consensus" &&
      (question.truth === null ||
        question.truth < question.minimum ||
        question.truth > question.maximum)
    ) {
      return [issue("error", "slider", `${question.id} truth sits outside the scale.`)];
    }
    return [];
  }
  if (question.kind === "rank") {
    const items = new Set(question.items.map((item) => item.id));
    const tiers = new Set(question.tiers.map((tier) => tier.id));
    if (
      items.size !== question.items.length ||
      tiers.size !== question.tiers.length ||
      items.size < 2 ||
      items.size > 8 ||
      tiers.size < 2 ||
      tiers.size > 8 ||
      [...question.items, ...question.tiers].some(
        (item) =>
          !contentLimits.optionId.test(item.id) ||
          !item.label.trim() ||
          item.label.length > contentLimits.labelMax,
      )
    )
      return [
        issue("error", "rank", `${question.id} needs distinct valid items and tiers.`),
      ];
    if (
      question.input === "ordered" &&
      (question.mode !== "complete" ||
        question.ties !== "forbidden" ||
        items.size !== tiers.size)
    )
      return [
        issue(
          "error",
          "rank",
          `${question.id} ordered input needs one distinct position per item.`,
        ),
      ];
    if (question.scoring === "consensus")
      return question.truth.length
        ? [
            issue(
              "error",
              "rank",
              `${question.id} consensus must not carry a fixed personal target.`,
            ),
          ]
        : [];
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
  if (question.kind === "wordle") {
    const answer = question.answer;
    return answer === null || /^[A-Z]{5}$/.test(answer)
      ? []
      : [issue("error", "wordle", `${question.id} needs five uppercase letters.`)];
  }
  if (question.kind === "typed") {
    if (
      question.scoring !== "commonness" &&
      question.accepted.every((answer) => !answer.trim())
    ) {
      return [issue("error", "typed", `${question.id} has no accepted answer.`)];
    }
    return typedIssues(question.id, question.maxLength, question.accepted);
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
  if (question.kind === "chess") {
    // Chess questions have no additional validation
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

function windowIssue(
  id: string,
  label: string,
  ms: number,
  maximum: number = contentLimits.collectMaxMs,
): ContentIssue[] {
  if (!Number.isInteger(ms) || ms < contentLimits.collectMinMs || ms > maximum) {
    return [
      issue(
        "error",
        "duration",
        `${id} ${label} must be 15 to ${maximum / 1000} seconds.`,
      ),
    ];
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

function validKart(q: { trackId: string; timeLimitMs: number; collectMs: number }) {
  const limit =
    q.trackId === "party-ring-v1"
      ? 45000
      : q.trackId === "mario-circuit-v1" || q.trackId === "26-park-v1"
        ? 180000
        : 0;
  return limit > 0 && q.timeLimitMs === limit && q.collectMs === limit;
}

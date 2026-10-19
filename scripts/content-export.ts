import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Question } from "../apps/api/src/questions/definition.ts";
import {
  playableQuestions,
  questionPacks,
} from "../apps/api/src/questions/registry.ts";
import { validatePack } from "../apps/api/src/questions/validate.ts";
import { implementedTrollKinds } from "../apps/api/src/troll/catalogue.ts";

const selected = process.argv[2];
const packs = selected
  ? questionPacks.filter((pack) => pack.packId === selected)
  : [...questionPacks];
if (packs.length === 0) {
  console.error(`Unknown pack "${selected}". Use demo or birthday.`);
  process.exit(1);
}
for (const pack of packs) {
  const errors = validatePack(pack).filter((item) => item.level === "error");
  if (errors.length > 0) {
    for (const item of errors) {
      console.error(`${pack.packId} ${item.code}: ${item.message}`);
    }
    process.exit(1);
  }
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, "docs/content");
mkdirSync(directory, { recursive: true });

const demo = packs.find((pack) => pack.packId === "demo");
if (demo) {
  const demoQuestions = playableQuestions(demo);
  const banner = [
    "Illustrative fixture pack.",
    `Question set \`${demo.version}\`.`,
    "These lines are not Humza's party questions and they are not facts about guests.",
    "Fixture names such as Amina and Bilal exist so the demo can score a round.",
    "",
  ].join("\n");
  writeFileSync(
    path.join(directory, "illustrative-answer-key.md"),
    `${banner}# Offline answer key\n\n${demoQuestions.map(answerBlock).join("\n")}`,
  );
  writeFileSync(
    path.join(directory, "illustrative-running-order.md"),
    `${banner}# Presenter running order\n\nSelected trolls in this build: ${implementedTrollKinds.join(", ")}.\n\n${demoQuestions.map(orderBlock).join("\n")}`,
  );
  console.log("Wrote docs/content/illustrative-answer-key.md");
  console.log("Wrote docs/content/illustrative-running-order.md");
}

const birthday = packs.find((pack) => pack.packId === "birthday");
if (birthday) {
  const playable = playableQuestions(birthday);
  const banner = [
    "Birthday catalogue.",
    `Question set \`${birthday.version}\`.`,
    "This version is not pinned to a room.",
    "Drafts stay out of the running order until they are ready and explicitly included.",
    "",
  ].join("\n");
  const answerBody =
    playable.length === 0
      ? "The birthday catalogue has no playable questions.\n"
      : playable.map(answerBlock).join("\n");
  const orderBody =
    playable.length === 0
      ? "The birthday catalogue has no playable questions.\n"
      : playable.map(orderBlock).join("\n");
  writeFileSync(
    path.join(directory, "birthday-answer-key.md"),
    `${banner}# Offline answer key\n\n${answerBody}`,
  );
  writeFileSync(
    path.join(directory, "birthday-running-order.md"),
    `${banner}# Presenter running order\n\n${orderBody}`,
  );
  console.log("Wrote docs/content/birthday-answer-key.md");
  console.log("Wrote docs/content/birthday-running-order.md");
}

function answerBlock(question: Question, index: number): string {
  return [
    `## ${index + 1}. ${question.id}`,
    "",
    question.prompt,
    "",
    `Reveal: ${revealLine(question)}`,
    "",
  ].join("\n");
}

function orderBlock(question: Question, index: number): string {
  const extra =
    question.kind === "vote"
      ? `, then ${question.voteMs / 1000}s to vote`
      : question.kind === "finale"
        ? `, then ${question.predictMs / 1000}s to predict`
        : "";
  return [
    `## ${index + 1}. ${question.kind} · ${question.id}`,
    "",
    question.prompt,
    "",
    `${question.collectMs / 1000}s to answer${extra}. Attribution: ${question.attribution}.`,
    `Say at the reveal: ${revealLine(question)}`,
    "",
  ].join("\n");
}

function revealLine(question: Question): string {
  if (question.kind === "choice") {
    const outcome = question.outcome;
    if (outcome.kind === "poll") {
      return "No right answer. Read out the room's split.";
    }
    if (outcome.kind === "threshold") {
      const label = (id: string) =>
        question.options.find((option) => option.id === id)?.label ?? id;
      const who = (side: "everyone" | readonly string[]) =>
        side === "everyone" ? "everyone who answered" : side.map(label).join(", ");
      return `If more than ${Math.round(outcome.above * 100)}% pick ${label(outcome.optionId)}, ${who(outcome.met)} scores. Otherwise ${who(outcome.otherwise)} scores.`;
    }
    return (
      question.options.find((option) => option.id === question.correctOptionId)
        ?.label ??
      question.correctOptionId ??
      ""
    );
  }
  if (question.kind === "wordle") {
    return `${question.answer} (six guesses, ${question.collectMs / 1000} seconds; ${question.points} points for solving)`;
  }
  if (question.kind === "typed") {
    return `${question.accepted.join(" / ")} (close spellings count)`;
  }
  if (question.kind === "slider") {
    return `${question.truth} ${question.unit}`;
  }
  if (question.kind === "rank") {
    return question.truth
      .map((group) => {
        const tier = question.tiers.find((item) => item.id === group.tierId)?.label;
        const names = group.itemIds
          .map((id) => question.items.find((item) => item.id === id)?.label ?? id)
          .join(", ");
        return `${tier} ${names}`;
      })
      .join("; ");
  }
  if (question.kind === "vote") {
    return "No fixed answer. The room's votes decide it.";
  }
  if (question.kind === "guess") {
    return question.truthNickname
      ? `Fixture name ${question.truthNickname}. Replace this when the party question exists.`
      : "The named person is set on the question.";
  }
  if (question.kind === "finale") {
    return `Target ${question.target}. Fixture contestants ${question.contestants.join(" and ")}.`;
  }
  return `Closer to ${question.target}.`;
}

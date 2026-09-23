import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { demoQuestionSetVersion } from "../apps/api/src/room/limits.ts";
import {
  demoQuestions,
  type DemoQuestion,
} from "../apps/api/src/questions/demo-set.ts";
import { implementedTrollKinds } from "../apps/api/src/troll/catalogue.ts";
import { preflightContent } from "../apps/api/src/questions/preflight.ts";

const issues = preflightContent({ questions: demoQuestions, missingAssets: [] });
if (issues.length > 0) {
  for (const item of issues) {
    console.error(`${item.code}: ${item.message}`);
  }
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, "docs/content");
mkdirSync(directory, { recursive: true });

const banner = [
  "Illustrative fixture pack.",
  `Question set \`${demoQuestionSetVersion}\`.`,
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

function answerBlock(question: DemoQuestion, index: number): string {
  return [
    `## ${index + 1}. ${question.id}`,
    "",
    question.prompt,
    "",
    `Reveal: ${revealLine(question)}`,
    "",
  ].join("\n");
}

function orderBlock(question: DemoQuestion, index: number): string {
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

function revealLine(question: DemoQuestion): string {
  if (question.kind === "choice") {
    return (
      question.options.find((option) => option.id === question.correctOptionId)
        ?.label ?? question.correctOptionId
    );
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

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chessPiecePoints, chessRoundScore } from "@26/shared";
import type { Question } from "../apps/api/src/questions/definition.ts";
import {
  playableQuestions,
  questionPacks,
} from "../apps/api/src/questions/registry.ts";
import { validatePack } from "../apps/api/src/questions/validate.ts";
import { implementedTrollKinds } from "../apps/api/src/troll/catalogue.ts";

function exportContent(selected: string | undefined): void {
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
}

export function answerBlock(question: Question, index: number): string {
  return [
    `## ${index + 1}. ${question.id}`,
    "",
    question.prompt,
    "",
    `Reveal: ${revealLine(question)}`,
    "",
  ].join("\n");
}

export function orderBlock(question: Question, index: number): string {
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
  switch (question.kind) {
    case "choice": {
      const label = (id: string) =>
        question.options.find((option) => option.id === id)?.label ?? id;
      const outcome = question.outcome;
      switch (outcome.kind) {
        case "poll":
          return "No right answer. Read out the room's split.";
        case "threshold": {
          const who = (side: "everyone" | readonly string[]) =>
            side === "everyone" ? "everyone who answered" : side.map(label).join(", ");
          return `If more than ${Math.round(outcome.above * 100)}% pick ${label(outcome.optionId)}, ${who(outcome.met)} scores. Otherwise ${who(outcome.otherwise)} scores.`;
        }
        case "multiple":
          return outcome.scoring === "partial"
            ? `Correct answers are ${outcome.optionIds.map(label).join(", ")}. Partial credit applies: each right pick adds a share, and each wrong pick subtracts a share (minimum 0).`
            : `Correct answers are ${outcome.optionIds.map(label).join(", ")}. Only that exact set earns points.`;
        case "push":
          return `Players who bailed before the Raid keep their banked points. Players caught by the Raid score zero. If there was no Raid, players still in bank keep ${outcome.banks.at(-1) ?? 0} points.`;
        case "correct":
          if (question.correctOptionId === null) {
            throw new Error(`Missing correct option for ${question.id}`);
          }
          return label(question.correctOptionId);
        default:
          throw new Error(
            `Unsupported choice outcome for ${question.id}: ${JSON.stringify(outcome satisfies never)}`,
          );
      }
    }
    case "map-guess":
      return question.target.label;
    case "wordle":
      return `${question.answer} (six guesses, ${question.collectMs / 1000} seconds; ${question.points} points for solving)`;
    case "typed":
      if (question.scoring === "commonness") {
        return (
          question.explanation ??
          "Reveal the matching groups. The most common answer wins."
        );
      }
      return question.accepted.length > 0
        ? `${question.accepted.join(" / ")} (close spellings count)`
        : (question.explanation ?? "Reveal the accepted answers.");
    case "slider":
      return question.scoring === "consensus" || question.truth === null
        ? "Reveal the room's median. The closer a guess is to the median, the more it scores."
        : `${question.truth} ${question.unit}`;
    case "rank":
      if (question.scoring === "consensus") {
        return question.explanation ?? "Reveal the room's ranking.";
      }
      return question.truth
        .map((group) => {
          const tier =
            question.tiers.find((item) => item.id === group.tierId)?.label ??
            group.tierId;
          const names = group.itemIds
            .map((id) => question.items.find((item) => item.id === id)?.label ?? id)
            .join(", ");
          return `${tier} ${names}`;
        })
        .join("; ");
    case "vote":
      return question.explanation ?? "Reveal the outcome of the room's vote.";
    case "guess":
      if (question.scoring === "majority") {
        if (question.award === "nominees") {
          return "Reveal who got the most votes. Each most-voted player receives the full points; tied winners are not split.";
        }
        const bonus =
          question.selfVoteBonus === "double"
            ? " A winning self-vote scores double."
            : "";
        return `Reveal who got the most votes. Guests who picked them score.${bonus}`;
      }
      return question.truthNickname ?? "Reveal the room's picks.";
    case "finale":
      return `Target ${question.target}. Fixture contestants ${question.contestants.join(" and ")}.`;
    case "duel":
      return `Closer to ${question.target}.`;
    case "chess": {
      const { q, r, b, n, p } = chessPiecePoints;
      const mate = chessRoundScore({
        capturedPoints: 0,
        status: "checkmate",
        winner: "player",
      });
      const time = chessRoundScore({
        capturedPoints: 0,
        status: "timeout",
        winner: "player",
      });
      return `Capturing Black pieces scores ${q} for a queen, ${r} for a rook, ${b} for a bishop, ${n} for a knight and ${p} for a pawn. Checkmating the bot earns at least ${mate} points. Winning on time adds ${time} points to captures. Other results score captures only.`;
    }
    case "kart":
      return (
        question.explanation ??
        "The fastest finish wins. Tied finish times share a place. Anyone who did not finish scores zero."
      );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  exportContent(process.argv[2]);
}

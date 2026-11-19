import assert from "node:assert/strict";
import { test } from "node:test";
import { birthdayPack } from "../apps/api/src/questions/packs/birthday/manifest.ts";
import { playableQuestions } from "../apps/api/src/questions/registry.ts";
import { answerBlock, orderBlock } from "./content-export.ts";

const questions = playableQuestions(birthdayPack);

test("every birthday question has a reveal in both exports", () => {
  assert.equal(questions.length, birthdayPack.order.length);
  for (const [index, question] of questions.entries()) {
    for (const block of [answerBlock(question, index), orderBlock(question, index)]) {
      assert.doesNotMatch(block, /\b(?:undefined|null)\b/, question.id);
      assert.match(block, /^(?:Reveal|Say at the reveal): \S.*$/m, question.id);
    }
  }
});

test("birthday reveals explain exact sets, the room median and minigame scoring", () => {
  const blocks = new Map(
    questions.map((question, index) => [question.id, orderBlock(question, index)]),
  );
  assert.match(
    blocks.get("christianity-branches") ?? "",
    /Correct answers are Muggletonians, The Jumpers, Ranters\./,
  );
  assert.match(
    blocks.get("trump-made-up-country") ?? "",
    /Correct answers are The United States of Israel, The Islamic Republic of Japan\./,
  );
  const runningOrder = [...blocks.values()].join("\n");
  assert.equal(runningOrder.match(/Reveal the room's median\./g)?.length, 3);
  assert.match(
    runningOrder,
    /Checkmating the bot earns at least 40 points\. Winning on time adds 15 points/,
  );
  assert.match(
    runningOrder,
    /Fastest completed lap wins\. Finishers share place on equal finish times/,
  );
  assert.match(
    runningOrder,
    /If there was no Raid, players still in bank keep \d+ points\./,
  );
  const where = questions.find((question) => question.id === "where-are-we");
  assert.equal(where?.kind, "map-guess");
  if (where?.kind === "map-guess") {
    assert.match(blocks.get("where-are-we") ?? "", new RegExp(where.target.label));
  }
  const ed = questions.find((question) => question.id === "ed-or-humza");
  assert.equal(ed?.kind, "rank");
  if (ed?.kind === "rank") {
    const edReveal = blocks.get("ed-or-humza") ?? "";
    for (const item of ed.items) {
      assert.match(edReveal, new RegExp(escapeRegExp(item.label)));
    }
    for (const tier of ed.tiers) {
      assert.match(edReveal, new RegExp(`\\b${escapeRegExp(tier.label)}\\b`));
    }
  }
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

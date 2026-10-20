import { expect, it } from "vitest";
import { pointsFor } from "../src/questions/multiple-choice.ts";
import { publicQuestionSchema } from "@26/shared";
import { birthdayPack } from "../src/questions/packs/birthday/manifest.ts";
import { missingRequirements } from "../src/questions/definition.ts";
import { toPlayable } from "../src/questions/authoring.ts";
import { validatePack } from "../src/questions/validate.ts";
import { questionPreview } from "../src/room/question-preview.ts";

const slugs = [
  "empathy",
  "freedom",
  "sleep",
  "salvation",
  "crying-ceo",
  "nihilism",
  "technology",
  "performance-review",
  "absolute-force",
  "grief-pipeline",
];
const proposals = ["B", "A", "B", "A", "B", "A", "B", "B", "A", "B"];

it.each(slugs)(
  "plays the sourced replacement %s round without leaking its answer in rehearsal",
  (slug) => {
    const q = birthdayPack.catalogue.find((q) => q.id === `who-said-it-${slug}`);
    if (q?.kind !== "choice") throw new Error("Choice draft required");
    expect(q.status).toBe("ready");
    expect(q.presentation).toBe("who-said-it");
    expect(q.options.map((o) => o.id)).toEqual(["a", "b"]);
    expect(q.notes).toContain("Verified replacement");
    expect(q.correctOption).toEqual({
      known: proposals[slugs.indexOf(slug)]!.toLowerCase(),
    });

    expect(missingRequirements(q)).toEqual([]);
    const playable = toPlayable(q);
    if (playable?.kind !== "choice") throw new Error("Ready choice");
    expect(
      pointsFor(playable, {
        optionId: proposals[slugs.indexOf(slug)]!.toLowerCase(),
        receivedAt: 1000,
        deadlineAt: 21000,
      }).points,
    ).toBe(100);
    expect(birthdayPack.order).not.toContain(q.id);
    const preview = questionPreview(birthdayPack, q);
    expect(preview.interactive).toBe(true);
    expect(preview.limitation).toBeNull();
    expect(publicQuestionSchema.safeParse(preview.question).success).toBe(true);
    expect(preview.question?.prompt).toBe(q.prompt);
    for (const field of [
      "notes",
      "correctOption",
      "correctOptionId",
      "explanation",
      "requirements",
    ])
      expect(preview.question).not.toHaveProperty(field);
    expect(JSON.stringify(preview)).not.toContain("Supplied answer:");
  },
);

it("uses sourced excerpts while retaining stable ids, question count and release isolation", () => {
  expect(
    birthdayPack.catalogue.find((q) => q.id === "who-said-it-crying-ceo")?.prompt,
  ).toContain("freedom and democracy");
  expect(
    birthdayPack.catalogue.find((q) => q.id === "who-said-it-grief-pipeline")?.prompt,
  ).toContain("extraordinary effort");
  expect(
    JSON.stringify(
      birthdayPack.catalogue.filter((q) => q.id.startsWith("who-said-it-")),
    ),
  ).not.toContain("I laid off 15%");
  expect(
    birthdayPack.catalogue.filter((q) => q.id.startsWith("who-said-it-")),
  ).toHaveLength(10);
  expect(validatePack(birthdayPack).filter((i) => i.level === "error")).toEqual([]);
  expect(birthdayPack.release).toBe("draft");
  expect(birthdayPack.order).toEqual([]);
});

import { expect, it } from "vitest";
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
  "preserves the proposed %s round as a sourced-answer draft with an honest rehearsal",
  (slug) => {
    const q = birthdayPack.catalogue.find((q) => q.id === `who-said-it-${slug}`);
    if (q?.kind !== "choice") throw new Error("Choice draft required");
    expect(q.status).toBe("draft");
    expect(q.presentation).toBe("who-said-it");
    expect(q.options.map((o) => o.id)).toEqual(["a", "b"]);
    expect(q.notes).toContain(`Supplied answer: ${proposals[slugs.indexOf(slug)]}.`);
    expect(q.correctOption).toHaveProperty("missing");
    expect(missingRequirements(q).some((r) => r.name === "quote-source")).toBe(true);
    expect(toPlayable(q)).toBeUndefined();
    expect(birthdayPack.order).not.toContain(q.id);
    const preview = questionPreview(birthdayPack, q);
    expect(preview.interactive).toBe(true);
    expect(preview.limitation).toContain("unverified");
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

it("preserves long quotes and user wording without enlarging shared prompt limits", () => {
  expect(
    birthdayPack.catalogue.find((q) => q.id === "who-said-it-crying-ceo")?.prompt,
  ).toBe(
    "I laid off 15% of our staff this morning. Sitting at my desk crying made me realize: leadership isn't about numbers, it's about feeling the pain of others and still executing.",
  );
  expect(
    birthdayPack.catalogue.find((q) => q.id === "who-said-it-grief-pipeline")?.prompt,
  ).toContain("Grief is temporary; pipeline momentum is permanent.");
  expect(
    birthdayPack.catalogue.filter((q) => q.id.startsWith("who-said-it-")),
  ).toHaveLength(10);
  expect(validatePack(birthdayPack).filter((i) => i.level === "error")).toEqual([]);
  expect(birthdayPack.release).toBe("draft");
  expect(birthdayPack.order).toEqual([]);
});

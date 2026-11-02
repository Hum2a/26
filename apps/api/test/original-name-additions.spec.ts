import { expect, it } from "vitest";
import { publicQuestionSchema } from "@26/shared";
import { toPlayable } from "../src/questions/authoring.ts";
import { birthdayPack } from "../src/questions/packs/birthday/manifest.ts";
import { realNameVinDiesel } from "../src/questions/packs/birthday/real-name-vin-diesel.ts";
import { realNameJamieFoxx } from "../src/questions/packs/birthday/real-name-jamie-foxx.ts";
import { checkTypedAnswer, pointsForTyped } from "../src/questions/typed.ts";
import { validatePack } from "../src/questions/validate.ts";
import { questionPreview } from "../src/room/question-preview.ts";

it.each([
  [
    realNameVinDiesel,
    [
      "Mark Sinclair",
      "Mark Sinclair Vincent",
      "Mark Vincent",
      "  MARK SINCLAIR!  ",
      "Mark Sincliar",
    ],
    ["Vin Diesel", "Mark", "Sinclair", "Dom Toretto"],
  ],
  [
    realNameJamieFoxx,
    ["Eric Marlon Bishop", "Eric Bishop", "ERICBISHOP", "Eric Marlin Bishop"],
    ["Jamie Foxx", "Eric", "Bishop", "Django"],
  ],
] as const)(
  "$0.id scores original names and rejects stage names or incomplete guesses",
  (authored, accepted, rejected) => {
    expect(authored.status).toBe("ready");
    expect(birthdayPack.catalogue.filter((q) => q.id === authored.id)).toEqual([
      authored,
    ]);
    const question = toPlayable(authored);
    if (question?.kind !== "typed") throw new Error("Ready typed question required");
    expect(question).toMatchObject({
      presentation: "redacted-file",
      points: 100,
      collectMs: 20_000,
      maxLength: 60,
    });
    for (const answer of accepted) {
      expect(checkTypedAnswer(question, answer).ok).toBe(true);
      expect(pointsForTyped(question, answer)).toEqual({
        points: 100,
        detail: "correct",
      });
    }
    for (const answer of rejected)
      expect(pointsForTyped(question, answer).points).toBe(0);
    expect(pointsForTyped(question, undefined)).toEqual({
      points: 0,
      detail: "missing",
    });
    expect(birthdayPack.order).toContain(authored.id);
  },
);

it.each([realNameVinDiesel, realNameJamieFoxx])(
  "$id rehearses without original names, private notes or future reveals",
  (authored) => {
    const preview = questionPreview(birthdayPack, authored);
    expect(preview.interactive).toBe(true);
    expect(publicQuestionSchema.safeParse(preview.question).success).toBe(true);
    for (const field of ["accepted", "notes", "explanation", "answer", "truth"])
      expect(preview.question).not.toHaveProperty(field);
    const payload = JSON.stringify(preview);
    for (const name of ["Sinclair", "Vincent", "Bishop", "Marlon", "Marlin"])
      expect(payload).not.toContain(name);
    expect(authored.instructions).toContain("Middle names are optional");
  },
);

it("keeps both additions ready in the unreleased birthday catalogue", () => {
  expect(birthdayPack.release).toBe("draft");
  expect(birthdayPack.order.at(-1)).toBe("kart-sprint");
  expect(validatePack(birthdayPack).filter((issue) => issue.level === "error")).toEqual(
    [],
  );
});

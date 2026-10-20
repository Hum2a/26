import { expect, it } from "vitest";
import { publicQuestionSchema } from "@26/shared";
import { toPlayable } from "../src/questions/authoring.ts";
import { inflationMealDeal } from "../src/questions/packs/birthday/inflation-meal-deal.ts";
import { inflationSausageRoll } from "../src/questions/packs/birthday/inflation-sausage-roll.ts";
import { inflationCheeseburger } from "../src/questions/packs/birthday/inflation-cheeseburger.ts";
import { birthdayPack } from "../src/questions/packs/birthday/manifest.ts";
import { checkEstimate, pointsForEstimate } from "../src/questions/slider.ts";
import { validatePack } from "../src/questions/validate.ts";
import { questionPreview } from "../src/room/question-preview.ts";

it.each([
  [inflationMealDeal, 385],
  [inflationSausageRoll, 135],
  [inflationCheeseburger, 139],
] as const)(
  "rehearses and scores the sourced $0.id without leaking its reveal",
  (authored, target) => {
    expect(authored.status).toBe("ready");
    expect(birthdayPack.catalogue.filter((q) => q.id === authored.id)).toEqual([
      authored,
    ]);
    const question = toPlayable(authored);
    if (question?.kind !== "slider") throw new Error("Ready slider required");
    expect(question.truth).toBe(target);
    expect(checkEstimate(question, target)).toEqual({ ok: true, value: target });
    expect(pointsForEstimate(question, target)).toEqual({
      points: 100,
      detail: "exact",
    });
    expect(pointsForEstimate(question, target + 1).points).toBe(0);
    expect(checkEstimate(question, question.maximum + 1).ok).toBe(false);
    expect(question.collectMs).toBe(20_000);
    const preview = questionPreview(birthdayPack, authored);
    expect(preview.interactive).toBe(true);
    expect(publicQuestionSchema.safeParse(preview.question).success).toBe(true);
    for (const field of ["truth", "bands", "notes", "explanation"])
      expect(preview.question).not.toHaveProperty(field);
    expect(birthdayPack.order).not.toContain(authored.id);
  },
);

it("defines which dated price guests should estimate, with source limitations", () => {
  expect(inflationMealDeal.instructions).toContain("£3 in 2012");
  expect(inflationMealDeal.instructions).toContain("WITH a Clubcard");
  expect(inflationMealDeal.instructions).toContain("20 October 2026");
  expect(inflationSausageRoll.instructions).toContain("reportedly 66p in 2012");
  expect(inflationSausageRoll.instructions).toContain("8 January 2026");
  expect(inflationCheeseburger.instructions).toContain("99p in 2012");
  expect(inflationCheeseburger.instructions).toContain("September 2026 menu-guide");
  expect(inflationCheeseburger.notes).toContain("independent fan guide");
  expect(birthdayPack.release).toBe("draft");
  expect(birthdayPack.order).toEqual([]);
  expect(validatePack(birthdayPack).filter((issue) => issue.level === "error")).toEqual(
    [],
  );
});

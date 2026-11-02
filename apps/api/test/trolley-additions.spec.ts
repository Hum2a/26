import { expect, it } from "vitest";
import { publicQuestionSchema } from "@26/shared";
import { toPlayable } from "../src/questions/authoring.ts";
import { birthdayPack } from "../src/questions/packs/birthday/manifest.ts";
import { trolleyYourMum } from "../src/questions/packs/birthday/trolley-your-mum.ts";
import { trolleyMamdaniAfrica } from "../src/questions/packs/birthday/trolley-mamdani-africa.ts";
import { trolleyFreddoMultiverse } from "../src/questions/packs/birthday/trolley-freddo-multiverse.ts";
import { choiceTally, settleChoice } from "../src/questions/choice-outcome.ts";
import { pointsFor } from "../src/questions/multiple-choice.ts";
import { validatePack } from "../src/questions/validate.ts";
import { questionPreview } from "../src/room/question-preview.ts";

it.each([trolleyYourMum, trolleyMamdaniAfrica, trolleyFreddoMultiverse])(
  "$id is a ready, unscored trolley poll with a safe phone rehearsal",
  (authored) => {
    expect(authored.status).toBe("ready");
    expect(birthdayPack.catalogue.filter((q) => q.id === authored.id)).toEqual([
      authored,
    ]);
    const question = toPlayable(authored);
    if (question?.kind !== "choice") throw new Error("Ready choice required");
    expect(question.presentation).toBe("trolley-lever");
    expect(question.correctOptionId).toBeNull();
    expect(question.collectMs).toBe(20_000);
    expect(question.speedBonus).toBeNull();
    expect(question.points).toBe(0);
    const answers = ["derail", "derail", "leave"];
    const settlement = settleChoice(question, answers);
    expect(settlement).toMatchObject({
      outcome: "poll",
      everyone: false,
      optionIds: [],
    });
    expect(choiceTally(question.options, answers)).toEqual([
      { optionId: "derail", count: 2 },
      { optionId: "leave", count: 1 },
    ]);
    for (const optionId of ["derail", "leave"])
      expect(
        pointsFor(
          question,
          { optionId, receivedAt: 1000, deadlineAt: 21000 },
          undefined,
          settlement,
        ),
      ).toEqual({ points: 0, detail: "poll" });
    const preview = questionPreview(birthdayPack, authored);
    expect(preview.interactive).toBe(true);
    expect(publicQuestionSchema.safeParse(preview.question).success).toBe(true);
    expect(preview.question).toMatchObject({
      outcome: "poll",
      options: authored.options,
    });
    for (const field of ["correctOption", "correctOptionId", "notes", "explanation"])
      expect(preview.question).not.toHaveProperty(field);
    expect(birthdayPack.order).toContain(authored.id);
  },
);

it("keeps the requested match-ups and explicit pull/leave consequences", () => {
  expect(trolleyYourMum.prompt).toContain("1,000 random people");
  expect(trolleyYourMum.prompt).toContain("your mum");
  expect(trolleyMamdaniAfrica.prompt).toContain("everyone in Africa");
  expect(trolleyMamdaniAfrica.prompt).toContain("Mayor Zohran Mamdani");
  expect(trolleyFreddoMultiverse.prompt).toContain("all life in every universe");
  expect(trolleyFreddoMultiverse.prompt).toContain("one Freddo");
  for (const q of [trolleyYourMum, trolleyMamdaniAfrica, trolleyFreddoMultiverse]) {
    expect(q.options[0]).toMatchObject({
      id: "derail",
      label: expect.stringMatching(/^Pull:/),
    });
    expect(q.options[1]).toMatchObject({
      id: "leave",
      label: expect.stringMatching(/^Leave:/),
    });
  }
  expect(birthdayPack.release).toBe("draft");
  expect(birthdayPack.order.at(-1)).toBe("kart-sprint");
  expect(validatePack(birthdayPack).filter((issue) => issue.level === "error")).toEqual(
    [],
  );
});

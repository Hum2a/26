import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { publicQuestionSchema, questionOptionImageSchema } from "@26/shared";
import { favouritePokemon } from "../src/questions/packs/birthday/favourite-pokemon.ts";
import { inflationFreddo } from "../src/questions/packs/birthday/inflation-freddo.ts";
import { inflationPetrol } from "../src/questions/packs/birthday/inflation-petrol.ts";
import { birthdayPack } from "../src/questions/packs/birthday/manifest.ts";
import { questionPreview } from "../src/room/question-preview.ts";
import {
  assertSliderQuestion,
  checkEstimate,
  pointsForEstimate,
} from "../src/questions/slider.ts";
import { toPlayable } from "../src/questions/authoring.ts";
import { validatePack } from "../src/questions/validate.ts";

it("maps each supplied picture to its own option, with four real PNG files", () => {
  expect(favouritePokemon.options.map(({ id, image }) => [id, image])).toEqual(
    ["turtwig", "mudkip", "tepig", "osama-bin-laden"].map((id) => [
      id,
      `/assets/questions/favourite-pokemon/${id}.png`,
    ]),
  );
  for (const option of favouritePokemon.options) {
    const file = fileURLToPath(
      new URL(`../../web/public${option.image}`, import.meta.url).href,
    );
    expect([...readFileSync(file).subarray(0, 8)]).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ]);
  }
  expect(favouritePokemon.correctOption).toEqual({ known: "mudkip" });
  const projected = questionPreview(birthdayPack, favouritePokemon);
  if (projected.question?.kind !== "choice") throw new Error("Choice preview required");
  expect(projected.question.options).toEqual(favouritePokemon.options);
  expect(projected.question).not.toHaveProperty("correctOption");
  expect(projected.question).not.toHaveProperty("notes");
  expect(publicQuestionSchema.safeParse(projected.question).success).toBe(true);
});

it("rejects non-local, non-PNG and traversal option-image URLs", () => {
  for (const image of [
    "https://example.com/image.png",
    "javascript:alert(1)",
    "data:image/png;base64,AAA",
    "/assets/questions/../secrets.png",
    "/assets/questions/picture.webp",
    "/assets/questions/picture.png?secret=1",
  ])
    expect(questionOptionImageSchema.safeParse(image).success).toBe(false);
  expect(
    validatePack({
      ...birthdayPack,
      catalogue: [
        {
          ...favouritePokemon,
          options: [
            { id: "a", label: "A", image: "https://example.com/a.png" },
            { id: "b", label: "B" },
          ],
          correctOption: { known: "a" },
        },
      ],
    }).some((issue) => issue.code === "asset"),
  ).toBe(true);
});

it("makes dated inflation questions ready with reachable exact scoring answers", () => {
  for (const [authored, truth] of [
    [inflationFreddo, 35],
    [inflationPetrol, 175],
  ] as const) {
    expect(authored.status).toBe("ready");
    const question = toPlayable(authored);
    if (question?.kind !== "slider") throw new Error("Ready slider required");
    expect(() => assertSliderQuestion(question)).not.toThrow();
    expect(question.truth).toBe(truth);
    expect(question.points).toBe(100);
    expect(question.collectMs).toBe(20_000);
    expect(checkEstimate(question, truth)).toEqual({ ok: true, value: truth });
    expect(pointsForEstimate(question, truth)).toEqual({
      points: 100,
      detail: "exact",
    });
    expect(pointsForEstimate(question, truth + 1).points).toBe(0);
    const preview = questionPreview(birthdayPack, authored);
    expect(preview.interactive).toBe(true);
    expect(preview.question).not.toHaveProperty("truth");
    expect(preview.question).not.toHaveProperty("bands");
    expect(preview.question).not.toHaveProperty("explanation");
    expect(birthdayPack.order).toContain(authored.id);
  }
  expect(inflationFreddo.instructions).toContain("typically 20p in 2012");
  expect(inflationFreddo.instructions).toContain("Tesco on 20 October 2026");
  expect(inflationFreddo.notes).toContain("inferred");
  expect(inflationPetrol.instructions).toContain("15 October 2012");
  expect(inflationPetrol.instructions).toContain("138.35p");
  expect(inflationPetrol.instructions).toContain("12 October 2026");
  expect(inflationPetrol.instructions).toContain("rounded to the nearest penny");
  expect(inflationPetrol.explanation).toContain("175.28p");
  expect(birthdayPack.release).toBe("draft");
  expect(validatePack(birthdayPack).filter((issue) => issue.level === "error")).toEqual(
    [],
  );
});

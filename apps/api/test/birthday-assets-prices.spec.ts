import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { publicQuestionSchema, questionOptionImageSchema } from "@26/shared";
import { favouritePokemon } from "../src/questions/packs/birthday/favourite-pokemon.ts";
import { inflationFreddo } from "../src/questions/packs/birthday/inflation-freddo.ts";
import { inflationPetrol } from "../src/questions/packs/birthday/inflation-petrol.ts";
import { birthdayPack } from "../src/questions/packs/birthday/manifest.ts";
import { demoPack } from "../src/questions/packs/demo/manifest.ts";
import { packPublicAssets } from "../src/questions/pack-assets.ts";
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

it("has three sourced photo rounds, a complete Pokémon rehearsal and no retired catalogue entries", () => {
  const rooms = birthdayPack.catalogue.filter((q) => q.id.startsWith("accommodation-"));
  expect(rooms).toHaveLength(3);
  for (const q of rooms) {
    const playable = toPlayable(q);
    expect(playable).toBeDefined();
    const preview = questionPreview(birthdayPack, q);
    expect(preview.question?.image?.src).toBe(`/assets/questions/${q.id}/photo.jpg`);
    expect(preview.question?.image?.credit).toMatch(/CC BY/);
    expect(preview.question).not.toHaveProperty("correctOption");
  }
  const pokemon = birthdayPack.catalogue.find((q) => q.id === "whos-that-pokemon")!;
  expect(questionPreview(birthdayPack, pokemon)).toMatchObject({
    interactive: true,
    question: { kind: "choice", options: expect.any(Array) },
  });
  expect(toPlayable(pokemon)).toBeDefined();
  for (const q of birthdayPack.catalogue)
    expect(q.id).not.toMatch(
      /^(who-said-it-|subculture-|council-|trolley-your-mum$|trolley-mamdani-africa$|trolley-freddo-multiverse$|ai-turing-test$|tribunal-reddit$)/,
    );
});

const pngMagic = [137, 80, 78, 71, 13, 10, 26, 10];

function publicFile(asset: string) {
  return fileURLToPath(new URL(`../../web/public${asset}`, import.meta.url).href);
}

it("ships every picture a catalogue names, including demo cake and sky drawings", () => {
  for (const pack of [demoPack, birthdayPack]) {
    const assets = packPublicAssets(pack);
    expect(assets.length).toBeGreaterThan(0);
    for (const asset of assets) {
      const file = publicFile(asset);
      expect(existsSync(file), asset).toBe(true);
      expect(statSync(file).size, asset).toBeGreaterThan(100);
      const head = [...readFileSync(file).subarray(0, 8)];
      if (asset.endsWith(".png")) expect(head).toEqual(pngMagic);
      if (asset.endsWith(".jpg")) expect(head.slice(0, 2)).toEqual([0xff, 0xd8]);
    }
  }
  expect(packPublicAssets(birthdayPack)).toContain(
    "/assets/questions/whos-that-pokemon/silhouette.svg",
  );
  expect(packPublicAssets(birthdayPack)).not.toContain(undefined);
  const listing = birthdayPack.catalogue.find(
    (q) => q.id === "property-price-roulette",
  );
  expect(listing?.media?.[0]?.required).toBe(true);
  expect(listing?.media?.[0]?.asset).toBeUndefined();
  expect(packPublicAssets(birthdayPack)).not.toContain(
    "/assets/questions/property-price-roulette/photo.jpg",
  );
  for (const id of ["candles", "colour"] as const) {
    const preview = questionPreview(
      demoPack,
      demoPack.catalogue.find((q) => q.id === id)!,
    );
    expect(preview.question?.image?.src).toBe(`/assets/questions/${id}/photo.jpg`);
    expect(preview.question?.image?.credit).toMatch(/CC0/);
  }
  for (const asset of [
    "/assets/questions/whos-that-pokemon-preview/silhouette.png",
    "/assets/questions/whos-that-pokemon-preview/piplup.png",
  ]) {
    const file = publicFile(asset);
    expect(existsSync(file), asset).toBe(true);
    expect([...readFileSync(file).subarray(0, 8)]).toEqual(pngMagic);
  }
});

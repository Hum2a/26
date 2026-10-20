import { expect, it } from "vitest";
import { contentLimits } from "@26/shared";
import { birthdayPack } from "../src/questions/packs/birthday/manifest.ts";
import { missingRequirements } from "../src/questions/definition.ts";
import { toPlayable } from "../src/questions/authoring.ts";
import { pointsFor } from "../src/questions/multiple-choice.ts";
import { validatePack } from "../src/questions/validate.ts";
import { questionPreview } from "../src/room/question-preview.ts";

const ready = [
  "subculture-cheese-rollers",
  "subculture-gurners",
  "subculture-puddle-stompers",
  "subculture-ranters-muggletonians",
];
const incomplete = [
  "guess-tab-oyster",
  "guess-tab-car-insurance",
  "guess-tab-soho-pint",
  "guess-tab-ev-charge",
  "ai-turing-test",
  "heathrow-search-query",
  "rank-driving-sins",
  "dating-exit-excuse",
  "dial-pop-culture",
  "dial-london-geography",
  "dial-british-politics",
];
const byId = (id: string) => {
  const q = birthdayPack.catalogue.find((q) => q.id === id);
  if (!q) throw new Error(`Missing question: ${id}`);
  return q;
};

it.each(ready)("%s scores its supplied and sourced Real/Made up answer", (id) => {
  const authored = byId(id);
  expect(authored.status).toBe("ready");
  const q = toPlayable(authored);
  if (q?.kind !== "choice") throw new Error("Ready choice required");
  const correct = id === "subculture-puddle-stompers" ? "made-up" : "real";
  expect(q.correctOptionId).toBe(correct);
  expect(
    pointsFor(q, { optionId: correct, receivedAt: 1000, deadlineAt: 21000 }).points,
  ).toBe(100);
  expect(
    pointsFor(q, {
      optionId: correct === "real" ? "made-up" : "real",
      receivedAt: 1000,
      deadlineAt: 21000,
    }).points,
  ).toBe(0);
  expect(questionPreview(birthdayPack, authored).interactive).toBe(true);
});

it.each(incomplete)("%s retains its real gaps and cannot enter the live game", (id) => {
  const q = byId(id);
  expect(q.status).toBe("draft");
  expect(toPlayable(q)).toBeUndefined();
  expect(missingRequirements(q).length).toBeGreaterThan(0);
  const forced = { ...birthdayPack, order: [id] };
  expect(validatePack(forced).some((i) => i.code === "draft-in-order")).toBe(true);
  const preview = questionPreview(birthdayPack, q);
  if (id === "ai-turing-test") {
    expect(preview.interactive).toBe(true);
    expect(preview.limitation).toContain("example options");
    expect(preview.limitation).toContain("No genuine Humza");
  } else if (id.startsWith("guess-tab-")) {
    expect(preview.question).toBeNull();
    expect(preview.limitation).toContain("numeric scale");
  } else {
    expect(preview.interactive).toBe(false);
    expect(preview.limitation).toContain("not implemented");
  }
});

it("preserves the supplied 30-second scenario, driving list and dial endpoints without invented answers", () => {
  expect(byId("dating-exit-excuse").collectMs).toBe(30_000);
  expect(byId("dating-exit-excuse").instructions).toContain(
    "Most Smooth, Most Brutal and Instantly Causes a Scene",
  );
  const rank = byId("rank-driving-sins");
  if (rank.kind !== "rank") throw new Error("Rank draft required");
  expect(rank.items.map((i) => i.id)).toEqual([
    "middle-lane",
    "indicating",
    "high-beams",
    "charger",
  ]);
  expect(rank.truth).toHaveProperty("missing");
  for (const id of [
    "dial-pop-culture",
    "dial-london-geography",
    "dial-british-politics",
  ]) {
    const dial = byId(id);
    expect(dial).toMatchObject({ minimum: 0, maximum: 100, step: 1, initial: 50 });
    expect(dial.instructions).toMatch(/^0 = .*100 = /);
    if (dial.kind !== "slider") throw new Error("Slider draft required");
    expect(dial.truth).toHaveProperty("missing");
  }
});

it("rehearses a catalogue larger than 40 while retaining the 40-question live order limit", () => {
  expect(birthdayPack.catalogue.length).toBeGreaterThan(contentLimits.packMax);
  for (const q of birthdayPack.catalogue) {
    const preview = questionPreview(birthdayPack, q);
    if (preview.question) {
      expect(preview.question).toMatchObject({ id: q.id, index: 1, total: 1 });
      for (const field of [
        "notes",
        "truth",
        "correctOption",
        "correctOptionId",
        "accepted",
        "requirements",
        "explanation",
      ])
        expect(preview.question).not.toHaveProperty(field);
    } else expect(q.status).toBe("draft");
  }
  const ordered = { ...birthdayPack, order: ready.slice(0, 2) };
  expect(questionPreview(ordered, byId(ready[1]!)).question).toMatchObject({
    index: 2,
    total: 2,
  });
  const tooLong = {
    ...birthdayPack,
    order: Array.from({ length: 41 }, () => ready[0]!),
  };
  expect(validatePack(tooLong).some((i) => i.code === "pack")).toBe(true);
  expect(contentLimits.packMax).toBe(40);
  expect(
    birthdayPack.catalogue.filter((q) => q.id.startsWith("who-said-it-")).length,
  ).toBe(10);
  expect(validatePack(birthdayPack).filter((i) => i.level === "error")).toEqual([]);
  expect(birthdayPack.order).toEqual([]);
  expect(birthdayPack.release).toBe("draft");
});

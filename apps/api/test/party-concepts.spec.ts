import { expect, it } from "vitest";
import { contentLimits } from "@26/shared";
import { birthdayPack } from "../src/questions/packs/birthday/manifest.ts";
import { missingRequirements } from "../src/questions/definition.ts";
import {
  choiceQuestion,
  typedQuestion,
  voteQuestion,
  toPlayable,
} from "../src/questions/authoring.ts";
import { pointsFor } from "../src/questions/multiple-choice.ts";
import { validatePack } from "../src/questions/validate.ts";
import { questionPreview } from "../src/room/question-preview.ts";

const ready = [
  "subculture-cheese-rollers",
  "subculture-gurners",
  "subculture-puddle-stompers",
  "subculture-ranters-muggletonians",
];
const completed = [
  "guess-tab-oyster",
  "guess-tab-car-insurance",
  "guess-tab-soho-pint",
  "guess-tab-ev-charge",
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

it("keeps legacy placeholders disabled until their actual variant is configured", () => {
  const missing = (name: string) => ({
    code: "options" as const,
    name,
    detail: "The requested variant has not been configured.",
  });
  const drafts = [
    typedQuestion({
      id: "password-placeholder",
      title: "Placeholder",
      prompt: "Enter a made-up word",
      requirements: [missing("ranking-mechanic")],
    }),
    choiceQuestion({
      id: "multiple-placeholder",
      title: "Placeholder",
      prompt: "Choose",
      options: [
        { id: "one", label: "One" },
        { id: "two", label: "Two" },
      ],
      requirements: [missing("multiple-selection")],
    }),
    voteQuestion({
      id: "awards-placeholder",
      title: "Placeholder",
      prompt: "Write a line",
      requirements: [missing("multi-award-voting")],
    }),
  ];
  for (const q of drafts) {
    expect(questionPreview(birthdayPack, q).interactive).toBe(false);
    expect(questionPreview(birthdayPack, q).limitation).toContain("Draft layout only");
    expect(toPlayable(q)).toBeUndefined();
  }
});

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

it.each(completed)(
  "%s is playable, has no fabricated gaps and offers the real rehearsal",
  (id) => {
    const q = byId(id);
    expect(q.status).toBe("ready");
    expect(toPlayable(q)).toBeDefined();
    expect(missingRequirements(q)).toEqual([]);
    expect(
      validatePack({ ...birthdayPack, order: [id] }).filter((i) => i.level === "error"),
    ).toEqual([]);
    expect(questionPreview(birthdayPack, q).interactive).toBe(true);
    expect(questionPreview(birthdayPack, q).question).not.toBeNull();
  },
);

it("uses an actual earlier Humza message instead of treating an example as a personal belief", () => {
  const q = byId("ai-turing-test");
  expect(q.status).toBe("ready");
  expect(toPlayable(q)).toBeDefined();
  expect(q.notes).toContain("earlier message in this planning chat");
  if (q.kind !== "choice") throw new Error("Choice required");
  expect(q.correctOption).toEqual({ known: "own-identity" });
  expect(q.options.find((o) => o.id === "own-identity")?.label).toBe(
    "Everything can have its own identity.",
  );
  expect(q.prompt).not.toContain("2 AM");
  const preview = questionPreview(birthdayPack, q);
  expect(preview.interactive).toBe(true);
  expect(preview.limitation).toBeNull();
  expect(preview.question).not.toHaveProperty("correctOption");
  expect(preview.question).not.toHaveProperty("correctOptionId");
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
  expect(rank).toMatchObject({
    scoring: "consensus",
    input: "ordered",
    truth: { known: [] },
  });
  for (const id of [
    "dial-pop-culture",
    "dial-london-geography",
    "dial-british-politics",
  ]) {
    const dial = byId(id);
    expect(dial).toMatchObject({ minimum: 0, maximum: 100, step: 1, initial: 50 });
    expect(dial.instructions).toMatch(/^0 = .*100 = /);
    if (dial.kind !== "slider") throw new Error("Slider draft required");
    expect(dial).toMatchObject({ scoring: "consensus", truth: { known: null } });
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
  expect(
    birthdayPack.catalogue
      .filter(
        (q) =>
          ![
            "tribunal-reddit",
            "council-broadwater-farm",
            "council-redoubt-new-babylon",
            "council-ferrier-sector",
            "council-thamesmead-south",
            "council-blackbird-leys",
            "apology-video-auction",
            "nextdoor-paranoia",
            "group-chat-figurine",
            "defend-indefensible",
            "cursed-search-history",
            "property-price-roulette",
          ].includes(q.id),
      )
      .every((q) => q.status === "ready" && missingRequirements(q).length === 0),
  ).toBe(true);
  expect(birthdayPack.order).toEqual([]);
  expect(birthdayPack.release).toBe("draft");
});

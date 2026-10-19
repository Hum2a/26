import { contentLimits, publicQuestionSchema } from "@26/shared";
import { describe, expect, it } from "vitest";
import {
  choiceQuestion,
  guessQuestion,
  toPlayable,
  typedQuestion,
} from "../src/questions/authoring.ts";
import { demoQuestionSetVersion } from "../src/room/limits.ts";
import type { QuestionPack } from "../src/questions/definition.ts";
import { attachAudienceFields, publicQuestionCore } from "../src/questions/project.ts";
import {
  playableQuestions,
  questionPacks,
  resolveContent,
} from "../src/questions/registry.ts";
import { birthdayPack } from "../src/questions/packs/birthday/manifest.ts";
import { demoPack } from "../src/questions/packs/demo/manifest.ts";
import { validatePack } from "../src/questions/validate.ts";
import { missingRequirements } from "../src/questions/definition.ts";
import { favouritePokemon } from "../src/questions/packs/birthday/favourite-pokemon.ts";
import { howItalianIsHumza } from "../src/questions/packs/birthday/how-italian-is-humza.ts";
import { christianityBranches } from "../src/questions/packs/birthday/christianity-branches.ts";
import { inflationFreddo } from "../src/questions/packs/birthday/inflation-freddo.ts";
import { inflationPetrol } from "../src/questions/packs/birthday/inflation-petrol.ts";
import { commonPassword } from "../src/questions/packs/birthday/common-password.ts";
import { completeAWordle } from "../src/questions/packs/birthday/complete-a-wordle.ts";

const fixtureOptions = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
];

function partyPack(overrides: Partial<QuestionPack> = {}): QuestionPack {
  return {
    packId: "birthday",
    version: "fixture-pack",
    release: "released",
    profile: "party",
    illustrative: false,
    order: [],
    catalogue: [],
    ...overrides,
  };
}

describe("question authoring", () => {
  it("keeps the illustrative demo playable and labelled", () => {
    const demo = resolveContent(demoQuestionSetVersion);
    expect(demo.status).toBe("playable");
    if (demo.status !== "playable") {
      return;
    }
    expect(demo.pack.questions.map((question) => question.id)).toEqual([
      ...demoPack.order,
    ]);
    expect(demo.pack.illustrative).toBe(true);
    expect(validatePack(demoPack).filter((item) => item.level === "error")).toEqual([]);
  });

  it("accepts a party pack that is not an illustrative demo", () => {
    const ready = choiceQuestion({
      id: "fixture-mark",
      title: "Fixture mark",
      status: "ready",
      prompt: "Fixture: which mark is a circle?",
      options: [
        { id: "circle", label: "Circle" },
        { id: "square", label: "Square" },
      ],
      correctOption: { known: "circle" },
      points: 0,
    });
    const pack = partyPack({
      order: [ready.id],
      catalogue: [ready],
    });
    expect(validatePack(pack).filter((item) => item.level === "error")).toEqual([]);
    const playable = playableQuestions(pack)[0];
    expect(playable?.points).toBe(0);
    expect(playable?.illustrative).toBe(false);
    if (!playable || playable.kind !== "choice") {
      throw new Error("Expected a playable choice.");
    }
    const parsed = publicQuestionSchema.safeParse({
      ...publicQuestionCore(playable, 1, 1),
      kind: "choice",
      options: playable.options,
      speedBonus: false,
      modifiers: [],
      suppressSpeedBonus: false,
    });
    expect(parsed.success).toBe(true);
  });

  it("saves an incomplete photo guess without playing it", () => {
    const draft = guessQuestion({
      id: "childhood-photo",
      title: "Childhood photo",
      prompt: "Who is in this photo?",
      scoring: "named",
      media: [{ name: "childhood-photo", kind: "image", required: true }],
      truth: {
        missing: {
          code: "correct-answer",
          name: "person",
          detail: "The person in the photo has not been named.",
        },
      },
    });
    expect(draft.status).toBe("draft");
    expect(toPlayable(draft)).toBeUndefined();
    const pack = partyPack({
      release: "draft",
      version: "birthday-draft",
      catalogue: [draft],
      order: [],
    });
    const issues = validatePack(pack);
    expect(issues.some((item) => item.level === "error")).toBe(false);
    expect(
      issues.filter((item) => item.level === "incomplete").map((item) => item.code),
    ).toEqual(["incomplete", "incomplete"]);
    expect(JSON.stringify(draft)).not.toContain('"known"');
    expect(birthdayPack.order).not.toContain(draft.id);
    expect(birthdayPack.catalogue.map((question) => question.id)).not.toContain(
      draft.id,
    );
  });

  it("rejects a draft that was placed in the running order", () => {
    const draft = choiceQuestion({
      id: "half-written",
      title: "Half written",
      prompt: "Fixture: finish this later.",
      status: "draft",
    });
    const issues = validatePack(
      partyPack({
        release: "draft",
        catalogue: [draft],
        order: [draft.id],
      }),
    );
    expect(
      issues.some((item) => item.level === "error" && item.code === "draft-in-order"),
    ).toBe(true);
  });

  it("reorders a pack without changing question identity", () => {
    const order = [
      "colour",
      "shape",
      ...demoPack.order.filter((id) => id !== "shape" && id !== "colour"),
    ];
    const questions = playableQuestions({ ...demoPack, order });
    expect(questions.map((question) => question.id)).toEqual(order);
    expect(questions.find((question) => question.id === "shape")?.prompt).toBe(
      "Illustrative demo: which of these is a circle?",
    );
    expect(demoPack.order[0]).toBe("shape");
  });

  it("does not substitute another pack for an unavailable version", () => {
    expect(resolveContent("unreleased")).toEqual({ status: "lobby" });
    expect(resolveContent("birthday-draft")).toEqual({
      status: "unavailable",
      version: "birthday-draft",
      reason: "draft",
    });
    expect(resolveContent("missing-pack")).toEqual({
      status: "unavailable",
      version: "missing-pack",
      reason: "unknown",
    });
    const demo = resolveContent(demoQuestionSetVersion);
    const missing = resolveContent("missing-pack");
    expect(missing).not.toHaveProperty("pack");
    if (demo.status === "playable") {
      expect(demo.pack.version).toBe(demoQuestionSetVersion);
    }
  });

  it("keeps presenter notes and future reveals off guest snapshots", () => {
    const authored = choiceQuestion({
      id: "noted",
      title: "Noted fixture",
      status: "ready",
      prompt: "Fixture: which mark is a circle?",
      notes: "Presenter note stays on the control screen.",
      explanation: "The circle is the round mark.",
      options: [
        { id: "circle", label: "Circle" },
        { id: "square", label: "Square" },
      ],
      correctOption: { known: "circle" },
    });
    const playable = playableQuestions(
      partyPack({ catalogue: [authored], order: [authored.id] }),
    )[0];
    if (!playable) {
      throw new Error("Expected the fixture to be playable.");
    }
    const early = attachAudienceFields(
      { prompt: playable.prompt },
      playable,
      "guest",
      false,
    );
    expect(early.explanation).toBeNull();
    expect(early).not.toHaveProperty("presenterNotes");
    expect(JSON.stringify(early)).not.toContain("Presenter note");
    expect(JSON.stringify(early)).not.toContain("round mark");
    const revealed = attachAudienceFields(
      { prompt: playable.prompt },
      playable,
      "guest",
      true,
    );
    expect(revealed.explanation).toBe("The circle is the round mark.");
    expect(JSON.stringify(revealed)).not.toContain("Presenter note");
    const control = attachAudienceFields(
      { prompt: playable.prompt },
      playable,
      "control",
      false,
    );
    expect(control.presenterNotes).toBe("Presenter note stays on the control screen.");
    expect(control.explanation).toBeNull();
    expect(JSON.stringify(publicQuestionCore(playable, 1, 1))).not.toContain(
      "Presenter note",
    );
  });

  it("uses the same id, prompt, and points limits as the public contract", () => {
    const id = "a".repeat(40);
    expect(contentLimits.questionId.test(id)).toBe(true);
    expect(contentLimits.questionId.test("a".repeat(41))).toBe(false);
    expect(contentLimits.pointsMin).toBe(0);
    expect(contentLimits.promptMax).toBe(200);
    const tooLong = choiceQuestion({
      id: "a".repeat(41),
      title: "Too long",
      status: "ready",
      prompt: "x".repeat(201),
      points: -1,
      options: fixtureOptions,
      correctOption: { known: "yes" },
    });
    const codes = validatePack(partyPack({ catalogue: [tooLong], order: [] }))
      .filter((item) => item.level === "error")
      .map((item) => item.code);
    expect(codes).toEqual(expect.arrayContaining(["id", "prompt", "score"]));
  });

  it("reports a broken manifest reference and an unsupported presentation", () => {
    const ready = choiceQuestion({
      id: "plain",
      title: "Plain",
      status: "ready",
      prompt: "Fixture: pick one.",
      presentation: "sparkle",
      options: fixtureOptions,
      correctOption: { known: "yes" },
    });
    const codes = validatePack(
      partyPack({
        catalogue: [ready, ready],
        order: ["missing-question"],
      }),
    )
      .filter((item) => item.level === "error")
      .map((item) => item.code);
    expect(codes).toEqual(
      expect.arrayContaining(["duplicate", "manifest", "presentation"]),
    );
  });

  it("leaves the birthday catalogue unpinned", () => {
    expect(questionPacks.map((pack) => pack.version)).toEqual([
      "demo-2026-09-22",
      "birthday-draft",
    ]);
    expect(birthdayPack.release).toBe("draft");
    expect(birthdayPack.order).toEqual([]);
  });

  it("authors polls, threshold outcomes, and typed answers without a correct option", () => {
    const poll = choiceQuestion({
      id: "poll",
      title: "Poll",
      prompt: "Pick one.",
      outcome: { kind: "poll" },
      options: fixtureOptions,
    });
    expect(poll.status).toBe("ready");
    expect(poll.points).toBe(0);
    expect(toPlayable(poll)).toMatchObject({ correctOptionId: null, points: 0 });

    const split = choiceQuestion({
      id: "split",
      title: "Split",
      prompt: "Pick one.",
      options: fixtureOptions,
      outcome: {
        kind: "threshold",
        optionId: "yes",
        above: 0.5,
        met: "everyone",
        otherwise: ["no"],
      },
    });
    expect(split.status).toBe("ready");
    expect(split.points).toBe(100);

    const typed = typedQuestion({
      id: "typed",
      title: "Typed",
      prompt: "Type it.",
      accepted: { known: ["Jon Harvey"] },
    });
    expect(typed.status).toBe("ready");
    expect(toPlayable(typed)).toMatchObject({ kind: "typed", maxLength: 60 });
    const missing = typedQuestion({
      id: "typed-draft",
      title: "Typed",
      prompt: "Type it.",
    });
    expect(missing.status).toBe("draft");
    expect(toPlayable(missing)).toBeUndefined();

    const pack = partyPack({
      catalogue: [poll, split, typed],
      order: ["poll", "split", "typed"],
    });
    expect(validatePack(pack).filter((item) => item.level === "error")).toEqual([]);
  });

  it("rejects a scored poll, a threshold on a missing option, and an oversized answer box", () => {
    const scoredPoll = choiceQuestion({
      id: "scored-poll",
      title: "Poll",
      prompt: "Pick one.",
      outcome: { kind: "poll" },
      points: 50,
      options: fixtureOptions,
    });
    const badSplit = choiceQuestion({
      id: "bad-split",
      title: "Split",
      prompt: "Pick one.",
      options: fixtureOptions,
      outcome: {
        kind: "threshold",
        optionId: "maybe",
        above: 0.5,
        met: "everyone",
        otherwise: ["no"],
      },
    });
    const wideBox = typedQuestion({
      id: "wide-box",
      title: "Typed",
      prompt: "Type it.",
      maxLength: 200,
      accepted: { known: ["x"] },
    });
    const pack = partyPack({
      catalogue: [scoredPoll, badSplit, wideBox],
      order: ["scored-poll", "bad-split", "wide-box"],
    });
    const errors = validatePack(pack)
      .filter((item) => item.level === "error")
      .map((item) => item.message);
    expect(errors).toEqual(
      expect.arrayContaining([
        "scored-poll is a poll, so its points must be 0.",
        "bad-split threshold names an option that is not in the list.",
        "wide-box answer box must hold 1 to 80 characters.",
      ]),
    );
  });

  it("projects a typed question without its accepted answers", () => {
    const typed = toPlayable(
      typedQuestion({
        id: "typed",
        title: "Typed",
        prompt: "Type it.",
        accepted: { known: ["Jon Harvey"] },
      }),
    );
    if (!typed || typed.kind !== "typed") {
      throw new Error("The typed fixture is ready.");
    }
    const view = publicQuestionSchema.parse({
      ...publicQuestionCore(typed, 1, 1),
      kind: "typed",
      maxLength: typed.maxLength,
    });
    expect(JSON.stringify(view)).not.toContain("Jon Harvey");
  });

  it("lets a poll list up to 16 options but keeps an ordinary choice at 6", () => {
    const many = Array.from({ length: 16 }, (_, index) => ({
      id: `party-${index}`,
      label: `Party ${index}`,
    }));
    const ballot = choiceQuestion({
      id: "ballot",
      title: "Ballot",
      prompt: "Vote for a party.",
      outcome: { kind: "poll" },
      options: many,
    });
    const crowded = choiceQuestion({
      id: "crowded",
      title: "Crowded",
      prompt: "Pick one.",
      options: many.slice(0, 7),
      correctOption: { known: "party-0" },
    });
    const tooMany = choiceQuestion({
      id: "too-many",
      title: "Too many",
      prompt: "Vote.",
      outcome: { kind: "poll" },
      options: [...many, { id: "party-16", label: "Party 16" }],
    });
    const pack = partyPack({
      catalogue: [ballot, crowded, tooMany],
      order: ["ballot", "crowded", "too-many"],
    });
    const failing = validatePack(pack)
      .filter((item) => item.level === "error")
      .map((item) => item.message);
    expect(failing).toEqual([
      "crowded needs distinct options.",
      "too-many needs distinct options.",
    ]);
    const ballotPlayable = toPlayable(ballot);
    if (!ballotPlayable || ballotPlayable.kind !== "choice") {
      throw new Error("The ballot is ready.");
    }
    expect(() =>
      publicQuestionSchema.parse({
        ...publicQuestionCore(ballotPlayable, 1, 1),
        kind: "choice",
        options: ballotPlayable.options,
        outcome: "poll",
        speedBonus: false,
        modifiers: [],
        suppressSpeedBonus: false,
      }),
    ).not.toThrow();
  });

  it("keeps the birthday catalogue valid with drafts out of the running order", () => {
    expect(validatePack(birthdayPack).filter((item) => item.level === "error")).toEqual(
      [],
    );
    expect(birthdayPack.order).toEqual([]);
  });
});

describe("October birthday question additions", () => {
  it.each([
    [favouritePokemon, "mudkip", ["Turtwig", "Mudkip", "Tepig", "Osama bin laden"]],
    [
      howItalianIsHumza,
      "half-percent",
      [
        "1%",
        "pineapple belongs on pizza",
        "dominos pizza is better than rome pizza",
        "0.5%",
      ],
    ],
  ] as const)(
    "keeps supplied choices and answer for $0.id",
    (question, answer, labels) => {
      expect(question.status).toBe("ready");
      expect(question.options.map((option) => option.label)).toEqual(labels);
      expect(question.correctOption).toEqual({ known: answer });
      expect(missingRequirements(question)).toEqual([]);
      expect(question.points).toBe(100);
      expect(question.collectMs).toBe(20_000);
      const playable = toPlayable(question);
      expect(playable?.kind).toBe("choice");
      expect(publicQuestionCore(playable!, 1, 2)).not.toHaveProperty("correctOptionId");
      expect(publicQuestionCore(playable!, 1, 2)).not.toHaveProperty("notes");
    },
  );
  it.each([commonPassword, inflationFreddo, inflationPetrol, christianityBranches])(
    "keeps $id blocked until the real requirements are supplied",
    (question) => {
      expect(question.status).toBe("draft");
      expect(missingRequirements(question).length).toBeGreaterThan(0);
      expect(toPlayable(question)).toBeUndefined();
      expect(birthdayPack.order).not.toContain(question.id);
    },
  );
  it("records unsupported mechanics rather than silently substituting typed scoring", () => {
    expect(missingRequirements(commonPassword).map((item) => item.name)).toContain(
      "ranking-mechanic",
    );
    expect(missingRequirements(completeAWordle)).toEqual([]);
    expect(completeAWordle.kind).toBe("wordle");
    expect(completeAWordle.status).toBe("ready");
    expect(birthdayPack.order).not.toContain(completeAWordle.id);
    expect(commonPassword.accepted).not.toHaveProperty("known");
    expect(completeAWordle.answer).toEqual({ known: "VULGY" });
    expect(christianityBranches.options.map((option) => option.label)).toEqual([
      "unorthodox",
      "jisraeli",
      "Irish Catholic terrorists",
      "muggletonians",
      "the jumpers",
      "ranters",
    ]);
    expect(christianityBranches.correctOption).not.toHaveProperty("known");
    expect(christianityBranches.prompt).toBe(
      "Which of these ARE branches of Christianity?",
    );
    expect(christianityBranches.instructions).toBe("Select all that apply.");
    expect(christianityBranches.notes).toContain("muggletonians, the jumpers, ranters");
    expect(
      missingRequirements(christianityBranches).map((item) => item.name),
    ).toContain("multiple-selection");
    expect(commonPassword.notes).toContain("matching other guests");
    expect(missingRequirements(commonPassword).map((item) => item.name)).not.toContain(
      "commonness-definition",
    );
    expect(completeAWordle.notes).toContain("Encore Glyph's classic board");
    for (const slider of [inflationFreddo, inflationPetrol]) {
      expect(slider.kind).toBe("slider");
      expect(slider.prompt).toContain("guess the price in 2026");
      expect(slider.notes).toContain("show the 2012 price");
      expect(slider.truth).not.toHaveProperty("known");
      expect(missingRequirements(slider).map((item) => item.name)).toEqual(
        expect.arrayContaining([
          "comparison",
          "reference-price",
          "scale",
          "target-price",
        ]),
      );
    }
  });
  it("registers all seven entries without releasing or replacing the running game", () => {
    const entries = [
      favouritePokemon,
      commonPassword,
      completeAWordle,
      inflationFreddo,
      inflationPetrol,
      howItalianIsHumza,
      christianityBranches,
    ];
    for (const question of entries) expect(birthdayPack.catalogue).toContain(question);
    expect(birthdayPack.release).toBe("draft");
    expect(birthdayPack.order).toEqual([]);
    expect(resolveContent("birthday-draft").status).toBe("unavailable");
    expect(resolveContent(demoQuestionSetVersion).status).toBe("playable");
    expect(
      validatePack(birthdayPack).filter((issue) => issue.level === "error"),
    ).toEqual([]);
  });
});

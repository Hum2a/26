import { contentLimits, publicQuestionSchema } from "@26/shared";
import { describe, expect, it } from "vitest";
import {
  choiceQuestion,
  guessQuestion,
  toPlayable,
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
    expect(birthdayPack.catalogue).toEqual([]);
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
});

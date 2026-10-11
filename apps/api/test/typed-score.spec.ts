import { describe, expect, it } from "vitest";
import { toPlayable, typedQuestion } from "../src/questions/authoring.ts";
import { checkTypedAnswer, pointsForTyped } from "../src/questions/typed.ts";
import {
  editDistance,
  matchTyped,
  normaliseTyped,
} from "../src/questions/typed-match.ts";
import { realNameTommyRobinson } from "../src/questions/packs/birthday/real-name-tommy-robinson.ts";

function playable() {
  const question = toPlayable(
    typedQuestion({
      id: "real-name",
      title: "Real name",
      prompt: "What was their real name?",
      points: 100,
      maxLength: 30,
      accepted: { known: ["Jon Harvey", "Jonathan Harvey"] },
    }),
  );
  if (!question || question.kind !== "typed") {
    throw new Error("The typed fixture is ready.");
  }
  return question;
}

describe("typed answer matching", () => {
  it("ignores case, accents, punctuation, hyphens and spacing", () => {
    expect(normaliseTyped("  Stephen  YAXLEY-Lennon! ")).toBe("stephen yaxley lennon");
    expect(normaliseTyped("Zoë O’Brien")).toBe("zoe obrien");
    expect(matchTyped("jon harvey", ["Jon Harvey"]).correct).toBe(true);
    expect(matchTyped("JONHARVEY", ["Jon Harvey"]).correct).toBe(true);
    expect(matchTyped("stephen yaxley lennon", ["Stephen Yaxley-Lennon"]).correct).toBe(
      true,
    );
  });

  it("forgives a small typo and a swapped pair, but not a different name", () => {
    expect(editDistance("harvey", "havrey")).toBe(1);
    expect(matchTyped("John Harvey", ["Jon Harvey"]).correct).toBe(true);
    expect(matchTyped("Steven Yaxley-Lennon", ["Stephen Yaxley-Lennon"]).correct).toBe(
      true,
    );
    expect(matchTyped("David Paulsen", ["David Paulden"]).correct).toBe(true);
    expect(matchTyped("Jon Snow", ["Jon Harvey"]).correct).toBe(false);
    expect(matchTyped("Harvey", ["Jon Harvey"]).correct).toBe(false);
    expect(matchTyped("Ann", ["Ian"]).correct).toBe(false);
    expect(matchTyped("", ["Jon Harvey"]).correct).toBe(false);
  });

  it("reports which accepted spelling matched", () => {
    expect(matchTyped("jonathan harvey", ["Jon Harvey", "Jonathan Harvey"])).toEqual({
      correct: true,
      matched: "Jonathan Harvey",
    });
  });
});

describe("typed answer scoring", () => {
  it("scores the question's points for a match and 0 otherwise", () => {
    const question = playable();
    expect(pointsForTyped(question, "jon harvey")).toEqual({
      points: 100,
      detail: "correct",
    });
    expect(pointsForTyped(question, "Count Binface")).toEqual({
      points: 0,
      detail: "miss",
    });
    expect(pointsForTyped(question, undefined)).toEqual({
      points: 0,
      detail: "missing",
    });
  });

  it("trims answers and rejects empty, oversized, or control-character text", () => {
    const question = playable();
    expect(checkTypedAnswer(question, "  Jon Harvey  ")).toEqual({
      ok: true,
      body: "Jon Harvey",
    });
    for (const value of ["", "   ", 42, null, "x".repeat(31), "Jon\nHarvey"]) {
      expect(checkTypedAnswer(question, value).ok).toBe(false);
    }
  });

  it("accepts the party spellings for Tommy Robinson", () => {
    const question = toPlayable(realNameTommyRobinson);
    if (!question || question.kind !== "typed") {
      throw new Error("The Tommy Robinson question is ready.");
    }
    for (const body of ["Stephen Yaxley-Lennon", "stephen lennon", "Stephen Yaxley"]) {
      expect(pointsForTyped(question, body).points).toBe(question.points);
    }
    expect(pointsForTyped(question, "Tommy Robinson").points).toBe(0);
  });
});

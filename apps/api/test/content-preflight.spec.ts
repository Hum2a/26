import { describe, expect, it } from "vitest";
import { demoQuestions } from "../src/questions/demo-set.ts";
import { preflightContent } from "../src/questions/preflight.ts";

describe("illustrative content preflight", () => {
  it("accepts the versioned demo pack", () => {
    expect(preflightContent({ questions: demoQuestions, missingAssets: [] })).toEqual(
      [],
    );
  });

  it("rejects a correct option that is not on the question", () => {
    const questions = demoQuestions.map((question) =>
      question.kind === "choice" && question.id === "shape"
        ? { ...question, correctOptionId: "missing" }
        : question,
    );
    const issues = preflightContent({ questions, missingAssets: [] });
    expect(issues.some((issue) => issue.code === "choice")).toBe(true);
  });

  it("rejects a prompt that is not labelled illustrative", () => {
    const questions = demoQuestions.map((question, index) =>
      index === 0
        ? { ...question, prompt: "A party question that was not supplied." }
        : question,
    );
    const issues = preflightContent({ questions, missingAssets: [] });
    expect(issues.some((issue) => issue.code === "label")).toBe(true);
  });

  it("reports a missing selected asset", () => {
    const issues = preflightContent({
      questions: demoQuestions,
      missingAssets: ["apps/web/public/assets/demo-sting.wav"],
    });
    expect(issues.map((issue) => issue.code)).toEqual(["asset"]);
  });
});

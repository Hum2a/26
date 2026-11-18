import { describe, expect, it } from "vitest";
import { awardsPoints } from "../src/questions/multiple-choice";
import { mockElection } from "../src/questions/packs/birthday/mock-election";
import { trolleyProblem as trolleyProblem } from "../src/questions/packs/birthday/trolley-problem";
import { birthdayPack } from "../src/questions/packs/birthday/manifest";

describe("awardsPoints", () => {
  it("is false for polls and for rounds worth nothing, true otherwise", () => {
    expect(
      awardsPoints({ points: 100, kind: "choice", outcome: { kind: "poll" } }),
    ).toBe(false);
    expect(awardsPoints({ points: 0, kind: "slider" })).toBe(false);
    expect(
      awardsPoints({ points: 100, kind: "choice", outcome: { kind: "correct" } }),
    ).toBe(true);
    expect(awardsPoints({ points: 50, kind: "vote" })).toBe(true);
  });

  it("marks the birthday polls as just for fun and keeps scored rounds scoring", () => {
    expect(awardsPoints(mockElection)).toBe(false);
    expect(awardsPoints(trolleyProblem)).toBe(false);
    const polls = birthdayPack.catalogue.filter(
      (q) => q.kind === "choice" && q.outcome.kind === "poll",
    );
    // Mock election and the trolley problem; the other trolley polls were
    // retired from the catalogue on 16 November 2026.
    expect(polls.map(({ id }) => id)).toEqual(
      expect.arrayContaining(["mock-election", "trolley-problem"]),
    );
    for (const poll of polls) expect(awardsPoints(poll)).toBe(false);
    const scored = birthdayPack.catalogue.filter(
      (q) => q.kind === "choice" && q.outcome.kind === "correct" && q.points > 0,
    );
    expect(scored.length).toBeGreaterThan(0);
    for (const question of scored) expect(awardsPoints(question)).toBe(true);
  });
});

import { expect, it } from "vitest";
import type { LobbySnapshot } from "@26/shared";
import { questionDirection } from "./question-direction";
const snapshot = (kind: string, extra: object = {}, play: object = {}) =>
  ({
    phase: "collect",
    paused: false,
    held: false,
    play: { question: { kind }, selfAnswer: null, selfBallot: null, ...play },
    ...extra,
  }) as unknown as LobbySnapshot;
it.each([
  ["choice", "Pick one"],
  ["slider", "Slide"],
  ["rank", "Place the items"],
  ["typed", "Type your answer"],
  ["vote", "Write your line"],
  ["guess", "Choose a player"],
  ["duel", "Enter your number"],
  ["finale", "Enter your number"],
])("gives the next action for %s", (kind, action) =>
  expect(questionDirection(snapshot(kind), false)).toContain(action),
);
it("distinguishes pending, accepted, paused and waiting states", () => {
  expect(
    questionDirection(
      snapshot("guess", {}, { selfBallot: { candidateId: "sample" } }),
      false,
    ),
  ).toBe("Locked in — watch the stage");
  expect(questionDirection(snapshot("choice"), true)).toBe("Sending your answer…");
  expect(
    questionDirection(
      snapshot("choice", {}, { selfAnswer: { kind: "choice", optionId: "test" } }),
      false,
    ),
  ).toBe("Locked in — watch the stage");
  expect(questionDirection(snapshot("choice", { paused: true }), false)).toBe(
    "Paused — hang tight",
  );
  expect(questionDirection(snapshot("choice", { held: true }), false)).toBe(
    "Waiting for the host",
  );
  expect(questionDirection(snapshot("choice", { phase: "reveal" }), false)).toBe(
    "The results are in",
  );
});
it("keeps contestants, spectators and late joiners clear about their role", () => {
  expect(
    questionDirection(
      snapshot("finale", { phase: "predict" }, { duel: { role: "spectator" } }),
      false,
    ),
  ).toBe("Back a winner, then send");
  expect(
    questionDirection(
      snapshot("finale", { phase: "predict" }, { duel: { role: "pair" } }),
      false,
    ),
  ).toContain("You’re playing");
  expect(
    questionDirection(snapshot("duel", {}, { duel: { role: "spectator" } }), false),
  ).toBe("Watch the duel on the stage");
  expect(
    questionDirection(snapshot("duel", {}, { duel: { role: "late" } }), false),
  ).toBe("You’re watching this round");
});

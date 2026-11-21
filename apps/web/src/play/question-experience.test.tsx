import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import type { LobbySnapshot } from "@26/shared";
import { playingFixture } from "../admin/controls.test-support";
import { QuestionExperience } from "./question-experience";

function revealed(selfAward: number | null): LobbySnapshot {
  return {
    ...playingFixture,
    phase: "reveal",
    play: {
      ...playingFixture.play!,
      selfAnswer: { optionId: "one" },
      selfAward,
    },
  } as LobbySnapshot;
}

it("gives listening, reading, open and closed phases distinct phone cues", () => {
  const show = (phase: LobbySnapshot["phase"]) => (
    <QuestionExperience snapshot={{ ...playingFixture, phase }} pending={false}>
      <p>Round</p>
    </QuestionExperience>
  );
  const view = render(show("intro"));
  expect(screen.getByRole("status").textContent).toContain("Listen to Baseer");
  expect(screen.getByRole("status").dataset.open).toBe("false");
  view.rerender(show("prompt"));
  expect(screen.getByRole("status").textContent).toContain("Read the question");
  expect(screen.getByRole("status").dataset.open).toBe("false");
  view.rerender(show("collect"));
  expect(screen.getByRole("status").textContent).toContain("Answer now");
  expect(screen.getByRole("status").dataset.open).toBe("true");
  view.rerender(show("reveal"));
  expect(screen.getByRole("status").textContent).toContain("Answers closed");
  expect(screen.getByRole("status").dataset.open).toBe("false");
});

it("says a round that could not score was just for fun, not a miss", () => {
  render(
    <QuestionExperience snapshot={revealed(null)} pending={false}>
      <p>Round</p>
    </QuestionExperience>,
  );
  expect(screen.getByText("Just for fun")).toBeTruthy();
  expect(screen.queryByText("No points this time")).toBeNull();
});

it("still reports a scored miss and a win", () => {
  const view = render(
    <QuestionExperience snapshot={revealed(0)} pending={false}>
      <p>Round</p>
    </QuestionExperience>,
  );
  expect(screen.getByText("No points this time")).toBeTruthy();
  view.rerender(
    <QuestionExperience snapshot={revealed(120)} pending={false}>
      <p>Round</p>
    </QuestionExperience>,
  );
  expect(screen.getByText("+120 points")).toBeTruthy();
});

it("does not promise more rounds after the last question", () => {
  const last = revealed(0);
  last.play!.question = { ...last.play!.question, index: 2, total: 2 };
  render(
    <QuestionExperience snapshot={last} pending={false}>
      <p>Round</p>
    </QuestionExperience>,
  );
  expect(screen.getByText(/That was the last one/)).toBeTruthy();
  expect(screen.queryByText("Plenty more to come.")).toBeNull();
});

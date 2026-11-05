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

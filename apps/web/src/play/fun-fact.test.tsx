import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import type { LobbySnapshot } from "@26/shared";
import { StagePlay } from "./stage-play";
import { FunFactPhone } from "./fun-fact";

const card = {
  id: "fun:browser:firefox",
  illustrative: false,
  text: "1 person used Firefox.",
};

it("shows one stage sentence and the count, not the question", () => {
  render(
    <StagePlay
      snapshot={
        {
          phase: "facts",
          funFact: { index: 0, total: 10, card },
          play: { question: { prompt: "A secret question?" } },
        } as unknown as LobbySnapshot
      }
    />,
  );
  expect(
    screen.getByRole("region", { name: "From your phones" }).textContent,
  ).toContain("1 person used Firefox.");
  expect(screen.getByText("1 of 10")).toBeTruthy();
  expect(screen.queryByText("A secret question?")).toBeNull();
});

it("tells the matching phone that the fact is theirs", () => {
  render(<FunFactPhone fact={{ index: 2, total: 10, card, appliesToYou: true }} />);
  expect(screen.getByText("Watch the stage")).toBeTruthy();
  expect(screen.getByRole("heading").textContent).toContain("1 person used Firefox.");
  expect(screen.getByText("That’s you.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Send answer" })).toBeNull();
});

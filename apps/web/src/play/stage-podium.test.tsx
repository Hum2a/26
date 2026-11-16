import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}));
import { playingFixture } from "../admin/controls.test-support";
import { StagePlay } from "./stage-play";

it("puts the leaders on a podium at the end without losing the heading or the list", async () => {
  const standings = [
    { place: 1, nickname: "Amina", points: 300 },
    { place: 2, nickname: "Bilal", points: 200 },
    { place: 3, nickname: "Chen", points: 100 },
    { place: 4, nickname: "Dee", points: 50 },
  ];
  render(
    <StagePlay
      snapshot={{
        ...playingFixture,
        phase: "podium",
        play: { ...playingFixture.play!, standings },
      }}
    />,
  );
  expect(await screen.findByRole("heading", { name: "Podium" })).toBeTruthy();
  expect(screen.getAllByRole("listitem")).toHaveLength(4);
});

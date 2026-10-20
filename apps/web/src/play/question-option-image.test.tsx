import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { LobbySnapshot, PlaySnapshot } from "@26/shared";
import { GuestPlay } from "./guest-play";
import { StagePlay } from "./stage-play";

afterEach(cleanup);
const options = [
  { id: "turtwig", label: "Turtwig" },
  { id: "mudkip", label: "Mudkip" },
  { id: "tepig", label: "Tepig" },
  { id: "osama-bin-laden", label: "Osama bin laden" },
].map((option) => ({
  ...option,
  image: `/assets/questions/favourite-pokemon/${option.id}.png`,
}));
const play: PlaySnapshot = {
  question: {
    id: "pictured-choice",
    index: 1,
    total: 1,
    kind: "choice",
    prompt: "Choose one",
    presentation: "standard",
    options,
    points: 100,
    illustrative: false,
    attribution: "after",
    speedBonus: false,
    modifiers: [],
    suppressSpeedBonus: false,
  },
  submissionCount: 0,
  selfAnswer: null,
  selfBallot: null,
  ballot: null,
  duel: null,
  reveal: null,
  selfAward: null,
  selfStanding: null,
  standings: null,
  liveSample: null,
  attributions: null,
  explanation: null,
};
const snapshot = (phase = "collect") =>
  ({
    phase,
    paused: false,
    held: false,
    play,
    trolls: { active: [] },
  }) as unknown as LobbySnapshot;

it("renders illustrations inside existing phone buttons without changing their names or selection", () => {
  const select = vi.fn(),
    send = vi.fn();
  const view = render(
    <GuestPlay
      snapshot={snapshot()}
      pending={false}
      selectedId="tepig"
      onSelect={select}
      onSubmit={send}
      onEstimate={vi.fn()}
      onRank={vi.fn()}
      onText={vi.fn()}
      onBallot={vi.fn()}
      onDuel={vi.fn()}
    />,
  );
  for (const option of options) {
    const button = screen.getByRole("button", { name: option.label });
    const image = button.querySelector("img")!;
    expect(image.getAttribute("src")).toBe(option.image);
    expect(image.getAttribute("alt")).toBe("");
    expect(image.getAttribute("aria-hidden")).toBe("true");
    fireEvent.load(image);
    fireEvent.click(button);
    expect(select).toHaveBeenLastCalledWith(option.id);
  }
  fireEvent.click(screen.getByRole("button", { name: "Send answer" }));
  expect(send).toHaveBeenCalledTimes(1);
  expect(view.container.querySelectorAll(".question-choice-tile")).toHaveLength(4);
  // If a picture fails, the label and interactive card remain usable.
  fireEvent.error(view.container.querySelector("img")!);
  expect(screen.getByRole("button", { name: "Turtwig" })).toHaveProperty(
    "disabled",
    false,
  );
});

it("also draws images on stage and keeps answering closed during the prompt", () => {
  const view = render(<StagePlay snapshot={snapshot("prompt")} />);
  expect(view.container.querySelectorAll(".stage-option img")).toHaveLength(4);
  expect(screen.getByText("Osama bin laden")).toBeTruthy();
  view.unmount();
  render(
    <GuestPlay
      snapshot={snapshot("prompt")}
      pending={false}
      onSelect={vi.fn()}
      onSubmit={vi.fn()}
      onEstimate={vi.fn()}
      onRank={vi.fn()}
      onText={vi.fn()}
      onBallot={vi.fn()}
      onDuel={vi.fn()}
    />,
  );
  expect(screen.getByRole("button", { name: "Mudkip" })).toHaveProperty(
    "disabled",
    true,
  );
});

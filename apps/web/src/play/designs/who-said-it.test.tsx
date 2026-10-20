import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { LobbySnapshot, PlaySnapshot } from "@26/shared";
import { GuestPlay } from "../guest-play";
import { StagePlay } from "../stage-play";
import { previewQuestions, previewReveal } from "./preview/fixtures";

afterEach(cleanup);
const question = previewQuestions["who-said-it"];
function snapshot(
  phase = "collect",
  extra: Partial<PlaySnapshot> = {},
  paused = false,
) {
  return {
    phase,
    paused,
    held: false,
    finishAfterRound: false,
    trolls: { active: [] },
    play: {
      question,
      submissionCount: 2,
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
      ...extra,
    },
  } as unknown as LobbySnapshot;
}
const handlers = () => ({
  onSelect: vi.fn(),
  onSubmit: vi.fn(),
  onEstimate: vi.fn(),
  onRank: vi.fn(),
  onText: vi.fn(),
  onBallot: vi.fn(),
  onDuel: vi.fn(),
});

it("shows the quote and two choices, then selects and sends through existing callbacks", () => {
  const callbacks = handlers();
  const view = render(
    <GuestPlay snapshot={snapshot()} pending={false} {...callbacks} />,
  );
  expect(screen.getByText(question.prompt)).toBeTruthy();
  const choices = screen
    .getByRole("group", { name: "Choose a source" })
    .querySelectorAll("button");
  expect(choices).toHaveLength(2);
  fireEvent.click(choices[1]!);
  expect(callbacks.onSelect).toHaveBeenCalledWith("b");
  view.rerender(
    <GuestPlay snapshot={snapshot()} pending={false} selectedId="b" {...callbacks} />,
  );
  expect(
    screen
      .getByRole("group", { name: "Choose a source" })
      .querySelectorAll("button")[1]!
      .getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Send choice" }));
  expect(callbacks.onSubmit).toHaveBeenCalledOnce();
  expect(screen.queryByText(/^It was /)).toBeNull();
});

it.each(["prompt", "pending", "accepted", "paused"])(
  "keeps %s distinct and locks both source controls",
  (state) => {
    render(
      <GuestPlay
        snapshot={snapshot(
          state === "prompt" ? "prompt" : "collect",
          state === "accepted" ? { selfAnswer: { kind: "choice", optionId: "b" } } : {},
          state === "paused",
        )}
        pending={state === "pending"}
        selectedId="b"
        {...handlers()}
      />,
    );
    for (const button of screen
      .getByRole("group", { name: "Choose a source" })
      .querySelectorAll("button"))
      expect(button.disabled).toBe(true);
    if (state === "accepted")
      expect(screen.getByRole("button", { name: "Locked in ✓" })).toBeTruthy();
    else expect(screen.queryByRole("button", { name: "Locked in ✓" })).toBeNull();
  },
);

it("does not reveal an attribution on stage before server reveal fields arrive", () => {
  const view = render(<StagePlay snapshot={snapshot()} />);
  expect(screen.queryByText(/^It was /)).toBeNull();
  expect(screen.queryByText(/Correct ·/)).toBeNull();
  view.rerender(
    <StagePlay
      snapshot={snapshot("reveal", { reveal: previewReveal(question, "b", 2) })}
    />,
  );
  expect(screen.getByText(/^It was /)).toBeTruthy();
  expect(screen.getByText(/Correct ·/)).toBeTruthy();
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { LobbySnapshot, PlaySnapshot } from "@26/shared";
import { GuestPlay } from "../guest-play";
import { StagePlay } from "../stage-play";
import { previewQuestions } from "./preview/fixtures";

afterEach(cleanup);

// Public stand-in copy deliberately uses different stakes from the party script.
const question = {
  ...previewQuestions["trolley-lever"],
  prompt:
    "Divert towards one imaginary moon, or continue towards 1,000 imaginary planets?",
  options: [
    { id: "derail", label: "Pull: save the planets; lose the moon" },
    { id: "leave", label: "Leave: save the moon; lose the planets" },
  ],
} as Extract<PlaySnapshot["question"], { kind: "choice" }>;

function snapshot(
  extra: Partial<PlaySnapshot> = {},
  phase = "collect",
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
      submissionCount: 3,
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

it("labels actions without inventing fixed victim counts, selects and submits", () => {
  const callbacks = handlers();
  const view = render(
    <GuestPlay snapshot={snapshot()} pending={false} {...callbacks} />,
  );
  expect(screen.getByRole("img").getAttribute("aria-label")).not.toMatch(
    /five|one person/i,
  );
  expect(screen.getByText("Leave it")).toBeTruthy();
  expect(screen.getByText("Pull the lever")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: question.options[0]!.label }));
  expect(callbacks.onSelect).toHaveBeenCalledWith("derail");
  view.rerender(
    <GuestPlay
      snapshot={snapshot()}
      selectedId="derail"
      pending={false}
      {...callbacks}
    />,
  );
  expect(
    screen
      .getByRole("button", { name: question.options[0]!.label })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Commit to it" }));
  expect(callbacks.onSubmit).toHaveBeenCalledOnce();
});

it.each(["prompt", "pending", "accepted", "paused"])(
  "locks trolley controls in %s",
  (state) => {
    render(
      <GuestPlay
        snapshot={snapshot(
          state === "accepted"
            ? { selfAnswer: { kind: "choice", optionId: "derail" } }
            : {},
          state === "prompt" ? "prompt" : "collect",
          state === "paused",
        )}
        selectedId="derail"
        pending={state === "pending"}
        {...handlers()}
      />,
    );
    expect(
      screen.getByRole("button", { name: question.options[0]!.label }),
    ).toHaveProperty("disabled", true);
    expect(
      screen.getByRole("button", { name: question.options[1]!.label }),
    ).toHaveProperty("disabled", true);
    if (state === "accepted")
      expect(screen.getByRole("button", { name: "Locked in ✓" })).toHaveProperty(
        "disabled",
        true,
      );
    else expect(screen.queryByRole("button", { name: "Locked in ✓" })).toBeNull();
  },
);

it.each([
  [3, 1, "The room pulled the lever."],
  [1, 3, "The room left the lever alone."],
  [2, 2, "The room is split down the middle."],
] as const)(
  "shows actual option consequences and the %i/%i poll verdict on stage",
  (pull, leave, verdict) => {
    render(
      <StagePlay
        snapshot={snapshot(
          {
            reveal: {
              kind: "choice",
              outcome: "poll",
              correctOptionId: null,
              tally: [
                { optionId: "leave", count: leave },
                { optionId: "derail", count: pull },
              ],
              winners: [],
              everyone: false,
            },
          },
          "reveal",
        )}
      />,
    );
    expect(screen.getByText(question.options[0]!.label)).toBeTruthy();
    expect(screen.getByText(question.options[1]!.label)).toBeTruthy();
    expect(screen.getByText(verdict)).toBeTruthy();
    expect(
      screen.getByText(
        `${pull} pulled the lever · ${Math.round((pull / (pull + leave)) * 100)}%`,
      ),
    ).toBeTruthy();
  },
);

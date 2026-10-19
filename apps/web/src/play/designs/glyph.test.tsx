import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { LobbySnapshot, PlaySnapshot } from "@26/shared";
import { GuestPlay } from "../guest-play";
import { StagePlay } from "../stage-play";
import { questionDirection } from "../question-direction";

afterEach(cleanup);
const base: PlaySnapshot = {
  question: {
    id: "word-test",
    index: 1,
    total: 1,
    prompt: "Find the word",
    kind: "wordle",
    wordLength: 5,
    maxGuesses: 6,
    presentation: "glyph",
    points: 100,
    illustrative: false,
    attribution: "never",
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
const snapshot = (play = base, phase = "collect", paused = false) =>
  ({
    phase,
    paused,
    held: false,
    play,
    trolls: { active: [] },
  }) as unknown as LobbySnapshot;
function phone(view = snapshot(), onText = vi.fn(), pending = false) {
  return (
    <GuestPlay
      snapshot={view}
      pending={pending}
      onText={onText}
      onSelect={vi.fn()}
      onSubmit={vi.fn()}
      onEstimate={vi.fn()}
      onRank={vi.fn()}
      onBallot={vi.fn()}
      onDuel={vi.fn()}
    />
  );
}
it("accepts phone keys and physical typing, waits for server feedback and retains rejected drafts", () => {
  const send = vi.fn();
  const view = render(phone(snapshot(), send));
  for (const letter of "APPLE")
    fireEvent.click(screen.getByRole("button", { name: letter }));
  fireEvent.click(screen.getByRole("button", { name: "Check word" }));
  expect(send).toHaveBeenCalledWith("APPLE");
  expect(screen.queryByLabelText("A, right position")).toBeNull();
  view.rerender(phone(snapshot(), send, true));
  expect(screen.getByRole("button", { name: "Checking…" })).toHaveProperty(
    "disabled",
    true,
  );
  view.rerender(phone(snapshot(), send));
  expect(screen.getByRole("button", { name: "Check word" })).toHaveProperty(
    "disabled",
    false,
  );
  const answered: PlaySnapshot = {
    ...base,
    selfAnswer: {
      kind: "wordle",
      guesses: [
        { word: "APPLE", marks: ["correct", "absent", "absent", "present", "absent"] },
      ],
      status: "playing",
    },
  };
  view.rerender(phone(snapshot(answered), send));
  expect(screen.getByRole("button", { name: "Check word" })).toHaveProperty(
    "disabled",
    true,
  );
  expect(screen.getAllByLabelText("A, right position").length).toBeGreaterThan(0);
  expect(questionDirection(snapshot(answered), false)).toBe(
    "Type five letters, then check your word",
  );
  for (const key of "CRANE")
    fireEvent.keyDown(screen.getByRole("region", { name: "Wordle game" }), { key });
  fireEvent.keyDown(screen.getByRole("region", { name: "Wordle game" }), {
    key: "Enter",
  });
  expect(send).toHaveBeenLastCalledWith("CRANE");
});
it("locks during prompt, pause and after six guesses; continues to show the board", async () => {
  const view = render(phone(snapshot(base, "prompt")));
  expect(screen.getByRole("button", { name: "A" })).toHaveProperty("disabled", true);
  view.rerender(phone(snapshot(base, "collect", true)));
  expect(screen.getByRole("button", { name: "A" })).toHaveProperty("disabled", true);
  view.rerender(
    phone(
      snapshot({
        ...base,
        selfAnswer: { kind: "wordle", guesses: [], status: "lost" },
      }),
    ),
  );
  expect(await screen.findByText(/Six guesses used/)).toBeTruthy();
  expect(screen.getByLabelText("Your six guesses")).toBeTruthy();
  expect(screen.getByRole("button", { name: "A" })).toHaveProperty("disabled", true);
});
it("shows only a mystery word on stage until the server supplies a reveal", () => {
  const view = render(<StagePlay snapshot={snapshot()} />);
  expect(screen.getByLabelText("Five mystery letters")).toBeTruthy();
  view.rerender(
    <StagePlay
      snapshot={snapshot(
        {
          ...base,
          reveal: { kind: "wordle", answer: "CRANE", solvedCount: 2, responseCount: 3 },
        },
        "reveal",
      )}
    />,
  );
  expect(screen.getByLabelText("The word was CRANE")).toBeTruthy();
  expect(screen.getByText("2 of 3 players who tried solved it.")).toBeTruthy();
});

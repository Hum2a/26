import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
function phone(
  view = snapshot(),
  onText = vi.fn(),
  pending = false,
  wordleFeedback?: string,
  connected = true,
) {
  return (
    <GuestPlay
      snapshot={view}
      pending={pending}
      wordleFeedback={wordleFeedback}
      connected={connected}
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
  expect(await screen.findAllByText(/Six guesses used/)).not.toHaveLength(0);
  expect(screen.getByLabelText("Your six guesses")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "A" })).toBeNull();
});

function typingSurface() {
  return screen.getByRole("region", { name: "Wordle game" });
}

function pasteWord(word: string) {
  fireEvent.paste(typingSurface(), { clipboardData: { getData: () => word } });
}

it("pastes a word, replaces individual letters and clears the active row without submitting", () => {
  const send = vi.fn();
  render(phone(snapshot(), send));
  pasteWord(" crane \n");
  fireEvent.click(screen.getByRole("button", { name: "Edit letter 1: C" }));
  fireEvent.keyDown(typingSurface(), { key: "b" });
  expect(screen.getByRole("button", { name: "Edit letter 1: B" })).toBeTruthy();
  fireEvent.keyDown(typingSurface(), { key: "ArrowRight" });
  fireEvent.keyDown(typingSurface(), { key: "o" });
  pasteWord("NOT ONE WORD");
  expect(screen.getByRole("button", { name: "Edit letter 3: O" })).toBeTruthy();
  expect(send).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Check word" }));
  expect(send).toHaveBeenCalledOnce();
  expect(send).toHaveBeenCalledWith("BRONE");
  fireEvent.click(screen.getByRole("button", { name: "Clear word" }));
  expect(screen.getByRole("button", { name: "Check word" })).toHaveProperty(
    "disabled",
    true,
  );
  expect(
    within(typingSurface()).getAllByRole("button", { name: /Edit letter \d: empty/ }),
  ).toHaveLength(5);
});

it("flags already accepted words locally, keeps a rejection beside the tiles, and blocks sends while reconnecting", () => {
  const send = vi.fn();
  const answered: PlaySnapshot = {
    ...base,
    selfAnswer: {
      kind: "wordle",
      status: "playing",
      guesses: [
        { word: "APPLE", marks: ["correct", "absent", "absent", "present", "absent"] },
      ],
    },
  };
  const view = render(phone(snapshot(answered), send));
  pasteWord("apple");
  expect(screen.getByRole("button", { name: "Check word" })).toHaveProperty(
    "disabled",
    true,
  );
  fireEvent.keyDown(typingSurface(), { key: "Enter" });
  expect(send).not.toHaveBeenCalled();
  expect(within(typingSurface()).getByRole("status").textContent).toContain(
    "already tried",
  );
  pasteWord("zzzzz");
  fireEvent.click(screen.getByRole("button", { name: "Check word" }));
  view.rerender(
    phone(snapshot(answered), send, false, "That word isn’t in the word list."),
  );
  expect(within(typingSurface()).getByRole("status").textContent).toContain(
    "isn’t in the word list",
  );
  expect(screen.getByRole("button", { name: "Edit letter 1: Z" })).toBeTruthy();
  view.rerender(phone(snapshot(answered), send, false, undefined, false));
  expect(screen.getByRole("button", { name: "Check word" })).toHaveProperty(
    "disabled",
    true,
  );
  view.rerender(phone(snapshot(answered), send));
  expect(screen.getByRole("button", { name: "Edit letter 1: Z" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Check word" })).toHaveProperty(
    "disabled",
    false,
  );
});

it("uses the round result for a player who tried before time ran out", () => {
  render(
    phone(
      snapshot(
        {
          ...base,
          selfAward: 0,
          selfAnswer: {
            kind: "wordle",
            status: "playing",
            guesses: [
              {
                word: "APPLE",
                marks: ["correct", "absent", "absent", "present", "absent"],
              },
            ],
          },
          reveal: { kind: "wordle", answer: "ABLER", solvedCount: 0, responseCount: 1 },
        },
        "reveal",
      ),
    ),
  );
  expect(screen.getByText("No points this time")).toBeTruthy();
  expect(screen.queryByText("No answer from you")).toBeNull();
  expect(screen.queryByRole("button", { name: "Check word" })).toBeNull();
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

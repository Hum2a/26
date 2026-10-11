import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { playSnapshotSchema, type LobbySnapshot, type PlaySnapshot } from "@26/shared";
import { guestRoundCopy } from "./copy";
import { choiceNote, GuestPlay } from "./guest-play";
import { outcomeLine } from "./stage-play";

const core = {
  id: "fixture",
  index: 1,
  total: 3,
  points: 100,
  illustrative: false,
  attribution: "after" as const,
  presentation: "standard",
};

function play(question: object, extra: Partial<PlaySnapshot> = {}): PlaySnapshot {
  return playSnapshotSchema.parse({
    question: { ...core, ...question },
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
    ...extra,
  });
}

function lobby(phase: string, snapshot: PlaySnapshot): LobbySnapshot {
  return {
    phase,
    paused: false,
    held: false,
    play: snapshot,
    trolls: { active: [] },
  } as unknown as LobbySnapshot;
}

const pills = {
  kind: "choice",
  prompt: "Red or blue?",
  options: [
    { id: "red", label: "Red pill" },
    { id: "blue", label: "Blue pill" },
  ],
  outcome: "threshold",
  speedBonus: false,
  modifiers: [],
  suppressSpeedBonus: false,
};

describe("choice outcomes on the phone and stage", () => {
  it("marks the room's count and who scored on a threshold reveal", () => {
    const reveal = {
      kind: "choice" as const,
      correctOptionId: null,
      outcome: "threshold" as const,
      tally: [
        { optionId: "red", count: 2 },
        { optionId: "blue", count: 1 },
      ],
      winners: ["red"],
      everyone: false,
      met: false,
    };
    expect(choiceNote(reveal, "red")).toBe(" — 2 votes, scored");
    expect(choiceNote(reveal, "blue")).toBe(" — 1 vote");
    expect(outcomeLine(reveal, pills.options)).toBe("Red pill scores.");
    expect(outcomeLine({ ...reveal, everyone: true, winners: [] }, pills.options)).toBe(
      "Everyone who answered scores.",
    );
  });

  it("names the poll leader or a tie, and never claims a right answer", () => {
    const options = [
      { id: "derail", label: "Yes, derail it" },
      { id: "leave", label: "No, leave it" },
    ];
    const reveal = {
      kind: "choice" as const,
      correctOptionId: null,
      outcome: "poll" as const,
      tally: [
        { optionId: "derail", count: 3 },
        { optionId: "leave", count: 1 },
      ],
      winners: [],
      everyone: false,
      met: null,
    };
    expect(outcomeLine(reveal, options)).toBe("Yes, derail it wins the room.");
    expect(
      outcomeLine(
        {
          ...reveal,
          tally: [
            { optionId: "derail", count: 2 },
            { optionId: "leave", count: 2 },
          ],
        },
        options,
      ),
    ).toBe("A tie between Yes, derail it and No, leave it.");
    expect(choiceNote(reveal, "derail")).toBe(" — 3 votes");
    const revealed = play(
      { ...pills, outcome: "poll", points: 0 },
      {
        selfAnswer: { kind: "choice", optionId: "red" },
        reveal: { ...reveal, tally: [], winners: [] },
      },
    );
    expect(guestRoundCopy(lobby("reveal", revealed))).toBe(
      "Your vote is in the count.",
    );
  });

  it("tells a threshold guest whether their side scored", () => {
    const base = {
      kind: "choice" as const,
      correctOptionId: null,
      outcome: "threshold" as const,
      winners: ["red"],
      everyone: false,
    };
    const scored = play(pills, {
      selfAnswer: { kind: "choice", optionId: "red" },
      reveal: base,
      selfAward: 100,
    });
    expect(guestRoundCopy(lobby("reveal", scored))).toBe(
      "Your side scored. You got 100.",
    );
    const lost = play(pills, {
      selfAnswer: { kind: "choice", optionId: "blue" },
      reveal: base,
      selfAward: 0,
    });
    expect(guestRoundCopy(lobby("reveal", lost))).toBe("Your side scored 0.");
  });
});

describe("typed answers", () => {
  const typed = { kind: "typed", prompt: "What was their real name?", maxLength: 40 };

  it("offers a labelled answer box during collect and sends the text", () => {
    const onText = vi.fn();
    render(
      <GuestPlay
        snapshot={lobby("collect", play(typed))}
        pending={false}
        onSelect={vi.fn()}
        onSubmit={vi.fn()}
        onEstimate={vi.fn()}
        onRank={vi.fn()}
        onText={onText}
        onBallot={vi.fn()}
        onDuel={vi.fn()}
      />,
    );
    const field = screen.getByLabelText("Your answer");
    expect(field.getAttribute("maxlength")).toBe("40");
    fireEvent.change(field, { target: { value: "Jon Harvey" } });
    fireEvent.click(screen.getByRole("button", { name: /send answer/i }));
    expect(onText).toHaveBeenCalledWith("Jon Harvey");
    expect(guestRoundCopy(lobby("collect", play(typed)))).toBe("Type your answer.");
  });

  it("reports a right or wrong typed answer at the reveal", () => {
    const reveal = {
      kind: "typed" as const,
      answer: "Jon Harvey",
      correctCount: 1,
      responseCount: 2,
      correctNames: null,
    };
    const right = play(typed, {
      selfAnswer: { kind: "text", body: "jon harvey" },
      reveal,
      selfAward: 100,
    });
    expect(guestRoundCopy(lobby("reveal", right))).toBe("You got it. You scored 100.");
    const wrong = play(typed, {
      selfAnswer: { kind: "text", body: "Count Binface" },
      reveal,
      selfAward: 0,
    });
    expect(guestRoundCopy(lobby("reveal", wrong))).toBe("That was not the answer.");
  });
});

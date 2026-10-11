import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  customPresentationIds,
  type LobbySnapshot,
  type PlaySnapshot,
} from "@26/shared";
import { GuestPlay } from "../guest-play";
import { StagePlay } from "../stage-play";
import { previewQuestions, previewReveal } from "./preview/fixtures";
import { designs } from "./registry";

afterEach(cleanup);

function play(
  question: PlaySnapshot["question"],
  extra: Partial<PlaySnapshot> = {},
): PlaySnapshot {
  return {
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
  };
}

function lobby(phase: string, snapshot: PlaySnapshot): LobbySnapshot {
  return {
    phase,
    paused: false,
    held: false,
    finishAfterRound: false,
    play: snapshot,
    trolls: { active: [] },
  } as unknown as LobbySnapshot;
}

function phone(
  snapshot: LobbySnapshot,
  handlers: Partial<Parameters<typeof GuestPlay>[0]> = {},
) {
  return render(
    <GuestPlay
      snapshot={snapshot}
      pending={false}
      onSelect={vi.fn()}
      onSubmit={vi.fn()}
      onEstimate={vi.fn()}
      onRank={vi.fn()}
      onText={vi.fn()}
      onBallot={vi.fn()}
      onDuel={vi.fn()}
      {...handlers}
    />,
  );
}

describe("custom question designs", () => {
  it("registers exactly one design for every shared presentation id", () => {
    expect(Object.keys(designs).sort()).toEqual([...customPresentationIds].sort());
  });

  for (const id of customPresentationIds) {
    it(`${id} draws the phone and stage before, during and after answers`, () => {
      const question = previewQuestions[id];
      for (const phase of ["prompt", "collect", "reveal"]) {
        const reveal =
          phase === "reveal" ? previewReveal(question, undefined, 2) : null;
        const snapshot = lobby(phase, play(question, { reveal }));
        const guest = phone(snapshot);
        expect(guest.container.querySelector(".design-phone")).not.toBeNull();
        expect(guest.container.textContent).toContain(question.prompt);
        guest.unmount();
        const stage = render(<StagePlay snapshot={snapshot} />);
        expect(stage.container.querySelector(".design-stage")).not.toBeNull();
        stage.unmount();
      }
    });
  }

  it("selects and sends a choice through the phone's own handlers", () => {
    const onSelect = vi.fn();
    const onSubmit = vi.fn();
    const question = previewQuestions["now-playing"];
    const view = phone(lobby("collect", play(question)), { onSelect, onSubmit });
    fireEvent.click(screen.getByRole("button", { name: /screaming goat sounds/i }));
    expect(onSelect).toHaveBeenCalledWith("goat");
    view.rerender(
      <GuestPlay
        snapshot={lobby("collect", play(question))}
        selectedId="goat"
        pending={false}
        onSelect={onSelect}
        onSubmit={onSubmit}
        onEstimate={vi.fn()}
        onRank={vi.fn()}
        onText={vi.fn()}
        onBallot={vi.fn()}
        onDuel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /play this one/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("keeps choices locked before answers open", () => {
    phone(lobby("prompt", play(previewQuestions["number-plate"])));
    expect(screen.getByRole("button", { name: /hagakure/i })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("sends a typed answer from the redaction bar, including with the keyboard's Go key", () => {
    const onText = vi.fn();
    phone(lobby("collect", play(previewQuestions["redacted-file"])), { onText });
    const field = screen.getByLabelText("Real name");
    fireEvent.change(field, { target: { value: "Someone Else" } });
    fireEvent.submit(field.closest("form") as HTMLFormElement);
    expect(onText).toHaveBeenCalledWith("Someone Else");
  });

  it("ranks on the rage meter by tapping a trigger, then its heat", () => {
    const onRank = vi.fn();
    phone(lobby("collect", play(previewQuestions["rage-meter"])), { onRank });
    const order = ["Apple", "Palm Beach Pete", "Politics", "Conspiracy theories"];
    const tiers = ["Fastest", "2nd", "3rd", "Slowest"];
    order.forEach((label, index) => {
      fireEvent.click(screen.getByRole("button", { name: label }));
      fireEvent.click(
        screen.getByRole("button", { name: new RegExp(`^${tiers[index]}`) }),
      );
    });
    fireEvent.click(screen.getByRole("button", { name: /send ranking/i }));
    expect(onRank).toHaveBeenCalledWith([
      { itemId: "apple", tierId: "first" },
      { itemId: "palm-beach-pete", tierId: "second" },
      { itemId: "politics", tierId: "third" },
      { itemId: "conspiracy", tierId: "fourth" },
    ]);
  });

  it("shows the true order on the phone at the reveal, even without a ranking", () => {
    const question = previewQuestions["rage-meter"];
    const reveal = previewReveal(question, undefined, 1);
    phone(lobby("reveal", play(question, { reveal })));
    expect(screen.getByRole("button", { name: "Fastest: Apple" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Slowest: Politics" })).toBeTruthy();
  });

  it("declares the room's verdict on the pill stage", () => {
    const question = previewQuestions["red-blue-pill"];
    const reveal = {
      kind: "choice" as const,
      correctOptionId: null,
      outcome: "threshold" as const,
      tally: [
        { optionId: "red", count: 1 },
        { optionId: "blue", count: 3 },
      ],
      winners: [],
      everyone: true,
      met: true,
    };
    render(<StagePlay snapshot={lobby("reveal", play(question, { reveal }))} />);
    expect(screen.getByText("Over half took blue. Everyone lives.")).toBeTruthy();
  });

  it("falls back to the standard view when a design meets the wrong kind", () => {
    const typed = { ...previewQuestions["deed-poll"], presentation: "now-playing" };
    const view = phone(lobby("collect", play(typed)));
    expect(view.container.querySelector(".design-phone")).toBeNull();
    expect(screen.getByLabelText("Your answer")).toBeTruthy();
  });
});

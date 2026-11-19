import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { MotionConfig } from "motion/react";
import { playSnapshotSchema, type PlaySnapshot } from "@26/shared";
import { GuestMultiple } from "./guest-multiple";
import { GuestOrdered } from "./guest-ordered";
import { GuestSlider } from "./guest-slider";
import { GuestBallot } from "./guest-ballot";
import { StagePlay } from "./stage-play";
import type { LobbySnapshot } from "@26/shared";

const core = {
  id: "fixture",
  index: 1,
  total: 1,
  prompt: "Stand-in question",
  points: 100,
  illustrative: true,
  attribution: "after",
  presentation: "standard",
};
function play(question: object, extra: object = {}): PlaySnapshot {
  return playSnapshotSchema.parse({
    question: { ...core, ...question },
    selfAnswer: null,
    selfBallot: null,
    submissionCount: 0,
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

it("selects several options, sends one set, and distinguishes pending from accepted", () => {
  const onSubmit = vi.fn();
  const snapshot = play({
    kind: "choice",
    outcome: "multiple",
    options: [
      { id: "sun", label: "Sun" },
      { id: "moon", label: "Moon" },
      { id: "stars", label: "Stars" },
    ],
    speedBonus: false,
    modifiers: [],
    suppressSpeedBonus: false,
  });
  const { rerender } = render(
    <MotionConfig reducedMotion="always">
      <GuestMultiple play={snapshot} open pending={false} onSubmit={onSubmit} />
    </MotionConfig>,
  );
  expect(
    (screen.getByRole("button", { name: "Send selections" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Sun" }));
  fireEvent.click(screen.getByRole("button", { name: "Moon" }));
  expect(screen.getByRole("button", { name: "Sun" }).getAttribute("aria-pressed")).toBe(
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Send selections" }));
  expect(onSubmit).toHaveBeenCalledWith('["sun","moon"]');
  rerender(<GuestMultiple play={snapshot} open={false} pending onSubmit={onSubmit} />);
  expect(
    (screen.getByRole("button", { name: "Sun" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect(screen.queryByRole("button", { name: "Locked in ✓" })).toBeNull();
  rerender(
    <GuestMultiple
      play={{
        ...snapshot,
        selfAnswer: { kind: "multiple", optionIds: ["sun", "moon"] },
      }}
      open={false}
      pending={false}
      onSubmit={onSubmit}
    />,
  );
  expect(
    (screen.getByRole("button", { name: "Locked in ✓" }) as HTMLButtonElement).disabled,
  ).toBe(true);
});

it("offers keyboard-accessible reordering and submits the visible order", () => {
  const onSubmit = vi.fn();
  const snapshot = play({
    kind: "rank",
    mode: "complete",
    ties: "forbidden",
    input: "ordered",
    scoring: "consensus",
    items: [
      { id: "one", label: "First stand-in" },
      { id: "two", label: "Second stand-in" },
    ],
    tiers: [
      { id: "least", label: "Least" },
      { id: "most", label: "Most" },
    ],
  });
  if (snapshot.question.kind !== "rank") throw new Error("Rank fixture");
  render(
    <MotionConfig reducedMotion="always">
      <GuestOrdered
        question={snapshot.question}
        open
        pending={false}
        onSubmit={onSubmit}
      />
    </MotionConfig>,
  );
  expect(
    (
      screen.getByRole("button", {
        name: "Move First stand-in up",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Move First stand-in down" }));
  expect(
    (
      screen.getByRole("button", {
        name: "Move Second stand-in up",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Send ranking" }));
  expect(onSubmit).toHaveBeenCalledWith([
    { itemId: "two", tierId: "least" },
    { itemId: "one", tierId: "most" },
  ]);
});

it("requires a valid price before sending and preserves decimal pounds", () => {
  const onSubmit = vi.fn();
  const snapshot = play({
    kind: "slider",
    input: "number",
    scoring: "under",
    minimum: 0,
    maximum: 20,
    step: 0.01,
    initial: 0,
    unit: "£",
  });
  const { rerender } = render(
    <GuestSlider play={snapshot} open pending={false} onSubmit={onSubmit} />,
  );
  const input = screen.getByLabelText("Your price (£)");
  expect(
    (screen.getByRole("button", { name: "Lock in price" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  for (const value of ["-1", "21", "1.999", "nope"]) {
    fireEvent.change(input, { target: { value } });
    expect(
      (screen.getByRole("button", { name: "Lock in price" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  }
  fireEvent.change(input, { target: { value: "7.29" } });
  fireEvent.click(screen.getByRole("button", { name: "Lock in price" }));
  expect(onSubmit).toHaveBeenCalledWith(7.29);
  rerender(
    <GuestSlider
      play={{ ...snapshot, selfAnswer: { kind: "slider", value: 7.29 } }}
      open={false}
      pending={false}
      onSubmit={onSubmit}
    />,
  );
  expect((screen.getByLabelText("Your price (£)") as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect(
    (screen.getByRole("button", { name: "Locked in ✓" }) as HTMLButtonElement).disabled,
  ).toBe(true);
});

it("resets the visible selection when a new award ballot arrives", () => {
  const onSubmit = vi.fn();
  const snapshot = play(
    {
      kind: "vote",
      flow: "awards",
      candidateMode: "all",
      selfVote: "forbidden",
      votes: 1,
      tie: "shared",
      award: "authors",
      lateJoin: "ineligible",
    },
    {
      ballot: {
        total: 2,
        epoch: 0,
        label: "Stand-in award one",
        reason: "open",
        cards: [
          { id: "a", label: "Sample one", own: false, selectable: true, author: null },
          { id: "b", label: "Sample two", own: false, selectable: true, author: null },
        ],
      },
    },
  );
  const { rerender } = render(
    <GuestBallot
      play={snapshot}
      blocked={false}
      pending={false}
      search={false}
      onSubmit={onSubmit}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Sample one" }));
  expect(
    (screen.getByRole("button", { name: "Send vote" }) as HTMLButtonElement).disabled,
  ).toBe(false);
  rerender(
    <GuestBallot
      play={{
        ...snapshot,
        ballot: { ...snapshot.ballot!, epoch: 1, label: "Stand-in award two" },
      }}
      blocked={false}
      pending={false}
      search={false}
      onSubmit={onSubmit}
    />,
  );
  expect(
    (screen.getByRole("button", { name: "Send vote" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect(screen.getByRole("heading", { name: "Stand-in award two" })).toBeTruthy();
});

const tournament = {
  kind: "vote",
  flow: "tournament",
  candidateMode: "all",
  selfVote: "forbidden",
  votes: 1,
  tie: "shared",
  award: "authors",
  lateJoin: "ineligible",
};

it("steps a phone through its own phone-round pairs, then locks in", () => {
  const onSubmit = vi.fn();
  const pair = (epoch: number, ids: [string, string]) =>
    play(tournament, {
      ballot: {
        total: 80,
        epoch,
        label: `Phone round · pair ${epoch + 1} of 5`,
        instruction: "Pick the worse search. Everyone gets different pairs.",
        heat: { done: epoch, total: 5, finalists: 8 },
        reason: "open",
        cards: ids.map((id) => ({
          id,
          label: `Search ${id}`,
          own: false,
          selectable: true,
          author: null,
        })),
      },
    });
  const { rerender } = render(
    <GuestBallot
      play={pair(0, ["a", "b"])}
      blocked={false}
      pending={false}
      search={false}
      onSubmit={onSubmit}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Search b" }));
  fireEvent.click(screen.getByRole("button", { name: "Send vote" }));
  expect(onSubmit).toHaveBeenCalledWith("b");
  rerender(
    <GuestBallot
      play={pair(1, ["c", "d"])}
      blocked={false}
      pending={false}
      search={false}
      onSubmit={onSubmit}
    />,
  );
  expect(
    screen.getByRole("heading", { name: "Phone round · pair 2 of 5" }),
  ).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Send vote" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  const done = pair(4, ["i", "j"]);
  rerender(
    <GuestBallot
      play={{
        ...done,
        selfBallot: { candidateId: "j" },
        ballot: { ...done.ballot!, label: "Phone round · all 5 done" },
      }}
      blocked={false}
      pending={false}
      search={false}
      onSubmit={onSubmit}
    />,
  );
  expect(screen.getByRole("button", { name: "Locked in ✓" })).toBeTruthy();
});

it("shows the room's phone-round progress on the projector, not a pair", () => {
  const snapshot = play(tournament, {
    submissionCount: 120,
    ballot: {
      total: 80,
      epoch: 0,
      label: "Phone round",
      heat: { done: 120, total: 400, finalists: 8 },
      reason: "open",
      cards: [],
    },
  });
  render(
    <StagePlay
      snapshot={{ phase: "vote", play: snapshot } as unknown as LobbySnapshot}
    />,
  );
  expect(
    screen.getByRole("heading", { name: "Phone round: check your phone" }),
  ).toBeTruthy();
  expect(screen.getByText("120 of 400 votes in")).toBeTruthy();
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("120");
  expect(screen.getByText(/The top 8 come up here/)).toBeTruthy();
  expect(screen.queryByText(/The phones have the full list/)).toBeNull();
});

it("reveals the three independent stage awards without showing a misleading empty ballot", () => {
  const snapshot = play(
    {
      kind: "vote",
      flow: "awards",
      candidateMode: "all",
      selfVote: "forbidden",
      votes: 1,
      tie: "shared",
      award: "authors",
      lateJoin: "ineligible",
    },
    {
      reveal: {
        kind: "vote",
        totalBallots: 4,
        featured: false,
        winnerCount: 2,
        winners: [
          { id: "a", label: "Sample one" },
          { id: "b", label: "Sample two" },
        ],
        cards: [],
        awards: [
          {
            label: "Stand-in Smooth",
            winnerCount: 1,
            winners: [{ id: "a", label: "Sample one" }],
          },
          {
            label: "Stand-in Brutal",
            winnerCount: 1,
            winners: [{ id: "b", label: "Sample two" }],
          },
          { label: "Stand-in Scene", winnerCount: 0, winners: [] },
        ],
      },
    },
  );
  render(
    <StagePlay
      snapshot={{ phase: "reveal", play: snapshot } as unknown as LobbySnapshot}
    />,
  );
  expect(screen.getByRole("heading", { name: "Stand-in Smooth" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Stand-in Brutal" })).toBeTruthy();
  expect(screen.getByText("No votes — no award")).toBeTruthy();
  expect(screen.queryByText("0 choices are on the ballot.")).toBeNull();
});

it("formats a price reveal in pounds and preserves empty consensus as no estimates", () => {
  const snapshot = play(
    {
      kind: "slider",
      input: "number",
      scoring: "under",
      minimum: 0,
      maximum: 20,
      step: 0.01,
      initial: 0,
      unit: "£",
    },
    { reveal: { kind: "slider", truth: 4.25, unit: "£", guesses: [] } },
  );
  const { rerender } = render(
    <StagePlay
      snapshot={{ phase: "reveal", play: snapshot } as unknown as LobbySnapshot}
    />,
  );
  expect(screen.getByText("The answer is £4.25.")).toBeTruthy();
  rerender(
    <StagePlay
      snapshot={
        {
          phase: "reveal",
          play: {
            ...snapshot,
            reveal: { kind: "slider", truth: null, unit: "/100", guesses: [] },
          },
        } as unknown as LobbySnapshot
      }
    />,
  );
  expect(screen.getByText("No estimates this round.")).toBeTruthy();
});

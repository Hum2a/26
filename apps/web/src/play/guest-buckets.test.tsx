import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { GuestRank } from "./guest-rank";
import type { PlaySnapshot } from "@26/shared";
import type { LobbySnapshot } from "@26/shared";
import { StagePlay } from "./stage-play";

const items = Array.from({ length: 18 }, (_, i) => ({
  id: `quote-${i}`,
  label: `Stand-in quotation ${i + 1}`,
}));
const play = {
  question: {
    kind: "rank",
    id: "sort-fixture",
    input: "buckets",
    scoring: "placement",
    mode: "complete",
    ties: "shared",
    items,
    tiers: [
      { id: "ed", label: "Ed" },
      { id: "humza", label: "Humza" },
    ],
  },
  selfAnswer: null,
} as unknown as PlaySnapshot;

it("assigns the whole list, allows corrections and sends one complete submission", () => {
  const onSubmit = vi.fn();
  render(<GuestRank play={play} open pending={false} onSubmit={onSubmit} />);
  const send = screen.getByRole("button", {
    name: "Send assignments",
  }) as HTMLButtonElement;
  expect(send.disabled).toBe(true);
  const groups = screen.getAllByRole("group");
  for (const group of groups)
    fireEvent.click(within(group).getByRole("button", { name: "Ed" }));
  fireEvent.click(within(groups[0]!).getByRole("button", { name: "Humza" }));
  expect(screen.getByRole("status").textContent).toContain("18 / 18");
  expect(send.disabled).toBe(false);
  fireEvent.click(send);
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(onSubmit.mock.calls[0]![0]).toHaveLength(18);
  expect(onSubmit.mock.calls[0]![0]).toContainEqual({
    itemId: "quote-0",
    tierId: "humza",
  });
});

it.each(["pending", "accepted", "paused"])(
  "locks assignment controls while %s",
  (state) => {
    const accepted = items.map((item) => ({ itemId: item.id, tierId: "ed" }));
    render(
      <GuestRank
        play={{
          ...play,
          selfAnswer:
            state === "accepted" ? { kind: "rank", placements: accepted } : null,
        }}
        open={state !== "paused"}
        pending={state === "pending"}
        onSubmit={vi.fn()}
      />,
    );
    expect(
      screen
        .getAllByRole("button", { name: "Ed" })
        .every((button) => (button as HTMLButtonElement).disabled),
    ).toBe(true);
    if (state === "accepted")
      expect(
        screen
          .getAllByRole("button", { name: "Ed" })
          .every((button) => button.getAttribute("aria-pressed") === "true"),
      ).toBe(true);
  },
);

it("keeps speaker answers off stage before reveal, then reveals quotes under their person", () => {
  const publicPlay = {
    ...play,
    question: { ...play.question, presentation: "standard", prompt: "Sort the quotes" },
    submissionCount: 3,
    reveal: null,
    standings: null,
  };
  const snapshot = {
    phase: "collect",
    paused: false,
    held: false,
    play: publicPlay,
    trolls: { active: [] },
  } as unknown as LobbySnapshot;
  const view = render(<StagePlay snapshot={snapshot} />);
  expect(screen.getByText("3 submissions in.")).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Ed quotes" })).toBeNull();
  view.rerender(
    <StagePlay
      snapshot={{
        ...snapshot,
        phase: "reveal",
        play: {
          ...publicPlay,
          reveal: {
            kind: "rank",
            order: [
              { tierId: "ed", label: "Ed", itemIds: ["quote-0"] },
              { tierId: "humza", label: "Humza", itemIds: ["quote-1"] },
            ],
            rankings: [],
          },
        } as PlaySnapshot,
      }}
    />,
  );
  expect(
    within(screen.getByRole("region", { name: "Ed quotes" })).getByText(
      "Stand-in quotation 1",
    ),
  ).toBeTruthy();
  expect(
    within(screen.getByRole("region", { name: "Humza quotes" })).getByText(
      "Stand-in quotation 2",
    ),
  ).toBeTruthy();
});

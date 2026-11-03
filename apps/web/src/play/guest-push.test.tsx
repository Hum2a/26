import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}));
import type { LobbySnapshot } from "@26/shared";
import { playingFixture } from "../admin/controls.test-support";
import { GuestPush } from "./guest-push";

const push = {
  lines: ["keyboard", "pigeon", "incognito", "Surrey"],
  lineMs: 6_000,
  banks: [100, 250, 450, 700],
  windowMs: 30_000,
};

function snapshot(
  extra: Partial<LobbySnapshot>,
  play: Partial<NonNullable<LobbySnapshot["play"]>> = {},
): LobbySnapshot {
  return {
    ...playingFixture,
    ...extra,
    play: {
      ...playingFixture.play!,
      question: {
        ...playingFixture.play!.question,
        kind: "choice",
        outcome: "push",
        options: [
          { id: "bail", label: "BAIL" },
          { id: "hold", label: "Keep going" },
        ],
        push,
      } as NonNullable<LobbySnapshot["play"]>["question"],
      ...play,
    },
  };
}

it("reveals lines on the room's clock and bails with the showing bank", () => {
  const now = Date.now();
  const onBail = vi.fn();
  // 23 seconds left of 30: the second line is showing.
  render(
    <GuestPush
      snapshot={snapshot({
        phase: "collect",
        deadlineAt: now + 23_000,
        serverNow: now,
      })}
      push={push}
      observedAt={now}
      open
      pending={false}
      onBail={onBail}
    />,
  );
  expect(screen.getByText("keyboard")).toBeTruthy();
  expect(screen.getByText("pigeon")).toBeTruthy();
  expect(screen.queryByText("incognito")).toBeNull();
  expect(screen.getByText("Hold for the next line: 450")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "BAIL — bank 250" }));
  expect(onBail).toHaveBeenCalledTimes(1);
});

it("shows the server's bail line, then the Raid at the reveal", () => {
  const now = Date.now();
  const view = render(
    <GuestPush
      snapshot={snapshot(
        { phase: "collect", deadlineAt: now + 5_000, serverNow: now },
        { selfAnswer: { kind: "choice", optionId: "bail", pushLine: 1 } },
      )}
      push={push}
      observedAt={now}
      onBail={vi.fn()}
    />,
  );
  expect(screen.getByText("You bailed with")).toBeTruthy();
  expect(document.querySelector(".push-bank-value")?.textContent).toContain("250");
  view.rerender(
    <GuestPush
      snapshot={snapshot(
        { phase: "reveal", deadlineAt: null },
        {
          selfAnswer: { kind: "choice", optionId: "bail", pushLine: 1 },
          reveal: {
            kind: "choice",
            correctOptionId: null,
            outcome: "push",
            raidAfter: 3,
            tally: [{ optionId: "bail", count: 1 }],
          },
        },
      )}
      push={push}
      observedAt={now}
      onBail={vi.fn()}
    />,
  );
  expect(screen.getByRole("status").textContent).toBe("RAID after line 3.");
  expect(screen.getByText("Surrey")).toBeTruthy();
});

it("keeps BAIL off the projector and counts the room's bails", () => {
  const now = Date.now();
  render(
    <GuestPush
      snapshot={snapshot(
        { phase: "collect", deadlineAt: now + 20_000, serverNow: now },
        { submissionCount: 1 },
      )}
      push={push}
      observedAt={now}
      stage
    />,
  );
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByText("1 of 1 have bailed")).toBeTruthy();
});

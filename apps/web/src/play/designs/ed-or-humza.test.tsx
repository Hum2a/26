import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { LobbySnapshot, PlaySnapshot } from "@26/shared";
import { GuestPlay } from "../guest-play";
import { StagePlay } from "../stage-play";
import { previewQuestions, previewReveal } from "./preview/fixtures";

afterEach(cleanup);

const question = previewQuestions["ed-or-humza"];

function snapshot(phase = "collect", extra: Partial<PlaySnapshot> = {}): LobbySnapshot {
  return {
    phase,
    paused: false,
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

it("sorts fixture quotes one at a time and sends the whole list", () => {
  const callbacks = handlers();
  render(<GuestPlay snapshot={snapshot()} pending={false} {...callbacks} />);
  expect(screen.getByText(question.prompt)).toBeTruthy();
  expect(screen.getByText(/Stand-in: I only came for the crisps/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Ed" }));
  fireEvent.click(screen.getByRole("button", { name: "Humza" }));
  expect(screen.getByText(/2 of 8 sorted/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Undo/ }));
  expect(screen.getByText(/1 of 8 sorted/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Humza" }));
  const send = screen.getByRole("button", { name: "Send assignments" });
  expect(send).toHaveProperty("disabled", true);
  for (let i = 0; i < 6; i += 1) {
    fireEvent.click(screen.getByRole("button", { name: i % 2 ? "Humza" : "Ed" }));
  }
  fireEvent.click(send);
  expect(callbacks.onRank).toHaveBeenCalledOnce();
  const placements = callbacks.onRank.mock.calls[0]![0] as {
    itemId: string;
    tierId: string;
  }[];
  expect(placements).toHaveLength(8);
  expect(new Set(placements.map((entry) => entry.itemId)).size).toBe(8);
});

it("lets a guest move a quote back from a pile", () => {
  const callbacks = handlers();
  render(<GuestPlay snapshot={snapshot()} pending={false} {...callbacks} />);
  fireEvent.click(screen.getByRole("button", { name: "Ed" }));
  fireEvent.click(screen.getByRole("button", { name: "Ed 1" }));
  fireEvent.click(screen.getByRole("button", { name: /Move back/ }));
  expect(screen.getByText(/0 of 8 sorted/)).toBeTruthy();
  expect(screen.getByText(/Stand-in: I only came for the crisps/)).toBeTruthy();
});

it("expands a long stand-in quote without using a real attribution", () => {
  render(<GuestPlay snapshot={snapshot()} pending={false} {...handlers()} />);
  fireEvent.click(screen.getByRole("button", { name: "Ed" }));
  fireEvent.click(screen.getByRole("button", { name: "Ed" }));
  expect(screen.getByRole("button", { name: "Show full quote" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Show full quote" }));
  expect(screen.getByRole("button", { name: "Show less" })).toBeTruthy();
});

it("shows the stand-in speaker groups on the projector only after reveal", () => {
  const view = render(<StagePlay snapshot={snapshot()} />);
  expect(screen.queryByText(/Stand-in: I only came for the crisps/)).toBeNull();
  view.rerender(
    <StagePlay
      snapshot={snapshot("reveal", { reveal: previewReveal(question, undefined, 1) })}
    />,
  );
  expect(screen.getByText(/Stand-in: I only came for the crisps/)).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Ed" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Humza" })).toBeTruthy();
});

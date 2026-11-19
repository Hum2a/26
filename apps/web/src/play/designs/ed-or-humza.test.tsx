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

it("sorts fixture quotes one at a time and sends the whole list once", () => {
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
  fireEvent.click(send);
  expect(callbacks.onRank).toHaveBeenCalledOnce();
  const placements = callbacks.onRank.mock.calls[0]![0] as {
    itemId: string;
    tierId: string;
  }[];
  expect(placements).toHaveLength(8);
  expect(new Set(placements.map((entry) => entry.itemId)).size).toBe(8);
});

function dispatchPointer(
  target: Element,
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  {
    pointerId,
    clientX,
    clientY,
    timeStamp,
  }: { pointerId: number; clientX: number; clientY: number; timeStamp?: number },
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    button: 0,
  });
  Object.defineProperty(event, "pointerId", { value: pointerId });
  if (timeStamp !== undefined) {
    Object.defineProperty(event, "timeStamp", { value: timeStamp });
  }
  fireEvent(target, event);
}

it("assigns on horizontal drag and fast flick, ignores vertical scroll and pointercancel", () => {
  const callbacks = handlers();
  const { container } = render(
    <GuestPlay snapshot={snapshot()} pending={false} {...callbacks} />,
  );
  const firstCard = container.querySelector(".ed-card") as HTMLElement;

  // Vertical pan does not assign the quote.
  dispatchPointer(firstCard, "pointerdown", {
    pointerId: 1,
    clientX: 160,
    clientY: 200,
    timeStamp: 100,
  });
  dispatchPointer(firstCard, "pointermove", {
    pointerId: 1,
    clientX: 164,
    clientY: 120,
    timeStamp: 140,
  });
  dispatchPointer(firstCard, "pointerup", {
    pointerId: 1,
    clientX: 164,
    clientY: 120,
    timeStamp: 160,
  });
  expect(screen.getByText(/0 of 8 sorted/)).toBeTruthy();

  // Cancelled pointer does not assign even after horizontal movement.
  dispatchPointer(firstCard, "pointerdown", {
    pointerId: 2,
    clientX: 200,
    clientY: 200,
    timeStamp: 200,
  });
  dispatchPointer(firstCard, "pointermove", {
    pointerId: 2,
    clientX: 80,
    clientY: 200,
    timeStamp: 250,
  });
  dispatchPointer(firstCard, "pointercancel", {
    pointerId: 2,
    clientX: 80,
    clientY: 200,
    timeStamp: 260,
  });
  expect(screen.getByText(/0 of 8 sorted/)).toBeTruthy();

  // Slow horizontal drag left assigns quote 1 to Ed.
  dispatchPointer(firstCard, "pointerdown", {
    pointerId: 3,
    clientX: 220,
    clientY: 200,
    timeStamp: 300,
  });
  dispatchPointer(firstCard, "pointermove", {
    pointerId: 3,
    clientX: 120,
    clientY: 202,
    timeStamp: 700,
  });
  dispatchPointer(firstCard, "pointerup", {
    pointerId: 3,
    clientX: 120,
    clientY: 202,
    timeStamp: 760,
  });
  expect(screen.getByText(/1 of 8 sorted/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Ed 1" })).toBeTruthy();

  // Fast flick right assigns quote 2 to Humza even over a short distance (45px in 60ms).
  const secondCard = container.querySelector(".ed-card") as HTMLElement;
  dispatchPointer(secondCard, "pointerdown", {
    pointerId: 4,
    clientX: 140,
    clientY: 200,
    timeStamp: 900,
  });
  dispatchPointer(secondCard, "pointermove", {
    pointerId: 4,
    clientX: 185,
    clientY: 201,
    timeStamp: 950,
  });
  dispatchPointer(secondCard, "pointerup", {
    pointerId: 4,
    clientX: 185,
    clientY: 201,
    timeStamp: 960,
  });
  expect(screen.getByText(/2 of 8 sorted/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Humza 1" })).toBeTruthy();
});

it("restores the last card on undo, including after all quotes are sorted", () => {
  render(<GuestPlay snapshot={snapshot()} pending={false} {...handlers()} />);
  for (let i = 0; i < 8; i += 1) {
    fireEvent.click(screen.getByRole("button", { name: i % 2 ? "Humza" : "Ed" }));
  }
  expect(screen.getByText(/8 of 8 sorted/)).toBeTruthy();
  expect(screen.getByText(/All quotes assigned/)).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: /Undo/ }));
  expect(screen.getByText(/7 of 8 sorted/)).toBeTruthy();
  expect(screen.getByText(/Last fixture line for the design bench/)).toBeTruthy();
});

it("lets a guest expand long quotes in a review pile, move between piles, or move back", () => {
  const callbacks = handlers();
  render(<GuestPlay snapshot={snapshot()} pending={false} {...callbacks} />);
  // Sort first three quotes into Ed (quote 3 is the long stand-in quote).
  fireEvent.click(screen.getByRole("button", { name: "Ed" }));
  fireEvent.click(screen.getByRole("button", { name: "Ed" }));
  fireEvent.click(screen.getByRole("button", { name: "Ed" }));

  fireEvent.click(screen.getByRole("button", { name: "Ed 3" }));
  const expandLong = screen.getByRole("button", {
    name: /A much longer invented line/,
  });
  expect(expandLong.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(expandLong);
  expect(expandLong.getAttribute("aria-expanded")).toBe("true");

  // Move quote 1 to Humza, then undo restores it to Ed.
  const moveToHumza = screen.getAllByRole("button", { name: "Move to Humza" })[0]!;
  fireEvent.click(moveToHumza);
  expect(screen.getByRole("button", { name: "Ed 2" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Humza 1" })).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: /Undo/ }));
  expect(screen.getByRole("button", { name: "Ed 3" })).toBeTruthy();

  // Move quote 1 back to the deck.
  const moveBack = screen.getAllByRole("button", { name: /Move back/ })[0]!;
  fireEvent.click(moveBack);
  expect(screen.getByText(/2 of 8 sorted/)).toBeTruthy();
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

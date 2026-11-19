import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Browser } from "leaflet";
import type { LobbySnapshot, PlaySnapshot } from "@26/shared";
import { GuestPlay } from "../guest-play";
import { StagePlay } from "../stage-play";
import { previewQuestions, previewReveal } from "./preview/fixtures";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const question = previewQuestions["where-are-we"];

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

const handlers = (onMapPin = vi.fn()) => ({
  onSelect: vi.fn(),
  onSubmit: vi.fn(),
  onEstimate: vi.fn(),
  onMapPin,
  onRank: vi.fn(),
  onText: vi.fn(),
  onBallot: vi.fn(),
  onDuel: vi.fn(),
});

function stubMap() {
  Object.assign(Browser, { svg: true });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ type: "FeatureCollection", features: [] })),
  );
}

it("shows the stand-in clue, reserves the pin readout, and sends a pin through onMapPin", async () => {
  stubMap();
  const callbacks = handlers();
  render(<GuestPlay snapshot={snapshot()} pending={false} {...callbacks} />);
  expect(screen.getByText("Where are we?")).toBeTruthy();
  expect(screen.getByAltText(/Stand-in clue photo/)).toBeTruthy();
  expect(screen.getByText(/not the party clue/)).toBeTruthy();
  expect(screen.getByText("No pin placed yet")).toBeTruthy();
  fireEvent.click(
    await screen.findByRole("button", { name: "Place pin at map centre" }),
  );
  expect(screen.getByText(/Pin at 18\.00°, 0\.00°/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Send pin" }));
  expect(callbacks.onMapPin).toHaveBeenCalledWith({ lat: 18, lng: 0 });
});

it("opens the clue photo lightbox in a dialog and closes cleanly via button, backdrop, and Escape", async () => {
  stubMap();
  render(<GuestPlay snapshot={snapshot()} pending={false} {...handlers()} />);
  const trigger = screen.getByRole("button", { name: "Open clue photo" });

  // Close via explicit Close button; Tab stays trapped inside the modal and close restores focus.
  fireEvent.click(trigger);
  expect(screen.getByRole("dialog", { name: "Clue photo" })).toBeTruthy();
  const closeButton = screen.getByRole("button", { name: "Close clue photo" });
  expect(document.activeElement).toBe(closeButton);
  fireEvent.keyDown(window, { key: "Tab" });
  expect(document.activeElement).toBe(closeButton);
  fireEvent.click(closeButton);
  await waitFor(() => {
    expect(screen.queryByRole("dialog", { name: "Clue photo" })).toBeNull();
  });
  expect(document.activeElement).toBe(trigger);

  // Close via Escape key.
  fireEvent.click(trigger);
  expect(screen.getByRole("dialog", { name: "Clue photo" })).toBeTruthy();
  fireEvent.keyDown(window, { key: "Escape" });
  await waitFor(() => {
    expect(screen.queryByRole("dialog", { name: "Clue photo" })).toBeNull();
  });

  // Close via backdrop tap.
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "Clue photo" });
  fireEvent.click(dialog);
  await waitFor(() => {
    expect(screen.queryByRole("dialog", { name: "Clue photo" })).toBeNull();
  });
});

it("keeps the map closed until answering, then locks after an accepted pin", () => {
  stubMap();
  const view = render(
    <GuestPlay snapshot={snapshot("prompt")} pending={false} {...handlers()} />,
  );
  expect(screen.queryByRole("button", { name: "Send pin" })).toBeNull();
  expect(screen.getByText(/Study the clue/)).toBeTruthy();
  view.rerender(
    <GuestPlay
      snapshot={snapshot("collect", {
        selfAnswer: { kind: "map-guess", pin: { lat: 10, lng: 20 } },
      })}
      pending={false}
      {...handlers()}
    />,
  );
  expect(screen.getByRole("button", { name: "Locked in ✓" })).toBeTruthy();
});

it("reveals the stand-in harbour on the projector without a real party location", () => {
  stubMap();
  const reveal = previewReveal(question, undefined, 1);
  render(<StagePlay snapshot={snapshot("reveal", { reveal })} />);
  expect(screen.getByText(/Stand-in harbour/)).toBeTruthy();
  expect(screen.getByText(/Stand-in 1/)).toBeTruthy();
  expect(screen.queryByText(/party location/)).toBeTruthy();
});

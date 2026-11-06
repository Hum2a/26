import { fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useKartContactFeedback } from "./useKartContactFeedback";
import type { KartContactSample } from "./contact-feedback";
import { GuestKart } from "./GuestKart";
import { createKartRace, projectKartRace, type LobbySnapshot } from "@26/shared";

const fakes = vi.hoisted(() => ({
  audio: {
    unlock: vi.fn(() => true),
    play: vi.fn(() => true),
    stop: vi.fn(),
    dispose: vi.fn(),
    setMuted: vi.fn(),
  },
  animate: vi.fn(() => ({ stop: vi.fn() })),
  buzz: vi.fn(),
  reduced: false,
}));
vi.mock("../device/audio", () => ({ createScreenAudio: () => fakes.audio }));
vi.mock("../device/haptics", () => ({ buzz: fakes.buzz }));
vi.mock("../anim/use-reduced-motion", () => ({
  usePrefersReducedMotion: () => fakes.reduced,
}));
vi.mock("motion/react", async () => {
  const { useRef } = await import("react");
  const actual = await vi.importActual("motion/react");
  return { ...actual, useAnimate: () => [useRef(null), fakes.animate] };
});
vi.mock("./KartDriverView", () => ({
  KartDriverView: ({
    race,
    onReadiness,
  }: {
    race: { raceId: string };
    onReadiness?: (id: string, usable: boolean) => void;
  }) => {
    useEffect(() => onReadiness?.(race.raceId, true), [onReadiness, race.raceId]);
    return <div>Stand-in driving view</div>;
  },
}));
function Harness({ sample }: { sample: KartContactSample }) {
  const feedback = useKartContactFeedback(sample);
  return (
    <>
      {feedback.overlay}
      {feedback.settings}
    </>
  );
}
const sample = (
  elapsedMs: number,
  contact = false,
  active = true,
): KartContactSample => ({ raceId: "race", elapsedMs, contact, active });
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  fakes.reduced = false;
  fakes.audio.unlock.mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
});

it("uses fresh accepted edges with opt-in sound/haptics, bounded pulses and mute", () => {
  const view = render(<Harness sample={sample(0, true)} />);
  expect(fakes.animate).not.toHaveBeenCalled();
  expect(fakes.audio.unlock).not.toHaveBeenCalled();
  view.rerender(<Harness sample={sample(20)} />);
  view.rerender(<Harness sample={sample(40, true)} />);
  expect(fakes.animate).toHaveBeenCalledTimes(1);
  expect(fakes.audio.play).not.toHaveBeenCalled();
  expect(fakes.buzz).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText("Sound on contact"));
  fireEvent.click(screen.getByLabelText("Vibrate on contact (if supported)"));
  expect(fakes.audio.unlock).toHaveBeenCalledTimes(1);
  view.rerender(<Harness sample={sample(500)} />);
  view.rerender(<Harness sample={sample(520, true)} />);
  expect(fakes.audio.play).toHaveBeenCalledTimes(1);
  expect(fakes.buzz).toHaveBeenLastCalledWith(20);
  view.rerender(<Harness sample={sample(520, true)} />);
  expect(fakes.audio.play).toHaveBeenCalledTimes(1);
  view.rerender(<Harness sample={sample(540)} />);
  view.rerender(<Harness sample={sample(560, true)} />);
  expect(fakes.audio.play).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByLabelText("Sound on contact"));
  expect(fakes.audio.setMuted).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByLabelText("Show a gentle contact edge"));
  fakes.animate.mockClear();
  view.rerender(<Harness sample={sample(1000)} />);
  view.rerender(<Harness sample={sample(1020, true)} />);
  expect(fakes.animate).not.toHaveBeenCalled();
  expect(fakes.audio.play).toHaveBeenCalledTimes(1);
});

it("stops on pause, recovery, blur/hidden and unmount; never replays the held contact on resume", () => {
  const view = render(<Harness sample={sample(0)} />);
  fireEvent.click(screen.getByLabelText("Sound on contact"));
  fireEvent.click(screen.getByLabelText("Vibrate on contact (if supported)"));
  view.rerender(<Harness sample={sample(20, true)} />);
  expect(fakes.audio.play).toHaveBeenCalledTimes(1);
  view.rerender(<Harness sample={sample(20, true, false)} />);
  expect(fakes.buzz).toHaveBeenLastCalledWith(0);
  view.rerender(<Harness sample={sample(40, true)} />);
  expect(fakes.audio.play).toHaveBeenCalledTimes(1);
  fireEvent.blur(window);
  view.rerender(<Harness sample={sample(500)} />);
  view.rerender(<Harness sample={sample(520, true)} />);
  expect(fakes.audio.play).toHaveBeenCalledTimes(1);
  fireEvent.focus(window);
  view.rerender(<Harness sample={sample(540, true)} />);
  expect(fakes.audio.play).toHaveBeenCalledTimes(1);
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  fireEvent(document, new Event("visibilitychange"));
  view.rerender(<Harness sample={sample(1000)} />);
  hidden.mockReturnValue(false);
  fireEvent(document, new Event("visibilitychange"));
  view.rerender(<Harness sample={sample(1020, true)} />);
  expect(fakes.audio.play).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(fakes.audio.dispose).toHaveBeenCalledTimes(1);
});

it("keeps reduced motion to a short opacity cue and handles unsupported sound", () => {
  fakes.reduced = true;
  fakes.audio.unlock.mockReturnValue(false);
  const view = render(<Harness sample={sample(0)} />);
  fireEvent.click(screen.getByLabelText("Sound on contact"));
  expect((screen.getByLabelText("Sound on contact") as HTMLInputElement).checked).toBe(
    false,
  );
  expect(screen.getByRole("status").textContent).toContain("Sound is unavailable");
  view.rerender(<Harness sample={sample(20, true)} />);
  expect(fakes.animate).toHaveBeenLastCalledWith(
    expect.anything(),
    { opacity: [0, 0.2, 0] },
    { duration: 0.12, ease: "easeOut" },
  );
});

it("starts silent when mounted in an unfocused window and seeds a fresh baseline on focus", () => {
  vi.mocked(document.hasFocus).mockReturnValue(false);
  const view = render(<Harness sample={sample(0)} />);
  view.rerender(<Harness sample={sample(20, true)} />);
  expect(fakes.animate).not.toHaveBeenCalled();
  fireEvent.focus(window);
  view.rerender(<Harness sample={sample(40, true)} />);
  expect(fakes.animate).not.toHaveBeenCalled();
  view.rerender(<Harness sample={sample(60)} />);
  view.rerender(<Harness sample={sample(80, true)} />);
  expect(fakes.animate).toHaveBeenCalledTimes(1);
});

it("wires accepted live contacts, host effects-off, recovery, pause and disconnect to the same feedback", () => {
  const race = projectKartRace(
    createKartRace("contact-live", [{ playerId: "a", name: "Amina" }]),
    "a",
    100,
  );
  const snapshot = {
    phase: "collect",
    paused: false,
    held: false,
    play: { kart: race, selfAward: null },
  } as unknown as LobbySnapshot;
  const view = render(<GuestKart snapshot={snapshot} />);
  fireEvent.click(screen.getByRole("button", { name: "Controls" }));
  fireEvent.click(screen.getByLabelText("Sound on contact"));
  fireEvent.click(screen.getByRole("button", { name: "Back to driving" }));
  race.elapsedMs = 20;
  race.participants[0]!.contact = true;
  if (race.presentation?.version !== 2)
    throw new Error("Accepted contact envelope required");
  race.presentation.contacts = [{ eventId: 2001, atMs: 20, playerId: "a" }];
  view.rerender(<GuestKart snapshot={{ ...snapshot }} />);
  expect(fakes.audio.play).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Barrier contact — steer away")).toBeTruthy();
  race.effectsEnabled = false;
  race.elapsedMs = 500;
  race.participants[0]!.contact = false;
  view.rerender(<GuestKart snapshot={{ ...snapshot }} />);
  race.elapsedMs = 520;
  race.participants[0]!.contact = true;
  view.rerender(<GuestKart snapshot={{ ...snapshot }} />);
  expect(fakes.audio.play).toHaveBeenCalledTimes(1);
  race.effectsEnabled = true;
  view.rerender(<GuestKart snapshot={{ ...snapshot }} recoveryPending />);
  view.rerender(<GuestKart snapshot={{ ...snapshot }} />);
  race.elapsedMs = 540;
  view.rerender(<GuestKart snapshot={{ ...snapshot }} />);
  expect(fakes.audio.play).toHaveBeenCalledTimes(1);
  view.rerender(<GuestKart snapshot={{ ...snapshot, paused: true }} />);
  view.rerender(<GuestKart snapshot={{ ...snapshot }} connected={false} />);
  view.rerender(<GuestKart snapshot={{ ...snapshot }} />);
  race.elapsedMs = 600;
  view.rerender(<GuestKart snapshot={{ ...snapshot }} />);
  expect(fakes.audio.play).toHaveBeenCalledTimes(1);
});

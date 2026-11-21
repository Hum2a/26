import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { buzz } from "../device/haptics";
import { TrollPreview, trollPreviewMs } from "./troll-preview";

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(navigator, "vibrate", {
    configurable: true,
    value: vi.fn(() => true),
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("draws the real gag inside the stand-in phone, not over the troller's page", () => {
  const { container } = render(
    <TrollPreview kind="australia" label="Australia mode" victim="Sam" />,
  );
  const page = container.querySelector(".troll-preview-page")!;
  // The upside-down gag bends the stand-in page; the troller's phone stays upright.
  expect(page.classList.contains("troll-page-australia")).toBe(true);
  expect(document.documentElement.classList.contains("troll-page-australia")).toBe(
    false,
  );
  expect(screen.getByText("Preview · what Sam will see")).toBeTruthy();
});

it("keeps the troller's phone still while the preview runs", () => {
  render(<TrollPreview kind="haptic-storm" label="Haptics storm" />);
  act(() => vi.advanceTimersByTime(1_000));
  buzz(200);
  expect(navigator.vibrate).not.toHaveBeenCalled();
  buzz(50, { evenWhileMuted: true });
  expect(navigator.vibrate).toHaveBeenCalledWith(50);
});

it("tells the victim's side of a troll that is not drawn as a gag", () => {
  render(<TrollPreview kind="steal" label="Steal" victim="Sam" />);
  expect(
    screen.getByText("Someone is stealing half your points for this question."),
  ).toBeTruthy();
  expect(
    screen.getByText("Settles at this question's reveal, when the points are counted."),
  ).toBeTruthy();
});

it("stops after one run and replays on request", () => {
  const { container } = render(
    <TrollPreview kind="steal" label="Steal" victim="Sam" />,
  );
  expect(screen.getByRole("button", { name: "Playing…" })).toBeTruthy();
  act(() => vi.advanceTimersByTime(trollPreviewMs + 500));
  const replay = screen.getByRole("button", { name: "Replay preview" });
  fireEvent.click(replay);
  expect(screen.getByRole("button", { name: "Playing…" })).toBeTruthy();
  expect(container.querySelector(".troll-preview-effect")).toBeTruthy();
});

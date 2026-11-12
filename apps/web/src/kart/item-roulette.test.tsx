import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("../device/haptics", () => ({ buzz: vi.fn() }));
import { buzz } from "../device/haptics";
import { PowerUpControl, itemIcons, rouletteMs } from "./PowerUpControl";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.mocked(buzz).mockClear();
});

it("spins briefly when an item arrives, lands on it and never blocks the button", () => {
  const onUse = vi.fn();
  const view = render(<PowerUpControl item={null} onUse={onUse} />);
  const badge = () => view.container.querySelector(".kart-item-roulette")!;
  view.rerender(<PowerUpControl item="bomb" onUse={onUse} />);
  expect(buzz).toHaveBeenCalledWith(15);
  // The real item is usable straight away, even mid-spin.
  const button = view.getByRole("button", { name: "Use Bomb" });
  expect(button.hasAttribute("disabled")).toBe(false);
  button.click();
  expect(onUse).toHaveBeenCalledTimes(1);
  act(() => vi.advanceTimersByTime(rouletteMs + 50));
  expect(badge().hasAttribute("data-spinning")).toBe(false);
  expect(badge().textContent).toContain(itemIcons.bomb);
});

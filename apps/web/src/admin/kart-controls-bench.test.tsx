import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { KartControlsBench } from "./kart-controls-bench";

it("rehearses real driving, item/recovery shortcuts, pause/fresh input and reset without guests", async () => {
  render(<KartControlsBench />);
  fireEvent.keyDown(window, { key: "w" });
  expect(screen.getByLabelText("Current driving input").textContent).toContain(
    "Accelerate on",
  );
  fireEvent.keyDown(window, { key: "e" });
  fireEvent.keyUp(window, { key: "e" });
  fireEvent.keyDown(window, { key: "r" });
  expect(screen.getByText("Item attempts: 1 · Recoveries: 1")).toBeTruthy();
  expect(
    within(
      screen.getByRole("list", { name: "Local control rehearsal history" }),
    ).getAllByRole("listitem"),
  ).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Pause controls" }));
  expect(screen.getByLabelText("Current driving input").textContent).toContain(
    "Accelerate off",
  );
  fireEvent.click(screen.getByRole("button", { name: "Resume controls" }));
  fireEvent.keyDown(window, { key: "w", repeat: true });
  expect(screen.getByLabelText("Current driving input").textContent).toContain(
    "Accelerate off",
  );
  fireEvent.click(screen.getByRole("button", { name: "Reset rehearsal" }));
  expect(screen.getByText("Item attempts: 0 · Recoveries: 0")).toBeTruthy();
  await waitFor(() =>
    expect(
      screen.getByRole("list", { name: "Local control rehearsal history" }).children,
    ).toHaveLength(0),
  );
});

it("offers isolated stand-in contacts and optional real feedback controls", () => {
  render(<KartControlsBench />);
  fireEvent.click(screen.getByRole("button", { name: "Rehearse contact" }));
  expect(screen.getByText(/Stand-in contact ·/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Clear contact" }));
  expect(screen.getByText(/Stand-in contact cleared ·/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Controls" }));
  expect((screen.getByLabelText("Sound on contact") as HTMLInputElement).checked).toBe(
    false,
  );
  expect(
    (screen.getByLabelText("Vibrate on contact (if supported)") as HTMLInputElement)
      .checked,
  ).toBe(false);
  expect(
    (screen.getByLabelText("Show a gentle contact edge") as HTMLInputElement).checked,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Pause controls" }));
  expect(
    (screen.getByRole("button", { name: "Rehearse contact" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

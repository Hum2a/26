import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { KartItemsBench } from "./kart-items-bench";
it("shows the real homing fallback with a finished target, personal boost and no projectile", () => {
  render(<KartItemsBench />);
  fireEvent.click(
    screen.getByRole("button", { name: "Rehearse homing without a target" }),
  );
  expect(screen.getByRole("status").textContent).toContain("No eligible racer ahead");
  expect(
    screen.getByRole("list", { name: "Stand-in item state" }).textContent,
  ).toContain("Turbo active");
  expect(screen.getByText(/0 \/ 64 projectiles/)).toBeTruthy();
});
it("runs the actual finite moving two-racer script before parking the result for inspection", () => {
  render(<KartItemsBench />);
  fireEvent.click(screen.getByRole("button", { name: "Run moving two-racer sample" }));
  expect(screen.getByRole("status").textContent).toContain("actual two-racer driving");
  expect(
    screen.getByRole("list", { name: "Item simulation history" }).textContent,
  ).toContain("launch");
  expect(
    (screen.getByRole("button", { name: "Launch stand-in item" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});
it("rehearses the actual personal Treats boost without creating a track collectible", () => {
  render(<KartItemsBench />);
  fireEvent.click(screen.getByRole("button", { name: "Try personal Treats boost" }));
  expect(
    screen.getByRole("list", { name: "Stand-in item state" }).textContent,
  ).toContain("Turbo active");
  expect(screen.getByText(/0 \/ 64 projectiles/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Advance 1 second" }));
  expect(
    screen.getByRole("list", { name: "Stand-in item state" }).textContent,
  ).not.toContain("Turbo active");
});
it("rehearses real swept hits, fuse/shield outcomes and honest non-live status", () => {
  render(<KartItemsBench />);
  expect(
    screen.getByText(/This rehearsal changes no room, inventory or score/),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Restore sample copy" }));
  expect(screen.getByRole("status").textContent).toContain("Restored a validated copy");
  fireEvent.click(screen.getByRole("button", { name: "Launch stand-in item" }));
  fireEvent.click(screen.getByRole("button", { name: "Advance 1 second" }));
  expect(
    screen.getByRole("list", { name: "Item simulation history" }).textContent,
  ).toContain("hit");
  expect(
    screen.getByRole("list", { name: "Stand-in item state" }).textContent,
  ).toContain("Slowed");
  fireEvent.click(screen.getByRole("button", { name: "Reset sandbox" }));
  fireEvent.change(screen.getByLabelText("Projectile"), { target: { value: "bomb" } });
  fireEvent.click(screen.getByLabelText("Target behind for bomb rehearsal"));
  fireEvent.click(screen.getByLabelText("Target shield"));
  fireEvent.click(screen.getByRole("button", { name: "Launch stand-in item" }));
  fireEvent.click(screen.getByRole("button", { name: "Advance 1 second" }));
  expect(screen.getByText(/1 \/ 64 projectiles/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Restore sample copy" }));
  expect(screen.getByText(/1 \/ 64 projectiles/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Advance 1 second" }));
  expect(
    screen.getByRole("list", { name: "Item simulation history" }).textContent,
  ).toContain("shield");
  expect((screen.getByLabelText("Target shield") as HTMLInputElement).checked).toBe(
    false,
  );
});
it("manages capacity, spawning and cleanup through actual local reducers", () => {
  render(<KartItemsBench />);
  fireEvent.click(screen.getByRole("button", { name: "Rehearse full pool" }));
  expect(screen.getByText(/64 \/ 64 projectiles/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Launch stand-in item" }));
  expect(screen.getByRole("status").textContent).toContain("Pool full");
  fireEvent.click(screen.getByRole("button", { name: "Stop sandbox spawning" }));
  expect(
    (screen.getByRole("button", { name: "Launch stand-in item" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Clear sandbox projectiles" }));
  expect(screen.getByText(/0 \/ 64 projectiles/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Enable sandbox spawning" }));
  expect(
    (screen.getByRole("button", { name: "Launch stand-in item" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});

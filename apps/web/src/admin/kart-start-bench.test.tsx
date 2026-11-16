import { useEffect } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { KartStartBench } from "./kart-start-bench";
vi.mock("../kart/KartCanvas", () => ({
  default: function ReadyKartCanvas({
    onRenderState,
  }: {
    onRenderState: (state: "usable") => void;
  }) {
    useEffect(() => onRenderState("usable"), [onRenderState]);
    return <canvas />;
  },
}));
it("uses real readiness, map, controls and countdown with isolated connection/pause/rebuild commands", async () => {
  render(<KartStartBench />);
  fireEvent.click(screen.getByRole("button", { name: "Rehearse GO" }));
  const gas = screen.getByRole("button", {
    name: "Accelerate",
  }) as HTMLButtonElement;
  await waitFor(() => expect(gas.disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Disconnect rehearsal" }));
  expect(gas.disabled).toBe(true);
  expect(document.querySelector('.kart-countdown[data-active="false"]')).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Reconnect rehearsal" }));
  await waitFor(() => expect(gas.disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Pause rehearsal" }));
  expect(gas.disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Rebuild driving view" }));
  expect(screen.getByLabelText("Start rehearsal input").textContent).toContain(
    "Accelerate off",
  );
  fireEvent.change(screen.getByLabelText("Sample accepted sector"), {
    target: { value: "7" },
  });
  expect(screen.getByLabelText("Next sector: finish line")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Sample navigation track"), {
    target: { value: "party-ring-v1" },
  });
  expect(screen.getByLabelText("Next sector: finish line")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Turn sample kart around" }));
  expect(
    screen
      .getByRole("button", { name: "Turn sample kart around" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
});

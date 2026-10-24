import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { GraphicsControls } from "./graphics-controls";
import { useKartGraphics } from "./graphics-preferences";

beforeEach(() => sessionStorage.clear());
function Screen({ players }: { players: number }) {
  const graphics = useKartGraphics(players);
  return <GraphicsControls {...graphics} />;
}
it("offers local overrides and preserves the choice for this browser session", () => {
  const view = render(<Screen players={21} />);
  expect(screen.getByRole("status").textContent).toContain("Low detail");
  fireEvent.change(screen.getByLabelText("Graphics"), { target: { value: "high" } });
  expect(screen.getByRole("status").textContent).toContain("High detail");
  expect(sessionStorage.getItem("26-kart-graphics")).toBe("high");
  view.unmount();
  render(<Screen players={80} />);
  expect((screen.getByLabelText("Graphics") as HTMLSelectElement).value).toBe("high");
});

import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { DriftGauge } from "./DriftGauge";

it("identifies each tier and keeps the released boost tier visible", () => {
  const view = render(<DriftGauge chargeMs={0} />);
  for (const [chargeMs, tier, name] of [
    [700, 1, "Mini"],
    [1400, 2, "Super"],
    [2400, 3, "Ultra"],
  ] as const) {
    view.rerender(<DriftGauge chargeMs={chargeMs} />);
    expect(screen.getByLabelText("Drift charge level").textContent).toContain(
      `${name} turbo ready`,
    );
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      String(tier),
    );
    expect(view.container.querySelectorAll('[data-ready="true"]')).toHaveLength(tier);
    view.rerender(<DriftGauge chargeMs={0} boostLevel={tier} />);
    expect(screen.getByLabelText("Drift charge level").textContent).toBe(
      `${name} turbo active`,
    );
  }
});

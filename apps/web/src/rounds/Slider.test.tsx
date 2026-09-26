import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SliderField } from "./Slider";

function Harness() {
  const [value, setValue] = useState(4);
  return (
    <SliderField
      value={value}
      unit="cm"
      minimum={0}
      maximum={10}
      step={1}
      onChange={setValue}
    />
  );
}

describe("Slider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(navigator.vibrate).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the value and unit, and ticks once per 50ms of step changes", () => {
    render(<Harness />);
    expect(screen.getByText("4 cm").className).toContain("slider-readout");

    const slider = screen.getByRole("slider", { name: "Estimate" });
    fireEvent.change(slider, { target: { value: "5" } });
    expect(screen.getByText("5 cm")).toBeTruthy();
    expect(navigator.vibrate).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByRole("slider", { name: "Estimate" }), {
      target: { value: "6" },
    });
    expect(screen.getByText("6 cm")).toBeTruthy();
    expect(navigator.vibrate).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(50);
    fireEvent.change(screen.getByRole("slider", { name: "Estimate" }), {
      target: { value: "7" },
    });
    expect(screen.getByText("7 cm")).toBeTruthy();
    expect(navigator.vibrate).toHaveBeenCalledTimes(2);
  });
});

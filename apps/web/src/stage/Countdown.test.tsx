import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StageCountdown } from "./Countdown";

describe("StageCountdown", () => {
  it("pulses only in the final 5 seconds", () => {
    const { rerender } = render(
      <StageCountdown
        label="Time left"
        value="0:06"
        note="Time left in this phase."
        remainingMs={6_000}
      />,
    );
    expect(document.querySelector(".stage-countdown-pulse")).toBeNull();
    expect(screen.getByText("0:06").className).not.toContain("stage-timer-accent");

    rerender(
      <StageCountdown
        label="Time left"
        value="0:05"
        note="Time left in this phase."
        remainingMs={5_000}
      />,
    );
    expect(document.querySelector(".stage-countdown-pulse")).not.toBeNull();
    expect(screen.getByText("0:05").className).toContain("stage-timer-accent");

    rerender(
      <StageCountdown
        label="Time left"
        value="0:01"
        note="Time left in this phase."
        remainingMs={1_000}
      />,
    );
    expect(document.querySelector(".stage-countdown-pulse")).not.toBeNull();

    rerender(
      <StageCountdown
        label="Time left"
        value="0:00"
        note="Time left in this phase."
        remainingMs={0}
      />,
    );
    expect(document.querySelector(".stage-countdown-pulse")).toBeNull();
  });
});

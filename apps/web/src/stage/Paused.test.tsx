import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PausedOverlay } from "./Paused";

describe("PausedOverlay", () => {
  it("shows the caution tape on the paused overlay", () => {
    render(<PausedOverlay />);
    expect(screen.getByRole("status", { name: "Paused" })).toBeTruthy();
    expect(screen.getByText("The game is paused.")).toBeTruthy();
    expect(document.querySelector(".coming-soon-tape__text")?.textContent).toContain(
      "COMING SOON",
    );
  });
});

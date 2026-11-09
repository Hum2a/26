import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OptionText } from "./OptionText";

describe("OptionText", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("gives a long option the smaller font", () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(80);
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      lineHeight: "20px",
      fontSize: "18px",
    } as CSSStyleDeclaration);

    render(
      <OptionText text="A very long option that wraps past three lines on a phone screen" />,
    );

    expect(screen.getByText(/very long option/).className).toContain(
      "option-text-small",
    );
  });
});

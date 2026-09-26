import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SafeArea } from "./SafeArea";

function inset(): HTMLElement {
  const node = screen.getByText("Stage").parentElement;
  if (!node) {
    throw new Error("The safe area is missing.");
  }
  return node;
}

describe("SafeArea", () => {
  it("insets the stage and lets O outline it only in dev", () => {
    const css = [...document.querySelectorAll("style")]
      .map((style) => style.textContent ?? "")
      .join("\n");
    expect(css).toContain("padding: 5%");

    const { unmount } = render(
      <SafeArea dev={false}>
        <p>Stage</p>
      </SafeArea>,
    );
    expect(inset().className).toContain("stage-safe");
    expect(inset().className).not.toContain("stage-safe-outline");
    fireEvent.keyDown(window, { key: "O" });
    expect(inset().className).not.toContain("stage-safe-outline");
    unmount();

    render(
      <SafeArea dev>
        <p>Stage</p>
      </SafeArea>,
    );
    fireEvent.keyDown(window, { key: "O" });
    expect(inset().className).toContain("stage-safe-outline");
    fireEvent.keyDown(window, { key: "o" });
    expect(inset().className).not.toContain("stage-safe-outline");
  });
});

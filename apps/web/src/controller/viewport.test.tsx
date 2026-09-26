import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "../ui/primitives";
import { ControllerRoot } from "./ControllerRoot";

describe("controller viewport", () => {
  it("keeps the root from scrolling the document and makes taps at least 48px", () => {
    render(
      <ControllerRoot>
        <Button>Join</Button>
      </ControllerRoot>,
    );
    const root = document.querySelector(".controller-root");
    expect(root).not.toBeNull();
    const rootStyle = getComputedStyle(root as Element);
    expect(rootStyle.overscrollBehavior).toBe("none");
    expect(rootStyle.height).toBe("100dvh");
    expect(document.documentElement.style.overscrollBehavior).toBe("none");

    const css = [...document.querySelectorAll("style")]
      .map((style) => style.textContent ?? "")
      .join("\n");
    expect(css).toContain("touch-action: manipulation");
    expect(css).toContain("env(safe-area-inset-top)");
    expect(css).toContain("env(safe-area-inset-right)");
    expect(css).toContain("env(safe-area-inset-bottom)");
    expect(css).toContain("env(safe-area-inset-left)");

    const button = screen.getByRole("button", { name: "Join" });
    const buttonStyle = getComputedStyle(button);
    expect(Number.parseFloat(buttonStyle.minHeight)).toBeGreaterThanOrEqual(48);
    expect(Number.parseFloat(buttonStyle.minWidth)).toBeGreaterThanOrEqual(48);
    expect(buttonStyle.userSelect).toBe("none");
  });
});

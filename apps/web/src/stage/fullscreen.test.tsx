import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StageFullscreen } from "./fullscreen";

describe("stage fullscreen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks for fullscreen when F is pressed", () => {
    render(<StageFullscreen />);
    fireEvent.keyDown(window, { key: "F" });
    expect(document.documentElement.requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it("hides the cursor after idle and shows it again on a pointer move", () => {
    render(
      <StageFullscreen>
        <p>Stage</p>
      </StageFullscreen>,
    );
    const root = screen.getByText("Stage").parentElement;
    expect(root?.className).not.toContain("stage-cursor-hidden");

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(root?.className).toContain("stage-cursor-hidden");

    fireEvent.pointerMove(window);
    expect(root?.className).not.toContain("stage-cursor-hidden");
  });
});

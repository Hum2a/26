import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RotateHint } from "./RotateHint";

function mockOrientation(matches: boolean) {
  window.matchMedia = vi.fn((query: string) => {
    return {
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    } as unknown as MediaQueryList;
  });
}

describe("RotateHint", () => {
  it("shows in landscape on a short screen", () => {
    mockOrientation(true);
    render(<RotateHint />);
    expect(screen.getByText("Rotate your phone")).toBeTruthy();
  });

  it("stays hidden in portrait", () => {
    mockOrientation(false);
    render(<RotateHint />);
    expect(screen.queryByText("Rotate your phone")).toBeNull();
  });
});

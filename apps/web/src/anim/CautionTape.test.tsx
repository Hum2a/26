import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CautionTape } from "./CautionTape";

function matchMedia(matches: boolean) {
  return vi.fn((query: string) => {
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

describe("CautionTape", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the marquee text and stops the track under reduced motion", () => {
    render(<CautionTape />);
    const text = document.querySelector(".coming-soon-tape__text");
    expect(text?.textContent).toContain("COMING SOON · 近日公開 · COMING SOON · ");
    expect(
      document.querySelector(".coming-soon-tape")?.getAttribute("aria-hidden"),
    ).toBe("true");
    const css = [...document.querySelectorAll("style")]
      .map((style) => style.textContent ?? "")
      .join("\n");
    expect(css).toContain("animation: coming-soon-marquee 9s linear infinite");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");

    vi.stubGlobal("matchMedia", matchMedia(true));
    render(<CautionTape />);
    const reduced = document.querySelector(
      "[data-force-reduced-motion='true'] .coming-soon-tape__track",
    ) as HTMLElement;
    expect(reduced).toBeTruthy();
    expect(reduced.style.animation).toBe("none");
  });
});

import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PhaseTransition } from "./PhaseTransition";

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

describe("PhaseTransition", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("re-keys when the phase changes and is instant under reduced motion", () => {
    let mounts = 0;
    function Mark() {
      useEffect(() => {
        mounts += 1;
      }, []);
      return <p>Round body</p>;
    }

    const view = render(
      <PhaseTransition phase="lobby">
        <Mark />
      </PhaseTransition>,
    );
    expect(mounts).toBe(1);
    expect(document.querySelector("[data-phase='lobby']")).toBeTruthy();

    view.rerender(
      <PhaseTransition phase="prompt">
        <Mark />
      </PhaseTransition>,
    );
    expect(mounts).toBe(2);
    expect(document.querySelector("[data-phase='prompt']")).toBeTruthy();

    vi.stubGlobal("matchMedia", matchMedia(true));
    render(
      <PhaseTransition phase="collect">
        <p>Still here</p>
      </PhaseTransition>,
    );
    const instant = screen.getByText("Still here").parentElement as HTMLElement;
    expect(instant.dataset.phaseMotion).toBe("instant");
    expect(instant.style.opacity === "" || instant.style.opacity === "1").toBe(true);
    expect(instant.style.transform === "" || instant.style.transform === "none").toBe(
      true,
    );
  });
});

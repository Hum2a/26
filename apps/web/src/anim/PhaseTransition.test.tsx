import { useEffect } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
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

  it("re-keys when the phase changes and keeps a short fade without movement under reduced motion", async () => {
    vi.stubGlobal("matchMedia", matchMedia(true));
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

    await act(async () => {
      view.rerender(
        <PhaseTransition phase="prompt">
          <Mark />
        </PhaseTransition>,
      );
    });
    await waitFor(() =>
      expect(document.querySelector("[data-phase='lobby']")).toBeNull(),
    );
    expect(document.querySelector("[data-phase='prompt']")).toBeTruthy();
    expect(mounts).toBe(2);

    vi.stubGlobal("matchMedia", matchMedia(true));
    render(
      <PhaseTransition phase="collect">
        <p>Still here</p>
      </PhaseTransition>,
    );
    const faded = screen.getByText("Still here").parentElement as HTMLElement;
    expect(faded.dataset.phaseMotion).toBe("fade");
    expect(Number(faded.style.opacity)).toBeGreaterThanOrEqual(0.96);
    expect(faded.style.transform === "" || faded.style.transform === "none").toBe(true);
  });
});
it("keeps the projector readable and switches its heading with the authoritative phase", () => {
  const view = render(
    <PhaseTransition phase="prompt" stage>
      <h2>Read the question</h2>
    </PhaseTransition>,
  );
  expect(
    Number(screen.getByText("Read the question").parentElement!.style.opacity),
  ).toBeGreaterThanOrEqual(0.96);
  view.rerender(
    <PhaseTransition phase="collect" stage>
      <h2>Answers are open</h2>
    </PhaseTransition>,
  );
  expect(screen.queryByText("Read the question")).toBeNull();
  expect(screen.getByText("Answers are open").parentElement!.dataset.phase).toBe(
    "collect",
  );
  expect(
    Number(screen.getByText("Answers are open").parentElement!.style.opacity),
  ).toBeGreaterThanOrEqual(0.96);
});

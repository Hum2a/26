import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VictimToast } from "./VictimToast";

describe("VictimToast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("toasts a self troll, names the sender only when the payload has one, and dismisses", () => {
    vi.useFakeTimers();
    const { unmount } = render(<VictimToast event={{ target: "self" }} />);
    expect(screen.getByRole("status").textContent).toBe("🎯 You've been trolled");
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByRole("status")).toBeNull();
    unmount();

    const namedView = render(
      <VictimToast event={{ target: "self", troller: "Sam" }} />,
    );
    const named = namedView.getByRole("status").textContent ?? "";
    expect(named).toContain("You've been trolled");
    expect(named).toContain("Sam");
    namedView.unmount();

    render(<VictimToast event={{ target: "other", troller: "Sam" }} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

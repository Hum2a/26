import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReconnectBanner } from "./ReconnectBanner";

describe("ReconnectBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits 1.5s, disables inputs, then clears on SNAPSHOT", () => {
    const { rerender } = render(
      <ReconnectBanner disconnected snapshotId={0}>
        <input aria-label="Answer" />
      </ReconnectBanner>,
    );

    act(() => {
      vi.advanceTimersByTime(1499);
    });
    expect(screen.queryByText("Reconnecting…")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText("Reconnecting…")).toBeTruthy();
    expect((screen.getByLabelText("Answer") as HTMLInputElement).disabled).toBe(true);

    rerender(
      <ReconnectBanner disconnected={false} snapshotId={1}>
        <input aria-label="Answer" />
      </ReconnectBanner>,
    );
    expect(screen.queryByText("Reconnecting…")).toBeNull();
    expect(screen.getByText("Back in ✓")).toBeTruthy();
    expect((screen.getByLabelText("Answer") as HTMLInputElement).disabled).toBe(false);
  });
});

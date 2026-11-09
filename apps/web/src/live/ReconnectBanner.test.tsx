import { act, fireEvent, render, screen } from "@testing-library/react";
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
    expect(screen.getByLabelText("Answer").matches(":disabled")).toBe(true);

    rerender(
      <ReconnectBanner disconnected={false} snapshotId={1}>
        <input aria-label="Answer" />
      </ReconnectBanner>,
    );
    expect(screen.queryByText("Reconnecting…")).toBeNull();
    expect(screen.getByText("Back in ✓")).toBeTruthy();
    expect((screen.getByLabelText("Answer") as HTMLInputElement).disabled).toBe(false);
  });

  it("restores controls whose own disabled state changed during a disconnection", () => {
    const view = render(
      <ReconnectBanner disconnected={false} snapshotId={0}>
        <button disabled={false}>Drive</button>
      </ReconnectBanner>,
    );
    view.rerender(
      <ReconnectBanner disconnected snapshotId={0}>
        <button disabled>Drive</button>
      </ReconnectBanner>,
    );
    expect(screen.getByRole("button", { name: "Drive" }).matches(":disabled")).toBe(
      true,
    );
    view.rerender(
      <ReconnectBanner disconnected={false} snapshotId={1}>
        <button disabled={false}>Drive</button>
      </ReconnectBanner>,
    );
    expect(screen.getByRole("button", { name: "Drive" }).matches(":disabled")).toBe(
      false,
    );
  });

  it("tells the guest to check the signal at 10s and offers a manual retry at 30s", () => {
    const retry = vi.fn();
    render(
      <ReconnectBanner disconnected snapshotId={0} onRetry={retry}>
        <input aria-label="Answer" />
      </ReconnectBanner>,
    );
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText(/Check this phone’s Wi-Fi or signal/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again now" })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    const button = screen.getByRole("button", { name: "Try again now" });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(button);
    expect(retry).toHaveBeenCalledOnce();
  });
});

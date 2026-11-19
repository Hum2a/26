import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Browser } from "leaflet";
import type { PlaySnapshot } from "@26/shared";
import { GuessMap, GuestMapGuess } from "./map-guess";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubMapGlobals() {
  const originalSvg = Browser.svg;
  Object.assign(Browser, { svg: true });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ type: "FeatureCollection", features: [] })),
  );
  return () => {
    Object.assign(Browser, { svg: originalSvg });
  };
}

it("clamps latitude and wraps longitude safely after panning or zooming", async () => {
  const restore = stubMapGlobals();
  const onPin = vi.fn();
  const { container, unmount } = render(<GuessMap editable onPin={onPin} />);
  try {
    await screen.findByRole("button", { name: "Place pin at map centre" });
    const mapNode = container.querySelector(".guess-map") as HTMLElement;
    // Far off-edge click produces out-of-range projected coordinates that must clamp cleanly.
    fireEvent.click(mapNode, { clientX: -5000, clientY: -5000 });
    expect(onPin).toHaveBeenCalledOnce();
    const pin = onPin.mock.calls[0]![0] as { lat: number; lng: number };
    expect(pin.lat).toBeGreaterThanOrEqual(-85);
    expect(pin.lat).toBeLessThanOrEqual(85);
    expect(pin.lng).toBeGreaterThanOrEqual(-180);
    expect(pin.lng).toBeLessThanOrEqual(180);
  } finally {
    unmount();
    restore();
  }
});

it("requires a pin before sending and only locks when the saved answer arrives", async () => {
  const restore = stubMapGlobals();
  const play = { selfAnswer: null, reveal: null } as PlaySnapshot;
  const onSubmit = vi.fn();
  const { rerender, unmount, container } = render(
    <GuestMapGuess play={play} open pending={false} onSubmit={onSubmit} />,
  );
  try {
    expect(screen.getByRole("button", { name: "Send pin" })).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Place pin at map centre" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Send pin" }));
    expect(onSubmit).toHaveBeenCalledWith({ lat: 18, lng: 0 });
    rerender(<GuestMapGuess play={play} open={false} pending onSubmit={onSubmit} />);
    expect(screen.getByRole("button", { name: "Sending" })).toHaveProperty(
      "disabled",
      true,
    );
    const saved = {
      ...play,
      selfAnswer: { kind: "map-guess", pin: { lat: 18, lng: 0 } },
    } as const;
    rerender(
      <GuestMapGuess play={saved} open={false} pending={false} onSubmit={onSubmit} />,
    );
    expect(screen.getByRole("button", { name: "Locked in ✓" })).toHaveProperty(
      "disabled",
      true,
    );
    const revealed: PlaySnapshot = {
      ...play,
      reveal: {
        kind: "map-guess",
        target: { lat: 0, lng: 0 },
        label: "Real spot",
        pins: [],
        closest: [],
      },
    };
    rerender(
      <GuestMapGuess
        play={{ ...saved, reveal: revealed.reveal }}
        open={false}
        pending={false}
      />,
    );
    expect(container.querySelector('path[stroke="#12459b"]')).not.toBeNull();
    rerender(<GuestMapGuess play={revealed} open={false} pending={false} />);
    expect(screen.getByText("Real spot")).toBeTruthy();
    expect(container.querySelector('path[stroke="#12459b"]')).toBeNull();
  } finally {
    unmount();
    restore();
  }
});

it("keeps pinch/pan isolated to the map and lets the user place a pin after zooming", async () => {
  const restore = stubMapGlobals();
  const play = { selfAnswer: null, reveal: null } as PlaySnapshot;
  const onSubmit = vi.fn();
  const { container, unmount } = render(
    <GuestMapGuess play={play} open pending={false} onSubmit={onSubmit} />,
  );
  try {
    const centreButton = await screen.findByRole("button", {
      name: "Place pin at map centre",
    });
    const mapNode = container.querySelector(".guess-map") as HTMLElement;
    expect(mapNode.style.touchAction).toBe("none");
    expect(mapNode.style.overscrollBehavior).toBe("none");

    // Zoom in via Leaflet control, then tap the map AND place pin at centre cleanly.
    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    fireEvent.click(zoomIn);
    fireEvent.click(zoomIn);
    fireEvent.click(mapNode, { clientX: 40, clientY: 40 });
    expect(screen.getByRole("button", { name: "Send pin" })).toHaveProperty(
      "disabled",
      false,
    );
    fireEvent.click(centreButton);
    fireEvent.click(screen.getByRole("button", { name: "Send pin" }));
    expect(onSubmit).toHaveBeenCalledOnce();

    // Multi-touch pinch prevents default page zoom/rubber-banding.
    const pinchEvent = new Event("touchmove", { bubbles: true, cancelable: true });
    Object.defineProperty(pinchEvent, "touches", {
      value: [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 200 },
      ],
    });
    mapNode.dispatchEvent(pinchEvent);
    expect(pinchEvent.defaultPrevented).toBe(true);

    // Safari gesturestart/gesturechange prevent page zoom.
    const gestureEvent = new Event("gesturechange", {
      bubbles: true,
      cancelable: true,
    });
    mapNode.dispatchEvent(gestureEvent);
    expect(gestureEvent.defaultPrevented).toBe(true);

    // Micro-jitter single-finger tap does NOT suppress click synthesis.
    const startTouch = new Event("touchstart", { bubbles: true, cancelable: true });
    Object.defineProperty(startTouch, "touches", {
      value: [{ clientX: 120, clientY: 120 }],
    });
    mapNode.dispatchEvent(startTouch);
    const jitterMove = new Event("touchmove", { bubbles: true, cancelable: true });
    Object.defineProperty(jitterMove, "touches", {
      value: [{ clientX: 121, clientY: 120 }],
    });
    mapNode.dispatchEvent(jitterMove);
    expect(jitterMove.defaultPrevented).toBe(false);

    // Single-finger drag (>6px) prevents page scroll/rubber-banding.
    const panMove = new Event("touchmove", { bubbles: true, cancelable: true });
    Object.defineProperty(panMove, "touches", {
      value: [{ clientX: 160, clientY: 120 }],
    });
    mapNode.dispatchEvent(panMove);
    expect(panMove.defaultPrevented).toBe(true);
    mapNode.dispatchEvent(new Event("touchend", { bubbles: true, cancelable: true }));
  } finally {
    unmount();
    restore();
  }
});

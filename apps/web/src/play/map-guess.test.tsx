import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Browser } from "leaflet";
import type { PlaySnapshot } from "@26/shared";
import { GuestMapGuess } from "./map-guess";

afterEach(() => vi.unstubAllGlobals());

it("requires a pin before sending and only locks when the saved answer arrives", async () => {
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
  const play = { selfAnswer: null, reveal: null } as PlaySnapshot;
  const onSubmit = vi.fn();
  const { rerender, unmount } = render(
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
  } finally {
    unmount();
    Object.assign(Browser, { svg: originalSvg });
  }
});

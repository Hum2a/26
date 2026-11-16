import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SoloPracticeFrame } from "./SoloPracticeFrame";
import { defaultKartVfxPreset, kartLookPresets } from "@26/shared";
afterEach(() => vi.unstubAllGlobals());
it("sends cloned look tuning without refetching or replacing the same authorised face", async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(new Uint8Array([1, 2]), {
        headers: { "content-type": "image/png" },
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  const view = render(
    <SoloPracticeFrame
      gameId="room"
      driver={{ style: "racer", faceMediaId: "face" }}
      lookPreset={kartLookPresets.daylight}
    />,
  );
  const frame = screen.getByTitle("Solo kart practice") as HTMLIFrameElement,
    send = vi.spyOn(frame.contentWindow!, "postMessage");
  fireEvent.load(frame);
  await waitFor(() => expect(send.mock.lastCall?.[0].face?.size).toBe(2));
  view.rerender(
    <SoloPracticeFrame
      gameId="room"
      driver={{ style: "racer", faceMediaId: "face" }}
      lookPreset={kartLookPresets.warm}
    />,
  );
  await waitFor(() =>
    expect(send.mock.lastCall?.[0].look.grading.temperature).toBe(0.3),
  );
  expect(send.mock.lastCall![0]).not.toHaveProperty("face");
  expect(send.mock.lastCall![0]).not.toHaveProperty("gameId");
  expect(send.mock.lastCall![0].look).not.toBe(kartLookPresets.warm);
  view.rerender(
    <SoloPracticeFrame
      gameId="room"
      driver={{ style: "racer", faceMediaId: "face" }}
      lookPreset={null}
    />,
  );
  await waitFor(() => expect(send.mock.lastCall?.[0].look).toBeNull());
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("reuses authorised photo bytes across preset/style changes and iframe readiness without sending room details", async () => {
  const fetcher = vi.fn().mockImplementation(
    async () =>
      new Response(new Uint8Array([1, 2]), {
        headers: { "content-type": "image/png" },
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  const view = render(
    <SoloPracticeFrame
      gameId="room"
      driver={{ style: "racer", faceMediaId: "face" }}
      effectsPreset={defaultKartVfxPreset}
    />,
  );
  const frame = screen.getByTitle("Solo kart practice") as HTMLIFrameElement;
  const send = vi.spyOn(frame.contentWindow!, "postMessage");
  fireEvent.load(frame);
  await waitFor(() => expect(send.mock.lastCall?.[0].face?.size).toBe(2));
  const face = send.mock.lastCall![0].face;
  view.rerender(
    <SoloPracticeFrame
      gameId="room"
      driver={{ style: "royal", faceMediaId: "face" }}
      effectsPreset={{ ...defaultKartVfxPreset, size: 1 }}
    />,
  );
  await waitFor(() => expect(send.mock.lastCall?.[0].effects?.size).toBe(1));
  expect(send.mock.lastCall![0]).not.toHaveProperty("face");
  expect(send.mock.lastCall![0]).not.toHaveProperty("gameId");
  expect(send.mock.lastCall![0].style).toBe("royal");
  fireEvent.load(frame);
  await waitFor(() => expect(send.mock.lastCall?.[0].face).toBe(face));
  expect(fetcher).toHaveBeenCalledTimes(1);
  view.rerender(
    <SoloPracticeFrame
      gameId="room"
      driver={{ style: "royal", faceMediaId: "face" }}
      effectsPreset={null}
    />,
  );
  await waitFor(() => expect(send.mock.lastCall?.[0].effects).toBeNull());
  expect(send.mock.lastCall![0]).not.toHaveProperty("face");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("sends only presentation bytes and style to the same-origin engine, and clears a removed photo", async () => {
  const face = new Blob(["sample"], { type: "image/png" });
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const view = render(
    <SoloPracticeFrame driver={{ style: "royal" }} sampleFace={face} />,
  );
  const frame = screen.getByTitle("Solo kart practice") as HTMLIFrameElement;
  const send = vi.spyOn(frame.contentWindow!, "postMessage");
  fireEvent.load(frame);
  await waitFor(() =>
    expect(send).toHaveBeenLastCalledWith(
      { kind: "kart-practice-presentation", style: "royal", face },
      location.origin,
    ),
  );
  expect(fetcher).not.toHaveBeenCalled();
  expect(frame.src).not.toMatch(/credential|token|gameId/);
  const before = send.mock.calls.length;
  act(() =>
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://wrong.example",
        source: frame.contentWindow,
        data: { kind: "kart-practice-ready" },
      }),
    ),
  );
  expect(send.mock.calls.length).toBe(before);
  view.rerender(<SoloPracticeFrame driver={{ style: "royal" }} />);
  await waitFor(() =>
    expect(send).toHaveBeenLastCalledWith(
      { kind: "kart-practice-presentation", style: "royal", face: null },
      location.origin,
    ),
  );
});
it("shows an honest photo failure while sending the chosen driver without room credentials", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("denied", { status: 403 })),
  );
  render(
    <SoloPracticeFrame
      gameId="room"
      driver={{ style: "party", faceMediaId: "face" }}
    />,
  );
  await screen.findByText(/Your photo could not load in practice/);
  expect(screen.getByTitle("Solo kart practice").getAttribute("src")).toBe(
    "/kart-engine/index.html",
  );
});

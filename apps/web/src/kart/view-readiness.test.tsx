import { useEffect } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { createKartRace, projectKartRace, type LobbySnapshot } from "@26/shared";
import { GuestKart } from "./GuestKart";
vi.mock("./KartCanvas", () => ({
  default: function ControlledKartCanvas({
    onRenderState,
  }: {
    onRenderState: (state: "loading" | "usable" | "failed") => void;
  }) {
    useEffect(() => onRenderState("loading"), [onRenderState]);
    return (
      <>
        <button onClick={() => onRenderState("usable")}>Complete circuit load</button>
        <button onClick={() => onRenderState("failed")}>Interrupt circuit</button>
        <button onClick={() => onRenderState("loading")}>Retry stand-in circuit</button>
      </>
    );
  },
}));
function snapshot(id = "readiness"): LobbySnapshot {
  const race = projectKartRace(
    createKartRace(id, [{ playerId: "p", name: "Stand-in" }], {
      trackId: "mario-circuit-v1",
    }),
    "p",
    0,
  );
  return {
    phase: "collect",
    paused: false,
    held: false,
    serverNow: 1000,
    play: { kart: race, question: { kind: "kart", timeLimitMs: 180000 } },
  } as unknown as LobbySnapshot;
}
it("releases loading/failed phones, permits the real map immediately and resets readiness for a new race", async () => {
  const send = vi.fn();
  const view = render(<GuestKart snapshot={snapshot()} onInput={send} />);
  const gas = screen.getByRole("button", {
    name: "Accelerate",
  }) as HTMLButtonElement;
  expect(gas.disabled).toBe(true);
  await screen.findByRole("button", { name: "Complete circuit load" });
  fireEvent.click(screen.getByRole("button", { name: "Complete circuit load" }));
  await waitFor(() => expect(gas.disabled).toBe(false));
  fireEvent.keyDown(window, { key: "w" });
  fireEvent.click(screen.getByRole("button", { name: "Interrupt circuit" }));
  await waitFor(() => expect(gas.disabled).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: "Use lightweight map" }));
  await waitFor(() => expect(gas.disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Use 3D driving view" }));
  await waitFor(() => expect(gas.disabled).toBe(true));
  fireEvent.click(await screen.findByRole("button", { name: "Complete circuit load" }));
  await waitFor(() => expect(gas.disabled).toBe(false));
  view.rerender(<GuestKart snapshot={snapshot("new-race")} onInput={send} />);
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Accelerate",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true),
  );
});

import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createKartRace, projectKartRace, kartNeutral } from "@26/shared";
import { TouchController } from "./TouchController";
import { useKartSocket } from "./useKartSocket";
import KartGameWrapper from "./KartGameWrapper";
vi.mock("./KartCanvas", () => ({ default: () => <div>Stand-in WebGL renderer</div> }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("emits normalised steering and releases all held controls on blur or disabling", () => {
  const change = vi.fn(),
    view = render(<TouchController onChange={change} />);
  fireEvent.change(screen.getByLabelText("Steering"), { target: { value: "-.75" } });
  expect(change).toHaveBeenLastCalledWith({ ...kartNeutral, steer: -0.75 });
  fireEvent.pointerUp(screen.getByLabelText("Steering"));
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
  fireEvent.keyDown(screen.getByRole("button", { name: "Accelerate" }), {
    key: "Enter",
  });
  expect(change.mock.lastCall![0].gas).toBe(true);
  fireEvent.blur(window);
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
  view.rerender(<TouchController onChange={change} disabled />);
  expect(
    (screen.getByRole("button", { name: "Accelerate" }) as HTMLButtonElement).disabled,
  ).toBe(true);
});
it("uses one input heartbeat on the existing transport and never submits a lap time", () => {
  vi.useFakeTimers();
  const send = vi.fn();
  const race = projectKartRace(
    createKartRace("fixture-race", [{ playerId: "guest", name: "Stand-in driver" }]),
    "guest",
    100,
  );
  const view = renderHook(({ enabled }) => useKartSocket(race, enabled, send), {
    initialProps: { enabled: true },
  });
  act(() => view.result.current({ ...kartNeutral, gas: true, drift: true }));
  act(() => vi.advanceTimersByTime(300));
  expect(send).toHaveBeenCalledTimes(4);
  expect(send.mock.lastCall![0]).toMatchObject({
    raceId: "fixture-race",
    gas: true,
    drift: true,
  });
  expect(send.mock.lastCall![0]).not.toHaveProperty("timeMs");
  expect(send.mock.calls[3]![0].sequence).toBeGreaterThan(
    send.mock.calls[0]![0].sequence,
  );
  view.rerender({ enabled: false });
  expect(send.mock.lastCall![0]).toMatchObject(kartNeutral);
  const count = send.mock.calls.length;
  act(() => vi.advanceTimersByTime(500));
  expect(send).toHaveBeenCalledTimes(count);
});

it("keeps two held pointers independent and releases each cancelled or lost capture", () => {
  class TestPointer extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  vi.stubGlobal("PointerEvent", TestPointer);
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  const change = vi.fn();
  render(<TouchController onChange={change} />);
  const gas = screen.getByRole("button", { name: "Accelerate" }),
    drift = screen.getByRole("button", { name: "Drift / hop" });
  fireEvent.pointerDown(gas, { pointerId: 1 });
  fireEvent.pointerDown(drift, { pointerId: 2 });
  expect(change.mock.lastCall![0]).toMatchObject({ gas: true, drift: true });
  fireEvent.pointerCancel(gas, { pointerId: 1 });
  expect(change.mock.lastCall![0]).toMatchObject({ gas: false, drift: true });
  fireEvent.lostPointerCapture(drift, { pointerId: 2 });
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
});

it("delivers each server-confirmed race completion once, including null-time DNF", async () => {
  const state = createKartRace("completion-fixture", [
    { playerId: "one", name: "Amina" },
    { playerId: "two", name: "Bilal" },
  ]);
  const complete = vi.fn(),
    view = render(
      <KartGameWrapper
        race={projectKartRace(state, null, 100)}
        onRaceComplete={complete}
      />,
    );
  expect(complete).not.toHaveBeenCalled();
  state.ended = true;
  state.drivers[0]!.status = "FINISHED";
  state.drivers[0]!.lapTimeMs = 28_000;
  state.drivers[1]!.status = "DNF";
  const final = projectKartRace(state, null, 100);
  view.rerender(<KartGameWrapper race={final} onRaceComplete={complete} />);
  await waitFor(() => expect(complete).toHaveBeenCalledTimes(2));
  expect(complete).toHaveBeenCalledWith({
    playerId: "one",
    lapTimeMs: 28_000,
    status: "FINISHED",
  });
  expect(complete).toHaveBeenCalledWith({
    playerId: "two",
    lapTimeMs: null,
    status: "DNF",
  });
  view.rerender(<KartGameWrapper race={{ ...final }} onRaceComplete={complete} />);
  expect(complete).toHaveBeenCalledTimes(2);
});

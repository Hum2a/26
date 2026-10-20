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
import { GuestKart } from "./GuestKart";
import { steerFromPointer } from "./steering";
import type { LobbySnapshot } from "@26/shared";
import KartGameWrapper from "./KartGameWrapper";
vi.mock("./KartCanvas", () => ({
  default: ({
    followPlayerId,
    mobile,
  }: {
    followPlayerId?: string;
    mobile: boolean;
  }) => (
    <div
      data-testid="driving-renderer"
      data-player={followPlayerId}
      data-mobile={String(mobile)}
    >
      Stand-in WebGL renderer
    </div>
  ),
}));

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
    drift = screen.getByRole("button", { name: "Drift / boost" });
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

it("centres the thumb pad, clamps edges, ignores a second steering thumb and releases capture", () => {
  expect(steerFromPointer(50, 0, 100)).toBe(0);
  expect(steerFromPointer(52, 0, 100)).toBe(0);
  expect(steerFromPointer(-200, 0, 100)).toBe(-1);
  expect(steerFromPointer(300, 0, 100)).toBe(1);
  expect(steerFromPointer(20, 0, 0)).toBe(0);
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
  const view = render(<TouchController onChange={change} />);
  fireEvent.click(screen.getByRole("button", { name: "Use thumb pad" }));
  const pad = screen.getByLabelText("Steering").parentElement!;
  vi.spyOn(pad, "getBoundingClientRect").mockReturnValue({
    left: 0,
    width: 100,
  } as DOMRect);
  fireEvent.pointerDown(pad, { pointerId: 1, clientX: 92 });
  expect(change.mock.lastCall![0].steer).toBe(1);
  fireEvent.pointerDown(pad, { pointerId: 2, clientX: 0 });
  expect(change.mock.lastCall![0].steer).toBe(1);
  fireEvent.pointerCancel(pad, { pointerId: 2 });
  expect(change.mock.lastCall![0].steer).toBe(1);
  fireEvent.pointerCancel(pad, { pointerId: 1 });
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
  fireEvent.keyDown(screen.getByRole("button", { name: "Accelerate" }), {
    key: "Enter",
  });
  fireEvent.pointerDown(pad, { pointerId: 3, clientX: 92 });
  view.rerender(<TouchController onChange={change} disabled />);
  view.rerender(<TouchController onChange={change} />);
  fireEvent.pointerDown(pad, { pointerId: 4, clientX: 0 });
  expect(change.mock.lastCall![0].steer).toBe(-1);
  fireEvent.click(screen.getByRole("button", { name: "Swap sides" }));
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
  expect(
    screen.getByRole("button", { name: "Swap sides" }).getAttribute("aria-pressed"),
  ).toBe("true");
});

it("shows server-confirmed drift and wrong-way feedback, and replaces pedals with a settled finish card", () => {
  const state = createKartRace("hud", [{ playerId: "a", name: "Amina" }]);
  state.drivers[0]!.driftMs = 700;
  state.drivers[0]!.wasDrifting = true;
  const race = projectKartRace(state, "a", 100);
  const snapshot = {
    phase: "collect",
    paused: false,
    held: false,
    play: { kart: race, selfAward: null },
  } as unknown as LobbySnapshot;
  const view = render(<GuestKart snapshot={snapshot} />);
  expect(
    screen
      .getByRole("progressbar", { name: "Drift charge" })
      .getAttribute("aria-valuenow"),
  ).toBe("100");
  expect(screen.getByText("Drift ready — release R!")).toBeTruthy();
  race.participants[0]!.wrongWay = true;
  view.rerender(<GuestKart snapshot={{ ...snapshot }} />);
  expect(screen.getByText("Wrong way — turn around")).toBeTruthy();
  race.participants[0]!.status = "FINISHED";
  race.participants[0]!.lapTimeMs = 28_000;
  view.rerender(<GuestKart snapshot={{ ...snapshot }} />);
  expect(screen.getByRole("heading", { name: "Lap complete" })).toBeTruthy();
  expect(screen.getByText("28.00s")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Accelerate" })).toBeNull();
  expect(screen.getByText("Watch the stage for the results.")).toBeTruthy();
});

it("gives the phone its own driving view and a map option without changing input authority", async () => {
  const race = projectKartRace(
    createKartRace("phone", [
      { playerId: "mine", name: "Amina" },
      { playerId: "other", name: "Bilal" },
    ]),
    "mine",
    100,
  );
  const snapshot = {
    phase: "collect",
    paused: false,
    held: false,
    play: { kart: race, selfAward: null },
  } as unknown as LobbySnapshot;
  const view = render(<GuestKart snapshot={snapshot} onInput={vi.fn()} />);
  const renderer = await screen.findByTestId("driving-renderer");
  expect(renderer.getAttribute("data-player")).toBe("mine");
  expect(renderer.getAttribute("data-mobile")).toBe("true");
  expect(screen.getByText("Position 1 of 2")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Use lightweight map" }));
  expect(screen.queryByTestId("driving-renderer")).toBeNull();
  const map = screen.getByRole("img", { name: "Your live track position" });
  expect(map.querySelectorAll("[data-map-player]")).toHaveLength(1);
  expect(map.querySelector('[data-map-player="other"]')).toBeNull();
  expect(
    (screen.getByRole("button", { name: "Accelerate" }) as HTMLButtonElement).disabled,
  ).toBe(false);
  view.rerender(<GuestKart snapshot={{ ...snapshot, paused: true }} />);
  expect(
    (screen.getByRole("button", { name: "Accelerate" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect(screen.getByRole("img", { name: "Your live track position" })).toBeTruthy();
});

it("does not mistake an older shortlisted leaderboard for the race size", () => {
  const race = projectKartRace(
    createKartRace("legacy", [{ playerId: "mine", name: "Amina" }]),
    "mine",
    100,
  );
  delete race.participantCount;
  render(
    <GuestKart
      snapshot={
        {
          phase: "collect",
          paused: false,
          held: false,
          play: { kart: race, selfAward: null },
        } as unknown as LobbySnapshot
      }
    />,
  );
  expect(screen.getByText("Position 1")).toBeTruthy();
  expect(screen.queryByText(/Position 1 of/)).toBeNull();
});

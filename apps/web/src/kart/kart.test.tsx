import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  createKartRace,
  projectKartRace,
  kartNeutral,
  createDrivingBody,
  kartItemNames,
} from "@26/shared";
import { TouchController } from "./TouchController";
import { useKartSocket } from "./useKartSocket";
import { GuestKart } from "./GuestKart";
import {
  pedalFromPointer,
  pedalFromTravel,
  steerFromPointer,
  steerFromTravel,
} from "./steering";
import type { LobbySnapshot, KartLookPreset } from "@26/shared";
import KartGameWrapper from "./KartGameWrapper";
import { useEffect } from "react";
vi.mock("./KartCanvas", () => ({
  default: function ReadyKartCanvas({
    followPlayerId,
    mobile,
    vfxPreset,
    paused,
    prediction,
    lookPreset,
    onRenderState,
  }: {
    followPlayerId?: string;
    mobile: boolean;
    vfxPreset?: { enabled: boolean };
    paused?: boolean;
    prediction?: unknown;
    lookPreset?: KartLookPreset;
    onRenderState?: (state: "usable") => void;
  }) {
    useEffect(() => onRenderState?.("usable"), [onRenderState]);
    return (
      <div
        data-testid="driving-renderer"
        data-player={followPlayerId}
        data-mobile={String(mobile)}
        data-effects={vfxPreset === undefined ? "legacy" : String(vfxPreset.enabled)}
        data-paused={String(paused)}
        data-prediction={prediction ? "on" : "off"}
        data-look={lookPreset ? JSON.stringify(lookPreset) : "original"}
      >
        Stand-in WebGL renderer
      </div>
    );
  },
}));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
for (const item of ["tennis", "bomb", "homing", "treat"] as const)
  it(`uses the phone's version3 ${item} slot and retains pedal control while awaiting acceptance`, async () => {
    const saved = createKartRace("expanded-ui", [{ playerId: "mine", name: "Amina" }], {
      itemRules: { version: 2, allowed: [item] },
    });
    saved.drivers[0]!.power!.item = item;
    const race = projectKartRace(saved, "mine", 100);
    expect(race.powers!.selfItem).toBeNull();
    const snapshot = {
      phase: "collect",
      paused: false,
      held: false,
      play: { kart: race },
    } as unknown as LobbySnapshot;
    const use = vi.fn();
    const view = render(
      <GuestKart snapshot={snapshot} onInput={vi.fn()} onUseItem={use} />,
    );
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Accelerate",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: `Use ${kartItemNames[item]}` }));
    expect(use).toHaveBeenCalledWith("expanded-ui");
    view.rerender(
      <GuestKart snapshot={snapshot} onInput={vi.fn()} onUseItem={use} itemPending />,
    );
    expect(
      (screen.getByRole("button", { name: "Using…" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Accelerate",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
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
  // Pin the heartbeat's random start phase so the count below is exact.
  const random = vi.spyOn(Math, "random").mockReturnValue(0);
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
  random.mockRestore();
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

it("steers the thumb pad from where the thumb lands, clamps travel, ignores a second steering thumb and releases capture", () => {
  expect(steerFromPointer(50, 0, 100)).toBe(0);
  expect(steerFromPointer(52, 0, 100)).toBe(0);
  expect(steerFromPointer(-200, 0, 100)).toBe(-1);
  expect(steerFromPointer(300, 0, 100)).toBe(1);
  expect(steerFromPointer(20, 0, 0)).toBe(0);
  // From the centre, travel is a straight line and the edge is full lock.
  expect(steerFromTravel(0, 300)).toBe(0);
  expect(steerFromTravel(8, 300)).toBeCloseTo(8 / 150);
  const half = steerFromTravel(80, 300);
  expect(half).toBeCloseTo(80 / 150);
  expect(steerFromTravel(-80, 300)).toBeCloseTo(-half);
  expect(steerFromTravel(150, 300)).toBe(1);
  expect(steerFromTravel(200, 300)).toBe(1);
  expect(steerFromTravel(-900, 300)).toBe(-1);
  expect(steerFromTravel(30, 100)).toBeCloseTo(0.6);
  expect(steerFromTravel(70, 100)).toBe(1);
  expect(steerFromTravel(10, 0)).toBe(0);
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
  fireEvent.click(screen.getByRole("button", { name: "Controls" }));
  fireEvent.click(screen.getByRole("button", { name: "Use thumb pad" }));
  fireEvent.click(screen.getByRole("button", { name: "Back to driving" }));
  const pad = screen.getByLabelText("Steering").parentElement!;
  vi.spyOn(pad, "getBoundingClientRect").mockReturnValue({
    left: 0,
    width: 100,
  } as DOMRect);
  // Landing off-centre does not jerk the kart; sliding does the steering.
  fireEvent.pointerDown(pad, { pointerId: 1, clientX: 92 });
  expect(change.mock.lastCall![0].steer).toBe(0);
  fireEvent.pointerMove(pad, { pointerId: 1, clientX: 192 });
  expect(change.mock.lastCall![0].steer).toBe(1);
  fireEvent.pointerDown(pad, { pointerId: 2, clientX: 0 });
  expect(change.mock.lastCall![0].steer).toBe(1);
  fireEvent.pointerCancel(pad, { pointerId: 2 });
  expect(change.mock.lastCall![0].steer).toBe(1);
  fireEvent.pointerCancel(pad, { pointerId: 1 });
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
  fireEvent.keyDown(screen.getByRole("button", { name: "Drift / boost" }), {
    key: "Enter",
  });
  fireEvent.pointerDown(pad, { pointerId: 3, clientX: 92 });
  view.rerender(<TouchController onChange={change} disabled />);
  view.rerender(<TouchController onChange={change} />);
  fireEvent.pointerDown(pad, { pointerId: 4, clientX: 0 });
  fireEvent.pointerMove(pad, { pointerId: 4, clientX: -100 });
  expect(change.mock.lastCall![0].steer).toBe(-1);
  fireEvent.click(screen.getByRole("button", { name: "Controls" }));
  fireEvent.click(screen.getByRole("button", { name: "Swap sides" }));
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
  expect(
    screen.getByRole("button", { name: "Swap sides" }).getAttribute("aria-pressed"),
  ).toBe("true");
});

it("steers from the zone without changing speed, while the other thumb works the pedals", () => {
  // Up and down from the landing point, with a coasting band in the middle.
  expect(pedalFromTravel(0, 120)).toBeNull();
  expect(pedalFromTravel(-20, 120)).toBeNull();
  expect(pedalFromTravel(-22, 120)).toBe("gas");
  expect(pedalFromTravel(22, 120)).toBe("brake");
  // Short pads still need a deliberate 14 px; tall pads never more than 28 px.
  expect(pedalFromTravel(-13, 40)).toBeNull();
  expect(pedalFromTravel(-14, 40)).toBe("gas");
  expect(pedalFromTravel(-28, 400)).toBe("gas");
  expect(pedalFromTravel(Number.NaN, 120)).toBeNull();
  expect(pedalFromTravel(-50, 0)).toBeNull();
  expect(pedalFromPointer(10, 0, 120)).toBe("gas");
  expect(pedalFromPointer(60, 0, 120)).toBeNull();
  expect(pedalFromPointer(110, 0, 120)).toBe("brake");
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
  fireEvent.click(screen.getByRole("button", { name: "Controls" }));
  fireEvent.click(screen.getByRole("button", { name: "Use thumb pad" }));
  fireEvent.click(screen.getByRole("button", { name: "Back to driving" }));
  const accelerate = screen.getByRole("button", { name: "Accelerate" });
  const drift = screen.getByRole("button", { name: "Drift / boost" });
  expect(screen.getByRole("button", { name: "Brake / reverse" })).toBeTruthy();
  const pad = screen
    .getByLabelText("Steering")
    .closest<HTMLElement>(".kart-thumb-pad")!;
  expect(pad.dataset.pedals).toBe("false");
  vi.spyOn(pad, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 300,
    height: 120,
  } as DOMRect);
  fireEvent.pointerDown(pad, { pointerId: 1, clientX: 150, clientY: 60 });
  expect(change.mock.lastCall![0]).toEqual(kartNeutral);
  // Sliding up and across steers, and does not touch the throttle or the brake.
  fireEvent.pointerMove(pad, { pointerId: 1, clientX: 240, clientY: 30 });
  expect(change.mock.lastCall![0]).toMatchObject({ gas: false, brake: false });
  const steered = change.mock.lastCall![0].steer as number;
  expect(steered).toBeGreaterThan(0.15);
  expect(steered).toBeLessThan(1);
  expect(pad.dataset.pedal).toBe("none");
  fireEvent.pointerDown(accelerate, { pointerId: 2 });
  expect(change.mock.lastCall![0]).toEqual({
    steer: steered,
    gas: true,
    brake: false,
    drift: false,
  });
  fireEvent.pointerMove(pad, { pointerId: 1, clientX: 150, clientY: 110 });
  expect(change.mock.lastCall![0]).toMatchObject({
    gas: true,
    brake: false,
    steer: 0,
  });
  fireEvent.pointerDown(drift, { pointerId: 3 });
  expect(change.mock.lastCall![0]).toMatchObject({ gas: true, drift: true, steer: 0 });
  fireEvent.pointerUp(pad, { pointerId: 1 });
  expect(change.mock.lastCall![0]).toMatchObject({
    steer: 0,
    gas: true,
    drift: true,
  });
  fireEvent.pointerUp(accelerate, { pointerId: 2 });
  fireEvent.pointerUp(drift, { pointerId: 3 });
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
});

it("releases a held steer when the controls lock, without the zone setting speed", () => {
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
  const view = render(
    <TouchController onChange={change} steeringDefault="pad-absolute" />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Controls" }));
  fireEvent.click(screen.getByRole("button", { name: "Use thumb pad" }));
  fireEvent.click(screen.getByRole("button", { name: "Back to driving" }));
  const pad = screen
    .getByLabelText("Steering")
    .closest<HTMLElement>(".kart-thumb-pad")!;
  vi.spyOn(pad, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 300,
    height: 120,
  } as DOMRect);
  fireEvent.pointerDown(pad, { pointerId: 1, clientX: 280, clientY: 10 });
  expect(change.mock.lastCall![0]).toMatchObject({ gas: false, brake: false });
  expect(change.mock.lastCall![0].steer).not.toBe(0);
  view.rerender(
    <TouchController onChange={change} steeringDefault="pad-absolute" disabled />,
  );
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
  expect(pad.dataset.pedal).toBe("none");
  fireEvent.pointerMove(pad, { pointerId: 1, clientX: 280, clientY: 5 });
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
});

it("shows server-confirmed drift and wrong-way feedback, and replaces pedals with a settled finish card", async () => {
  const state = createKartRace("hud", [{ playerId: "a", name: "Amina" }]);
  state.drivers[0]!.driftMs = 700;
  state.drivers[0]!.wasDrifting = true;
  state.drivers[0]!.checkpoint = 3;
  const race = projectKartRace(state, "a", 100);
  const snapshot = {
    phase: "collect",
    paused: false,
    held: false,
    play: { kart: race, selfAward: null },
  } as unknown as LobbySnapshot;
  const view = render(<GuestKart snapshot={snapshot} />);
  expect(screen.getByText("Sector 4 / 8")).toBeTruthy();
  expect(
    screen
      .getByRole("progressbar", { name: "Drift charge" })
      .getAttribute("aria-valuenow"),
  ).toBe("1");
  expect(await screen.findByText("Drift ready — release R!")).toBeTruthy();
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

it("passes the public effects switch and authoritative pause separately into the phone renderer", async () => {
  const race = projectKartRace(
    createKartRace("effects", [{ playerId: "mine", name: "Amina" }]),
    "mine",
    100,
  );
  const snapshot = {
    phase: "collect",
    paused: false,
    held: false,
    play: { kart: race },
  } as unknown as LobbySnapshot;
  const view = render(<GuestKart snapshot={snapshot} />);
  const canvas = await screen.findByTestId("driving-renderer");
  expect(canvas.getAttribute("data-effects")).toBe("legacy");
  for (const enabled of [true, false]) {
    view.rerender(
      <GuestKart
        snapshot={{
          ...snapshot,
          play: { ...snapshot.play!, kart: { ...race, effectsEnabled: enabled } },
        }}
      />,
    );
    expect(canvas.getAttribute("data-effects")).toBe(String(enabled));
  }
  view.rerender(<GuestKart snapshot={{ ...snapshot, paused: true }} />);
  expect(canvas.getAttribute("data-paused")).toBe("true");
  expect(canvas.getAttribute("data-look")).toBe("original");
  view.rerender(
    <GuestKart
      snapshot={{
        ...snapshot,
        play: { ...snapshot.play!, kart: { ...race, look: "race" } },
      }}
    />,
  );
  expect(JSON.parse(canvas.getAttribute("data-look")!).optics.bloom.enabled).toBe(true);
  view.rerender(
    <GuestKart
      snapshot={{
        ...snapshot,
        play: { ...snapshot.play!, kart: { ...race, look: "off" } },
      }}
    />,
  );
  expect(canvas.getAttribute("data-look")).toBe("original");
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
  // The test browser is a fine pointer, so the view uses the desktop renderer.
  expect(renderer.getAttribute("data-mobile")).toBe("false");
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

it("uses the phone renderer and its frame budget for a coarse pointer", async () => {
  const previous = window.matchMedia;
  window.matchMedia = vi.fn(
    () =>
      ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  );
  const race = projectKartRace(
    createKartRace("phone-coarse", [{ playerId: "mine", name: "Amina" }]),
    "mine",
    100,
  );
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
      onInput={vi.fn()}
    />,
  );
  expect(
    (await screen.findByTestId("driving-renderer")).getAttribute("data-mobile"),
  ).toBe("true");
  window.matchMedia = previous;
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

it("offers recovery to the driver and releases controls while awaiting the server", () => {
  const race = projectKartRace(
    createKartRace("recovery", [{ playerId: "mine", name: "Amina" }]),
    "mine",
    100,
  );
  const snapshot = {
    phase: "collect",
    paused: false,
    held: false,
    play: { kart: race },
  } as unknown as LobbySnapshot;
  const recover = vi.fn();
  const view = render(
    <GuestKart snapshot={snapshot} onInput={vi.fn()} onRecover={recover} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Back to track" }));
  expect(recover).toHaveBeenCalledWith("recovery");
  view.rerender(
    <GuestKart
      snapshot={snapshot}
      onInput={vi.fn()}
      onRecover={recover}
      recoveryPending
    />,
  );
  expect(
    (screen.getByRole("button", { name: "Returning…" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect(
    (screen.getByRole("button", { name: "Accelerate" }) as HTMLButtonElement).disabled,
  ).toBe(true);
});

it("releases keyboard controls when focus moves to the steering input", () => {
  const change = vi.fn();
  render(<TouchController onChange={change} />);
  fireEvent.keyDown(window, { key: "ArrowUp" });
  fireEvent.keyDown(window, { key: " " });
  const slider = screen.getByLabelText("Steering");
  slider.focus();
  fireEvent.keyUp(slider, { key: " " });
  expect(change).toHaveBeenLastCalledWith({ ...kartNeutral, gas: true });
  fireEvent.keyUp(slider, { key: "ArrowUp" });
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
});

it("shows the held power-up and waits for server acknowledgement without releasing the pedals", () => {
  const race = projectKartRace(
    createKartRace("items", [{ playerId: "mine", name: "Amina" }]),
    "mine",
    100,
  );
  race.powers!.selfItem = "shield";
  const snapshot = {
    phase: "collect",
    paused: false,
    held: false,
    play: { kart: race },
  } as unknown as LobbySnapshot;
  const use = vi.fn(),
    view = render(<GuestKart snapshot={snapshot} onInput={vi.fn()} onUseItem={use} />);
  fireEvent.click(screen.getByRole("button", { name: "Use Bubble shield" }));
  expect(use).toHaveBeenCalledWith("items");
  view.rerender(
    <GuestKart snapshot={snapshot} onInput={vi.fn()} onUseItem={use} itemPending />,
  );
  expect(
    (screen.getByRole("button", { name: "Using…" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect(
    (screen.getByRole("button", { name: "Accelerate" }) as HTMLButtonElement).disabled,
  ).toBe(false);
  view.rerender(<GuestKart snapshot={{ ...snapshot, paused: true }} onUseItem={use} />);
  expect(
    (screen.getByRole("button", { name: "Use Bubble shield" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

it("routes keyboard actions through existing callbacks and starts a new race with released input", () => {
  const race = projectKartRace(
    createKartRace("keyboard-race", [{ playerId: "mine", name: "Amina" }]),
    "mine",
    100,
  );
  race.powers!.selfItem = "shield";
  const snapshot = {
    phase: "collect",
    paused: false,
    held: false,
    play: { kart: race },
  } as unknown as LobbySnapshot;
  const use = vi.fn(),
    recover = vi.fn(),
    send = vi.fn();
  const view = render(
    <GuestKart
      snapshot={snapshot}
      onInput={send}
      onUseItem={use}
      onRecover={recover}
    />,
  );
  fireEvent.keyDown(window, { key: "e" });
  fireEvent.keyDown(window, { key: "e", repeat: true });
  expect(use).toHaveBeenCalledTimes(1);
  expect(use).toHaveBeenLastCalledWith("keyboard-race");
  fireEvent.keyDown(window, { key: "r" });
  expect(recover).toHaveBeenLastCalledWith("keyboard-race");
  fireEvent.keyDown(window, { key: "w" });
  expect(
    screen.getByRole("button", { name: "Accelerate" }).getAttribute("aria-pressed"),
  ).toBe("true");
  view.rerender(
    <GuestKart
      snapshot={{
        ...snapshot,
        play: { ...snapshot.play!, kart: { ...race, raceId: "another-race" } },
      }}
      onInput={send}
      onUseItem={use}
      onRecover={recover}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Accelerate" }).getAttribute("aria-pressed"),
  ).toBe("false");
  fireEvent.keyDown(window, { key: "w", repeat: true });
  expect(
    screen.getByRole("button", { name: "Accelerate" }).getAttribute("aria-pressed"),
  ).toBe("false");
});

it("lays out each kart state for landscape and keeps race notices visible over the driving view", async () => {
  const state = createKartRace("layout", [
    { playerId: "a", name: "Amina" },
    { playerId: "b", name: "Chen" },
  ]);
  const race = projectKartRace(state, "a", 100);
  race.participants[0]!.gridPosition = 2;
  race.participantCount = 2;
  const base = {
    phase: "intro",
    paused: false,
    held: false,
    play: { kart: race, selfAward: null },
  } as unknown as LobbySnapshot;
  const phone = () => screen.getByRole("region", { name: "Sprint controller" });
  const notice = () => phone().querySelector(".kart-race-status");
  // Grid: the slot and the instruction stay in the overlay, not in a hidden paragraph.
  const view = render(<GuestKart snapshot={base} />);
  expect(phone().getAttribute("data-layout")).toBe("grid");
  await waitFor(() => expect(notice()?.textContent).toContain("Grid slot 2 of 2"));
  // One big tap turns race sound on, and the prompt then leaves.
  const prompt = screen.getByRole("button", { name: "🔊 Tap for race sound" });
  act(() => prompt.click());
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "🔊 Tap for race sound" })).toBeNull(),
  );
  expect(notice()?.parentElement).toBe(phone());
  expect(notice()?.tagName).not.toBe("P");
  // Racing: no notice while driving normally.
  view.rerender(<GuestKart snapshot={{ ...base, phase: "collect" }} />);
  expect(phone().getAttribute("data-layout")).toBe("race");
  await waitFor(() => expect(notice()?.textContent).toBe(""));
  // Paused, then a lost connection, are announced over the driving view.
  view.rerender(<GuestKart snapshot={{ ...base, phase: "collect", paused: true }} />);
  await waitFor(() => expect(notice()?.textContent).toBe("Paused — controls released"));
  view.rerender(
    <GuestKart snapshot={{ ...base, phase: "collect" }} connected={false} />,
  );
  await waitFor(() =>
    expect(notice()?.textContent).toBe("Connection lost — controls released"),
  );
  view.rerender(<GuestKart snapshot={{ ...base, phase: "collect" }} recoveryPending />);
  await waitFor(() =>
    expect(notice()?.textContent).toBe("Returning to the track — controls released"),
  );
  // Finished: its own layout, no driving overlay.
  race.participants[0]!.status = "FINISHED";
  race.participants[0]!.lapTimeMs = 28_000;
  view.rerender(<GuestKart snapshot={{ ...base, phase: "collect" }} />);
  expect(phone().getAttribute("data-layout")).toBe("finish");
  expect(notice()).toBeNull();
  // Watching a race this phone is not in.
  const watching = projectKartRace(state, null, 100);
  view.rerender(
    <GuestKart
      snapshot={
        {
          ...base,
          phase: "collect",
          play: { kart: watching, selfAward: null },
        } as unknown as LobbySnapshot
      }
    />,
  );
  expect(phone().getAttribute("data-layout")).toBe("watch");
  // No race at all: the ordinary layout.
  view.rerender(
    <GuestKart
      snapshot={
        {
          ...base,
          play: { question: { kind: "kart", timeLimitMs: 180_000 }, selfAward: null },
        } as unknown as LobbySnapshot
      }
    />,
  );
  expect(phone().getAttribute("data-layout")).toBeNull();
});

it("sends at most one control message per heartbeat, merging rapid changes", () => {
  vi.useFakeTimers();
  const send = vi.fn();
  const race = projectKartRace(
    createKartRace("instant", [{ playerId: "guest", name: "Stand-in driver" }]),
    "guest",
    100,
  );
  const view = renderHook(() => useKartSocket(race, true, send));
  expect(send).toHaveBeenCalledTimes(1);
  // Within the gap: held back, then sent once with the latest controls.
  act(() => view.result.current({ ...kartNeutral, gas: true }));
  act(() => view.result.current({ ...kartNeutral, gas: true, steer: -1 }));
  act(() => vi.advanceTimersByTime(55));
  expect(send).toHaveBeenCalledTimes(1);
  act(() => vi.advanceTimersByTime(35));
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.lastCall![0]).toMatchObject({ gas: true, steer: -1 });
  // A later change goes out within one gap, without waiting a full heartbeat.
  act(() => vi.advanceTimersByTime(140));
  act(() => view.result.current({ ...kartNeutral, brake: true }));
  act(() => vi.advanceTimersByTime(90));
  expect(send.mock.lastCall![0]).toMatchObject({ brake: true, gas: false });
  // Unchanged controls are not re-sent outside the heartbeat.
  const after = send.mock.calls.length;
  act(() => view.result.current({ ...kartNeutral, brake: true }));
  expect(send).toHaveBeenCalledTimes(after);
  // Steering that changes every frame still sends no faster than ~10 a second.
  const times: number[] = [];
  send.mockImplementation(() => times.push(Date.now()));
  for (let i = 0; i < 60; i++) {
    act(() => view.result.current({ ...kartNeutral, steer: i % 2 ? 1 : -1 }));
    act(() => vi.advanceTimersByTime(17));
  }
  for (let i = 1; i < times.length; i++)
    expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(90);
  // 60 frames is 1,020 ms: at a 90 ms minimum gap, at most twelve messages.
  expect(times.length).toBeLessThanOrEqual(12);
  view.unmount();
});

it("starts each phone's heartbeat at a random point in the beat", () => {
  vi.useFakeTimers();
  const race = projectKartRace(
    createKartRace("phase", [{ playerId: "guest", name: "Stand-in driver" }]),
    "guest",
    100,
  );
  const firstHeartbeat = (random: number) => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(random);
    const send = vi.fn();
    const view = renderHook(() => useKartSocket(race, true, send));
    spy.mockRestore();
    expect(send).toHaveBeenCalledTimes(1);
    let waited = 0;
    while (send.mock.calls.length === 1 && waited < 300) {
      act(() => vi.advanceTimersByTime(5));
      waited += 5;
    }
    view.unmount();
    return waited;
  };
  const early = firstHeartbeat(0);
  const late = firstHeartbeat(0.6);
  expect(early).toBeGreaterThanOrEqual(90);
  expect(early).toBeLessThanOrEqual(105);
  expect(late - early).toBeGreaterThanOrEqual(55);
});

it("follows the host's prediction switch and steering default", async () => {
  const state = createKartRace("feel", [{ playerId: "a", name: "Amina" }]);
  const race = projectKartRace(state, "a", 100);
  const snapshot = {
    phase: "collect",
    paused: false,
    held: false,
    play: { kart: race, selfAward: null },
  } as unknown as LobbySnapshot;
  const view = render(<GuestKart snapshot={snapshot} onInput={vi.fn()} />);
  const renderer = await screen.findByTestId("driving-renderer");
  expect(renderer.getAttribute("data-prediction")).toBe("on");
  view.rerender(
    <GuestKart
      snapshot={
        {
          ...snapshot,
          play: { kart: { ...race, settings: { prediction: "off" } }, selfAward: null },
        } as unknown as LobbySnapshot
      }
      onInput={vi.fn()}
    />,
  );
  expect(screen.getByTestId("driving-renderer").getAttribute("data-prediction")).toBe(
    "off",
  );
});

it("starts sideways phones on the slider when the host chooses it, unless the guest picked", () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  const view = render(<TouchController onChange={vi.fn()} steeringDefault="slider" />);
  fireEvent.click(screen.getByRole("button", { name: "Controls" }));
  expect(screen.getByRole("button", { name: "Use thumb pad" })).toBeTruthy();
  view.rerender(<TouchController onChange={vi.fn()} steeringDefault="pad-strip" />);
  expect(screen.getByRole("button", { name: "Use steering slider" })).toBeTruthy();
  expect(screen.getByText("Slide to steer")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Accelerate" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Brake / reverse" })).toBeTruthy();
  // A guest's own choice wins over later host defaults.
  fireEvent.click(screen.getByRole("button", { name: "Use steering slider" }));
  view.rerender(<TouchController onChange={vi.fn()} steeringDefault="pad-absolute" />);
  expect(screen.getByRole("button", { name: "Use thumb pad" })).toBeTruthy();
});

it("explains accepted bounce stun on the phone while keeping held controls ready to resume", () => {
  const state = createKartRace("phone-stun", [{ playerId: "a", name: "Amina" }], {
    handling: "bounce-v1",
  });
  state.drivers[0]!.physics = {
    ...createDrivingBody(),
    stunMs: 180,
    impactCooldownMs: 600,
  };
  const race = projectKartRace(state, "a", 100);
  race.participants[0]!.wrongWay = true;
  const snapshot = {
    phase: "collect",
    paused: false,
    held: false,
    play: { kart: race, selfAward: null },
  } as unknown as LobbySnapshot;
  const view = render(<GuestKart snapshot={snapshot} />);
  expect(screen.getByText("Barrier impact — controls resume in a moment")).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Accelerate" }) as HTMLButtonElement).disabled,
  ).toBe(false);
  if (race.presentation?.version !== 2 || !race.presentation.handling)
    throw new Error("Accepted handling state required");
  race.presentation.handling.stunMs = 0;
  race.elapsedMs = 200;
  view.rerender(<GuestKart snapshot={{ ...snapshot }} />);
  expect(screen.getByText("Wrong way — turn around")).toBeTruthy();
});

it("keeps the input heartbeat running when the device wall clock changes", () => {
  vi.useFakeTimers();
  const race = projectKartRace(
    createKartRace("clock-input", [{ playerId: "mine", name: "Amina" }]),
    "mine",
    0,
  );
  const send = vi.fn();
  const view = renderHook(() => useKartSocket(race, true, send));
  const first = send.mock.calls.length;
  vi.setSystemTime(Date.now() - 3600000);
  act(() => vi.advanceTimersByTime(200));
  expect(send.mock.calls.length).toBeGreaterThan(first);
  view.unmount();
});

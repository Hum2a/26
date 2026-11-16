import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { kartNeutral } from "@26/shared";
import { TouchController } from "./TouchController";
import { testPad } from "./controls.test-support";
import type { KartPad } from "./gamepad";

let pad: KartPad | null, frames: Map<number, FrameRequestCallback>, nextFrame: number;
const previousPads = Object.getOwnPropertyDescriptor(navigator, "getGamepads");
beforeEach(() => {
  pad = testPad();
  frames = new Map();
  nextFrame = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.set(++nextFrame, cb);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  Object.defineProperty(navigator, "getGamepads", {
    configurable: true,
    value: () => [null, pad],
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (previousPads) Object.defineProperty(navigator, "getGamepads", previousPads);
  else Reflect.deleteProperty(navigator, "getGamepads");
});
const frame = () =>
  act(() => {
    const calls = [...frames.values()];
    frames.clear();
    calls.forEach((cb) => cb(16));
  });
const down = (key: string, repeat = false) =>
  fireEvent.keyDown(window, { key, repeat });
const up = (key: string) => fireEvent.keyUp(window, { key });

it("adds WASD and edge-triggered item/recovery shortcuts, releasing input for recovery", () => {
  const change = vi.fn(),
    item = vi.fn(),
    recover = vi.fn();
  render(<TouchController onChange={change} onUseItem={item} onRecover={recover} />);
  down("w");
  down("d");
  down(" ");
  expect(change).toHaveBeenLastCalledWith({
    gas: true,
    steer: 1,
    drift: true,
    brake: false,
  });
  down("e");
  down("e", true);
  down("e");
  expect(item).toHaveBeenCalledTimes(1);
  up("e");
  down("e");
  expect(item).toHaveBeenCalledTimes(2);
  down("r");
  down("r", true);
  expect(recover).toHaveBeenCalledTimes(1);
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
  down("w", true);
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
  up("w");
  down("w");
  expect(change.mock.lastCall![0].gas).toBe(true);
});
it("requires fresh keyboard input after pause and blur and respects item pending", () => {
  const change = vi.fn(),
    item = vi.fn();
  const view = render(
    <TouchController onChange={change} onUseItem={item} itemDisabled />,
  );
  down("e");
  expect(item).not.toHaveBeenCalled();
  down("ArrowUp");
  view.rerender(<TouchController onChange={change} disabled />);
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
  view.rerender(<TouchController onChange={change} />);
  down("ArrowUp", true);
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
  up("ArrowUp");
  down("ArrowUp");
  expect(change.mock.lastCall![0].gas).toBe(true);
  fireEvent.blur(window);
  down("ArrowUp", true);
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
});
it("does not steal typing, editable content, modifier shortcuts, buttons or modal keys", () => {
  const change = vi.fn(),
    item = vi.fn();
  const fixture = (dialog: boolean) => (
    <>
      <TouchController onChange={change} onUseItem={item} />
      <input aria-label="Nickname" />
      <div contentEditable data-testid="editor" />
      {dialog ? (
        <div role="dialog" aria-modal="true">
          Menu
        </div>
      ) : null}
    </>
  );
  const view = render(fixture(true));
  down("w");
  down("e");
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
  expect(item).not.toHaveBeenCalled();
  view.rerender(fixture(false));
  fireEvent.keyDown(screen.getByLabelText("Nickname"), { key: "w" });
  fireEvent.keyDown(screen.getByTestId("editor"), { key: "e" });
  fireEvent.keyDown(screen.getByRole("button", { name: "Controls" }), { key: "r" });
  fireEvent.keyDown(window, { key: "r", ctrlKey: true });
  expect(item).not.toHaveBeenCalled();
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
  down("w");
  expect(change.mock.lastCall![0].gas).toBe(true);
  act(() => screen.getByLabelText("Nickname").focus());
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
  act(() => (document.activeElement as HTMLElement).blur());
  up("w");
  down("w");
  view.rerender(fixture(true));
  frame();
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
});
it("polls one gamepad, deduplicates actions and requires neutral after connect, recovery and unplug", () => {
  const change = vi.fn(),
    item = vi.fn(),
    recover = vi.fn();
  pad = testPad(1, [0, 2]);
  render(<TouchController onChange={change} onUseItem={item} onRecover={recover} />);
  frame();
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
  expect(item).not.toHaveBeenCalled();
  pad = testPad();
  frame();
  pad = testPad(0.8, [0, 2]);
  frame();
  expect(change.mock.lastCall![0]).toMatchObject({ gas: true });
  expect(item).toHaveBeenCalledTimes(1);
  frame();
  expect(item).toHaveBeenCalledTimes(1);
  pad = testPad(0, [0, 3]);
  frame();
  expect(recover).toHaveBeenCalledTimes(1);
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
  frame();
  expect(recover).toHaveBeenCalledTimes(1);
  pad = testPad();
  frame();
  pad = testPad(1, [0]);
  frame();
  expect(change.mock.lastCall![0].gas).toBe(true);
  fireEvent(window, new Event("gamepaddisconnected"));
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
  frame();
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
  pad = testPad();
  frame();
  pad = testPad(0, [0]);
  frame();
  expect(change.mock.lastCall![0].gas).toBe(true);
});
it("merges devices without a neutral gamepad erasing a held key or pedal", () => {
  const change = vi.fn();
  render(<TouchController onChange={change} />);
  frame();
  down("ArrowUp");
  down("ArrowLeft");
  pad = testPad(1);
  frame();
  expect(change.mock.lastCall![0]).toMatchObject({ gas: true, steer: -1 });
  up("ArrowLeft");
  expect(change.mock.lastCall![0]).toMatchObject({ gas: true, steer: 1 });
  fireEvent.keyDown(screen.getByRole("button", { name: "Drift / boost" }), {
    key: "Enter",
  });
  pad = null;
  frame();
  expect(change.mock.lastCall![0]).toMatchObject({ gas: true, drift: true, steer: 0 });
  up("ArrowUp");
  fireEvent.keyUp(screen.getByRole("button", { name: "Drift / boost" }), {
    key: "Enter",
  });
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
});

it("keeps one poll through strict mounting and changing callbacks without resetting held input", () => {
  const read = vi.fn(() => [pad]);
  Object.defineProperty(navigator, "getGamepads", { configurable: true, value: read });
  const first = vi.fn(),
    next = vi.fn();
  const view = render(
    <StrictMode>
      <TouchController onChange={first} />
    </StrictMode>,
  );
  frame();
  expect(read).toHaveBeenCalledTimes(1);
  pad = testPad(0, [0]);
  frame();
  expect(first.mock.lastCall![0].gas).toBe(true);
  view.rerender(
    <StrictMode>
      <TouchController onChange={next} />
    </StrictMode>,
  );
  frame();
  expect(read).toHaveBeenCalledTimes(3);
  expect(next).not.toHaveBeenCalled();
  pad = testPad();
  frame();
  expect(next).toHaveBeenLastCalledWith(kartNeutral);
});

it("does not reactivate a visible but unfocused window, even after the pad returns to neutral", () => {
  const change = vi.fn();
  render(<TouchController onChange={change} />);
  frame();
  pad = testPad(0, [0]);
  frame();
  expect(change.mock.lastCall![0].gas).toBe(true);
  fireEvent.blur(window);
  pad = testPad();
  frame();
  pad = testPad(0, [0]);
  frame();
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
  fireEvent.focus(window);
  frame();
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
  pad = testPad();
  frame();
  pad = testPad(0, [0]);
  frame();
  expect(change.mock.lastCall![0].gas).toBe(true);
});

it("releases hidden controls and does not use an item that was held through a pending receipt", () => {
  const change = vi.fn(),
    item = vi.fn();
  const view = render(
    <TouchController onChange={change} onUseItem={item} itemDisabled />,
  );
  frame();
  pad = testPad(0, [0, 2]);
  frame();
  expect(item).not.toHaveBeenCalled();
  view.rerender(<TouchController onChange={change} onUseItem={item} />);
  frame();
  expect(item).not.toHaveBeenCalled();
  pad = testPad();
  frame();
  pad = testPad(0, [0, 2]);
  frame();
  expect(item).toHaveBeenCalledTimes(1);
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  fireEvent(document, new Event("visibilitychange"));
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
  frame();
  hidden.mockReturnValue(false);
  fireEvent(document, new Event("visibilitychange"));
  frame();
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
  pad = testPad();
  frame();
  pad = testPad(0, [0]);
  frame();
  expect(change.mock.lastCall![0].gas).toBe(true);
});
it("keeps mouse steering opt-in, owned by one pointer and released after cancellation or blur", () => {
  class TestPointer extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? "mouse";
    }
  }
  vi.stubGlobal("PointerEvent", TestPointer);
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  const change = vi.fn();
  render(<TouchController onChange={change} />);
  expect(screen.queryByRole("group", { name: "Mouse steering area" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Controls" }));
  fireEvent.click(screen.getByLabelText("Enable mouse steering area"));
  fireEvent.click(screen.getByRole("button", { name: "Back to driving" }));
  const area = screen.getByRole("group", { name: "Mouse steering area" });
  fireEvent.click(screen.getByRole("button", { name: "Use thumb pad" }));
  const thumb = screen.getByLabelText("Steering").closest(".kart-thumb-pad")!;
  vi.spyOn(area, "getBoundingClientRect").mockReturnValue({
    left: 0,
    width: 200,
  } as DOMRect);
  fireEvent.pointerDown(area, { pointerId: 1, clientX: 0, button: 0, buttons: 1 });
  expect(change.mock.lastCall![0].steer).toBe(-1);
  fireEvent.pointerDown(thumb, {
    pointerId: 2,
    clientX: 200,
    button: 0,
    buttons: 1,
    pointerType: "touch",
  });
  fireEvent.pointerUp(thumb, { pointerId: 2, pointerType: "touch" });
  expect(change.mock.lastCall![0].steer).toBe(-1);
  fireEvent.pointerDown(area, { pointerId: 2, clientX: 200, button: 0, buttons: 1 });
  fireEvent.pointerUp(area, { pointerId: 2 });
  expect(change.mock.lastCall![0].steer).toBe(-1);
  fireEvent.pointerMove(area, { pointerId: 1, clientX: 200, buttons: 1 });
  expect(change.mock.lastCall![0].steer).toBe(1);
  fireEvent.pointerCancel(area, { pointerId: 1 });
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
  fireEvent.pointerDown(area, { pointerId: 1, clientX: 200, buttons: 1 });
  fireEvent.blur(window);
  fireEvent.pointerMove(area, { pointerId: 1, clientX: 200, buttons: 1 });
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
});
it("releases inputs while settings are open, tunes response and resets local preferences", () => {
  const change = vi.fn();
  render(<TouchController onChange={change} />);
  down("w");
  fireEvent.click(screen.getByRole("button", { name: "Controls" }));
  expect(change).toHaveBeenLastCalledWith(kartNeutral);
  expect(
    (screen.getByRole("button", { name: "Accelerate" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  fireEvent.change(screen.getByLabelText("Steering response"), {
    target: { value: "0.5" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Back to driving" }));
  fireEvent.change(screen.getByLabelText("Steering"), { target: { value: "0.5" } });
  expect(change.mock.lastCall![0].steer).toBe(0.25);
  fireEvent.click(screen.getByRole("button", { name: "Controls" }));
  fireEvent.click(screen.getByRole("button", { name: "Reset control settings" }));
  expect((screen.getByLabelText("Steering response") as HTMLInputElement).value).toBe(
    "1",
  );
});

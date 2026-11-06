import { useCallback, useEffect, useRef, useState } from "react";
import { kartNeutral, type KartControls } from "@26/shared";
import {
  controlSteering,
  readKartGamepad,
  type KartControlPreferences,
} from "./gamepad";

type Channel = "touch" | "keyboard" | "gamepad";
const blank = () => ({
  touch: { ...kartNeutral },
  keyboard: { ...kartNeutral },
  gamepad: { ...kartNeutral },
});
const same = (a: KartControls, b: KartControls) =>
  a.steer === b.steer && a.gas === b.gas && a.brake === b.brake && a.drift === b.drift;
const typing = (target: EventTarget | null) =>
  target instanceof Element &&
  Boolean(
    target.closest(
      "input, textarea, select, [contenteditable]:not([contenteditable=false]), [role=dialog], dialog[open]",
    ),
  );
const modal = () =>
  Boolean(document.querySelector('[role="dialog"][aria-modal="true"], dialog[open]'));
const drivingInput = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest("[data-kart-steering]"));

/** One input boundary: all devices feed the existing intent sender, never physics. */
export function useKartControls(options: {
  disabled: boolean;
  preferences: KartControlPreferences;
  onChange: (controls: KartControls) => void;
  onUseItem?: () => void;
  onRecover?: () => void;
  itemDisabled?: boolean;
  recoveryDisabled?: boolean;
  onRelease?: () => void;
}) {
  const callbacks = useRef(options);
  useEffect(() => {
    callbacks.current = options;
  });
  const channels = useRef(blank());
  const last = useRef<KartControls>({ ...kartNeutral });
  const keys = useRef(new Set<string>());
  const armed = useRef(false);
  const focused = useRef(true);
  const [controls, setControls] = useState<KartControls>({ ...kartNeutral });
  const [gamepad, setGamepad] = useState(false);
  const [releaseToken, setReleaseToken] = useState(0);
  const publish = useCallback((channel: Channel, patch: Partial<KartControls>) => {
    const all = channels.current;
    all[channel] = { ...all[channel], ...patch };
    const next = {
      steer: all.keyboard.steer || all.touch.steer || all.gamepad.steer,
      gas: all.keyboard.gas || all.touch.gas || all.gamepad.gas,
      brake: all.keyboard.brake || all.touch.brake || all.gamepad.brake,
      drift: all.keyboard.drift || all.touch.drift || all.gamepad.drift,
    };
    if (!same(next, last.current)) {
      last.current = next;
      setControls(next);
      callbacks.current.onChange(next);
    }
  }, []);
  const reset = useCallback(() => {
    keys.current.clear();
    armed.current = false;
    channels.current = blank();
    callbacks.current.onRelease?.();
    setReleaseToken((value) => value + 1);
    last.current = { ...kartNeutral };
    setControls({ ...kartNeutral });
    callbacks.current.onChange({ ...kartNeutral });
  }, []);
  const touch = useCallback(
    (patch: Partial<KartControls>) => {
      if (callbacks.current.disabled || !focused.current || document.hidden || modal())
        return;
      publish(
        "touch",
        patch.steer === undefined
          ? patch
          : {
              ...patch,
              steer: controlSteering(
                patch.steer,
                callbacks.current.preferences.sensitivity,
              ),
            },
      );
    },
    [publish],
  );
  const action = useCallback(
    (kind: "item" | "recover") => {
      const c = callbacks.current;
      if (c.disabled || !focused.current || document.hidden || modal()) return;
      if (kind === "item") {
        if (!c.itemDisabled) c.onUseItem?.();
      } else if (!c.recoveryDisabled && c.onRecover) {
        reset();
        c.onRecover();
      }
    },
    [reset],
  );
  const {
    disabled,
    preferences: { sensitivity, deadzone },
  } = options;
  useEffect(() => {
    // Initial state is already neutral. Reconfiguration releases in cleanup;
    // synchronise the external sender here without an extra local render.
    callbacks.current.onChange({ ...kartNeutral });
    const updateKeys = () =>
      publish("keyboard", {
        steer:
          Number(keys.current.has("arrowright") || keys.current.has("d")) -
          Number(keys.current.has("arrowleft") || keys.current.has("a")),
        gas: keys.current.has("arrowup") || keys.current.has("w"),
        brake: keys.current.has("arrowdown") || keys.current.has("s"),
        drift: keys.current.has(" "),
      });
    const keyboard = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (
        ![
          "arrowleft",
          "arrowright",
          "arrowup",
          "arrowdown",
          "w",
          "a",
          "s",
          "d",
          " ",
          "e",
          "r",
        ].includes(key)
      )
        return;
      if (event.type === "keyup") {
        keys.current.delete(key);
        updateKeys();
        return;
      }
      if (modal()) {
        reset();
        return;
      }
      if (
        disabled ||
        !focused.current ||
        document.hidden ||
        typing(event.target) ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      if (event.target instanceof Element && event.target.closest("button,a")) return;
      // A key held through pause/blur cannot re-arm itself with repeat events.
      if (event.repeat && !keys.current.has(key)) return;
      event.preventDefault();
      const fresh = !keys.current.has(key);
      keys.current.add(key);
      if (key === "e" || key === "r") {
        if (fresh && !event.repeat) action(key === "e" ? "item" : "recover");
      } else updateKeys();
    };
    const focus = (event: FocusEvent) => {
      if (modal()) reset();
      else if (typing(event.target) && !drivingInput(event.target)) {
        keys.current.clear();
        publish("keyboard", kartNeutral);
      }
    };
    const hidden = () => {
      if (document.hidden) reset();
    };
    const blurWindow = () => {
      focused.current = false;
      reset();
    };
    const focusWindow = () => {
      focused.current = true;
      armed.current = false;
    };
    let raf = 0,
      padIndex: number | null = null,
      previousItem = false,
      previousRecover = false;
    const disconnected = () => {
      armed.current = false;
      padIndex = null;
      setGamepad(false);
      publish("gamepad", kartNeutral);
    };
    const poll = () => {
      if (disabled) return;
      const frame = readKartGamepad({ sensitivity, deadzone });
      if (!frame.available) {
        disconnected();
        return;
      }
      setGamepad((was) =>
        was === (frame.index !== null) ? was : frame.index !== null,
      );
      if (frame.index !== padIndex) {
        armed.current = false;
        padIndex = frame.index;
      }
      const neutral =
        !frame.controls.steer &&
        !frame.controls.gas &&
        !frame.controls.brake &&
        !frame.controls.drift &&
        !frame.item &&
        !frame.recover;
      if (neutral) armed.current = true;
      if (
        !focused.current ||
        document.hidden ||
        modal() ||
        (typing(document.activeElement) && !drivingInput(document.activeElement))
      ) {
        if (modal() && (!same(last.current, kartNeutral) || keys.current.size)) reset();
        armed.current = false;
        publish("gamepad", kartNeutral);
      } else if (armed.current && frame.index !== null) {
        if (frame.recover && !previousRecover) action("recover");
        else {
          publish("gamepad", frame.controls);
          if (frame.item && !previousItem) action("item");
        }
      } else publish("gamepad", kartNeutral);
      previousItem = frame.item;
      previousRecover = frame.recover;
      raf = requestAnimationFrame(poll);
    };
    if (!disabled) raf = requestAnimationFrame(poll);
    window.addEventListener("keydown", keyboard);
    window.addEventListener("keyup", keyboard);
    window.addEventListener("blur", blurWindow);
    window.addEventListener("focus", focusWindow);
    window.addEventListener("gamepaddisconnected", disconnected);
    document.addEventListener("visibilitychange", hidden);
    document.addEventListener("focusin", focus);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", keyboard);
      window.removeEventListener("keyup", keyboard);
      window.removeEventListener("blur", blurWindow);
      window.removeEventListener("focus", focusWindow);
      window.removeEventListener("gamepaddisconnected", disconnected);
      document.removeEventListener("visibilitychange", hidden);
      document.removeEventListener("focusin", focus);
      reset();
    };
  }, [disabled, sensitivity, deadzone, publish, reset, action]);
  return { controls, touch, reset, gamepad, releaseToken };
}

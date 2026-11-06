import {
  useEffect,
  useCallback,
  useId,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import type { KartControls } from "@26/shared";
import { SteeringPad } from "./SteeringPad";
import { useKartControls } from "./useKartControls";
import { defaultKartControls } from "./gamepad";
import { steerFromPointer } from "./steering";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";
import "./kart.css";

/** The full-screen landscape race layout; see kart.css. */
const landscapeRace = "(orientation: landscape) and (max-height: 32rem)";
const landscape = () =>
  typeof window !== "undefined" && Boolean(window.matchMedia?.(landscapeRace).matches);

function ControlSettings({
  id,
  reduced,
  children,
}: {
  id: string;
  reduced: boolean;
  children: ReactNode;
}) {
  const present = useIsPresent();
  return (
    <motion.div
      id={id}
      inert={!present}
      aria-hidden={!present || undefined}
      className="kart-input-settings"
      initial={{ opacity: 0, y: reduced ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : 6 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

/** Pointer capture keeps multiple thumbs independent; cancellation never leaves the throttle held. */
export function TouchController({
  disabled = false,
  onChange,
  steeringDefault = "pad-strip",
  onUseItem,
  onRecover,
  itemDisabled = false,
  recoveryDisabled = false,
  extraSettings,
}: {
  disabled?: boolean;
  onChange: (value: KartControls) => void;
  /** Host default for phones held sideways; a guest's own choice still wins. */
  steeringDefault?: "pad-strip" | "slider" | "pad-absolute";
  onUseItem?: () => void;
  onRecover?: () => void;
  itemDisabled?: boolean;
  recoveryDisabled?: boolean;
  extraSettings?: ReactNode;
}) {
  // The native slider needs its small handle grabbed exactly, which is hard
  // mid-race on a phone held sideways; the thumb pad accepts a touch anywhere.
  const padByDefault = () => steeringDefault !== "slider" && landscape();
  const [pad, setPad] = useState(padByDefault);
  const chosen = useRef(false);
  useEffect(() => {
    const media = window.matchMedia?.(landscapeRace);
    if (!media) return;
    const follow = () => {
      if (!chosen.current) setPad(steeringDefault !== "slider" && media.matches);
    };
    follow();
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, [steeringDefault]);
  const [swapped, setSwapped] = useState(false);
  const pointers = useRef(new Map<number, keyof KartControls>());
  const mouse = useRef<number | null>(null);
  const thumb = useRef<number | null>(null);
  const claimThumb = useCallback((pointerId: number) => {
    if (mouse.current !== null || thumb.current !== null) return false;
    thumb.current = pointerId;
    return true;
  }, []);
  const releaseThumb = useCallback((pointerId: number) => {
    if (thumb.current === pointerId) thumb.current = null;
  }, []);
  const [settings, setSettings] = useState(false);
  const [preferences, setPreferences] = useState(() => ({ ...defaultKartControls }));
  const [mouseSteering, setMouseSteering] = useState(false);
  const id = useId(),
    reduced = usePrefersReducedMotion();
  const locked = disabled || settings;
  const input = useKartControls({
    disabled: locked,
    preferences,
    onChange,
    onUseItem,
    onRecover,
    itemDisabled,
    recoveryDisabled,
    onRelease: () => {
      pointers.current.clear();
      mouse.current = null;
      thumb.current = null;
    },
  });
  const controls = input.controls,
    emit = input.touch;
  const releaseMouse = (pointerId: number) => {
    if (mouse.current !== pointerId) return;
    mouse.current = null;
    emit({ steer: 0 });
  };
  const steerMouse = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    emit({ steer: steerFromPointer(event.clientX, box.left, box.width) });
  };
  function press(
    event: PointerEvent<HTMLButtonElement>,
    control: "gas" | "brake" | "drift",
  ) {
    if (locked) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, control);
    emit({ [control]: true });
  }
  function release(event: PointerEvent<HTMLButtonElement>) {
    const control = pointers.current.get(event.pointerId);
    if (!control) return;
    pointers.current.delete(event.pointerId);
    if (![...pointers.current.values()].includes(control)) emit({ [control]: false });
  }
  return (
    <div className="kart-controller-shell">
      <div className="kart-control-options">
        <button
          type="button"
          aria-pressed={pad}
          onClick={() => {
            input.reset();
            chosen.current = true;
            setPad(!pad);
          }}
        >
          {pad ? "Use steering slider" : "Use thumb pad"}
        </button>
        <button
          type="button"
          aria-pressed={swapped}
          onClick={() => {
            input.reset();
            setSwapped(!swapped);
          }}
        >
          Swap sides
        </button>
        <button
          type="button"
          aria-expanded={settings}
          aria-controls={`${id}-settings`}
          onClick={() => setSettings((value) => !value)}
        >
          Controls
        </button>
      </div>
      <AnimatePresence initial={false}>
        {settings ? (
          <ControlSettings id={`${id}-settings`} reduced={reduced}>
            <p>
              Controls released while this panel is open. The race clock keeps running.
            </p>
            <label htmlFor={`${id}-response`}>Steering response</label>
            <input
              id={`${id}-response`}
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={preferences.sensitivity}
              onChange={(event) =>
                setPreferences((value) => ({
                  ...value,
                  sensitivity: Number(event.target.value),
                }))
              }
            />
            <output htmlFor={`${id}-response`}>
              {preferences.sensitivity.toFixed(2)}× · lower is gentler
            </output>
            <label htmlFor={`${id}-deadzone`}>Gamepad deadzone</label>
            <input
              id={`${id}-deadzone`}
              type="range"
              min="0.05"
              max="0.4"
              step="0.01"
              value={preferences.deadzone}
              onChange={(event) =>
                setPreferences((value) => ({
                  ...value,
                  deadzone: Number(event.target.value),
                }))
              }
            />
            <output htmlFor={`${id}-deadzone`}>
              {Math.round(preferences.deadzone * 100)}%
            </output>
            <label>
              <input
                type="checkbox"
                checked={mouseSteering}
                onChange={(event) => setMouseSteering(event.target.checked)}
              />{" "}
              Enable mouse steering area
            </label>
            <p>Keyboard: arrows or WASD · Space: drift · E: item · R: back to track.</p>
            {extraSettings}
            <p>
              Gamepad: A: accelerate · B: brake · RB/RT: drift · X: item · Y: back to
              track. Release the controls after connecting or resuming.
            </p>
            <button
              type="button"
              onClick={() => {
                setPreferences({ ...defaultKartControls });
                setMouseSteering(false);
                input.reset();
              }}
            >
              Reset control settings
            </button>
            <button type="button" onClick={() => setSettings(false)}>
              Back to driving
            </button>
          </ControlSettings>
        ) : null}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {mouseSteering ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="kart-mouse-steering"
            role="group"
            aria-label="Mouse steering area"
            aria-disabled={locked}
            tabIndex={0}
            onPointerDown={(event) => {
              if (
                locked ||
                event.pointerType !== "mouse" ||
                event.button !== 0 ||
                mouse.current !== null ||
                thumb.current !== null
              )
                return;
              event.preventDefault();
              event.currentTarget.focus();
              mouse.current = event.pointerId;
              event.currentTarget.setPointerCapture(event.pointerId);
              steerMouse(event);
            }}
            onPointerMove={(event) => {
              if (mouse.current !== event.pointerId) return;
              if (locked || !(event.buttons & 1)) releaseMouse(event.pointerId);
              else steerMouse(event);
            }}
            onPointerUp={(event) => releaseMouse(event.pointerId)}
            onPointerCancel={(event) => releaseMouse(event.pointerId)}
            onLostPointerCapture={(event) => releaseMouse(event.pointerId)}
            onBlur={() => {
              if (mouse.current !== null) releaseMouse(mouse.current);
            }}
          >
            Hold the left mouse button here to steer. Use W or ↑ to accelerate.
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {input.gamepad ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="kart-gamepad-status"
            role="status"
          >
            Gamepad connected
          </motion.p>
        ) : null}
      </AnimatePresence>
      <div
        className="kart-controller"
        data-swapped={swapped}
        aria-label="Kart touch controls"
      >
        <div className="kart-steering">
          <label htmlFor="kart-steering">Steer left / right</label>
          {pad ? (
            <SteeringPad
              value={controls.steer}
              disabled={locked}
              releaseToken={input.releaseToken}
              claimPointer={claimThumb}
              releasePointer={releaseThumb}
              absolute={steeringDefault === "pad-absolute"}
              onChange={(steer) => emit({ steer })}
            />
          ) : (
            <input
              id="kart-steering"
              aria-label="Steering"
              data-kart-steering
              type="range"
              min={-1}
              max={1}
              step={0.01}
              value={controls.steer}
              disabled={locked}
              onChange={(event) => emit({ steer: Number(event.target.value) })}
              onPointerDown={(event) => {
                if (!claimThumb(event.pointerId)) event.preventDefault();
              }}
              onPointerUp={(event) => {
                if (thumb.current === null || thumb.current === event.pointerId) {
                  releaseThumb(event.pointerId);
                  emit({ steer: 0 });
                }
              }}
              onPointerCancel={(event) => {
                if (thumb.current === null || thumb.current === event.pointerId) {
                  releaseThumb(event.pointerId);
                  emit({ steer: 0 });
                }
              }}
              onBlur={() => {
                thumb.current = null;
                emit({ steer: 0 });
              }}
            />
          )}
          <span aria-hidden="true">
            ← &nbsp; {Math.round(controls.steer * 100)} &nbsp; →
          </span>
        </div>
        <div className="kart-pedals">
          {(
            [
              ["gas", "A", "Accelerate"],
              ["brake", "B", "Brake / reverse"],
              ["drift", "R", "Drift / boost"],
            ] as const
          ).map(([control, key, label]) => (
            <button
              key={control}
              type="button"
              className={`kart-pedal kart-pedal-${control}`}
              aria-label={label}
              aria-pressed={controls[control]}
              disabled={locked}
              onPointerDown={(event) => press(event, control)}
              onPointerUp={release}
              onPointerCancel={release}
              onLostPointerCapture={release}
              onKeyDown={(event) => {
                if (event.key === " " || event.key === "Enter") {
                  event.preventDefault();
                  if (!locked) emit({ [control]: true });
                }
              }}
              onKeyUp={(event) => {
                if (event.key === " " || event.key === "Enter") {
                  event.preventDefault();
                  emit({ [control]: false });
                }
              }}
              onBlur={() => emit({ [control]: false })}
            >
              <strong>{key}</strong>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

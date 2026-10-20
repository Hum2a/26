import { useEffect, useRef, useState, type PointerEvent } from "react";
import { kartNeutral, type KartControls } from "@26/shared";
import "./kart.css";

/** Pointer capture keeps multiple thumbs independent; cancellation never leaves the throttle held. */
export function TouchController({
  disabled = false,
  onChange,
}: {
  disabled?: boolean;
  onChange: (value: KartControls) => void;
}) {
  const [controls, setControls] = useState<KartControls>({ ...kartNeutral });
  const current = useRef<KartControls>({ ...kartNeutral });
  const callback = useRef(onChange);
  const pointers = useRef(new Map<number, keyof KartControls>());
  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);
  function emit(patch: Partial<KartControls>) {
    const next = { ...current.current, ...patch };
    current.current = next;
    setControls(next);
    callback.current(next);
  }
  useEffect(() => {
    const keys = new Set<string>();
    const reset = () => {
      keys.clear();
      pointers.current.clear();
      current.current = { ...kartNeutral };
      setControls({ ...kartNeutral });
      callback.current({ ...kartNeutral });
    };
    const visibility = () => {
      if (document.hidden) reset();
    };
    const keyChange = (event: KeyboardEvent) => {
      if (
        disabled ||
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(event.key)
      )
        return;
      if (
        event.target instanceof HTMLElement &&
        /BUTTON|INPUT|TEXTAREA|SELECT/.test(event.target.tagName)
      )
        return;
      event.preventDefault();
      if (event.type === "keydown") keys.add(event.key);
      else keys.delete(event.key);
      const next = {
        steer: Number(keys.has("ArrowRight")) - Number(keys.has("ArrowLeft")),
        gas: keys.has("ArrowUp"),
        brake: keys.has("ArrowDown"),
        drift: keys.has(" "),
      };
      current.current = next;
      setControls(next);
      callback.current(next);
    };
    if (disabled) reset();
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("keydown", keyChange);
    window.addEventListener("keyup", keyChange);
    return () => {
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("keydown", keyChange);
      window.removeEventListener("keyup", keyChange);
      callback.current({ ...kartNeutral });
    };
  }, [disabled]);
  function press(
    event: PointerEvent<HTMLButtonElement>,
    control: "gas" | "brake" | "drift",
  ) {
    if (disabled) return;
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
    <div className="kart-controller" aria-label="Kart touch controls">
      <div className="kart-steering">
        <label htmlFor="kart-steering">Steer left / right</label>
        <input
          id="kart-steering"
          aria-label="Steering"
          type="range"
          min={-1}
          max={1}
          step={0.01}
          value={controls.steer}
          disabled={disabled}
          onChange={(event) => emit({ steer: Number(event.target.value) })}
          onPointerUp={() => emit({ steer: 0 })}
          onPointerCancel={() => emit({ steer: 0 })}
          onBlur={() => emit({ steer: 0 })}
        />
        <span aria-hidden="true">
          ← &nbsp; {Math.round(controls.steer * 100)} &nbsp; →
        </span>
      </div>
      <div className="kart-pedals">
        {(
          [
            ["gas", "A", "Accelerate"],
            ["brake", "B", "Brake / reverse"],
            ["drift", "R", "Drift / hop"],
          ] as const
        ).map(([control, key, label]) => (
          <button
            key={control}
            type="button"
            className={`kart-pedal kart-pedal-${control}`}
            aria-label={label}
            aria-pressed={controls[control]}
            disabled={disabled}
            onPointerDown={(event) => press(event, control)}
            onPointerUp={release}
            onPointerCancel={release}
            onLostPointerCapture={release}
            onKeyDown={(event) => {
              if (event.key === " " || event.key === "Enter") {
                event.preventDefault();
                emit({ [control]: true });
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
  );
}

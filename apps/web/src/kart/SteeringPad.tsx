import { useEffect, useRef, type CSSProperties } from "react";

import { steerFromPointer, steerFromTravel } from "./steering";

/** The native slider remains the keyboard/assistive-technology interface to the pad. */
export function SteeringPad({
  value,
  disabled,
  onChange,
  absolute = false,
}: {
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
  /** Older fixed-centre steering: the touch point itself sets the lock. */
  absolute?: boolean;
}) {
  const owner = useRef<number | null>(null);
  /** Where the steering thumb landed; travel from here steers. */
  const origin = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const resetOwner = () => {
      owner.current = null;
    };
    const hidden = () => {
      if (document.hidden) resetOwner();
    };
    if (disabled) resetOwner();
    window.addEventListener("blur", resetOwner);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", resetOwner);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [disabled]);
  const release = (pointerId: number) => {
    if (owner.current !== pointerId) return;
    owner.current = null;
    onChange(0);
  };
  return (
    <div
      className="kart-thumb-pad"
      data-disabled={disabled}
      style={{ "--steer": value } as CSSProperties}
      onPointerDown={(event) => {
        if (
          disabled ||
          owner.current !== null ||
          (event.pointerType === "mouse" && event.button !== 0)
        )
          return;
        event.preventDefault();
        owner.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        input.current?.focus({ preventScroll: true });
        origin.current = event.clientX;
        const landing = event.currentTarget.getBoundingClientRect();
        onChange(
          absolute ? steerFromPointer(event.clientX, landing.left, landing.width) : 0,
        );
      }}
      onPointerMove={(event) => {
        if (disabled || owner.current !== event.pointerId) return;
        const box = event.currentTarget.getBoundingClientRect();
        onChange(
          absolute
            ? steerFromPointer(event.clientX, box.left, box.width)
            : steerFromTravel(event.clientX - origin.current, box.width),
        );
      }}
      onPointerUp={(event) => release(event.pointerId)}
      onPointerCancel={(event) => release(event.pointerId)}
      onLostPointerCapture={(event) => release(event.pointerId)}
    >
      <span className="kart-thumb-track" aria-hidden="true">
        ←<span />→
      </span>
      <span className="kart-thumb-knob" aria-hidden="true" />
      <input
        id="kart-steering"
        ref={input}
        aria-label="Steering"
        aria-valuetext={
          value === 0
            ? "Centred"
            : `${Math.round(Math.abs(value) * 100)} per cent ${value < 0 ? "left" : "right"}`
        }
        type="range"
        min={-1}
        max={1}
        step={0.01}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        onBlur={() => {
          owner.current = null;
          onChange(0);
        }}
      />
    </div>
  );
}

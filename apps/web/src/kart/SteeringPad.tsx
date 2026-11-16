import { useEffect, useRef, type CSSProperties } from "react";

import {
  pedalFromPointer,
  pedalFromTravel,
  steerFromPointer,
  steerFromTravel,
  type KartPedal,
} from "./steering";

const pedalOffset = (pedal: KartPedal) =>
  pedal === "gas" ? -1 : pedal === "brake" ? 1 : 0;

/**
 * One thumb drives: slide sideways to steer, push up to accelerate and pull
 * down to brake, which leaves the other thumb free for drift. The native
 * slider remains the keyboard/assistive-technology interface to steering;
 * the keyboard pedals are W/S or the arrow keys.
 */
export function SteeringPad({
  value,
  pedal = null,
  disabled,
  onChange,
  onPedal,
  absolute = false,
  releaseToken = 0,
  claimPointer,
  releasePointer,
}: {
  value: number;
  /** The pedal this pad is holding, so the knob shows it. */
  pedal?: KartPedal;
  disabled: boolean;
  onChange: (value: number) => void;
  /** Without this the pad only steers. */
  onPedal?: (pedal: KartPedal) => void;
  /** Older fixed-centre steering: the touch point itself sets the lock. */
  absolute?: boolean;
  releaseToken?: number;
  claimPointer?: (pointerId: number) => boolean;
  releasePointer?: (pointerId: number) => void;
}) {
  const ownerRef = useRef<number | null>(null);
  /** Where the steering thumb landed; travel from here steers and works the pedals. */
  const origin = useRef({ x: 0, y: 0 });
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const resetOwner = () => {
      const previous = ownerRef.current;
      ownerRef.current = null;
      if (previous !== null) releasePointer?.(previous);
    };
    const hidden = () => {
      if (document.hidden) resetOwner();
    };
    resetOwner();
    window.addEventListener("blur", resetOwner);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", resetOwner);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [disabled, releaseToken, releasePointer]);
  const release = (pointerId: number) => {
    if (ownerRef.current !== pointerId) return;
    ownerRef.current = null;
    releasePointer?.(pointerId);
    onChange(0);
    onPedal?.(null);
  };
  return (
    <div
      className="kart-thumb-pad"
      data-disabled={disabled}
      data-pedals={Boolean(onPedal)}
      data-pedal={pedal ?? "none"}
      style={{ "--steer": value, "--pedal": pedalOffset(pedal) } as CSSProperties}
      onPointerDown={(event) => {
        if (
          disabled ||
          ownerRef.current !== null ||
          (event.pointerType === "mouse" && event.button !== 0)
        )
          return;
        if (claimPointer && !claimPointer(event.pointerId)) return;
        event.preventDefault();
        ownerRef.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        input.current?.focus({ preventScroll: true });
        origin.current = { x: event.clientX, y: event.clientY };
        const landing = event.currentTarget.getBoundingClientRect();
        onChange(
          absolute ? steerFromPointer(event.clientX, landing.left, landing.width) : 0,
        );
        onPedal?.(
          absolute
            ? pedalFromPointer(event.clientY, landing.top, landing.height)
            : null,
        );
      }}
      onPointerMove={(event) => {
        if (disabled || ownerRef.current !== event.pointerId) return;
        const box = event.currentTarget.getBoundingClientRect();
        onChange(
          absolute
            ? steerFromPointer(event.clientX, box.left, box.width)
            : steerFromTravel(event.clientX - origin.current.x, box.width),
        );
        onPedal?.(
          absolute
            ? pedalFromPointer(event.clientY, box.top, box.height)
            : pedalFromTravel(event.clientY - origin.current.y, box.height),
        );
      }}
      onPointerUp={(event) => release(event.pointerId)}
      onPointerCancel={(event) => release(event.pointerId)}
      onLostPointerCapture={(event) => release(event.pointerId)}
    >
      <span className="kart-thumb-track" aria-hidden="true">
        ←<span />→
      </span>
      {onPedal ? (
        <span className="kart-thumb-pedals" aria-hidden="true">
          <span>↑</span>
          <span>↓</span>
        </span>
      ) : null}
      <span className="kart-thumb-knob" aria-hidden="true" />
      <input
        id="kart-steering"
        ref={input}
        aria-label="Steering"
        data-kart-steering
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
          if (ownerRef.current !== null) releasePointer?.(ownerRef.current);
          ownerRef.current = null;
          onChange(0);
          onPedal?.(null);
        }}
      />
    </div>
  );
}

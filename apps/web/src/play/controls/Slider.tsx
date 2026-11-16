import { useRef } from "react";
import { buzz } from "../../device/haptics";
import { Button } from "../../ui/primitives";
import "./slider.css";

const tickGapMs = 50;
const sliderTick = [8];

function snapSlider(
  value: number,
  minimum: number,
  maximum: number,
  step: number,
): number {
  const clamped = Math.min(maximum, Math.max(minimum, value));
  const steps = Math.round((clamped - minimum) / step);
  return minimum + steps * step;
}

export function SliderField({
  value,
  unit,
  minimum,
  maximum,
  step,
  disabled = false,
  onChange,
}: {
  value: number;
  unit: string;
  minimum: number;
  maximum: number;
  step: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const lastTick = useRef<number | null>(null);

  function commit(next: number) {
    const stepped = snapSlider(next, minimum, maximum, step);
    if (stepped === value) {
      return;
    }
    const now = Date.now();
    if (lastTick.current === null || now - lastTick.current >= tickGapMs) {
      lastTick.current = now;
      buzz(sliderTick);
    }
    onChange(stepped);
  }

  return (
    <div className="grid gap-3">
      <p className="slider-readout">
        {value} {unit}
      </p>
      <label className="grid gap-2 font-bold">
        Estimate
        <input
          className="slider-range"
          type="range"
          min={minimum}
          max={maximum}
          step={step}
          value={value}
          disabled={disabled}
          aria-valuetext={`${value} ${unit}`}
          onChange={(event) => commit(Number(event.target.value))}
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => commit(value - step)}
        >
          Lower
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => commit(value + step)}
        >
          Higher
        </Button>
      </div>
    </div>
  );
}

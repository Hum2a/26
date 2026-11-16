import { useEffect, useRef, useState } from "react";
import "./option-text.css";

function measureOptionLines(element: HTMLElement): number {
  const style = getComputedStyle(element);
  let lineHeight = Number.parseFloat(style.lineHeight);
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
    const fontSize = Number.parseFloat(style.fontSize);
    lineHeight = (Number.isFinite(fontSize) ? fontSize : 16) * 1.35;
  }
  if (lineHeight <= 0) {
    return 1;
  }
  return element.scrollHeight / lineHeight;
}

export function OptionText({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    let active = true;
    const compactNow = measureOptionLines(element) > 3;
    if (active) {
      setCompact(compactNow);
    }
    return () => {
      active = false;
    };
  }, [text]);

  return (
    <span
      ref={ref}
      className={compact ? "option-text option-text-small" : "option-text"}
    >
      {text}
    </span>
  );
}

import { useEffect, type ReactNode } from "react";
import { RotateHint } from "./RotateHint";
import "./controller.css";

export function ControllerRoot({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overscrollBehavior;
    root.style.overscrollBehavior = "none";
    return () => {
      root.style.overscrollBehavior = previous;
    };
  }, []);

  return (
    <div className="controller-root">
      {children}
      <RotateHint />
    </div>
  );
}

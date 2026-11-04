import { useEffect, type ReactNode } from "react";
import { RotateHint } from "./RotateHint";
import "./controller.css";

export function ControllerRoot({
  children,
  allowLandscape = false,
}: {
  children: ReactNode;
  allowLandscape?: boolean;
}) {
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
      <RotateHint allowLandscape={allowLandscape} />
    </div>
  );
}

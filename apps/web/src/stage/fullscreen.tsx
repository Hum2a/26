import { useEffect, useState, type ReactNode } from "react";
import { requestStageFullscreen } from "../device/fullscreen";
import { Button } from "../ui/primitives";
import "./tokens.css";

const idleMs = 2000;

function typingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest("input, textarea, select, [contenteditable='true']") !== null
  );
}

export function StageFullscreen({
  children,
  controls = true,
  onExit,
}: {
  children?: ReactNode;
  controls?: boolean;
  onExit?: () => void;
}) {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let timer = window.setTimeout(() => setIdle(true), idleMs);
    function wake() {
      setIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), idleMs);
    }
    function onKey(event: KeyboardEvent) {
      wake();
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (
        event.key === "Escape" &&
        !typingTarget(event.target) &&
        !document.querySelector("dialog[open]")
      ) {
        onExit?.();
        return;
      }
      if (event.key !== "f" && event.key !== "F") {
        return;
      }
      if (typingTarget(event.target)) {
        return;
      }
      requestStageFullscreen();
    }
    window.addEventListener("pointermove", wake);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("keydown", onKey);
    };
  }, [onExit]);

  return (
    <div className={idle ? "stage-fullscreen stage-cursor-hidden" : "stage-fullscreen"}>
      {controls ? (
        <Button type="button" onClick={() => requestStageFullscreen()}>
          Full screen
        </Button>
      ) : null}
      {children}
    </div>
  );
}

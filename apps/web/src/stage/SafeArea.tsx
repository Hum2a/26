import { useEffect, useState, type ReactNode } from "react";
import "./tokens.css";

function typingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest("input, textarea, select, [contenteditable='true']") !== null
  );
}

export function SafeArea({
  children,
  dev = import.meta.env.DEV,
}: {
  children: ReactNode;
  dev?: boolean;
}) {
  const [outline, setOutline] = useState(false);

  useEffect(() => {
    if (!dev) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (event.key !== "o" && event.key !== "O") {
        return;
      }
      if (typingTarget(event.target)) {
        return;
      }
      setOutline((current) => !current);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [dev]);

  const outlined = dev && outline;
  return (
    <div className={outlined ? "stage-safe stage-safe-outline" : "stage-safe"}>
      {children}
    </div>
  );
}

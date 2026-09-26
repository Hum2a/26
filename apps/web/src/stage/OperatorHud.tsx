import { useEffect, useState } from "react";

export function OperatorHud({
  count,
  phase,
  socket,
}: {
  count: number;
  phase: string;
  socket: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (event.key !== "d" && event.key !== "D") {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      setOpen((current) => !current);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!open) {
    return null;
  }
  return (
    <aside className="operator-hud motion-rise" role="status" aria-label="Operator">
      <p>Connected {count}</p>
      <p>Phase {phase}</p>
      <p>Socket {socket}</p>
    </aside>
  );
}

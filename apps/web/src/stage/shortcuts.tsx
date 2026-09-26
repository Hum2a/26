import { useEffect, useState } from "react";

/** Play actions the admin Advance, Pause, and Hide stage content buttons send. */
const hostCommands = {
  advance: "advance",
  pause: "pause",
  hide: "hide",
} as const;

export type HostCommand = (typeof hostCommands)[keyof typeof hostCommands];

function typingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest("input, textarea, select, [contenteditable='true']") !== null
  );
}

export function StageShortcuts({
  onCommand,
}: {
  onCommand: (command: HostCommand) => void;
}) {
  const [help, setHelp] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (typingTarget(event.target)) {
        return;
      }
      if (event.key === "?") {
        setHelp((open) => !open);
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        onCommand(hostCommands.advance);
        return;
      }
      if (event.key === "p" || event.key === "P") {
        onCommand(hostCommands.pause);
        return;
      }
      if (event.key === "h" || event.key === "H") {
        onCommand(hostCommands.hide);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [onCommand]);

  if (!help) {
    return null;
  }
  return (
    <div className="stage-shortcuts motion-rise" role="dialog" aria-label="Shortcuts">
      <p>Space advances.</p>
      <p>P pauses.</p>
      <p>H hides the stage.</p>
    </div>
  );
}

import { useEffect, useState } from "react";
import { stageShow } from "./audio";

const muteKey = "26-stage-mute";

function readMute(): boolean {
  try {
    return sessionStorage.getItem(muteKey) === "1";
  } catch {
    return false;
  }
}

function typingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest("input, textarea, select, [contenteditable='true']") !== null
  );
}

function rememberMute(muted: boolean): void {
  try {
    sessionStorage.setItem(muteKey, muted ? "1" : "0");
  } catch {
    // The mute icon still updates for this page.
  }
}

export function useStageShow() {
  const [unlocked, setUnlocked] = useState(false);
  const [muted, setMuted] = useState(readMute);

  useEffect(() => {
    stageShow.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (event.key !== "m" && event.key !== "M") {
        return;
      }
      if (typingTarget(event.target)) {
        return;
      }
      setMuted((current) => {
        const next = !current;
        rememberMute(next);
        return next;
      });
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  function startShow() {
    stageShow.unlock();
    setUnlocked(stageShow.unlocked);
  }

  function toggleMute() {
    setMuted((current) => {
      const next = !current;
      rememberMute(next);
      return next;
    });
  }

  return { unlocked, muted, startShow, toggleMute };
}

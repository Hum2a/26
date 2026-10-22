import { useEffect, useState } from "react";
import { buzz } from "../device/haptics";
import type { TrollSender } from "./classic-trolls";

/**
 * Fake phone chrome: the system pretending to do things. All are drawn by the
 * game page; none touch the real phone. Most leave the game playable.
 */

/** A recording pill and a red edge, like the phone's own screen recorder. */
export function ScreenRecording({ label }: { label: string }) {
  const seconds = useCounter(1_000, 600);
  return (
    <div className="troll-recording" role="status" aria-label={label}>
      <p className="troll-recording-pill">
        <span aria-hidden="true">●</span> Recording {formatClock(seconds)}
      </p>
    </div>
  );
}

/** The screen dims and a 1% battery warning pops up. */
export function LowBattery({
  label,
  escape,
  onEscape,
}: {
  label: string;
  escape: string | null;
  onEscape?: () => void;
}) {
  useEffect(() => {
    buzz(200);
  }, []);
  return (
    <div className="troll-dim" role="dialog" aria-label={label}>
      <div className="troll-system-alert">
        <p className="troll-system-title">Low Battery</p>
        <p>1% battery remaining. Your phone will turn off in a moment.</p>
        <div className="troll-battery" aria-hidden="true">
          <span />
        </div>
        <button type="button" onClick={() => onEscape?.()}>
          {escape ?? "Close"}
        </button>
      </div>
    </div>
  );
}

const airdropFiles = [
  "IMG_0420.jpg",
  "your_baby_photos.zip",
  "Screenshot of your search history.png",
  "humza_birthday_speech_DRAFT_47.docx",
  "definitely_not_a_virus.exe",
  "mum_voicenote_11min.m4a",
];

/** AirDrop requests that keep coming back. Decline only buys a few seconds. */
export function AirDropSpam({ label, from }: { label: string; from?: TrollSender }) {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (open) {
      buzz(60);
      return;
    }
    const timer = window.setTimeout(() => {
      setCount((value) => value + 1);
      setOpen(true);
    }, 1_800);
    return () => window.clearTimeout(timer);
  }, [open]);
  if (!open) {
    return null;
  }
  const file = airdropFiles[count % airdropFiles.length];
  return (
    <div className="troll-dim troll-dim-light" role="dialog" aria-label={label}>
      <div className="troll-system-alert">
        <p className="troll-system-title">AirDrop</p>
        <p>
          “{from?.nickname ?? "Someone"}’s iPhone” would like to share “{file}”.
        </p>
        <div className="troll-system-buttons">
          <button type="button" onClick={() => setOpen(false)}>
            Decline
          </button>
          <button type="button" onClick={() => setOpen(false)}>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

/** "Your phone needs to cool down". Covers the screen until it passes. */
export function Overheating({ label }: { label: string }) {
  const temperature = 41 + useCounter(700, 30);
  return (
    <div className="troll-cover troll-hot" role="alert" aria-label={label}>
      <p className="troll-hot-icon" aria-hidden="true">
        🌡️
      </p>
      <p className="troll-cover-title">Temperature</p>
      <p>Your phone needs to cool down before you can use it.</p>
      <p className="troll-hot-reading">{temperature}°C</p>
      <p className="troll-sponsor-small">Try answering less aggressively.</p>
    </div>
  );
}

/** "👀 12 people are watching you answer", climbing. */
export function AnswerViewers({ label }: { label: string }) {
  const watching = 3 + useCounter(900, 60) * 2;
  return (
    <p className="troll-pill troll-viewers" role="status" aria-label={label}>
      <span aria-hidden="true">👀</span> {watching} people are watching you answer
    </p>
  );
}

/** A chat bubble that is always typing and never sends. */
export function EndlessTyping({ label, from }: { label: string; from?: TrollSender }) {
  return (
    <div className="troll-typing" role="status" aria-label={label}>
      <p className="troll-typing-name">{from?.nickname ?? "Mum"} is typing</p>
      <p className="troll-typing-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </p>
    </div>
  );
}

function useCounter(stepMs: number, limit: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(
      () => setValue((current) => Math.min(limit, current + 1)),
      stepMs,
    );
    return () => window.clearInterval(timer);
  }, [stepMs, limit]);
  return value;
}

function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

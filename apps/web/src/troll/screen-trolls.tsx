import { useEffect, useRef, useState, type CSSProperties } from "react";
import "./screen-trolls.css";
import "./phone-gags.css";
import {
  CallFromMum,
  ScreenInvasion,
  ShatteredScreen,
  SponsorCard,
  type TrollSender,
} from "./classic-trolls";
import {
  AirDropSpam,
  AnswerViewers,
  EndlessTyping,
  LowBattery,
  Overheating,
  ScreenRecording,
} from "./chrome-trolls";
import { FakeLastPlace } from "./identity-trolls";
import {
  Autocorrect,
  CharacterLimit,
  HapticStorm,
  PossessedSlider,
  ReshuffledOptions,
  ReverseTyping,
  TranslatedOptions,
} from "./sabotage-trolls";

/**
 * Phone-only gags. The server owns when they start and stop; these components
 * only draw them. `onEscape` is absent while a command is pending.
 */
const screenKinds = [
  "netanyahu",
  "australia",
  "mirror",
  "jelly",
  "comic-sans",
  "lights-out",
  "bubble-wrap",
  "fake-crash",
  "forced-update",
  "captcha",
  "notification-storm",
  "confetti",
  "dvd",
  "invasion",
  "call",
  "crack",
  "sponsor",
  "screen-recording",
  "low-battery",
  "airdrop",
  "overheating",
  "answer-viewers",
  "typing-dots",
  "reshuffle",
  "translate",
  "slider-drift",
  "reverse-typing",
  "autocorrect",
  "char-limit",
  "haptic-storm",
  "fake-last",
] as const;

export type ScreenTrollKind = (typeof screenKinds)[number];

export function isScreenTroll(kind: string): kind is ScreenTrollKind {
  return screenKinds.some((item) => item === kind);
}

type Props = {
  kind: ScreenTrollKind;
  label: string;
  escape: string | null;
  onEscape?: () => void;
  /** Who sent it, when the phone knows. */
  from?: TrollSender;
  /** Seeds visuals that should stay the same across re-renders. */
  seed?: number;
  /** Other players' names, for gags that fake a leaderboard. */
  others?: string[];
};

export function ScreenTroll({
  kind,
  label,
  escape,
  onEscape,
  from,
  seed = 26,
  others = [],
}: Props) {
  switch (kind) {
    case "invasion":
      return <ScreenInvasion label={label} from={from} escape={escape} onEscape={onEscape} />;
    case "call":
      return <CallFromMum label={label} escape={escape} onEscape={onEscape} />;
    case "crack":
      return <ShatteredScreen label={label} seed={seed} escape={escape} onEscape={onEscape} />;
    case "sponsor":
      return <SponsorCard label={label} />;
    case "screen-recording":
      return <ScreenRecording label={label} />;
    case "low-battery":
      return <LowBattery label={label} escape={escape} onEscape={onEscape} />;
    case "airdrop":
      return <AirDropSpam label={label} from={from} />;
    case "overheating":
      return <Overheating label={label} />;
    case "answer-viewers":
      return <AnswerViewers label={label} />;
    case "typing-dots":
      return <EndlessTyping label={label} from={from} />;
    case "reshuffle":
      return <ReshuffledOptions label={label} />;
    case "translate":
      return <TranslatedOptions label={label} />;
    case "slider-drift":
      return <PossessedSlider label={label} />;
    case "reverse-typing":
      return <ReverseTyping label={label} />;
    case "autocorrect":
      return <Autocorrect label={label} />;
    case "char-limit":
      return <CharacterLimit label={label} />;
    case "haptic-storm":
      return <HapticStorm label={label} />;
    case "fake-last":
      return <FakeLastPlace label={label} others={others} />;
    case "netanyahu":
      return <NetanyahuFlood label={label} />;
    case "australia":
    case "mirror":
    case "jelly":
    case "comic-sans":
      return <PageWarp kind={kind} label={label} />;
    case "lights-out":
      return <LightsOut label={label} />;
    case "bubble-wrap":
      return <BubbleWrap label={label} onEscape={onEscape} />;
    case "fake-crash":
      return <FakeCrash label={label} />;
    case "forced-update":
      return <ForcedUpdate label={label} />;
    case "captcha":
      return <Captcha label={label} escape={escape} onEscape={onEscape} />;
    case "notification-storm":
      return <NotificationStorm label={label} />;
    case "confetti":
      return <Confetti label={label} />;
    case "dvd":
      return <DvdLogo label={label} escape={escape} onEscape={onEscape} />;
  }
}

/** Replace the image at `apps/web/public/assets/netanyahu.png`. */
const netanyahuAsset = "/assets/netanyahu.png";
const netanyahuCopies = Array.from({ length: 36 }, (_, index) => ({
  left: (index * 37) % 100,
  top: (index * 61) % 100,
  size: 22 + ((index * 13) % 30),
  spin: ((index * 47) % 90) - 45,
  delay: (index % 12) * 0.12,
}));

export function NetanyahuFlood({ label }: { label: string }) {
  return (
    <div className="troll-flood" role="alert" aria-label={label}>
      {netanyahuCopies.map((copy, index) => (
        <img
          key={index}
          src={netanyahuAsset}
          alt=""
          className="troll-flood-face"
          style={{
            left: `${copy.left}%`,
            top: `${copy.top}%`,
            width: `${copy.size}vmin`,
            rotate: `${copy.spin}deg`,
            animationDelay: `${copy.delay}s`,
          }}
        />
      ))}
      <p className="troll-flood-caption">{label}</p>
    </div>
  );
}

/** Bends the whole page. The phone stays playable underneath. */
function PageWarp({
  kind,
  label,
}: {
  kind: "australia" | "mirror" | "jelly" | "comic-sans";
  label: string;
}) {
  useEffect(() => {
    const root = document.documentElement;
    const name = `troll-page-${kind}`;
    root.classList.add(name);
    return () => root.classList.remove(name);
  }, [kind]);
  return (
    <p className="troll-pill" role="status">
      {label}
    </p>
  );
}

function LightsOut({ label }: { label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function move(event: PointerEvent) {
      ref.current?.style.setProperty("--torch-x", `${event.clientX}px`);
      ref.current?.style.setProperty("--torch-y", `${event.clientY}px`);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", move);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", move);
    };
  }, []);
  return (
    <div ref={ref} className="troll-torch" role="status" aria-label={label}>
      <p className="troll-torch-hint">Drag your finger to see</p>
    </div>
  );
}

const bubbleCount = 24;

function BubbleWrap({ label, onEscape }: { label: string; onEscape?: () => void }) {
  const [popped, setPopped] = useState<ReadonlySet<number>>(new Set());
  const done = popped.size >= bubbleCount;
  const sent = useRef(false);
  useEffect(() => {
    if (done && onEscape && !sent.current) {
      sent.current = true;
      onEscape();
    }
  }, [done, onEscape]);
  return (
    <div className="troll-cover troll-bubbles" role="dialog" aria-label={label}>
      <p className="troll-cover-title">
        Pop every bubble ({bubbleCount - popped.size} left)
      </p>
      <div className="troll-bubble-grid">
        {Array.from({ length: bubbleCount }, (_, index) => (
          <button
            key={index}
            type="button"
            className="troll-bubble"
            data-popped={popped.has(index) || undefined}
            aria-label={popped.has(index) ? "Popped" : "Pop bubble"}
            disabled={popped.has(index)}
            onClick={() => setPopped((current) => new Set(current).add(index))}
          />
        ))}
      </div>
    </div>
  );
}

function useTicker(stepMs: number, limit: number) {
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

function FakeCrash({ label }: { label: string }) {
  const percent = useTicker(60, 100);
  return (
    <div className="troll-cover troll-bsod" role="alert" aria-label={label}>
      <p className="troll-bsod-face">:(</p>
      <p>
        Your phone ran into a problem and needs to restart. We're just collecting
        some embarrassing info, and then we'll restart for you.
      </p>
      <p>{percent}% complete</p>
      <p className="troll-bsod-code">Stop code: SKILL_ISSUE</p>
    </div>
  );
}

function ForcedUpdate({ label }: { label: string }) {
  const tick = useTicker(80, 100);
  const percent = Math.min(99, Math.round(Math.sqrt(tick) * 10));
  return (
    <div className="troll-cover troll-update" role="alert" aria-label={label}>
      <p className="troll-update-title">Installing PhoneOS 47.0.1</p>
      <div className="troll-update-bar" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
      <p>About {2 + tick} minutes remaining…</p>
      <p className="troll-update-small">Do not turn off your phone. Or answer questions.</p>
    </div>
  );
}

const captchaSpots = [
  { left: 50, top: 55 },
  { left: 20, top: 20 },
  { left: 78, top: 82 },
  { left: 15, top: 75 },
  { left: 80, top: 25 },
];

function Captcha({
  label,
  escape,
  onEscape,
}: {
  label: string;
  escape: string | null;
  onEscape?: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const last = attempt >= captchaSpots.length - 1;
  const spot = captchaSpots[Math.min(attempt, captchaSpots.length - 1)];
  return (
    <div className="troll-cover troll-captcha" role="dialog" aria-label={label}>
      <p className="troll-cover-title">Prove you're human to keep playing</p>
      <button
        type="button"
        className="troll-captcha-box"
        style={{ left: `${spot.left}%`, top: `${spot.top}%` }}
        onClick={() => (last ? onEscape?.() : setAttempt((value) => value + 1))}
      >
        <span aria-hidden="true">{last ? "✔" : "☐"}</span> {escape ?? "I'm not a robot"}
      </button>
      {attempt > 0 && !last ? (
        <p className="troll-captcha-taunt">Suspicious. Try again.</p>
      ) : null}
    </div>
  );
}

const notifications = [
  ["Mum", "Call me. It's urgent. (It's not urgent)"],
  ["Bank", "Your card was declined at Greggs"],
  ["Screen Time", "You averaged 11 hours a day this week"],
  ["Ex", "hey"],
  ["Weather", "It is raining. It will keep raining."],
  ["Battery", "1% remaining. Good luck."],
  ["Duolingo", "You've made the owl sad"],
  ["Deliveroo", "Your rider is 1 minute away (for the next hour)"],
  ["Group chat", "47 new messages"],
  ["Calendar", "Dentist in 5 minutes"],
  ["Photos", "New memory: you, 2014, regrettable"],
  ["Uber", "Surge pricing is in effect. Everywhere. Forever."],
] as const;

function NotificationStorm({ label }: { label: string }) {
  const shown = useTicker(350, notifications.length);
  return (
    <div className="troll-notifications" role="status" aria-label={label}>
      {notifications.slice(0, shown + 1).map(([from, text], index) => (
        <div
          key={from}
          className="troll-notification"
          style={{ "--slot": index } as CSSProperties}
        >
          <strong>{from}</strong>
          <span>{text}</span>
        </div>
      ))}
    </div>
  );
}

const confettiPieces = Array.from({ length: 90 }, (_, index) => ({
  left: (index * 53) % 100,
  delay: ((index * 7) % 20) / 10,
  hue: (index * 47) % 360,
  spin: (index * 29) % 360,
}));

function Confetti({ label }: { label: string }) {
  return (
    <div className="troll-confetti" role="status" aria-label={label}>
      {confettiPieces.map((piece, index) => (
        <span
          key={index}
          style={{
            left: `${piece.left}%`,
            animationDelay: `${piece.delay}s`,
            background: `hsl(${piece.hue} 90% 60%)`,
            rotate: `${piece.spin}deg`,
          }}
        />
      ))}
      <p className="troll-confetti-title">HAPPY BIRTHDAY</p>
    </div>
  );
}

function DvdLogo({
  label,
  escape,
  onEscape,
}: {
  label: string;
  escape: string | null;
  onEscape?: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [hue, setHue] = useState(0);
  useEffect(() => {
    const logo = ref.current;
    if (!logo || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    let x = 30;
    let y = 60;
    let dx = 3.2;
    let dy = 2.6;
    let frame = 0;
    function step() {
      if (!logo) {
        return;
      }
      const maxX = window.innerWidth - logo.offsetWidth;
      const maxY = window.innerHeight - logo.offsetHeight;
      x += dx;
      y += dy;
      if (x <= 0 || x >= maxX) {
        dx = -dx;
        x = Math.max(0, Math.min(maxX, x));
        setHue((value) => (value + 67) % 360);
      }
      if (y <= 0 || y >= maxY) {
        dy = -dy;
        y = Math.max(0, Math.min(maxY, y));
        setHue((value) => (value + 67) % 360);
      }
      logo.style.translate = `${x}px ${y}px`;
      frame = window.requestAnimationFrame(step);
    }
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return (
    <div className="troll-cover troll-dvd" role="dialog" aria-label={label}>
      <p className="troll-cover-title">{escape ?? "Catch it"} to escape</p>
      <button
        ref={ref}
        type="button"
        className="troll-dvd-logo"
        style={{ color: `hsl(${hue} 90% 60%)` }}
        aria-label={escape ?? "Catch it"}
        onClick={() => onEscape?.()}
      >
        DVD
      </button>
    </div>
  );
}

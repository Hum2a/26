import { useEffect, useMemo, useState } from "react";
import { buzz } from "../device/haptics";
import { useTrollClip, type TrollSound } from "./troll-sound";

/** A 3.2 second glass smash in `apps/web/public/assets/`, played as the screen cracks. */
const glassCrackSoundAsset = "/assets/glass-crack.mp3";

/**
 * The original trolls, finished: the troller's face everywhere, a call from
 * Mum, a shattered screen and a sponsor break. Drawn on the target's phone;
 * the room decides when they start and stop.
 */
export type TrollSender = { nickname: string; faceSrc: string | null };

const invasionCopies = Array.from({ length: 28 }, (_, index) => ({
  left: (index * 41) % 100,
  top: (index * 67) % 100,
  size: 20 + ((index * 17) % 28),
  spin: ((index * 53) % 70) - 35,
  delay: (index % 10) * 0.1,
}));

/** The troller's driver face, or their name, all over the screen. */
export function ScreenInvasion({
  label,
  from,
  escape,
  onEscape,
}: {
  label: string;
  from?: TrollSender;
  escape: string | null;
  onEscape?: () => void;
}) {
  const nickname = from?.nickname ?? "Someone";
  return (
    <div className="troll-flood" role="dialog" aria-label={`${label}: ${nickname}`}>
      {invasionCopies.map((copy, index) =>
        from?.faceSrc ? (
          <img
            key={index}
            src={from.faceSrc}
            alt=""
            className="troll-flood-face troll-invasion-face"
            style={{
              left: `${copy.left}%`,
              top: `${copy.top}%`,
              width: `${copy.size}vmin`,
              rotate: `${copy.spin}deg`,
              animationDelay: `${copy.delay}s`,
            }}
          />
        ) : (
          <span
            key={index}
            aria-hidden="true"
            className="troll-flood-face troll-invasion-name"
            style={{
              left: `${copy.left}%`,
              top: `${copy.top}%`,
              fontSize: `${copy.size / 4}vmin`,
              rotate: `${copy.spin}deg`,
              animationDelay: `${copy.delay}s`,
            }}
          >
            {nickname}
          </span>
        ),
      )}
      <p className="troll-flood-caption">{nickname} was here</p>
      {escape ? (
        <button
          type="button"
          className="troll-cover-button"
          onClick={() => onEscape?.()}
        >
          {escape}
        </button>
      ) : null}
    </div>
  );
}

const callLines = [
  "Hello? Hello? Can you hear me?",
  "Are you eating properly?",
  "Your auntie says hello. And asks when you're getting married.",
  "Anyway, I'll let you go. Call me back.",
];

/** A full incoming-call screen. Decline ends it; Answer plays a short call. */
export function CallFromMum({
  label,
  escape,
  onEscape,
}: {
  label: string;
  escape: string | null;
  onEscape?: () => void;
}) {
  const [answered, setAnswered] = useState(false);
  const [line, setLine] = useState(0);
  useEffect(() => {
    if (answered) {
      return;
    }
    buzz([400, 200, 400]);
    const ring = window.setInterval(() => buzz([400, 200, 400]), 2_000);
    return () => window.clearInterval(ring);
  }, [answered]);
  useEffect(() => {
    if (!answered) {
      return;
    }
    if (line >= callLines.length) {
      onEscape?.();
      return;
    }
    const timer = window.setTimeout(() => setLine((value) => value + 1), 1_400);
    return () => window.clearTimeout(timer);
  }, [answered, line, onEscape]);
  return (
    <div className="troll-cover troll-call" role="dialog" aria-label={label}>
      <div className="troll-call-avatar" aria-hidden="true">
        M
      </div>
      <p className="troll-call-name">Mum</p>
      <p className="troll-call-meta">
        {answered ? "00:0" + Math.min(9, line * 2) : "mobile · calling…"}
      </p>
      {answered ? (
        <div className="troll-call-transcript" aria-live="polite">
          {callLines.slice(0, line + 1).map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
      ) : (
        <div className="troll-call-buttons">
          <button
            type="button"
            className="troll-call-decline"
            aria-label={escape ?? "Decline"}
            onClick={() => onEscape?.()}
          >
            <span aria-hidden="true">✕</span>
            {escape ?? "Decline"}
          </button>
          <button
            type="button"
            className="troll-call-accept"
            aria-label="Answer"
            onClick={() => setAnswered(true)}
          >
            <span aria-hidden="true">✆</span>
            Answer
          </button>
        </div>
      )}
    </div>
  );
}

type Crack = { d: string; width: number };

/** Jagged lines out from an impact point, plus a few rings. Seeded, so stable. */
function crackPaths(seed: number): Crack[] {
  let state = seed;
  const random = () => {
    state = (state * 1_103_515_245 + 12_345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
  const x = 30 + random() * 40;
  const y = 25 + random() * 35;
  const cracks: Crack[] = [];
  const arms = 9 + Math.floor(random() * 5);
  for (let arm = 0; arm < arms; arm += 1) {
    let angle = (arm / arms) * Math.PI * 2 + random() * 0.4;
    let px = x;
    let py = y;
    let d = `M ${x} ${y}`;
    const steps = 5 + Math.floor(random() * 6);
    for (let step = 0; step < steps; step += 1) {
      angle += (random() - 0.5) * 0.6;
      const length = 4 + random() * 12;
      px += Math.cos(angle) * length;
      py += Math.sin(angle) * length;
      d += ` L ${px.toFixed(1)} ${py.toFixed(1)}`;
    }
    cracks.push({ d, width: 0.35 + random() * 0.35 });
  }
  for (let ring = 1; ring <= 3; ring += 1) {
    const radius = ring * (3 + random() * 2);
    let d = "";
    const points = 10;
    for (let point = 0; point <= points; point += 1) {
      const angle = (point / points) * Math.PI * 2;
      const wobble = radius * (0.85 + random() * 0.3);
      d += `${point === 0 ? "M" : "L"} ${(x + Math.cos(angle) * wobble).toFixed(1)} ${(y + Math.sin(angle) * wobble).toFixed(1)} `;
    }
    cracks.push({ d, width: 0.25 });
  }
  return cracks;
}

/** A shattered screen. Taps still go through to the game underneath. */
export function ShatteredScreen({
  label,
  seed,
  escape,
  onEscape,
  sound,
}: {
  label: string;
  seed: number;
  escape: string | null;
  onEscape?: () => void;
  sound?: TrollSound;
}) {
  const cracks = useMemo(() => crackPaths(seed), [seed]);
  useTrollClip(glassCrackSoundAsset, sound);
  useEffect(() => {
    buzz(80);
  }, []);
  return (
    <div className="troll-crack-layer" role="status" aria-label={label}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {cracks.map((crack, index) => (
          <path key={index} d={crack.d} strokeWidth={crack.width} />
        ))}
      </svg>
      {escape ? (
        <button
          type="button"
          className="troll-cover-button"
          onClick={() => onEscape?.()}
        >
          {escape}
        </button>
      ) : null}
    </div>
  );
}

/** The target's own phone during their sponsor break. */
export function SponsorCard({ label }: { label: string }) {
  return (
    <div className="troll-cover troll-sponsor" role="status" aria-label={label}>
      <p className="troll-sponsor-ad">Ad</p>
      <p className="troll-cover-title">You are now sponsoring this round.</p>
      <p>Your name is on the big screen. Thank you for your generous contribution.</p>
      <p className="troll-sponsor-small">No refunds. Sponsorship is non-negotiable.</p>
    </div>
  );
}

/** A stable number from an effect id, for seeded visuals. */
export function seedFrom(id: string): number {
  let hash = 0;
  for (const character of id) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash || 26;
}

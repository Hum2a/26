import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon } from "@iconify/react/dist/offline";
import { muteHaptics } from "../device/haptics";
import { Button } from "../ui/primitives";
import type { TrollSender } from "./classic-trolls";
import { isScreenTroll } from "./screen-troll-kind";
import { ScreenTroll } from "./screen-troll-views";
import { targetLine, trollGroupOf, trollMeta, trollWhere } from "./troll-meta";
import { TrollPageScope } from "./troll-page-scope";
import { TrollSoundContext, type TrollSound } from "./troll-sound";
import "./troll-preview.css";

/** How long one preview runs before it offers a replay. */
export const trollPreviewMs = 5_000;

/** A preview never makes a sound: only the victim's phone plays the troll. */
const silent: TrollSound = {
  playUrl: async () => false,
  layerUrl: async () => "skipped",
  stop: () => {},
};

/**
 * Sabotage gags act on the real answer controls and text fields of the page they
 * run on, so in a preview they would scramble the troller's own troll tab. The
 * preview describes them on the stand-in instead of running them.
 */
const actsOnRealControls = new Set([
  "reshuffle",
  "translate",
  "slider-drift",
  "reverse-typing",
  "autocorrect",
  "char-limit",
]);

const yieldLine =
  "The send button moves for at most three seconds. The answers stay in place.";

/**
 * What the victim will see, drawn by the real troll components on a small
 * stand-in phone. It is silent, does not buzz, and bends only the stand-in
 * page, so the troller's own phone stays usable. Nothing is sent to the room.
 */
export function TrollPreview({
  kind,
  label,
  victim,
  sender,
  others = [],
}: {
  kind: string;
  label: string;
  /** The chosen victim's name, or undefined before one is picked. */
  victim?: string;
  sender?: TrollSender;
  others?: string[];
}) {
  const reduce = useReducedMotion();
  const page = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(0);
  const [playing, setPlaying] = useState(true);
  const group = trollGroupOf(kind);
  const meta = trollMeta[kind as keyof typeof trollMeta];
  const names = useMemo(() => others.slice(0, 6), [others]);

  // A layout effect runs before the gag's own effects, so its first buzz is muted too.
  useLayoutEffect(() => muteHaptics(), []);
  useEffect(() => {
    const timer = window.setTimeout(() => setPlaying(false), trollPreviewMs);
    return () => window.clearTimeout(timer);
  }, [run]);

  return (
    <section
      className="troll-preview glass"
      data-hue={group.hue}
      aria-label={`Preview: what ${victim ?? "your victim"} sees`}
    >
      <div className="troll-preview-frame" aria-hidden="true" inert>
        <TrollSoundContext.Provider value={silent}>
          <TrollPageScope.Provider value={page}>
            <div className="troll-preview-screen">
              <div className="troll-preview-page" ref={page}>
                <p className="troll-preview-kicker">Question 3 of 24</p>
                <p className="troll-preview-prompt">
                  Which biscuit is best for dunking?
                </p>
                <ol className="troll-preview-options">
                  {["Hobnob", "Digestive", "Rich tea", "Custard cream"].map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
                <p className="troll-preview-dock">Send</p>
              </div>
              <AnimatePresence>
                {playing ? (
                  <motion.div
                    key={run}
                    className="troll-preview-effect"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduce ? 0.1 : 0.2 }}
                  >
                    {isScreenTroll(kind) && !actsOnRealControls.has(kind) ? (
                      <ScreenTroll
                        kind={kind}
                        label={label}
                        escape={null}
                        from={sender}
                        seed={run + 26}
                        others={names}
                      />
                    ) : (
                      <div className="troll-preview-banner">
                        <span className="incoming-troll-icon">
                          <Icon icon={meta?.icon ?? group.icon} />
                        </span>
                        <p className="incoming-troll-title">{label}</p>
                        <p>
                          {kind === "yield"
                            ? yieldLine
                            : (targetLine[kind] ?? meta?.blurb)}
                        </p>
                      </div>
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </TrollPageScope.Provider>
        </TrollSoundContext.Provider>
      </div>
      <div className="troll-preview-copy">
        <p className="troll-preview-eyebrow">
          Preview · what {victim ?? "they"} will see
        </p>
        <p className="troll-preview-title">{label}</p>
        <p>{meta?.blurb}</p>
        <p className="troll-preview-where">{trollWhere(kind)}</p>
        <Button
          type="button"
          variant="secondary"
          className="troll-preview-replay"
          onClick={() => {
            setPlaying(true);
            setRun((value) => value + 1);
          }}
        >
          {playing ? "Playing…" : "Replay preview"}
        </Button>
      </div>
    </section>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimate } from "motion/react";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";
import { createScreenAudio } from "../device/audio";
import { buzz } from "../device/haptics";
import {
  createContactFeedbackCursor,
  type KartContactSample,
} from "./contact-feedback";

/** Presentation consumes accepted contacts; it cannot change driving or send commands. */
export function useKartContactFeedback(sample: KartContactSample) {
  const [audio] = useState(createScreenAudio);
  const [cursor] = useState(createContactFeedbackCursor);
  const [visual, setVisual] = useState(true);
  const [sound, setSound] = useState(false);
  const [vibration, setVibration] = useState(false);
  const [soundNotice, setSoundNotice] = useState("");
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reduced = usePrefersReducedMotion();
  const pulse = useRef<{ stop(): void } | null>(null);
  const vibrating = useRef(false);
  const focused = useRef(true);
  const stop = useCallback(() => {
    audio.stop();
    if (vibrating.current) {
      buzz(0);
      vibrating.current = false;
    }
    if (pulse.current) {
      pulse.current.stop();
      pulse.current = null;
      if (scope.current?.isConnected)
        animate(scope.current, { opacity: 0 }, { duration: 0.1, ease: "easeOut" });
    }
  }, [audio, animate, scope]);
  useEffect(() => {
    focused.current = document.hasFocus();
    const release = () => {
      focused.current = false;
      cursor.reset();
      stop();
    };
    const focus = () => {
      focused.current = true;
      cursor.reset();
    };
    const visibility = () => {
      if (document.hidden) release();
      else {
        cursor.reset();
        stop();
        focused.current = document.hasFocus();
      }
    };
    window.addEventListener("blur", release);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", release);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visibility);
      stop();
      cursor.reset();
      audio.dispose();
    };
  }, [audio, cursor, stop]);
  useEffect(() => {
    if (!sample.active || document.hidden || !focused.current) {
      cursor.reset();
      stop();
      return;
    }
    if (!cursor.read(sample)) return;
    if (visual && scope.current) {
      pulse.current?.stop();
      pulse.current = animate(
        scope.current,
        { opacity: [0, reduced ? 0.2 : 0.3, 0] },
        { duration: reduced ? 0.12 : 0.24, ease: "easeOut" },
      );
    }
    if (sound) audio.play({ frequency: 160, durationMs: 75, volume: 0.04 });
    if (vibration) {
      buzz(20);
      vibrating.current = true;
    }
  }, [
    sample.raceId,
    sample.elapsedMs,
    sample.active,
    sample.contact,
    sample,
    visual,
    sound,
    vibration,
    reduced,
    audio,
    cursor,
    animate,
    scope,
    stop,
  ]);
  return {
    reset: () => {
      stop();
      cursor.reset();
      audio.setMuted(true);
      setVisual(true);
      setSound(false);
      setVibration(false);
      setSoundNotice("");
    },
    overlay: <div ref={scope} className="kart-contact-cue" aria-hidden="true" />,
    settings: (
      <fieldset className="kart-contact-settings">
        <legend>Contact feedback</legend>
        <label>
          <input
            type="checkbox"
            checked={visual}
            onChange={(event) => {
              setVisual(event.target.checked);
              stop();
            }}
          />{" "}
          Show a gentle contact edge
        </label>
        <label>
          <input
            type="checkbox"
            checked={sound}
            onChange={(event) => {
              const enabled = event.target.checked;
              const ready = !enabled || audio.unlock();
              setSound(enabled && ready);
              audio.setMuted(!enabled || !ready);
              setSoundNotice(
                ready
                  ? ""
                  : "Sound is unavailable in this browser. You can keep driving.",
              );
            }}
          />{" "}
          Sound on contact
        </label>
        <label>
          <input
            type="checkbox"
            checked={vibration}
            onChange={(event) => {
              setVibration(event.target.checked);
              stop();
            }}
          />{" "}
          Vibrate on contact (if supported)
        </label>
        <AnimatePresence initial={false}>
          {soundNotice ? (
            <motion.p
              role="status"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
            >
              {soundNotice}
            </motion.p>
          ) : null}
        </AnimatePresence>
        <p>Sound and vibration start off. Changes stay on this screen.</p>
      </fieldset>
    ),
  };
}

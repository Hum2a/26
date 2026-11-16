import { AnimatePresence, motion } from "motion/react";
import type { KartRaceView } from "@26/shared";
import { ordinal, raceLaps } from "./race-callouts";
import type { RaceBanner } from "./useRaceFeedback";

type Driver = KartRaceView["participants"][number];

/**
 * The racing numbers a guest glances at: place, lap and slipstream, with a
 * short banner for a new lap, the final lap or a place gained. Text carries
 * every meaning; colour and motion only add to it.
 */
export function KartRaceHud({
  race,
  self,
  place,
  banner,
  reduced,
}: {
  race: KartRaceView;
  self: Driver;
  place: number | undefined;
  banner?: RaceBanner;
  reduced: boolean;
}) {
  const laps = raceLaps(race);
  const lap = Math.min(laps, self.lap ?? 1);
  const count = race.participantCount ?? race.participants.length;
  const ease = reduced
    ? { duration: 0.12, ease: "easeOut" as const }
    : { type: "spring" as const, stiffness: 420, damping: 28 };
  return (
    <div className="kart-race-hud" aria-label="Race position">
      <p
        className="kart-race-place"
        aria-label={`Place ${place ?? "unknown"} of ${count}`}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.strong
            key={place ?? "none"}
            initial={{ opacity: 0, y: reduced ? 0 : 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : -14 }}
            transition={ease}
          >
            {place ? ordinal(place) : "—"}
          </motion.strong>
        </AnimatePresence>
        <span aria-hidden="true">/{count}</span>
      </p>
      {laps > 1 ? (
        <p className="kart-race-lap" data-final={lap === laps || undefined}>
          Lap {lap}/{laps}
        </p>
      ) : null}
      <AnimatePresence initial={false}>
        {self.slipstream ? (
          <motion.p
            key="slipstream"
            className="kart-race-slip"
            data-phase={self.slipstream}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {self.slipstream === "active" ? "Slipstream!" : "Drafting…"}
          </motion.p>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {banner ? (
          <motion.p
            key={banner.id}
            className="kart-race-banner"
            data-tone={banner.tone}
            role="status"
            initial={{ opacity: 0, scale: reduced ? 1 : 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: reduced ? 1 : 1.06 }}
            transition={ease}
          >
            {banner.text}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

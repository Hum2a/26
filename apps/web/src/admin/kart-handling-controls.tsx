import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router";
import { kartHandlingNames, kartHandlingSchema } from "@26/shared";
import { Button } from "../ui/primitives";
import { useAdminRoom } from "./room-provider";
import { CommandFeedback } from "./command-feedback";

/** Separate from live presentation settings: gameplay freezes before the race. */
export function KartHandlingControls() {
  const { snapshot, execute, busy, connection } = useAdminRoom();
  const current = snapshot.kartHandling ?? {
    next: "slide-v1" as const,
    current: undefined,
    frozen: snapshot.phase === "collect",
  };
  const locked =
    busy ||
    connection !== "open" ||
    (current.frozen && ["intro", "prompt", "collect"].includes(snapshot.phase));
  return (
    <section className="admin-task-section" aria-label="Kart contact handling">
      <h2>Contact handling</h2>
      <p>
        Original slide keeps the established handling. Arcade bounce adds a mild rebound
        and a brief stun, with a cooldown to avoid repeated lock-outs.
      </p>
      <AnimatePresence initial={false}>
        <motion.p
          key={`next:${current.next}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
        >
          Next race: {kartHandlingNames[current.next]}.
        </motion.p>
        {current.current ? (
          <motion.p
            key={`current:${current.current}:${current.frozen}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
          >
            {current.frozen ? "Frozen race" : "Starting grid"}:{" "}
            {kartHandlingNames[current.current]}.
          </motion.p>
        ) : null}
      </AnimatePresence>
      <p>
        Choose before racing. The profile stays frozen during a race, including pauses.
        Changes after a race apply to the next one.
      </p>
      <div className="flex flex-wrap gap-3">
        {kartHandlingSchema.options.map((preset) => (
          <Button
            key={preset}
            variant={current.next === preset ? "primary" : "secondary"}
            aria-pressed={current.next === preset}
            disabled={locked}
            onClick={() =>
              current.next === preset
                ? undefined
                : void execute(
                    { action: "kart-handling", handlingPreset: preset },
                    "Choose kart contact handling",
                    "kart-handling",
                  )
            }
          >
            {preset === "slide-v1"
              ? "Use original slide handling"
              : "Use arcade bounce handling"}
          </Button>
        ))}
      </div>
      <CommandFeedback scope="kart-handling" />
      <Link to="/admin/kart?view=collisions">
        Rehearse both handling profiles without guests
      </Link>
      <ol aria-label="Kart handling history">
        <AnimatePresence initial={false}>
          {[...(snapshot.kartHandlingHistory ?? [])].reverse().map((entry, index) => (
            <motion.li
              key={`${entry.atMs}:${entry.preset}:${index}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
            >
              Host selected {kartHandlingNames[entry.preset]} at{" "}
              {new Date(entry.atMs).toLocaleTimeString("en-GB")}
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </section>
  );
}

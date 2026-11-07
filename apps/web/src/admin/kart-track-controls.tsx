import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { kartTrackCatalogue, type KartTrackId } from "@26/shared";
import { Button } from "../ui/primitives";
import { useAdminRoom } from "./room-provider";
import { CommandFeedback } from "./command-feedback";

export function KartTrackControls() {
  const { snapshot, execute, busy, connection } = useAdminRoom();
  const saved = snapshot.kartLobby?.trackId ?? "mario-circuit-v1";
  if (!snapshot.kartLobby) return null;
  const track = kartTrackCatalogue.tracks.find((t) => t.id === saved)!;
  const frozen = snapshot.phase !== "lobby";
  return (
    <section className="admin-task-section" aria-label="Kart course selection">
      <h2>Race course</h2>
      <p>
        Saved course: {track.name} · one lap · {track.raceLimitMs / 1000} seconds.
      </p>
      <p>
        {frozen
          ? "This race's course is frozen. Create a fresh kart lobby for another race."
          : "Choose before starting. The course and starting grid freeze when you start the race."}
      </p>
      <form
        key={saved}
        onSubmit={(event) => {
          event.preventDefault();
          const selected = new FormData(event.currentTarget).get(
            "kartTrack",
          ) as KartTrackId;
          void execute(
            { action: "kart-track", kartTrack: selected },
            "Save course",
            "kart-track",
          );
        }}
      >
        <label>
          Course for this race{" "}
          <select
            name="kartTrack"
            defaultValue={saved}
            disabled={frozen || busy || connection !== "open"}
          >
            {kartTrackCatalogue.tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.raceLimitMs / 1000}s
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" disabled={frozen || busy || connection !== "open"}>
          Save course
        </Button>
      </form>
      <CommandFeedback scope="kart-track" />
      <Link to="/admin/kart?view=tracks">Rehearse courses without guests</Link>
      <ol aria-label="Course selection history">
        <AnimatePresence initial={false}>
          {(snapshot.kartLobby.history ?? []).map((entry, i) => (
            <motion.li
              key={`${entry.atMs}-${i}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
            >
              Host chose{" "}
              {kartTrackCatalogue.tracks.find((t) => t.id === entry.trackId)!.name} ·{" "}
              {new Date(entry.atMs).toLocaleTimeString("en-GB")}
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </section>
  );
}

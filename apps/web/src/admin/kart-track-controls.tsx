import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { kartTrackCatalogue, type KartLaps, type KartTrackId } from "@26/shared";
import { Button } from "../ui/primitives";
import { useAdminRoom } from "./room-provider";
import { CommandFeedback } from "./command-feedback";

const lapWords = (laps: number) => (laps === 1 ? "one lap" : `${laps} laps`);
const cpuWords = (cpu: number) =>
  cpu === 0 ? "no CPU racers" : cpu === 1 ? "1 CPU racer" : `${cpu} CPU racers`;
/** "45 seconds", "3 minutes", "9 minutes". */
const windowWords = (ms: number) =>
  ms < 120_000 ? `${ms / 1000} seconds` : `${Math.round(ms / 60_000)} minutes`;

export function KartTrackControls() {
  const { snapshot, execute, busy, connection } = useAdminRoom();
  const saved = snapshot.kartLobby?.trackId ?? "mario-circuit-v1";
  const savedLaps = snapshot.kartLobby?.laps ?? 1;
  const savedCpu = snapshot.kartLobby?.cpu ?? 0;
  if (!snapshot.kartLobby) return null;
  const track = kartTrackCatalogue.tracks.find((t) => t.id === saved)!;
  const frozen = snapshot.phase !== "lobby";
  const locked = frozen || busy || connection !== "open";
  return (
    <section className="admin-task-section" aria-label="Kart course selection">
      <h2>Race course</h2>
      <p>
        Saved course: {track.name} · {lapWords(savedLaps)} ·{" "}
        {windowWords(track.raceLimitMs * savedLaps)} · {cpuWords(savedCpu)}.
      </p>
      <p>
        {frozen
          ? "This race's course is frozen. Create a fresh kart lobby for another race."
          : "Choose before starting. The course, laps, CPU racers and starting grid freeze when you start the race. More laps give a longer race window. CPU racers start behind the guests, take places on the track and never score."}
      </p>
      <form
        key={`${saved}-${savedLaps}-${savedCpu}`}
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const selected = form.get("kartTrack") as KartTrackId;
          const laps = Number(form.get("kartLaps")) as KartLaps;
          const cpu = Number(form.get("kartCpu"));
          void execute(
            { action: "kart-track", kartTrack: selected, kartLaps: laps, kartCpu: cpu },
            "Save course",
            "kart-track",
          );
        }}
      >
        <label>
          Course for this race{" "}
          <select name="kartTrack" defaultValue={saved} disabled={locked}>
            {kartTrackCatalogue.tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.raceLimitMs / 1000}s a lap
              </option>
            ))}
          </select>
        </label>
        <label>
          Laps{" "}
          <select name="kartLaps" defaultValue={String(savedLaps)} disabled={locked}>
            <option value="1">1 lap</option>
            <option value="2">2 laps</option>
            <option value="3">3 laps</option>
          </select>
        </label>
        <label>
          CPU racers{" "}
          <select name="kartCpu" defaultValue={String(savedCpu)} disabled={locked}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? "None" : n}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" disabled={locked}>
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
              {lapWords(entry.laps ?? 1)}
              {entry.cpu ? ` · ${cpuWords(entry.cpu)}` : ""} ·{" "}
              {new Date(entry.atMs).toLocaleTimeString("en-GB")}
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </section>
  );
}

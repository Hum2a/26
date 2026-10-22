import { Link } from "react-router";
import { Button } from "../ui/primitives";
import { useAdminRoom } from "./room-provider";
import { CommandFeedback } from "./command-feedback";

export function KartCourseControls() {
  const { snapshot, execute, busy, connection } = useAdminRoom();
  const race = snapshot.play?.kart;
  if (!race) return null;
  return (
    <section aria-label="Kart course controls">
      <h2>Kart course</h2>
      <p>
        {race.courseEnabled
          ? "Floor boosts, ramps and moving sweepers are on."
          : "Clear circuit — course features are off."}
      </p>
      <p>
        {race.participants.filter((d) => (d.height ?? 0) > 0).length} airborne ·{" "}
        {race.participants.filter((d) => d.boostRemainingMs > 0).length} boosting
      </p>
      <Button
        variant="secondary"
        disabled={
          busy ||
          connection !== "open" ||
          race.ended ||
          !["intro", "collect"].includes(snapshot.phase)
        }
        onClick={() =>
          void execute(
            { action: race.courseEnabled ? "kart-course-off" : "kart-course-on" },
            "Update kart course",
            "kart",
          )
        }
      >
        {race.courseEnabled
          ? "Switch course features off"
          : "Switch course features on"}
      </Button>
      <CommandFeedback scope="kart" />
      <h3>Course history</h3>
      {snapshot.kartCourseHistory?.length ? (
        <ol>
          {snapshot.kartCourseHistory.map((item, i) => (
            <li key={`${item.atMs}:${i}`}>
              Host switched features {item.enabled ? "on" : "off"} ·{" "}
              {new Date(item.atMs).toLocaleTimeString("en-GB")}
            </li>
          ))}
        </ol>
      ) : (
        <p>No course changes yet.</p>
      )}
      <Link to="/admin/kart">Rehearse boosts, ramps and gliding without guests →</Link>
    </section>
  );
}

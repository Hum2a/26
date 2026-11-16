import { Link } from "react-router";
import { Button } from "../ui/primitives";
import { useAdminRoom } from "./room-provider";
import { CommandFeedback } from "./command-feedback";
import { kartLookNameSchema } from "@26/shared";
import { KartCollisionOverlay } from "./kart-collision-overlay";
import { KartRecapPanel } from "../kart/KartRecapPanel";
import { KartItemControls } from "./kart-item-controls";

export function KartCourseControls() {
  const { snapshot, execute, busy, connection } = useAdminRoom();
  const race = snapshot.play?.kart;
  if (!race) return <KartItemControls />;
  return (
    <section aria-label="Kart course controls">
      <KartItemControls />
      <h2>Kart course</h2>
      <KartRecapPanel
        recap={snapshot.kartRecap}
        names={Object.fromEntries(
          snapshot.players.map((player) => [player.playerId, player.nickname]),
        )}
      />
      <p>
        Pause freezes accepted sector timing. Advance ends an active race early;
        unfinished drivers receive DNF, with the host-ended reason retained. Use the
        existing Live controls above.
      </p>
      <Link to="/admin/kart?view=recap">Rehearse race results without guests</Link>
      <KartCollisionOverlay
        trackId={race.trackId}
        history={snapshot.kartContactHistory}
        names={Object.fromEntries(
          snapshot.players.map((player) => [player.playerId, player.nickname]),
        )}
      />
      <Link to="/admin/kart?view=collisions">Rehearse collisions without guests</Link>
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
      <h3>Stage view</h3>
      <p>
        Current view: {race.spectator?.mode ?? "map"}. Follow tracks the leading active
        racer; director rotates among the leading three using accepted race time.
      </p>
      {(["map", "overview", "follow", "director"] as const).map((mode) => (
        <Button
          key={mode}
          variant="secondary"
          disabled={
            busy ||
            connection !== "open" ||
            !["intro", "prompt", "collect", "reveal", "scores"].includes(snapshot.phase)
          }
          onClick={() =>
            void execute(
              { action: `kart-stage-${mode}` },
              "Change kart stage view",
              "kart",
            )
          }
        >
          {mode === "map"
            ? "Return stage to map"
            : mode === "overview"
              ? "3D stage overview"
              : mode === "follow"
                ? "Follow race leader"
                : "Start stage director"}
        </Button>
      ))}
      {snapshot.kartStageHistory?.length ? (
        <ol aria-label="Stage view history">
          {snapshot.kartStageHistory.map((entry, i) => (
            <li key={i}>
              {entry.mode} · {new Date(entry.atMs).toLocaleTimeString("en-GB")}
            </li>
          ))}
        </ol>
      ) : (
        <p>No stage view changes yet.</p>
      )}
      <h3>Kart effects</h3>
      <p>
        {race.effectsEnabled === undefined
          ? "Legacy effects: new effects have not been enabled for this race."
          : race.effectsEnabled
            ? "New drift, exhaust, terrain and celebration effects are on."
            : "Kart decoration is off."}
      </p>
      {[true, false].map((enabled) => (
        <Button
          key={String(enabled)}
          variant="secondary"
          disabled={
            busy ||
            connection !== "open" ||
            (enabled && race.ended) ||
            !(
              enabled
                ? ["intro", "collect"]
                : ["intro", "prompt", "collect", "reveal", "scores"]
            ).includes(snapshot.phase)
          }
          onClick={() =>
            void execute(
              { action: enabled ? "kart-effects-on" : "kart-effects-off" },
              "Update kart effects",
              "kart",
            )
          }
        >
          {enabled ? "Switch new kart effects on" : "Switch kart decoration off"}
        </Button>
      ))}
      {snapshot.kartEffectsHistory?.length ? (
        <ol aria-label="Kart effects history">
          {[...snapshot.kartEffectsHistory].reverse().map((entry, index) => (
            <li key={`${entry.atMs}:${index}`}>
              Host switched decoration {entry.enabled ? "on" : "off"} at{" "}
              {new Date(entry.atMs).toLocaleTimeString("en-GB")}
            </li>
          ))}
        </ol>
      ) : null}
      <Link to="/admin/kart?view=effects">
        Rehearse and tune effects with stand-ins
      </Link>
      <h3>Kart look</h3>
      <p>
        Current look: {race.look ?? "original"}. These change the 3D scene only. Phones
        keep their own graphics and reduced-motion preferences; Low skips optional
        optical effects.
      </p>
      <div role="group" aria-label="Kart look presets">
        {kartLookNameSchema.options.map((preset) => (
          <Button
            key={preset}
            variant={race.look === preset ? "primary" : "secondary"}
            aria-pressed={race.look === preset}
            disabled={
              busy ||
              connection !== "open" ||
              (preset !== "off" && race.ended) ||
              !(
                preset === "off"
                  ? ["intro", "prompt", "collect", "reveal", "scores"]
                  : ["intro", "collect"]
              ).includes(snapshot.phase)
            }
            onClick={() =>
              void execute(
                { action: "kart-look", lookPreset: preset },
                "Change kart look",
                "kart",
              )
            }
          >
            {preset === "off" ? "Use original kart look" : `Use ${preset} kart look`}
          </Button>
        ))}
      </div>
      {snapshot.kartLookHistory?.length ? (
        <ol aria-label="Kart look history">
          {[...snapshot.kartLookHistory].reverse().map((entry, index) => (
            <li key={`${entry.atMs}:${index}`}>
              Host chose {entry.preset} at{" "}
              {new Date(entry.atMs).toLocaleTimeString("en-GB")}
            </li>
          ))}
        </ol>
      ) : (
        <p>No look changes yet.</p>
      )}
      <Link to="/admin/kart?view=look">
        Rehearse and tune the kart look with stand-ins
      </Link>
      <h3>Nearby racers</h3>
      <p>
        {race.opponentsEnabled
          ? "Phones can see nearby ghost karts; they do not collide."
          : "Nearby ghost karts are off."}
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
            {
              action: race.opponentsEnabled
                ? "kart-opponents-off"
                : "kart-opponents-on",
            },
            "Update nearby racers",
            "kart",
          )
        }
      >
        {race.opponentsEnabled ? "Hide nearby racers" : "Show nearby racers"}
      </Button>
      <h3>Opponent display history</h3>
      {snapshot.kartOpponentHistory?.length ? (
        <ol>
          {snapshot.kartOpponentHistory.map((item, i) => (
            <li key={`${item.atMs}:${i}`}>
              Host switched nearby racers {item.enabled ? "on" : "off"} ·{" "}
              {new Date(item.atMs).toLocaleTimeString("en-GB")}
            </li>
          ))}
        </ol>
      ) : (
        <p>No opponent display changes yet.</p>
      )}
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

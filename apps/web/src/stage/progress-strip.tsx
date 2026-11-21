import type { LobbySnapshot } from "@26/shared";
import { talkingPoints } from "../live/talking-points";
import { usePhaseCountdown } from "../live/use-phase-countdown";

/** Compact round progress for the projector. Names stay off this strip. */
export function ProgressStrip({
  snapshot,
  observedAt,
}: {
  snapshot: LobbySnapshot;
  observedAt: number;
}) {
  const points = talkingPoints(snapshot);
  const clock = usePhaseCountdown(snapshot, observedAt);
  if (!points.roundLine && snapshot.phase === "lobby") {
    return null;
  }
  return (
    <p className="projector-progress" aria-label="Game progress">
      {points.roundLine ? <span>{points.roundLine}</span> : null}
      <span>{points.phaseLine}</span>
      {clock ? <span>{clock.value}</span> : null}
      {points.answeredLine ? <span>{points.answeredLine}</span> : null}
      {points.nextLine ? <span>{points.nextLine}</span> : null}
      {snapshot.phase === "scores" && points.top.length ? (
        <span>
          Lead: {points.top.map((row) => `${row.nickname} ${row.points}`).join(" · ")}
        </span>
      ) : null}
      {snapshot.phase === "scores" && points.closest ? (
        <span>
          Closest: {points.closest.ahead} by {points.closest.gap}
        </span>
      ) : null}
    </p>
  );
}

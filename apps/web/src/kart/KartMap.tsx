import { motion, useReducedMotion } from "motion/react";
import type { KartRaceView } from "@26/shared";

/** SVG broadcast map: every public pose, only the leading three numbered to avoid 50 overlapping labels. */
export function KartMap({
  race,
  personal = false,
}: {
  race: KartRaceView;
  personal?: boolean;
}) {
  const reduced = useReducedMotion();
  const drivers = personal
    ? race.participants.filter((driver) => driver.playerId === race.selfPlayerId)
    : race.participants;
  const leaders = new Map(
    race.leaderboard.slice(0, 3).map((row, i) => [row.playerId, i]),
  );
  return (
    <svg
      className="kart-broadcast-map"
      viewBox="-65 -65 130 130"
      role="img"
      aria-label={
        personal
          ? "Your live track position"
          : `Live race map: ${drivers.length} drivers`
      }
    >
      <circle r="59" className="kart-map-orbit" />
      <circle r="53" className="kart-map-kerb" />
      <circle r="42" className="kart-map-road" />
      <circle r="42" className="kart-map-centreline" />
      <circle r="31" className="kart-map-kerb" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = ((i + 1) * Math.PI) / 4;
        return (
          <g key={i}>
            <path
              d={`M${Math.cos(a) * 34} ${Math.sin(a) * 34}L${Math.cos(a) * 50} ${Math.sin(a) * 50}`}
              className="kart-map-checkpoint"
            />
            <text
              x={Math.cos(a) * 57}
              y={Math.sin(a) * 57 + 1}
              className="kart-map-sector"
            >
              {i === 7 ? "START" : i + 1}
            </text>
          </g>
        );
      })}
      <path d="M34 0H50" className="kart-map-finish" />
      <text y="-2" className="kart-map-wordmark">
        26
      </text>
      <text y="6" className="kart-map-caption">
        GRAND PRIX
      </text>
      <text y="13" className="kart-map-caption">
        CLOCKWISE ↻
      </text>
      {drivers.map((driver) => (
        <motion.g
          key={driver.playerId}
          data-map-player={driver.playerId}
          initial={false}
          animate={{ x: driver.x, y: driver.z }}
          transition={{ duration: reduced ? 0 : 0.18, ease: "linear" }}
        >
          <title>{`#${driver.number} ${driver.name} · ${driver.status === "FINISHED" ? "Finished" : driver.status === "DNF" ? "DNF" : `${Math.round(driver.progress * 100)}%`}`}</title>
          <circle
            r={personal ? 2.8 : 1.5}
            className="kart-map-dot"
            data-finished={driver.status === "FINISHED"}
          />
          {personal || leaders.has(driver.playerId) ? (
            <>
              <circle r="3.5" className="kart-map-leader-ring" />
              <text
                y={-5 - (leaders.get(driver.playerId) ?? 0) * 5}
                className="kart-map-number"
              >
                {driver.number}
              </text>
            </>
          ) : null}
        </motion.g>
      ))}
    </svg>
  );
}

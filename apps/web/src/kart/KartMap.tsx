import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { KartRaceView } from "@26/shared";
import { driverFaceUrl } from "./driver-face";
import { useKartDrivers } from "./drivers-context";

/** A leader's face inside their marker ring. Drivers without a photo keep the plain dot. */
function MapFace({
  playerId,
  face,
  gameId,
}: {
  playerId: string;
  face: string | undefined;
  gameId: string;
}) {
  const clip = `${useId()}-face`;
  if (!face || !gameId) return null;
  return (
    <>
      <clipPath id={clip}>
        <circle r="3.1" />
      </clipPath>
      <image
        href={driverFaceUrl(gameId, face)}
        x={-3.1}
        y={-3.1}
        width={6.2}
        height={6.2}
        clipPath={`url(#${clip})`}
        preserveAspectRatio="xMidYMid slice"
        data-map-face={playerId}
      />
    </>
  );
}

/** SVG broadcast map: every public pose, only the leading three numbered to avoid 50 overlapping labels. */
export function KartMap({
  race,
  personal = false,
}: {
  race: KartRaceView;
  personal?: boolean;
}) {
  const reduced = useReducedMotion();
  const faces = useKartDrivers();
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
      {race.powers?.boxes
        .filter((b) => b.available)
        .map((b) => (
          <g key={b.id} aria-label="Item box">
            <rect
              x={b.x - 1.3}
              y={b.z - 1.3}
              width={2.6}
              height={2.6}
              fill="var(--accent)"
            />
            <text
              x={b.x}
              y={b.z + 0.8}
              textAnchor="middle"
              fontSize="2.4"
              fill="var(--accent-foreground)"
            >
              ?
            </text>
          </g>
        ))}
      {race.powers?.oils.map((o) => (
        <circle
          key={o.id}
          cx={o.x}
          cy={o.z}
          r={1.6}
          fill="var(--background)"
          stroke="var(--highlight)"
          strokeWidth={0.25}
          aria-label="Oil slick"
        />
      ))}
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
          {race.powers?.effects.some(
            (e) => e.playerId === driver.playerId && e.shieldMs > 0,
          ) ? (
            <circle
              r={personal ? 4.5 : 2.8}
              fill="none"
              stroke="var(--highlight)"
              strokeWidth={0.7}
              aria-label="Shield active"
            />
          ) : null}
          <circle
            r={personal ? 2.8 : 1.5}
            className="kart-map-dot"
            data-finished={driver.status === "FINISHED"}
          />
          {personal || leaders.has(driver.playerId) ? (
            <>
              <circle r="3.5" className="kart-map-leader-ring" />
              <MapFace
                playerId={driver.playerId}
                face={faces.byPlayer.get(driver.playerId)?.faceMediaId}
                gameId={faces.gameId}
              />
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

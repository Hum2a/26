import { motion } from "motion/react";
import type { KartRecap } from "@26/shared";
import { trialTime } from "./trial-time";
import "./recap.css";

export function KartRecapPanel({
  recap,
  names = {},
  selfPlayerId,
  stage = false,
}: {
  recap: KartRecap | undefined;
  names?: Readonly<Record<string, string>>;
  selfPlayerId?: string;
  stage?: boolean;
}) {
  if (!recap)
    return (
      <p className="kart-recap-unavailable">
        Sector history was not recorded for this older race.
      </p>
    );
  const sorted = [...recap.drivers].sort((a, b) =>
    a.status === "FINISHED" && b.status !== "FINISHED"
      ? -1
      : b.status === "FINISHED" && a.status !== "FINISHED"
        ? 1
        : (a.lapTimeMs ?? Infinity) - (b.lapTimeMs ?? Infinity) ||
          b.checkpoint - a.checkpoint ||
          a.number - b.number,
  );
  const rows = selfPlayerId
    ? sorted.filter((row) => row.playerId === selfPlayerId)
    : stage
      ? sorted.slice(0, 3)
      : sorted;
  const reason =
    recap.reason === "host-ended"
      ? "The host ended the race"
      : recap.reason === "time-limit"
        ? "Race time limit reached"
        : recap.reason === "all-finished"
          ? "Every driver finished"
          : recap.reason === "racing"
            ? "Accepted sector history — race in progress"
            : "Race ended";
  return (
    <motion.section
      className="kart-recap"
      data-stage={stage}
      aria-label="Race recap"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      <h3>{recap.reason === "racing" ? "Sector history" : "Race recap"}</h3>
      <p>
        {reason} · {recap.drivers.filter((row) => row.status === "FINISHED").length}{" "}
        finished · {recap.drivers.filter((row) => row.status === "DNF").length} DNF
      </p>
      {!stage ? (
        <p>History updated at {trialTime(recap.updatedAtMs)} of active race time.</p>
      ) : null}
      <ol aria-label="Accepted race results">
        {rows.map((row) => (
          <li key={row.playerId}>
            <strong>{names[row.playerId] ?? `Kart ${row.number}`}</strong>
            <span>
              {row.status === "FINISHED"
                ? row.lapTimeMs === null
                  ? "Finished — time unavailable"
                  : `Finished · ${trialTime(row.lapTimeMs)}`
                : row.status === "DNF"
                  ? recap.reason === "host-ended"
                    ? "DNF — host ended race"
                    : recap.reason === "time-limit"
                      ? "DNF — time limit"
                      : "DNF — race ended"
                  : `Sector ${Math.min(8, row.checkpoint + 1)} / 8`}
            </span>
            <span>
              {row.checkpoint} / 8 sectors complete · Back to track {row.recoveries}{" "}
              {row.recoveries === 1 ? "time" : "times"}
            </span>
            {!stage ? (
              <ol
                className="kart-sector-splits"
                aria-label={`${names[row.playerId] ?? `Kart ${row.number}`} sector splits`}
              >
                {row.sectorsMs.map((time, index) => (
                  <li key={index}>
                    Sector {index + 1}:{" "}
                    {time === null ? "not recorded" : trialTime(time)}
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        ))}
      </ol>
      {stage && sorted.length > 3 ? (
        <p>Sector splits are on phones; full history is in Live controls.</p>
      ) : null}
    </motion.section>
  );
}

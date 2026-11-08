import type { KartRaceView } from "@26/shared";
import { DriverBadge } from "./DriverBadge";
import { useKartDrivers } from "./drivers-context";
import { Scoreboard } from "../ui/scoreboard";

/** Browsing is local; places, times and points remain server-authoritative. */
export function KartLeaderboard({
  race,
  paused,
}: {
  race: KartRaceView;
  paused: boolean;
}) {
  const drivers = useKartDrivers();
  return (
    <aside className="kart-race-board" aria-label="Race leaderboard">
      <Scoreboard
        key={race.raceId}
        compact
        label="Race leaders"
        title={race.ended ? "The finish line" : "Race order"}
        subtitle={`${paused ? "Race paused · " : ""}${race.leaderboard.filter((row) => row.finished).length} finished · ${race.ended ? "Equal times share a place" : "Live from the circuit"}`}
        entries={race.leaderboard.map((entry) => {
          const driver = race.participants.find(
            (item) => item.playerId === entry.playerId,
          );
          return {
            id: entry.playerId,
            name: entry.name,
            place: entry.place,
            points: race.ended ? entry.points : undefined,
            detail: entry.finished
              ? `${(entry.timeMs! / 1000).toFixed(2)}s`
              : race.ended
                ? "DNF"
                : driver?.lap && (race.laps ?? 1) > 1
                  ? `Lap ${driver.lap}/${race.laps}`
                  : `${Math.round((driver?.progress ?? 0) * 100)}%`,
            meta: `Kart ${driver?.number ?? "—"}`,
            badge: (
              <DriverBadge
                gameId={drivers.gameId}
                driver={drivers.byPlayer.get(entry.playerId)}
                nickname={entry.name}
                size="1.8em"
              />
            ),
          };
        })}
      />
    </aside>
  );
}

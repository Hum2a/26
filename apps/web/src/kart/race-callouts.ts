import type { KartRaceView } from "@26/shared";

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th, 21st. */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

export const raceLaps = (race: Pick<KartRaceView, "laps"> | undefined) =>
  race?.laps ?? 1;

type Driver = KartRaceView["participants"][number];
const lapOf = (driver: Driver | undefined) => driver?.lap ?? 1;
const leaderOf = (race: KartRaceView) =>
  race.leaderboard.find((row) => row.place === 1)?.playerId;
const placeOf = (race: KartRaceView, playerId: string) =>
  race.leaderboard.find((row) => row.playerId === playerId)?.place;

export type StageCallout = {
  /** Stable, so the same moment never shows twice. */
  id: string;
  text: string;
  tone: "lead" | "lap" | "final" | "finish" | "win" | "launch";
};

/** Lead changes settle after the first scramble off the grid. */
const settleMs = 3000;

/**
 * What the projector announces between two consecutive public frames: a lead
 * change, the leader starting a new or final lap, and finishers. Pure, from
 * public race data only, and at most three a frame.
 */
export function stageCallouts(
  previous: KartRaceView | undefined,
  next: KartRaceView,
): StageCallout[] {
  if (!previous || previous.raceId !== next.raceId) return [];
  const callouts: StageCallout[] = [];
  const laps = raceLaps(next);
  const before = new Map(previous.participants.map((d) => [d.playerId, d]));
  const finishers = next.participants
    .filter(
      (d) => d.status === "FINISHED" && before.get(d.playerId)?.status === "RACING",
    )
    .map((d) => ({ driver: d, place: placeOf(next, d.playerId) ?? 0 }))
    .sort((a, b) => a.place - b.place);
  for (const { driver, place } of finishers)
    callouts.push(
      place === 1
        ? { id: `win-${next.raceId}`, text: `${driver.name} wins!`, tone: "win" }
        : {
            id: `finish-${next.raceId}-${driver.playerId}`,
            text: `${driver.name} finishes ${ordinal(place)}`,
            tone: "finish",
          },
    );
  // The first perfect start of the race gets one call.
  const rocket = next.participants.find(
    (d) => d.launch === "perfect" && before.get(d.playerId)?.launch !== "perfect",
  );
  if (rocket)
    callouts.push({
      id: `launch-${next.raceId}`,
      text: `${rocket.name} rockets off the line!`,
      tone: "launch",
    });
  const leaderId = leaderOf(next),
    previousLeader = leaderOf(previous);
  const leader = next.participants.find((d) => d.playerId === leaderId);
  if (
    leader &&
    leader.status === "RACING" &&
    previousLeader &&
    previousLeader !== leaderId &&
    next.elapsedMs >= settleMs &&
    next.participants.length > 1
  )
    callouts.push({
      id: `lead-${next.raceId}-${leaderId}-${next.elapsedMs}`,
      text: `${leader.name} takes the lead`,
      tone: "lead",
    });
  if (laps > 1 && leader?.status === "RACING") {
    const was = lapOf(before.get(leader.playerId)),
      now = lapOf(leader);
    if (now > was && now <= laps)
      callouts.push(
        now === laps
          ? { id: `final-${next.raceId}`, text: "Final lap!", tone: "final" }
          : {
              id: `lap-${next.raceId}-${now}`,
              text: `Lap ${now} of ${laps}`,
              tone: "lap",
            },
      );
  }
  return callouts.slice(0, 3);
}

export type SelfCue =
  | { kind: "launch"; grade: "perfect" | "good" }
  | { kind: "place"; place: number; gained: boolean }
  | { kind: "lap"; lap: number; laps: number }
  | { kind: "final-lap" }
  | { kind: "finish"; place: number | undefined };

/** This phone's own race moments between two frames. */
export function selfCues(
  previous: KartRaceView | undefined,
  next: KartRaceView,
): SelfCue[] {
  if (!previous || previous.raceId !== next.raceId || !next.selfPlayerId) return [];
  const id = next.selfPlayerId;
  const was = previous.participants.find((d) => d.playerId === id),
    now = next.participants.find((d) => d.playerId === id);
  if (!was || !now) return [];
  if (was.status === "RACING" && now.status === "FINISHED")
    return [{ kind: "finish", place: placeOf(next, id) }];
  if (now.status !== "RACING") return [];
  const cues: SelfCue[] = [];
  if (now.launch && !was.launch) cues.push({ kind: "launch", grade: now.launch });
  const laps = raceLaps(next);
  if (lapOf(now) > lapOf(was))
    cues.push(
      lapOf(now) === laps
        ? { kind: "final-lap" }
        : { kind: "lap", lap: lapOf(now), laps },
    );
  const placeWas = placeOf(previous, id),
    placeNow = placeOf(next, id);
  if (
    placeWas !== undefined &&
    placeNow !== undefined &&
    placeNow !== placeWas &&
    next.elapsedMs >= settleMs
  )
    cues.push({ kind: "place", place: placeNow, gained: placeNow < placeWas });
  return cues;
}

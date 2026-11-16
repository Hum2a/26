import type { LobbySnapshot } from "@26/shared";

const racePhases: ReadonlySet<string> = new Set(["intro", "prompt", "collect"]);

/**
 * One race is one scene from the grid to the chequered flag. Keeping it mounted
 * stops a phase change rebuilding the 3D view and closing the controls at GO.
 */
export function kartRaceScene(snapshot: LobbySnapshot | undefined): string | undefined {
  const play = snapshot?.play;
  if (!snapshot || play?.question.kind !== "kart" || !play.kart) return undefined;
  return racePhases.has(snapshot.phase) ? `kart:${play.kart.raceId}` : undefined;
}

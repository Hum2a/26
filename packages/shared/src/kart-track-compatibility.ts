import type { LobbySnapshot } from "./index.ts";
export const kartTrackCapabilityHeader = "x-26-kart-tracks";
export const kartTrackRefreshMessage =
  "The kart courses have updated. Refresh this tab to join the race.";
/** Old track readers cannot parse a new course or the new control-only selection. */
export function needsKartTrackUpdate(view: LobbySnapshot) {
  return (
    view.play?.kart?.trackId === "26-park-v1" ||
    (view.play?.question.kind === "kart" &&
      view.play.question.trackId === "26-park-v1") ||
    view.kartLobby?.trackId !== undefined
  );
}

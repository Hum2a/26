export type PresenceEvent = "PLAYER_JOINED" | "PLAYER_LEFT";

/** Joins and leaves are the player list on the snapshot. There is no extra message. */
export function connectedCount(events: readonly PresenceEvent[]): number {
  return events.reduce((count, event) => {
    if (event === "PLAYER_JOINED") {
      return count + 1;
    }
    return Math.max(0, count - 1);
  }, 0);
}

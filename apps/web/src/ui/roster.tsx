import { memo, useMemo, type ReactNode } from "react";
import type { LobbyPlayer } from "@26/shared";
import { avatarUrl, PlayerAvatar } from "./player-avatar";
import { RosterContext, useRosterEntry, type RosterEntry } from "./roster-context";

export { useRoster, useRosterEntry, type RosterEntry } from "./roster-context";

/**
 * Who is in the room, for any screen that draws a player by id: nickname and
 * profile photo. One provider per surface, rebuilt only when a name or photo
 * changes, so a clock patch does not redraw eighty faces. Every `PlayerAvatar`
 * inside it shows the player's photo without being passed one.
 */
export function rosterKey(players: readonly LobbyPlayer[]): string {
  return players
    .map((player) => `${player.playerId}:${player.nickname}:${player.avatarMediaId ?? ""}`)
    .join("|");
}

export function buildRoster(
  gameId: string,
  players: readonly LobbyPlayer[],
): Map<string, RosterEntry> {
  return new Map(
    players.map((player) => [
      player.playerId,
      {
        playerId: player.playerId,
        nickname: player.nickname,
        faceSrc: player.avatarMediaId ? avatarUrl(gameId, player.avatarMediaId) : null,
      },
    ]),
  );
}

export function RosterProvider({
  gameId,
  players,
  revision,
  children,
}: {
  gameId: string;
  players: readonly LobbyPlayer[];
  /** The photo display revision; a change refreshes photo URLs. */
  revision?: number;
  children: ReactNode;
}) {
  const key = rosterKey(players);
  // `players` gets a new identity on every full snapshot; the key does not.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const roster = useMemo(() => buildRoster(gameId, players), [gameId, key, revision]);
  return <RosterContext.Provider value={roster}>{children}</RosterContext.Provider>;
}

/**
 * A player's face by id, from the roster. A player who has left keeps a
 * neutral badge so a bubble never shows a stale name.
 */
export const RosterAvatar = memo(function RosterAvatar({
  playerId,
  size = "md",
}: {
  playerId: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}) {
  const entry = useRosterEntry(playerId);
  return <PlayerAvatar playerId={playerId} nickname={entry?.nickname ?? "?"} size={size} />;
});

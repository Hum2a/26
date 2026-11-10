import { createContext, useContext } from "react";
import type { LobbyPlayer } from "@26/shared";
import { withClientApiKey } from "../api/client-key";

/** One player as any screen draws them: nickname and profile photo URL. */
export type RosterEntry = {
  playerId: string;
  nickname: string;
  faceSrc: string | null;
};

export type Roster = ReadonlyMap<string, RosterEntry>;

/** Empty outside a provider, so a component still renders initials. */
export const RosterContext = createContext<Roster>(new Map());

export function useRoster(): Roster {
  return useContext(RosterContext);
}

export function useRosterEntry(playerId: string): RosterEntry | undefined {
  return useContext(RosterContext).get(playerId);
}

/** URL of a guest's profile photo. Same authenticated route as other room media. */
export function avatarUrl(gameId: string, mediaId: string): string {
  return withClientApiKey(`/api/rooms/${gameId}/media/${mediaId}`);
}

/** Changes only when a name or photo changes, so a clock patch keeps the roster. */
export function rosterKey(players: readonly LobbyPlayer[]): string {
  return players
    .map(
      (player) => `${player.playerId}:${player.nickname}:${player.avatarMediaId ?? ""}`,
    )
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

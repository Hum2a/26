import { createContext, useContext } from "react";

/** One player as any screen draws them: nickname and profile photo URL. */
export type RosterEntry = { playerId: string; nickname: string; faceSrc: string | null };

export type Roster = ReadonlyMap<string, RosterEntry>;

/** Empty outside a provider, so a component still renders initials. */
export const RosterContext = createContext<Roster>(new Map());

export function useRoster(): Roster {
  return useContext(RosterContext);
}

export function useRosterEntry(playerId: string): RosterEntry | undefined {
  return useContext(RosterContext).get(playerId);
}

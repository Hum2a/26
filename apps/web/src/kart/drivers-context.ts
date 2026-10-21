import { createContext, useContext } from "react";
import type { LobbyDriver } from "@26/shared";

export type KartDrivers = {
  gameId: string;
  byPlayer: ReadonlyMap<string, LobbyDriver>;
};

export const KartDriversContext = createContext<KartDrivers>({
  gameId: "",
  byPlayer: new Map(),
});

export function useKartDrivers(): KartDrivers {
  return useContext(KartDriversContext);
}

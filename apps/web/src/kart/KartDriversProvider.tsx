import { useMemo, type ReactNode } from "react";
import type { LobbySnapshot } from "@26/shared";
import { KartDriversContext, type KartDrivers } from "./drivers-context";

/** Makes each player's chosen driver available to the kart views below it. */
export function KartDriversProvider({
  snapshot,
  children,
}: {
  snapshot: Pick<LobbySnapshot, "gameId" | "players">;
  children: ReactNode;
}) {
  const key = snapshot.players
    .map(
      (player) =>
        `${player.playerId}:${player.driver?.style}:${player.driver?.faceMediaId}`,
    )
    .join("|");
  const value = useMemo<KartDrivers>(
    () => ({
      gameId: snapshot.gameId,
      byPlayer: new Map(
        snapshot.players.flatMap((player) =>
          player.driver ? [[player.playerId, player.driver] as const] : [],
        ),
      ),
    }),
    // The players array is rebuilt on every snapshot; only real driver changes matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshot.gameId, key],
  );
  return <KartDriversContext value={value}>{children}</KartDriversContext>;
}

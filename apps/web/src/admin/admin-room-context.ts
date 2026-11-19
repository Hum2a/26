import { createContext, useContext, type Dispatch, type SetStateAction } from "react";
import type { LobbySnapshot } from "@26/shared";
import type { PlayIntent } from "../live/room-api";

export type AdminCommand =
  Omit<PlayIntent, "gameId" | "requestId"> | { action: "transfer"; playerId: string };
export type CommandScope =
  | "live"
  | "players"
  | "room"
  | "media"
  | "voters"
  | "analytics"
  | "results"
  | "health"
  | "trolls"
  | "wall"
  | "kart"
  | "kart-handling"
  | "kart-items"
  | "kart-track"
  | "developer";
export type RoomContextValue = {
  snapshot: LobbySnapshot;
  connection: "connecting" | "open" | "closed";
  blocked: boolean;
  notice: string;
  setNotice: Dispatch<SetStateAction<string>>;
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
  observedAt: number;
  command: {
    status: "idle" | "pending" | "success" | "error";
    message: string;
    scope: CommandScope;
    retryable: boolean;
  };
  execute: (
    command: AdminCommand,
    label: string,
    scope?: CommandScope,
  ) => Promise<void>;
  retry: () => Promise<void>;
  transfer: {
    code: string;
    playerId: string;
    kind: "transfer" | "recovery";
    expiresAt?: string;
  } | null;
  clearTransfer: () => void;
};
export const RoomContext = createContext<RoomContextValue | null>(null);
export function useAdminRoom() {
  const room = useContext(RoomContext);
  if (!room) throw new Error("Room controls require the shared room provider.");
  return room;
}

import { kartLobbySchema } from "@26/shared";
import { freezeBirthdayOrder } from "../questions/birthday-order.ts";
import { readRoundState } from "../questions/round-state.ts";

/** Freeze just the existing race; never edit the saved birthday order. */
export async function freezeKartLobby() {
  const script = await freezeBirthdayOrder({
    revision: 0,
    ids: ["kart-sprint"],
    updatedAt: null,
    history: [],
  });
  return { ...script, version: `kart-${script.version}` };
}

export function readKartLobby(sql: SqlStorage) {
  const stored = readRoundState<unknown>(sql, "__room", "kart-lobby");
  return stored === undefined ? undefined : kartLobbySchema.parse(stored);
}

export function assertKartLobbyAction(sql: SqlStorage, action: string) {
  if (
    readKartLobby(sql) &&
    [
      "start-demo",
      "start-birthday",
      "start-kart-rehearsal",
      "start-fixture",
      "developer-configure",
    ].includes(action)
  )
    throw new Error("This is a kart-only lobby. Use Start kart race.");
}

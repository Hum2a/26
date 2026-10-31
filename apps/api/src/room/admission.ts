import type { LobbySnapshot } from "@26/shared";
import { readRoundState, writeRoundState } from "../questions/round-state.ts";

type Admission = NonNullable<LobbySnapshot["admission"]>;

export function readAdmission(sql: SqlStorage): Admission {
  return (
    readRoundState<Admission>(sql, "__room", "admission") ?? {
      open: true,
      history: [],
    }
  );
}

export function changeAdmission(sql: SqlStorage, open: boolean, now: number): void {
  if (typeof open !== "boolean" || !Number.isFinite(now) || now < 0)
    throw new Error("Choose whether new players can join.");
  const current = readAdmission(sql);
  if (current.open === open) return;
  writeRoundState(sql, "__room", "admission", {
    open,
    history: [...current.history, { open, at: now }].slice(-20),
  } satisfies Admission);
  sql.exec("UPDATE room SET state_version = state_version + 1");
}

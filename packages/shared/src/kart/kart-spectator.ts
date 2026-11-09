import { z } from "zod";

export const kartStageModeSchema = z.enum(["map", "overview", "follow", "director"]);
export type KartStageMode = z.infer<typeof kartStageModeSchema>;
export const kartSpectatorSchema = z
  .object({
    mode: kartStageModeSchema,
    revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
    followPlayerId: z.string().min(1).max(120).optional(),
  })
  .strict();

/** Camera selection uses accepted active time and frozen public roster, never browser clocks. */
export function kartSpectatorView(
  mode: KartStageMode,
  drivers: readonly {
    playerId: string;
    number: number;
    progress: number;
    status: "RACING" | "FINISHED" | "DNF";
  }[],
  elapsedMs: number,
) {
  if (mode === "map" || mode === "overview") return { mode };
  const active = drivers
    .filter((driver) => driver.status === "RACING")
    .sort((a, b) => b.progress - a.progress || a.number - b.number);
  const shortlist = (
    active.length ? active : [...drivers].sort((a, b) => a.number - b.number)
  ).slice(0, 3);
  const slot =
    mode === "director" && Number.isFinite(elapsedMs)
      ? Math.floor(Math.max(0, elapsedMs) / 8000) % Math.max(1, shortlist.length)
      : 0;
  const target = shortlist[slot];
  return target
    ? { mode, followPlayerId: target.playerId }
    : { mode: "overview" as const };
}

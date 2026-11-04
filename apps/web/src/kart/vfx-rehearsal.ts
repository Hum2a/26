import {
  kartFinishPresentation,
  kartRaceSchema,
  type KartDriver,
  type KartRaceView,
} from "@26/shared";

export const vfxScripts = [
  "start",
  "drift",
  "boost",
  "dirt",
  "flight",
  "impact",
  "finish",
] as const;
export type VfxScript = (typeof vfxScripts)[number];

/** Isolated admin visual script. Never simulates a room, controls, collision or score. */
export function vfxRehearsalRace(
  source: KartRaceView,
  script: VfxScript,
  activeMs: number,
  run: number,
): KartRaceView {
  const elapsed = Math.max(
    0,
    Math.min(10_000, Number.isFinite(activeMs) ? activeMs : 0),
  );
  const seconds = Math.min(elapsed, 6000) / 1000;
  const done = elapsed >= (script === "finish" ? 3000 : 6000);
  const sampleElapsed = Math.min(elapsed, script === "finish" ? 3000 : 6000);
  const pose = (driver: KartDriver, index: number): KartDriver => {
    const x =
      script === "dirt"
        ? -20
        : ((index % 3) - 1) * 4 +
          (script === "drift" ? Math.sin(seconds * 1.4) * 2 : 0);
    const z = -20 - seconds * 8 + Math.floor(index / 3) * 3;
    const heading =
      -Math.PI / 2 + (script === "drift" ? Math.sin(seconds * 1.4) * 0.18 : 0);
    const drifting = !done && script === "drift";
    return {
      ...driver,
      x,
      z,
      heading,
      speed: done ? 0 : 8,
      turnRate: drifting ? 0.5 : 0,
      height:
        script === "flight"
          ? Math.max(0, Math.sin((Math.PI * Math.min(seconds, 4)) / 4) * 3)
          : 0,
      contact: script === "impact" && elapsed >= 1500 && elapsed < 1750,
      drifting,
      driftCharge: drifting ? 1 : 0,
      driftChargeMs: drifting ? 1800 : 0,
      driftLevel: drifting ? 2 : 0,
      boostRemainingMs: !done && script === "boost" ? 900 : 0,
      boostLevel: !done && script === "boost" ? 3 : 0,
      status: done ? (script === "finish" ? "FINISHED" : "DNF") : "RACING",
      lapTimeMs: done && script === "finish" ? 3000 : null,
    };
  };
  const participants = source.participants.map(pose);
  const nearby = source.nearby?.map((driver, i) =>
    pose(driver, i + participants.length),
  );
  return kartRaceSchema.parse({
    ...source,
    raceId: `vfx-script-${Math.max(0, Math.min(1_000_000, Math.floor(run) || 0))}-${script}`,
    elapsedMs: Math.floor(sampleElapsed),
    ended: done,
    participants,
    nearby,
    presentation: kartFinishPresentation({
      elapsedMs: Math.floor(sampleElapsed),
      ended: done,
      drivers: [...participants, ...(nearby ?? [])],
    }),
    leaderboard: source.leaderboard.map((row) => ({ ...row, points: 0 })),
  });
}

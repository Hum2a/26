import { driftThresholds, driftTierNames, drivingDriftLevel } from "@26/shared";
import "./drift-gauge.css";

/** Pure presentation, fed by the solo body or the server-projected charge. */
export function DriftGauge({
  chargeMs,
  boostLevel = 0,
}: {
  chargeMs: number;
  boostLevel?: number;
}) {
  const level = drivingDriftLevel(chargeMs);
  const active = Math.min(3, Math.max(0, boostLevel));
  return (
    <div className="kart-tier-gauge" data-level={active || level}>
      <output aria-label="Drift charge level">
        {active
          ? `${driftTierNames[active]} turbo active`
          : level
            ? `Drift ${level}/3 · ${driftTierNames[level]} turbo ready`
            : "Steer + hold drift to charge"}
      </output>
      <div
        className="kart-tier-segments"
        role="progressbar"
        aria-label="Drift charge"
        aria-valuemin={0}
        aria-valuemax={3}
        aria-valuenow={active || level}
        aria-valuetext={`${driftTierNames[active || level]} · ${active || level} of 3 tiers`}
      >
        {driftThresholds.map((threshold, i) => {
          const start = i ? driftThresholds[i - 1]! : 0;
          const progress = active
            ? i < active
              ? 1
              : 0
            : Math.max(0, Math.min(1, (chargeMs - start) / (threshold - start)));
          return (
            <div
              key={threshold}
              className="kart-tier-segment"
              data-ready={i < (active || level)}
            >
              <span aria-hidden="true" style={{ transform: `scaleX(${progress})` }} />
              <small>
                {i + 1} · {driftTierNames[i + 1]}
              </small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

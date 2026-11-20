import type { PracticeMode, PracticeStanding } from "@26/shared";
import { ordinal } from "./race-callouts";
import { trialTime } from "./trial-time";

export function KartPracticeStandings({
  standings,
  mode,
  slipstream,
  finished = false,
}: {
  standings: readonly PracticeStanding[];
  mode: PracticeMode;
  slipstream?: "charging" | "active";
  finished?: boolean;
}) {
  if (standings.length <= 1) return null;
  const self = standings.find((row) => row.isPlayer);
  if (!self) return null;
  const selfIndex = standings.indexOf(self);
  const ahead = selfIndex > 0 ? standings[selfIndex - 1] : undefined;
  const behind =
    selfIndex < standings.length - 1 ? standings[selfIndex + 1] : undefined;

  if (finished) {
    return (
      <section className="kart-practice-results" aria-label="Practice race standings">
        <h3>Race standings</h3>
        <ol>
          {standings.map((row) => (
            <li key={row.playerId} data-self={row.isPlayer || undefined}>
              <span>
                {ordinal(row.place)} · {row.name}
              </span>
              <span>
                {row.finished && row.timeMs !== null
                  ? trialTime(row.timeMs)
                  : `Racing · ${Math.round(row.progress * 100)}%`}
              </span>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <div className="kart-practice-hud" aria-label="Practice race position">
      <output aria-label="Race place">
        <strong>{ordinal(self.place)}</strong>
        <small>/{standings.length}</small>
      </output>
      {mode === "free" ? (
        <span className="kart-practice-lap">Lap {self.lapsDone + 1}</span>
      ) : null}
      {slipstream ? (
        <span className="kart-practice-slip" data-phase={slipstream}>
          {slipstream === "active" ? "Slipstream!" : "Drafting…"}
        </span>
      ) : null}
      {ahead || behind ? (
        <span className="kart-practice-rivals">
          {ahead ? <span>▲ {ahead.name}</span> : null}
          {behind ? <span>▼ {behind.name}</span> : null}
        </span>
      ) : null}
    </div>
  );
}

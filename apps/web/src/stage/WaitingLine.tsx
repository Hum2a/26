import { waitingSummary } from "./waiting";
import "./tokens.css";

export function WaitingLine({ count, players }: { count: number; players: number }) {
  const { waiting, percentage } = waitingSummary(count, players);
  return (
    <div className="grid gap-3">
      <p>Waiting on {waiting}</p>
      <div
        className="stage-progress"
        role="progressbar"
        aria-label="Answers in"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
      >
        <span style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

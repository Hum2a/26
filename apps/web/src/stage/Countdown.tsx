import "./tokens.css";

function finalCountdown(remainingMs: number): boolean {
  return remainingMs > 0 && remainingMs <= 5_000;
}

export function StageCountdown({
  label,
  value,
  note,
  remainingMs = null,
}: {
  label: string;
  value: string;
  note: string;
  remainingMs?: number | null;
}) {
  const pulse = remainingMs !== null && finalCountdown(remainingMs);
  return (
    <div
      className={pulse ? "stage-countdown stage-countdown-pulse" : "stage-countdown"}
      aria-label={label}
    >
      <p className="text-sm font-bold tracking-[0.18em] uppercase">{label}</p>
      <p className={pulse ? "stage-timer stage-timer-accent" : "stage-timer"}>
        {value}
      </p>
      <p className="mt-5">{note}</p>
    </div>
  );
}

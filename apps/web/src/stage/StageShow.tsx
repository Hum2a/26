import { Button } from "../ui/primitives";

export function StageShowControls({
  unlocked,
  muted,
  onStart,
  onToggleMute,
}: {
  unlocked: boolean;
  muted: boolean;
  onStart: () => void;
  onToggleMute: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {unlocked ? (
        <p>The show audio is unlocked on this screen.</p>
      ) : (
        <Button type="button" variant="secondary" onClick={onStart}>
          Start show
        </Button>
      )}
      <button
        type="button"
        className="stage-mute"
        aria-pressed={muted}
        aria-label={muted ? "Muted" : "Sound on"}
        onClick={onToggleMute}
      >
        <MuteIcon muted={muted} />
      </button>
    </div>
  );
}

function MuteIcon({ muted }: { muted: boolean }) {
  return (
    <svg className="stage-mute-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      {muted ? (
        <path
          d="M16 9l5 6M21 9l-5 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      ) : (
        <path
          d="M16 9a4 4 0 010 6M18.5 7a7 7 0 010 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}

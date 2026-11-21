import { useRef } from "react";
import { Button } from "../ui/primitives";

/** Confirm before the existing troll command. There is no separate USE_TROLL message. */
export function TrollConfirm({
  nickname,
  troll,
  onCancel,
  onConfirm,
  disabled = false,
  reason,
  announce = false,
}: {
  nickname: string;
  troll: string;
  onCancel: () => void;
  onConfirm: () => void;
  disabled?: boolean;
  reason?: string;
  /** Live region for one-shot status, not a ticking cooldown. */
  announce?: boolean;
}) {
  const sent = useRef(false);

  return (
    <div className="troll-confirm" role="dialog" aria-label="Confirm troll">
      <p className="troll-confirm-kicker">Step 3 · Confirm</p>
      <p className="troll-confirm-copy">
        Troll {nickname} with {troll}?
      </p>
      {reason ? (
        <p className="troll-confirm-reason" role={announce ? "status" : undefined}>
          {reason}
        </p>
      ) : (
        <p className="troll-confirm-reason">This cannot be undone from here.</p>
      )}
      <div className="troll-confirm-actions">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Back
        </Button>
        <Button
          type="button"
          className="troll-confirm-go"
          disabled={disabled}
          aria-disabled={disabled}
          data-cta={!disabled ? "" : undefined}
          onClick={() => {
            if (disabled || sent.current) {
              return;
            }
            sent.current = true;
            onConfirm();
          }}
        >
          Confirm
        </Button>
      </div>
    </div>
  );
}

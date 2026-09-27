import { useEffect, useRef, type Ref } from "react";
import { PhoneDock } from "../controller/phone-dock";
import { Button } from "../ui/primitives";
import type { SubmitState } from "./submit-state";
import "./submit.css";

export function SubmitButton({
  label,
  state,
  disabled = false,
  className = "",
  onClick,
  ref,
}: {
  label: string;
  state: SubmitState;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
  ref?: Ref<HTMLButtonElement>;
}) {
  const sent = useRef(false);

  useEffect(() => {
    if (state === "idle") {
      sent.current = false;
    }
    return () => undefined;
  }, [state]);

  function activate() {
    if (sent.current || state !== "idle" || disabled) {
      return;
    }
    sent.current = true;
    onClick();
  }

  const sending = state === "sending";
  const locked = state === "locked";
  return (
    <PhoneDock>
      <Button
        ref={ref}
        type="button"
        className={className}
        disabled={disabled || sending || locked}
        aria-busy={sending || undefined}
        onClick={activate}
      >
        <span className="submit-label">
          {sending ? (
            <>
              <span className="submit-spinner" aria-hidden="true" />
              Sending
            </>
          ) : locked ? (
            "Locked in ✓"
          ) : (
            label
          )}
        </span>
      </Button>
    </PhoneDock>
  );
}

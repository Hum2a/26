import { useEffect, useRef, type Ref } from "react";
import { PhoneDock } from "../../controller/phone-dock";
import { Button } from "../../ui/primitives";
import type { SubmitState } from "./submit-state";
import "./submit.css";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

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
  const reduce = useReducedMotion();
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
        aria-label={sending ? "Sending" : locked ? "Locked in ✓" : label}
        onClick={activate}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            className="submit-label"
            key={state}
            initial={{ opacity: 0.6, y: reduce ? 0 : 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
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
          </motion.span>
        </AnimatePresence>
      </Button>
    </PhoneDock>
  );
}

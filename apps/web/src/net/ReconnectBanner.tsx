import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

const reconnectDelayMs = 1500;
const toastMs = 2400;

export function ReconnectBanner({
  disconnected,
  snapshotId,
  children,
}: {
  disconnected: boolean;
  snapshotId: number;
  children: ReactNode;
}) {
  const [waiting, setWaiting] = useState(false);
  const [toast, setToast] = useState(false);
  const recovering = useRef(false);
  const seenSnapshot = useRef(snapshotId);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!disconnected) {
      return () => {};
    }
    recovering.current = true;
    const timer = window.setTimeout(() => setWaiting(true), reconnectDelayMs);
    return () => {
      window.clearTimeout(timer);
      setWaiting(false);
    };
  }, [disconnected]);

  useEffect(() => {
    if (seenSnapshot.current === snapshotId) {
      return () => {};
    }
    seenSnapshot.current = snapshotId;
    if (!recovering.current) {
      return () => {};
    }
    recovering.current = false;
    setWaiting(false);
    setToast(true);
    const timer = window.setTimeout(() => setToast(false), toastMs);
    return () => window.clearTimeout(timer);
  }, [snapshotId]);

  const frame = useRef<HTMLFieldSetElement>(null);
  const banner = disconnected && waiting;

  useEffect(() => {
    const root = frame.current;
    if (!root || !disconnected) {
      return () => {};
    }
    const controls = [
      ...root.querySelectorAll("input, button, textarea, select"),
    ].filter(
      (
        control,
      ): control is
        | HTMLInputElement
        | HTMLButtonElement
        | HTMLTextAreaElement
        | HTMLSelectElement =>
        control instanceof HTMLInputElement ||
        control instanceof HTMLButtonElement ||
        control instanceof HTMLTextAreaElement ||
        control instanceof HTMLSelectElement,
    );
    const previous = controls.map((control) => control.disabled);
    for (const control of controls) {
      control.disabled = true;
    }
    return () => {
      controls.forEach((control, index) => {
        control.disabled = previous[index] ?? false;
      });
    };
  }, [disconnected, waiting]);

  return (
    <div className="grid gap-3">
      {banner ? (
        <motion.p
          role="status"
          className="w-full rounded-2xl bg-highlight px-4 py-3 text-lg font-bold text-highlight-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
        >
          Reconnecting…
        </motion.p>
      ) : null}
      <fieldset
        ref={frame}
        disabled={disconnected}
        className="m-0 min-w-0 border-0 p-0"
      >
        {children}
      </fieldset>
      <AnimatePresence>
        {toast ? (
          <motion.p
            role="status"
            className="rounded-2xl bg-accent px-4 py-3 text-lg font-bold text-accent-foreground"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
          >
            Back in ✓
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

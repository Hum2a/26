import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "../ui/primitives";

const reconnectDelayMs = 1500;
/** The phone keeps retrying throughout. These only change what the guest is told. */
const stillTryingMs = 10_000;
const offerRetryMs = 30_000;
const toastMs = 2400;

export function ReconnectBanner({
  disconnected,
  snapshotId,
  onRetry,
  children,
}: {
  disconnected: boolean;
  snapshotId: number;
  onRetry?: () => void;
  children: ReactNode;
}) {
  const [waiting, setWaiting] = useState<0 | 1 | 2 | 3>(0);
  const [toast, setToast] = useState(false);
  const recovering = useRef(false);
  const seenSnapshot = useRef(snapshotId);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!disconnected) {
      return () => {};
    }
    recovering.current = true;
    const timers = [
      window.setTimeout(() => setWaiting(1), reconnectDelayMs),
      window.setTimeout(() => setWaiting(2), stillTryingMs),
      window.setTimeout(() => setWaiting(3), offerRetryMs),
    ];
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      setWaiting(0);
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
    setWaiting(0);
    setToast(true);
    const timer = window.setTimeout(() => setToast(false), toastMs);
    return () => window.clearTimeout(timer);
  }, [snapshotId]);

  const banner = disconnected && waiting > 0;

  return (
    <div className="grid gap-3">
      {banner ? (
        <motion.div
          className="grid w-full gap-2 rounded-2xl bg-highlight px-4 py-3 text-highlight-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={waiting}
              role="status"
              className="text-lg font-bold"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0.01 : 0.18 }}
            >
              {waiting === 1
                ? "Reconnecting…"
                : "Still trying to reach the room. Check this phone’s Wi-Fi or signal."}
            </motion.p>
          </AnimatePresence>
          <AnimatePresence>
            {waiting === 3 && onRetry ? (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
              >
                <Button variant="secondary" onClick={onRetry}>
                  Try again now
                </Button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      ) : null}
      <fieldset disabled={disconnected} className="m-0 min-w-0 border-0 p-0">
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

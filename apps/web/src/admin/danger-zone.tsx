import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button, ConfirmDialog } from "../ui/primitives";
import { useAdminRoom } from "./room-provider";

/** Ending the game early and destroying the room. Both ask first. */
export function DangerZone() {
  const { snapshot, connection, busy, execute, command } = useAdminRoom();
  const [asking, setAsking] = useState<"end-now" | "destroy" | null>(null);
  const [typed, setTyped] = useState("");
  const reduce = useReducedMotion();
  const locked = busy || connection !== "open" || command.retryable;
  const phase = snapshot.phase;
  const canEnd = phase !== "lobby" && phase !== "podium";
  const codeMatches = typed.trim().toUpperCase() === snapshot.joinCode.toUpperCase();

  function close() {
    setAsking(null);
    setTyped("");
  }

  return (
    <section className="admin-danger" aria-label="End or destroy this room">
      <div>
        <p className="entry-eyebrow">Careful</p>
        <h2>End or destroy</h2>
      </div>
      <div className="admin-danger-actions">
        <AnimatePresence initial={false} mode="popLayout">
          {canEnd ? (
            <motion.div
              key="end"
              layout={!reduce}
              initial={{ opacity: 0, y: reduce ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduce ? 0 : 6 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              className="admin-danger-card"
            >
              <h3>End the game now</h3>
              <p>
                Stops the current question without scoring it and goes straight to the
                podium.
              </p>
              <Button
                variant="secondary"
                disabled={locked}
                onClick={() => setAsking("end-now")}
              >
                End game now
              </Button>
            </motion.div>
          ) : null}
          <motion.div
            key="destroy"
            layout={!reduce}
            className="admin-danger-card"
            data-severe=""
          >
            <h3>Destroy this room</h3>
            <p>
              Disconnects every phone and the stage, deletes players, answers, scores
              and photos, and frees the join code. This cannot be undone.
            </p>
            <Button
              variant="secondary"
              disabled={locked}
              onClick={() => setAsking("destroy")}
            >
              Destroy room…
            </Button>
          </motion.div>
        </AnimatePresence>
      </div>
      <ConfirmDialog
        open={asking === "end-now"}
        title="End the game now?"
        confirmLabel="End game now"
        disabled={locked || !canEnd}
        onClose={close}
        onConfirm={() => {
          close();
          void execute({ action: "end-now" }, "End game now");
        }}
      >
        <p>
          The current question will not be scored. Everyone moves to the podium with the
          points they already have.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={asking === "destroy"}
        title={`Destroy room ${snapshot.joinCode}?`}
        confirmLabel="Destroy room"
        disabled={locked || !codeMatches}
        onClose={close}
        onConfirm={() => {
          if (!codeMatches) return;
          const confirmCode = typed.trim().toUpperCase();
          close();
          void execute({ action: "destroy", confirmCode }, "Destroy room");
        }}
      >
        <p>
          Every guest and the stage will see that the room has closed. Players, answers,
          scores and photos are deleted. An archive already saved for results is kept.
        </p>
        <label className="admin-danger-confirm">
          Type <strong>{snapshot.joinCode}</strong> to confirm
          <input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            aria-label={`Type ${snapshot.joinCode} to confirm`}
            spellCheck={false}
            aria-invalid={typed.length > 0 && !codeMatches}
          />
        </label>
      </ConfirmDialog>
    </section>
  );
}

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import NumberFlow from "@number-flow/react";
import type { LobbySnapshot, PlaySnapshot } from "@26/shared";
import { usePhaseCountdown } from "../live/use-phase-countdown";
import { SubmitButton } from "./controls/SubmitButton";
import { roundSubmitState } from "./controls/submit-state";
import "./guest-push.css";

type Push = NonNullable<Extract<PlaySnapshot["question"], { kind: "choice" }>["push"]>;

/**
 * Push your luck on the phone. Lines appear on the room's clock; the phone
 * only displays them. The Raid point is never on the phone: it arrives with
 * the reveal. BAIL is the one action, sent through the ordinary answer.
 */
export function GuestPush({
  snapshot,
  push,
  observedAt,
  open = false,
  pending = false,
  onBail,
  stage = false,
}: {
  snapshot: LobbySnapshot;
  push: Push;
  observedAt: number;
  open?: boolean;
  pending?: boolean;
  onBail?: () => void;
  /** The projector: no bank or BAIL, just the lines and the room's bails. */
  stage?: boolean;
}) {
  const reduce = useReducedMotion();
  const play = snapshot.play!;
  const clock = usePhaseCountdown(snapshot, observedAt);
  const collecting = snapshot.phase === "collect";
  const revealed = play.reveal?.kind === "choice" ? play.reveal : undefined;
  const elapsed =
    collecting && clock?.remainingMs !== null && clock?.remainingMs !== undefined
      ? Math.max(0, push.windowMs - clock.remainingMs)
      : 0;
  const shown = revealed
    ? push.lines.length
    : collecting
      ? Math.min(push.lines.length, Math.floor(elapsed / push.lineMs) + 1)
      : 0;
  const own = play.selfAnswer?.kind === "choice" ? play.selfAnswer : undefined;
  const bailed = own?.optionId === "bail";
  const bankIndex = bailed && own?.pushLine !== undefined ? own.pushLine : shown - 1;
  const bank = bankIndex >= 0 ? (push.banks[bankIndex] ?? 0) : 0;
  const next = !bailed && shown < push.lines.length ? push.banks[shown] : undefined;
  const raidAfter = revealed?.raidAfter;

  return (
    <section className="push" aria-label="Cursed search history">
      <div className="push-browser glass" aria-live="polite">
        <div className="push-bar" aria-hidden="true">
          <span />
          <span />
          <span />
          <p>History</p>
        </div>
        <ol className="push-lines">
          <AnimatePresence initial={false}>
            {push.lines.slice(0, shown).map((line, index) => {
              const raidedHere =
                raidAfter !== undefined && raidAfter !== null && index >= raidAfter;
              return (
                <motion.li
                  key={line}
                  className="push-line"
                  data-heat={index}
                  data-after-raid={raidedHere || undefined}
                  data-bailed-here={bailed && own?.pushLine === index ? "" : undefined}
                  initial={{
                    opacity: 0,
                    y: reduce ? 0 : 10,
                    filter: reduce ? "none" : "blur(4px)",
                  }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: reduce ? 0.15 : 0.35, ease: [0.2, 0, 0, 1] }}
                >
                  <span className="push-line-icon" aria-hidden="true">
                    ⌕
                  </span>
                  <span className="push-line-text">{line}</span>
                  <span className="push-line-bank">{push.banks[index]}</span>
                </motion.li>
              );
            })}
          </AnimatePresence>
          {push.lines.slice(shown).map((_, index) => (
            <li
              key={`hidden-${index}`}
              className="push-line"
              data-hidden=""
              aria-hidden="true"
            >
              <span className="push-line-icon">⌕</span>
              <span className="push-line-text">• • •</span>
            </li>
          ))}
        </ol>
        <AnimatePresence>
          {revealed ? (
            <motion.p
              key="raid"
              className="push-raid"
              data-raid={raidAfter === null ? "none" : "hit"}
              role="status"
              initial={{ opacity: 0, scale: reduce ? 1 : 1.15 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={
                reduce
                  ? { duration: 0.15 }
                  : { type: "spring", stiffness: 360, damping: 18 }
              }
            >
              {raidAfter === null
                ? "No Raid! Everyone still in keeps the lot."
                : `RAID after line ${raidAfter}.`}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
      {stage ? (
        <p className="push-stage-count" role="status">
          {revealed
            ? `${revealed.tally?.[0]?.count ?? 0} bailed out`
            : `${play.submissionCount} of ${snapshot.players.length} have bailed`}
        </p>
      ) : null}
      {stage ? null : (
        <div className="push-bank glass" data-bailed={bailed || undefined}>
          <p className="push-bank-label">
            {bailed ? "You bailed with" : collecting ? "On the table" : "Bank"}
          </p>
          <p className="push-bank-value">
            <NumberFlow value={bank} animated={!reduce} locales="en-GB" />
            <small>pts</small>
          </p>
          <p className="push-bank-note">
            {bailed
              ? "If the Raid hadn’t hit yet, that’s yours. The reveal decides."
              : next !== undefined && collecting
                ? `Hold for the next line: ${next}`
                : collecting
                  ? "Last line. Bail now or ride it out."
                  : "Bail before the Raid to keep your bank."}
          </p>
        </div>
      )}
      {!stage && onBail && (collecting || pending || own) ? (
        <SubmitButton
          className="push-bail"
          label={`BAIL — bank ${bank}`}
          state={roundSubmitState(Boolean(own), pending)}
          disabled={!open || shown === 0}
          onClick={onBail}
        />
      ) : null}
    </section>
  );
}

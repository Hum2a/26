import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { talkingPoints, type TalkingGuest } from "../live/talking-points";
import { usePhaseCountdown } from "../live/use-phase-countdown";
import { PlayerAvatar } from "../ui/player-avatar";
import { RosterProvider } from "../ui/roster";
import { useAdminRoom } from "./room-provider";

function GuestChip({ guest }: { guest: TalkingGuest }) {
  return (
    <>
      <PlayerAvatar playerId={guest.playerId} nickname={guest.nickname} size="xs" />
      <span>{guest.nickname}</span>
    </>
  );
}

export function TalkingPointsPanel() {
  const { snapshot, observedAt } = useAdminRoom();
  const countdown = usePhaseCountdown(snapshot, observedAt);
  const reduced = useReducedMotion();
  const points = talkingPoints(snapshot);
  const collecting = ["collect", "vote", "predict"].includes(snapshot.phase);
  return (
    <RosterProvider
      gameId={snapshot.gameId}
      players={snapshot.players}
      revision={snapshot.mediaDisplayRevision}
    >
      <section
        className="admin-task-section talking-points"
        aria-label="Talking points"
      >
        <h2>Talking points</h2>
        <p className="admin-meta">
          Lines for the room while you wait. Nothing here is a new score — it is what
          the room already knows.
        </p>
        <dl className="talking-facts">
          {points.roundLine ? (
            <div>
              <dt>Round</dt>
              <dd>{points.roundLine}</dd>
            </div>
          ) : null}
          {points.currentPrompt ? (
            <div>
              <dt>This round</dt>
              <dd>{points.currentPrompt}</dd>
            </div>
          ) : null}
          {points.nextLine ? (
            <div>
              <dt>Coming up</dt>
              <dd>{points.nextLine.replace(/^Coming up: /, "")}</dd>
            </div>
          ) : null}
          <div>
            <dt>Phase</dt>
            <dd>
              {points.phaseLine}
              {countdown ? ` · ${countdown.value} left` : ""}
            </dd>
          </div>
          {points.answeredLine ? (
            <div>
              <dt>Answers</dt>
              <dd>{points.answeredLine}</dd>
            </div>
          ) : null}
        </dl>
        {collecting && (points.waiting.length || points.answered.length) ? (
          <div className="talking-lists">
            <section aria-label="Still thinking">
              <h3>Still thinking</h3>
              {points.waiting.length ? (
                <ul>
                  <AnimatePresence initial={false}>
                    {points.waiting.map((guest) => (
                      <motion.li
                        key={guest.playerId}
                        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
                        transition={{ duration: reduced ? 0.12 : 0.18 }}
                      >
                        <GuestChip guest={guest} />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              ) : (
                <p>Everyone connected has answered.</p>
              )}
              {points.waitingExtra ? <p>+{points.waitingExtra} more</p> : null}
            </section>
            <section aria-label="Answered">
              <h3>Answered</h3>
              {points.answered.length ? (
                <ul>
                  {points.answered.map((guest) => (
                    <li key={guest.playerId}>
                      <GuestChip guest={guest} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Nobody in yet.</p>
              )}
              {points.answeredExtra ? <p>+{points.answeredExtra} more</p> : null}
            </section>
          </div>
        ) : null}
        {points.top.length ? (
          <section aria-label="Live top three">
            <h3>Live top three</h3>
            <ol className="talking-leaders">
              {points.top.map((row) => (
                <li key={row.playerId ?? row.nickname}>
                  <span>{row.place}.</span> {row.nickname}{" "}
                  <span className="admin-mono-tag">{row.points}</span>
                </li>
              ))}
            </ol>
            {points.closest ? (
              <p>
                Closest race: {points.closest.ahead} leads {points.closest.behind} by{" "}
                {points.closest.gap} {points.closest.gap === 1 ? "point" : "points"}.
              </p>
            ) : null}
          </section>
        ) : null}
        {points.highlights.length ? (
          <section aria-label="Fun stats">
            <h3>Fun stats</h3>
            <ul className="talking-highlights">
              {points.highlights.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {points.recent.length ? (
          <p className="admin-meta">Just in: {points.recent.join(", ")}</p>
        ) : null}
      </section>
    </RosterProvider>
  );
}

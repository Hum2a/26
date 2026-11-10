import { AnimatePresence, motion } from "motion/react";
import { Button } from "../ui/primitives";
import { PlayerAvatar } from "../ui/player-avatar";
import { avatarUrl } from "../ui/roster-context";
import { RosterProvider } from "../ui/roster";
import { VoteBoard } from "../play/vote-board";
import { useAdminRoom } from "./room-provider";
import { CommandFeedback } from "./command-feedback";
import { VotersRehearsal } from "./voters-rehearsal";

const attributionCopy = {
  live: "Live: picks show as guests answer, then stay for the reveal.",
  after: "After: picks appear at the reveal.",
  never: "Never: picks stay off the big screen.",
} as const;

/**
 * The vote board's host view. See who is picking what (the same board the
 * projector draws), switch picks off the big screen for the whole room, and
 * remove any guest's profile photo. Rehearse with stand-ins below.
 */
export function VotersPage() {
  const { snapshot, execute, busy, connection, command } = useAdminRoom();
  const locked = busy || connection !== "open" || command.retryable;
  const display = snapshot.voterDisplay;
  const hidden = display?.mode === "hidden";
  const play = snapshot.play;
  const choice = play?.question.kind === "choice" ? play : null;
  const withPhotos = snapshot.players.filter((player) => player.avatarMediaId);

  return (
    <section className="admin-section">
      <header className="admin-page-heading">
        <div>
          <p className="entry-eyebrow">On the big screen</p>
          <h1>Vote board</h1>
        </div>
      </header>
      <p>
        Choice questions show who is picking what: each option grows as votes land and
        fills with the voters&rsquo; faces. Guest phones never receive other
        people&rsquo;s picks.
      </p>
      <CommandFeedback scope="voters" />

      <section
        className="skin-panel p-4 space-y-3"
        aria-label="Picks on the big screen"
      >
        <h2>Picks on the big screen</h2>
        <p>
          {hidden
            ? "Hidden for every question. The stage shows the options and how many have answered."
            : "Following each question: live, after the reveal or never, as the question says."}
        </p>
        <Button
          variant="secondary"
          disabled={locked || !display}
          onClick={() =>
            void execute(
              { action: hidden ? "voters-question" : "voters-hidden" },
              hidden ? "Show picks on the big screen" : "Hide picks on the big screen",
              "voters",
            )
          }
        >
          {hidden ? "Show picks again" : "Hide picks for every question"}
        </Button>
        <ol aria-label="Vote board switch history">
          <AnimatePresence initial={false}>
            {display?.history.map((entry, index) => (
              <motion.li
                key={`${entry.atMs}:${index}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                Host {entry.mode === "hidden" ? "hid picks" : "showed picks"} ·{" "}
                {new Date(entry.atMs).toLocaleString("en-GB")}
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      </section>

      <section className="skin-panel p-4 space-y-3" aria-label="Board right now">
        <h2>Right now</h2>
        {choice && choice.question.kind === "choice" ? (
          <>
            <p>
              Question {choice.question.index}: {choice.question.prompt}
              <br />
              {attributionCopy[choice.question.attribution]}
              {hidden ? " The room switch is hiding it." : ""}
            </p>
            <div className="voters-live-stage stage-presentation">
              <RosterProvider
                gameId={snapshot.gameId}
                players={snapshot.players}
                revision={snapshot.mediaDisplayRevision}
              >
                <VoteBoard play={choice} />
              </RosterProvider>
            </div>
          </>
        ) : (
          <p>No choice question is running. The board appears here when one is.</p>
        )}
      </section>

      <section className="skin-panel p-4 space-y-3" aria-label="Profile photos">
        <h2>Profile photos</h2>
        <p>
          {withPhotos.length} of {snapshot.players.length} players have a photo.
          Removing one takes it off every screen at once; the guest may take a new one.
        </p>
        {snapshot.players.length === 0 ? (
          <p>No players yet.</p>
        ) : (
          <ul className="voters-photo-list" aria-label="Players and photos">
            <AnimatePresence initial={false}>
              {snapshot.players.map((player) => (
                <motion.li
                  key={player.playerId}
                  layout="position"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <PlayerAvatar
                    playerId={player.playerId}
                    nickname={player.nickname}
                    faceSrc={
                      player.avatarMediaId
                        ? avatarUrl(snapshot.gameId, player.avatarMediaId)
                        : null
                    }
                    size="lg"
                  />
                  <span className="voters-photo-name">{player.nickname}</span>
                  {player.avatarMediaId ? (
                    <Button
                      variant="secondary"
                      disabled={locked}
                      onClick={() =>
                        void execute(
                          { action: "avatar-clear", playerId: player.playerId },
                          `Remove ${player.nickname}'s photo`,
                          "voters",
                        )
                      }
                    >
                      Remove photo
                    </Button>
                  ) : (
                    <span className="text-sm text-muted">No photo</span>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      <VotersRehearsal />
    </section>
  );
}

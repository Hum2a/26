import { useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import NumberFlow from "@number-flow/react";
import type { LobbySnapshot, PlaySnapshot } from "@26/shared";
import { PlayerAvatar } from "../ui/player-avatar";
import "./ranks-tab.css";

type Standing = NonNullable<PlaySnapshot["standings"]>[number];
type SelfStanding = NonNullable<PlaySnapshot["selfStanding"]>;

type Memory = {
  standings: Standing[] | null;
  self: SelfStanding | null;
  /** Place before the latest change, for the movement arrow. */
  previousPlace: number | null;
  award: { questionId: string; points: number | null } | null;
};

/**
 * The phone's leaderboard. The room only sends standings while scores are
 * shown, so this keeps the latest ones for the rest of the round. It never
 * sorts or totals anything itself.
 */
export function RanksTab({
  snapshot,
  nickname,
}: {
  snapshot: LobbySnapshot | undefined;
  nickname: string;
}) {
  const reduce = useReducedMotion();
  const play = snapshot?.play;
  const [memory, setMemory] = useState<Memory>({
    standings: null,
    self: null,
    previousPlace: null,
    award: null,
  });
  const nextStandings = play?.standings ?? null;
  const nextSelf = play?.selfStanding ?? null;
  // A revealed round with no award could not score (a poll): remember it as
  // such, so Ranks never repeats the previous round's points.
  const revealed = snapshot?.phase === "reveal" || snapshot?.phase === "scores";
  const nextAward =
    play && (play.selfAward !== null || (revealed && play.question.kind !== "kart"))
      ? { questionId: play.question.id, points: play.selfAward }
      : null;
  const changed =
    (nextStandings !== null &&
      JSON.stringify(nextStandings) !== JSON.stringify(memory.standings)) ||
    (nextSelf !== null && JSON.stringify(nextSelf) !== JSON.stringify(memory.self)) ||
    (nextAward !== null && JSON.stringify(nextAward) !== JSON.stringify(memory.award));
  if (changed) {
    setMemory({
      standings: nextStandings ?? memory.standings,
      self: nextSelf ?? memory.self,
      previousPlace:
        nextSelf && memory.self && nextSelf.place !== memory.self.place
          ? memory.self.place
          : memory.previousPlace,
      award: nextAward ?? memory.award,
    });
  }
  const hidden = Boolean(
    snapshot?.trolls.active.some(
      (effect) =>
        effect.kind === "hide-score" &&
        effect.role === "target" &&
        effect.status === "active",
    ),
  );
  const standings = memory.standings ?? [];
  const self = memory.self;
  const movement =
    self && memory.previousPlace !== null ? memory.previousPlace - self.place : 0;
  const leader = Math.max(1, ...standings.map((row) => row.points));
  const idOf = (name: string) =>
    snapshot?.players.find((player) => player.nickname === name)?.playerId ?? name;
  const podium = standings.filter((row) => row.place <= 3).slice(0, 3);
  const rest = standings.filter((row) => !podium.includes(row));

  return (
    <div className="ranks-tab">
      <header className="phone-tab-head">
        <p className="entry-eyebrow">Leaderboard</p>
        <h1 className="phone-tab-title">Ranks</h1>
      </header>
      <section className="ranks-self glass" aria-label="Your standing">
        {hidden ? (
          <p className="ranks-hidden">
            Someone hid your score from you. It comes back after this question.
          </p>
        ) : self ? (
          <>
            <div className="ranks-self-place">
              <span className="ranks-self-hash" aria-hidden="true">
                #
              </span>
              <NumberFlow value={self.place} animated={!reduce} aria-hidden="true" />
              <span className="sr-only">
                Place {self.place} of {self.players}
              </span>
              <small aria-hidden="true">of {self.players}</small>
            </div>
            <div className="ranks-self-points">
              <strong>
                <NumberFlow
                  value={self.points}
                  animated={!reduce}
                  locales="en-GB"
                  aria-hidden="true"
                />
                <span className="sr-only">{self.points} points</span>
              </strong>
              <span>points</span>
            </div>
            <AnimatePresence initial={false}>
              {movement !== 0 ? (
                <motion.p
                  key={`${movement}`}
                  className="ranks-move"
                  data-direction={movement > 0 ? "up" : "down"}
                  initial={{ opacity: 0, y: reduce ? 0 : movement > 0 ? 8 : -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {movement > 0 ? "▲" : "▼"} {Math.abs(movement)}{" "}
                  {Math.abs(movement) === 1 ? "place" : "places"}
                </motion.p>
              ) : null}
            </AnimatePresence>
            {memory.award ? (
              <p className="ranks-award">
                {memory.award.points === null
                  ? "The last round was just for fun"
                  : memory.award.points > 0
                    ? `+${memory.award.points} on the last question`
                    : "No points on the last question"}
              </p>
            ) : null}
          </>
        ) : (
          <p className="ranks-empty">
            Your place appears after the first scores. Answer to get on the board.
          </p>
        )}
      </section>
      {podium.length > 0 ? (
        <section className="ranks-podium" aria-label="Top three">
          {[2, 1, 3].map((place) => {
            const row = podium.find((item) => item.place === place);
            if (!row) return <span key={place} />;
            return (
              <motion.div
                key={row.nickname}
                layout={!reduce}
                className="ranks-pillar glass"
                data-place={place}
                data-self={row.nickname === nickname || undefined}
                initial={{ opacity: 0, y: reduce ? 0 : 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduce
                    ? { duration: 0.15 }
                    : {
                        type: "spring",
                        stiffness: 260,
                        damping: 24,
                        delay: place * 0.06,
                      }
                }
              >
                <PlayerAvatar
                  playerId={idOf(row.nickname)}
                  nickname={row.nickname}
                  size="lg"
                />
                <strong>{row.nickname}</strong>
                <span className="ranks-pillar-points">
                  <NumberFlow value={row.points} animated={!reduce} locales="en-GB" />
                </span>
                <span className="ranks-pillar-step" aria-label={`Place ${place}`}>
                  {place}
                </span>
              </motion.div>
            );
          })}
        </section>
      ) : null}
      {rest.length > 0 ? (
        <ol className="ranks-list" aria-label="Leaderboard">
          <AnimatePresence initial={false}>
            {rest.map((row, index) => (
              <motion.li
                key={row.nickname}
                layout={!reduce}
                className="ranks-row glass"
                data-self={row.nickname === nickname || undefined}
                initial={{ opacity: 0, x: reduce ? 0 : -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.22,
                  delay: reduce ? 0 : Math.min(index * 0.03, 0.2),
                }}
              >
                <span className="ranks-row-place">{row.place}</span>
                <PlayerAvatar
                  playerId={idOf(row.nickname)}
                  nickname={row.nickname}
                  size="sm"
                />
                <span className="ranks-row-name">{row.nickname}</span>
                <span className="ranks-row-points">{row.points}</span>
                <span
                  className="ranks-row-bar"
                  aria-hidden="true"
                  style={
                    { "--share": `${(row.points / leader) * 100}%` } as CSSProperties
                  }
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      ) : null}
      {standings.length === 0 ? (
        <p className="ranks-empty">
          The top ten appear here once the first scores are in.
        </p>
      ) : null}
    </div>
  );
}

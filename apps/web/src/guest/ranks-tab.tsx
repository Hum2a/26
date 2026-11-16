import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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

const memoryKey = (gameId: string) => `26-ranks-${gameId}`;
const emptyMemory: Memory = {
  standings: null,
  self: null,
  previousPlace: null,
  award: null,
};

/** The last standings this tab saw for a game, so a reload mid-round keeps them. */
function readMemory(gameId: string | undefined): Memory {
  if (!gameId) return emptyMemory;
  try {
    const raw = sessionStorage.getItem(memoryKey(gameId));
    return raw
      ? { ...emptyMemory, ...(JSON.parse(raw) as Partial<Memory>) }
      : emptyMemory;
  } catch {
    return emptyMemory;
  }
}
function writeMemory(gameId: string | undefined, memory: Memory) {
  if (!gameId) return;
  try {
    sessionStorage.setItem(memoryKey(gameId), JSON.stringify(memory));
  } catch {
    // Storage can be unavailable; Ranks then fills again at the next scores.
  }
}

function standingsEqual(a: Standing[] | null, b: Standing[] | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i]!;
    const right = b[i]!;
    if (
      left.place !== right.place ||
      left.nickname !== right.nickname ||
      left.points !== right.points
    ) {
      return false;
    }
  }
  return true;
}

function selfEqual(a: SelfStanding | null, b: SelfStanding | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.place === b.place && a.points === b.points && a.players === b.players;
}

function awardEqual(a: Memory["award"], b: Memory["award"]): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.questionId === b.questionId && a.points === b.points;
}

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
  const gameId = snapshot?.gameId;
  const [{ scopedGameId, memory }, setScopedMemory] = useState<{
    scopedGameId: string | undefined;
    memory: Memory;
  }>(() => ({
    scopedGameId: gameId,
    memory: readMemory(gameId),
  }));

  const currentMemory = scopedGameId === gameId ? memory : readMemory(gameId);
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
    (nextStandings !== null && !standingsEqual(nextStandings, currentMemory.standings)) ||
    (nextSelf !== null && !selfEqual(nextSelf, currentMemory.self)) ||
    (nextAward !== null && !awardEqual(nextAward, currentMemory.award));
  const nextMemory: Memory = changed
    ? {
        standings: nextStandings ?? currentMemory.standings,
        self: nextSelf ?? currentMemory.self,
        previousPlace:
          nextSelf && currentMemory.self && nextSelf.place !== currentMemory.self.place
            ? currentMemory.self.place
            : currentMemory.previousPlace,
        award: nextAward ?? currentMemory.award,
      }
    : currentMemory;

  if (scopedGameId !== gameId || changed) {
    setScopedMemory({ scopedGameId: gameId, memory: nextMemory });
  }

  const lastWritten = useRef<Memory | null>(null);
  useEffect(() => {
    if (!gameId || memory === emptyMemory || memory === lastWritten.current) return;
    if (scopedGameId !== gameId) return;
    lastWritten.current = memory;
    writeMemory(gameId, memory);
  }, [gameId, scopedGameId, memory]);

  const hidden = Boolean(
    snapshot?.trolls.active.some(
      (effect) =>
        effect.kind === "hide-score" &&
        effect.role === "target" &&
        effect.status === "active",
    ),
  );
  const standings = nextMemory.standings ?? [];
  const self = nextMemory.self;
  const movement =
    self && nextMemory.previousPlace !== null
      ? nextMemory.previousPlace - self.place
      : 0;
  const leader = Math.max(1, ...standings.map((row) => row.points));
  const idByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const player of snapshot?.players ?? []) {
      map.set(player.nickname, player.playerId);
    }
    return map;
  }, [snapshot?.players]);
  const idOf = (name: string) => idByName.get(name) ?? name;
  const podium = standings.filter((row) => row.place <= 3).slice(0, 3);
  const podiumSet = new Set(podium);
  const rest = standings.filter((row) => !podiumSet.has(row));

  return (
    <div className="ranks-tab">
      <header className="phone-tab-head">
        <p className="entry-eyebrow">Leaderboard</p>
        <h1 className="phone-tab-title">Ranks</h1>
      </header>
      {snapshot?.phase === "podium" ? (
        <a
          className="entry-text-link ranks-results-link"
          href={`/r/${snapshot.gameId}`}
        >
          See the full results →
        </a>
      ) : null}
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

import { useEffect, useMemo, useRef, useState } from "react";
import type { LobbyPlayer, PlaySnapshot } from "@26/shared";
import { Button } from "../ui/primitives";
import { RosterContext, type RosterEntry } from "../ui/roster-context";
import { VoteBoard } from "../play/vote-board";

/**
 * A dry run of the stage vote board: the real component, stand-in players,
 * local state only. No room, socket, score or answer key is involved; the
 * "answer" here is a label the host picks for the rehearsal.
 */

const optionSet = [
  { id: "a", label: "Stand-in option A" },
  { id: "b", label: "Stand-in option B" },
  { id: "c", label: "Stand-in option C" },
  { id: "d", label: "Stand-in option D" },
] as const;

const standInCount = 24;

function standInId(index: number): string {
  return `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

/** A drawn stand-in face, so the rehearsal shows photo bubbles without real photos. */
function standInFace(index: number): string | null {
  if (index % 3 === 2) return null; // Some players never add a photo: initials.
  const hue = (index * 47) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="hsl(${hue} 70% 62%)"/><circle cx="32" cy="34" r="18" fill="hsl(${(hue + 30) % 360} 45% 86%)"/><circle cx="25" cy="31" r="2.6" fill="#222"/><circle cx="39" cy="31" r="2.6" fill="#222"/><path d="M24 40 Q32 ${46 + (index % 3)} 40 40" stroke="#222" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const standInPlayers: LobbyPlayer[] = Array.from(
  { length: standInCount },
  (_, index) => ({ playerId: standInId(index), nickname: `Stand-in ${index + 1}` }),
);

type Mode = "live" | "after" | "never";
type Phase = "collect" | "reveal";

export function VotersRehearsal() {
  const [mode, setMode] = useState<Mode>("live");
  const [phase, setPhase] = useState<Phase>("collect");
  const [answer, setAnswer] = useState<string>("b");
  // Each stand-in's current pick, in the order they arrived.
  const [picks, setPicks] = useState<{ playerId: string; optionId: string }[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer);
    },
    [],
  );

  const roster = useMemo(
    () =>
      new Map<string, RosterEntry>(
        standInPlayers.map((player, index) => [
          player.playerId,
          { playerId: player.playerId, nickname: player.nickname, faceSrc: standInFace(index) },
        ]),
      ),
    [],
  );

  function addVote() {
    setPicks((current) => {
      const free = standInPlayers.find(
        (player) => !current.some((pick) => pick.playerId === player.playerId),
      );
      if (!free) return current;
      // Weighted towards B and A so a leader emerges.
      const roll = (current.length * 7 + 3) % 10;
      const optionId = roll < 4 ? "b" : roll < 7 ? "a" : roll < 9 ? "c" : "d";
      return [...current, { playerId: free.playerId, optionId }];
    });
  }

  function wave() {
    for (let step = 0; step < 8; step += 1) {
      timers.current.push(window.setTimeout(addVote, 140 + step * 220));
    }
  }

  function changeMind() {
    setPicks((current) => {
      if (current.length === 0) return current;
      const [first, ...rest] = current;
      const next = optionSet.find((option) => option.id !== first!.optionId)!.id;
      return [...rest, { playerId: first!.playerId, optionId: next }];
    });
  }

  function reset() {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
    setPicks([]);
    setPhase("collect");
  }

  const play = rehearsalPlay(picks, mode, phase, answer);

  return (
    <section className="skin-panel p-4 space-y-3" aria-label="Vote board rehearsal">
      <h2>Rehearse the board</h2>
      <p>
        The real stage board with stand-in players. Nothing reaches the room. To try a
        real selfie, join from a second tab and open the photo card.
      </p>
      <div className="admin-actions">
        <label htmlFor="voters-rehearsal-mode">This question shows picks</label>
        <select
          id="voters-rehearsal-mode"
          value={mode}
          onChange={(event) => setMode(event.target.value as Mode)}
        >
          <option value="live">Live, as they come in</option>
          <option value="after">After the reveal</option>
          <option value="never">Never</option>
        </select>
        <label htmlFor="voters-rehearsal-answer">Rehearsal answer</label>
        <select
          id="voters-rehearsal-answer"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
        >
          {optionSet.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="admin-actions">
        <Button variant="secondary" disabled={phase === "reveal"} onClick={addVote}>
          Add a vote
        </Button>
        <Button variant="secondary" disabled={phase === "reveal"} onClick={wave}>
          Wave of votes
        </Button>
        <Button
          variant="secondary"
          disabled={phase === "reveal" || picks.length === 0}
          onClick={changeMind}
        >
          Change a mind
        </Button>
        <Button
          variant="secondary"
          onClick={() => setPhase((current) => (current === "reveal" ? "collect" : "reveal"))}
        >
          {phase === "reveal" ? "Back to answering" : "Reveal"}
        </Button>
        <Button variant="secondary" onClick={reset}>
          Reset
        </Button>
      </div>
      <p className="text-sm text-muted">
        {picks.length} of {standInCount} stand-ins have picked ·{" "}
        {phase === "reveal" ? "revealed" : "answers open"}
      </p>
      <div className="voters-rehearsal-stage stage-presentation">
        <RosterContext.Provider value={roster}>
          <VoteBoard play={play} />
        </RosterContext.Provider>
      </div>
    </section>
  );
}

/** The snapshot the room would send the stage for these stand-in picks. */
export function rehearsalPlay(
  picks: readonly { playerId: string; optionId: string }[],
  mode: Mode,
  phase: Phase,
  answer: string,
): PlaySnapshot {
  const shows = mode === "live" || (mode === "after" && phase === "reveal");
  return {
    question: {
      kind: "choice",
      id: "vote-board-rehearsal",
      index: 1,
      total: 1,
      prompt: "Stand-in question for the vote board",
      points: 0,
      illustrative: true,
      attribution: mode,
      presentation: "standard",
      options: optionSet.map((option) => ({ ...option })),
      speedBonus: false,
      modifiers: [],
      suppressSpeedBonus: false,
    },
    submissionCount: picks.length,
    selfAnswer: null,
    selfBallot: null,
    ballot: null,
    duel: null,
    reveal:
      phase === "reveal"
        ? {
            kind: "choice",
            correctOptionId: answer,
          }
        : null,
    selfAward: null,
    selfStanding: null,
    standings: null,
    liveSample: null,
    attributions: null,
    voters: shows
      ? optionSet.map((option) => ({
          optionId: option.id,
          playerIds: picks
            .filter((pick) => pick.optionId === option.id)
            .map((pick) => pick.playerId),
        }))
      : null,
    explanation: null,
  } as PlaySnapshot;
}

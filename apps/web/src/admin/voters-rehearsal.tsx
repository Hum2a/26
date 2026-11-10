import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../ui/primitives";
import { RosterContext, type RosterEntry } from "../ui/roster-context";
import { VoteBoard } from "../play/vote-board";
import {
  optionSet,
  rehearsalPlay,
  standInCount,
  standInFace,
  standInPlayers,
  type Mode,
  type Phase,
} from "./voters-rehearsal-data";

/**
 * A dry run of the stage vote board: the real component, stand-in players,
 * local state only. No room, socket, score or answer key is involved; the
 * "answer" here is a label the host picks for the rehearsal.
 */

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
          {
            playerId: player.playerId,
            nickname: player.nickname,
            faceSrc: standInFace(index),
          },
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

  /** Stops a wave still landing, so nobody votes after the reveal. */
  function stopWave() {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
  }

  function reset() {
    stopWave();
    setPicks([]);
    setPhase("collect");
  }

  function toggleReveal() {
    if (phase === "collect") stopWave();
    setPhase(phase === "reveal" ? "collect" : "reveal");
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
        <Button variant="secondary" onClick={toggleReveal}>
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

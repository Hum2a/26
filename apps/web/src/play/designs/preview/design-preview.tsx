import { useMemo, useState } from "react";
import { MotionGlobalConfig } from "motion/react";
import {
  customPresentationIds,
  emptyWordleBoard,
  reduceWordle,
  type CustomPresentationId,
  type LobbySnapshot,
  type PlaySnapshot,
  type RoomPhaseName,
} from "@26/shared";
import { GuestPlay } from "../../guest-play";
import { StagePlay } from "../../stage-play";
import { SafeArea } from "../../../stage/SafeArea";
import type { TierPlacement } from "../../controls/TierAssign";
import { previewQuestions, previewReveal } from "./fixtures";
import "../../../stage/projector.css";

/**
 * Development-only design bench at `/design`. It drives the real phone and
 * stage components with a fake snapshot. Nothing here reaches a room.
 */
const phases = [
  "prompt",
  "collect",
  "reveal",
] as const satisfies readonly RoomPhaseName[];

type Answer = PlaySnapshot["selfAnswer"];

// `?still=1` jumps every Motion animation to its end, for checking a final layout.
if (new URLSearchParams(window.location.search).get("still") === "1") {
  MotionGlobalConfig.skipAnimations = true;
}

function readParams() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q");
  const phase = params.get("phase");
  return {
    id: (customPresentationIds as readonly string[]).includes(q ?? "")
      ? (q as CustomPresentationId)
      : customPresentationIds[0],
    surface:
      params.get("surface") === "stage" ? ("stage" as const) : ("phone" as const),
    phase: (phases as readonly string[]).includes(phase ?? "")
      ? (phase as (typeof phases)[number])
      : ("collect" as const),
  };
}

export function DesignPreview() {
  const initial = useMemo(() => readParams(), []);
  const [id, setId] = useState<CustomPresentationId>(initial.id);
  const [surface, setSurface] = useState(initial.surface);
  const [phase, setPhase] = useState<(typeof phases)[number]>(initial.phase);
  const [selectedId, setSelectedId] = useState<string>();
  const [answer, setAnswer] = useState<Answer>(null);
  const [count, setCount] = useState(3);
  const [seed, setSeed] = useState(1);

  const question = previewQuestions[id];
  const revealed = phase === "reveal";
  const play: PlaySnapshot = {
    question,
    submissionCount: count,
    selfAnswer: answer,
    selfBallot: null,
    ballot: null,
    duel: null,
    reveal: revealed ? previewReveal(question, selectedId, seed) : null,
    selfAward: revealed ? 100 : null,
    selfStanding: null,
    standings: null,
    liveSample: null,
    attributions: null,
    explanation:
      revealed && id === "scripture"
        ? "The full verse is printed here at the reveal (preview text)."
        : null,
  };
  const snapshot = {
    phase,
    paused: false,
    held: false,
    finishAfterRound: false,
    play,
    trolls: { active: [] },
  } as unknown as LobbySnapshot;

  function reset(
    next: Partial<{ id: CustomPresentationId; phase: (typeof phases)[number] }>,
  ) {
    if (next.id) {
      setId(next.id);
      setSelectedId(undefined);
      setAnswer(null);
    }
    if (next.phase) {
      setPhase(next.phase);
    }
  }

  return (
    <div className="design-bench">
      <div className="design-bench-bar">
        <label>
          Design{" "}
          <select
            value={id}
            onChange={(event) =>
              reset({ id: event.target.value as CustomPresentationId })
            }
          >
            {customPresentationIds.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          Surface{" "}
          <select
            value={surface}
            onChange={(event) => setSurface(event.target.value as "phone" | "stage")}
          >
            <option value="phone">phone</option>
            <option value="stage">stage</option>
          </select>
        </label>
        <label>
          Phase{" "}
          <select
            value={phase}
            onChange={(event) =>
              reset({ phase: event.target.value as (typeof phases)[number] })
            }
          >
            {phases.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => setCount((value) => value + 1)}>
          +1 answer
        </button>
        <button type="button" onClick={() => setSeed((value) => value + 1)}>
          Reshuffle votes
        </button>
        <button
          type="button"
          onClick={() => {
            setAnswer(null);
            setSelectedId(undefined);
          }}
        >
          Clear my answer
        </button>
      </div>
      {question.kind === "wordle" ? (
        <p>
          Development sample: any five letters are allowed; the stand-in word is WORDS.
          Use Question packs for the real word-list rehearsal.
        </p>
      ) : null}
      {surface === "phone" ? (
        <div className="design-bench-phone">
          <GuestPlay
            snapshot={snapshot}
            selectedId={selectedId}
            pending={false}
            onSelect={setSelectedId}
            onSubmit={() => {
              if (selectedId) {
                setAnswer({ kind: "choice", optionId: selectedId });
              }
            }}
            onEstimate={() => undefined}
            onRank={(placements: TierPlacement[]) =>
              setAnswer({ kind: "rank", placements })
            }
            onText={(body) => {
              if (question.kind !== "wordle") {
                setAnswer({ kind: "text", body: body.trim() });
                return;
              }
              // Explicit development adapter with a stand-in word, never the party target.
              const result = reduceWordle(
                answer?.kind === "wordle" ? answer : emptyWordleBoard(),
                body,
                { answer: "WORDS", isWord: () => true, deadline: 1 },
                0,
              );
              if (result.ok) setAnswer(result.state);
            }}
            onBallot={() => undefined}
            onDuel={() => undefined}
          />
        </div>
      ) : (
        <SafeArea dev={false}>
          <div className="stage-presentation">
            <StagePlay snapshot={snapshot} />
          </div>
        </SafeArea>
      )}
    </div>
  );
}

export default DesignPreview;

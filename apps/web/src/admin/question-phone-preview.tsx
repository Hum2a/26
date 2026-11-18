const ChessRehearsal = lazy(() =>
  import("../chess/chess-rehearsal").then((module) => ({
    default: module.ChessRehearsal,
  })),
);
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link, useParams, useSearchParams } from "react-router";
import type { LobbySnapshot, PlaySnapshot } from "@26/shared";
import { rehearsalPhase, rehearsalPlay } from "./question-rehearsal";
import { ControllerRoot } from "../controller/ControllerRoot";
import { PhoneShell } from "../guest/phone-shell";
import { GuestPlay } from "../play/guest-play";
import { PhaseTransition } from "../anim/PhaseTransition";
import { Button } from "../ui/primitives";
import { readQuestionPreview, rehearseWordle } from "./sections-api";
import { useSection } from "./use-section";
import "./phone-preview.css";

/** Authenticated isolated rehearsal. It never opens a socket or sends a guest action. */
export function QuestionPhonePreview() {
  const { version = "", questionId = "" } = useParams();
  const reader = useCallback(
    () => readQuestionPreview(version, questionId),
    [version, questionId],
  );
  const content = useSection(reader);
  const [params] = useSearchParams();
  const data = !content.loading && !content.error ? content.data : undefined;
  useEffect(() => {
    document.title = "Phone preview · 26";
  }, []);
  if (!data?.question)
    return (
      <div className="phone-preview-unavailable">
        <p className="entry-eyebrow">Phone preview</p>
        <h1>{content.loading ? "Loading the phone…" : "Preview unavailable"}</h1>
        <p role="status">{content.error || data?.limitation}</p>
        {content.error ? (
          <Link
            className="entry-text-link"
            to={`/admin/login?returnTo=${encodeURIComponent(`/admin/phone-preview/${version}/${questionId}`)}`}
            target="_top"
          >
            Admin sign in →
          </Link>
        ) : null}
        {!content.loading ? (
          <Button onClick={() => void content.refresh()}>Try again</Button>
        ) : null}
      </div>
    );
  return (
    <PhoneRehearsal
      key={`${version}/${questionId}/${params.get("phase")}/${params.get("take")}`}
      version={version}
      question={data.question}
      phase={rehearsalPhase(params.get("phase"), data.question)}
      limitation={data.limitation}
      interactive={data.interactive}
    />
  );
}

function PhoneRehearsal({
  version,
  question,
  phase,
  limitation,
  interactive,
}: {
  version: string;
  question: PlaySnapshot["question"];
  phase: "prompt" | "collect" | "vote";
  limitation: string | null;
  interactive: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const [answer, setAnswer] = useState<PlaySnapshot["selfAnswer"]>(null);
  const [ballot, setBallot] = useState<PlaySnapshot["selfBallot"]>(null);
  const [beat, setBeat] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const [clockNow, setClockNow] = useState(startedAt);
  const [pausedDuration, setPausedDuration] = useState(0);
  const [paused, setPaused] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  async function sendText(body: string) {
    if (question.kind === "choice" && question.outcome === "multiple") {
      setAnswer({ kind: "multiple", optionIds: JSON.parse(body) as string[] });
      return;
    }
    if (question.kind !== "wordle") {
      setAnswer({ kind: "text", body });
      return;
    }
    setPending(true);
    setError(undefined);
    const result = await rehearseWordle(
      version,
      question.id,
      answer?.kind === "wordle" ? answer.guesses.map((g) => g.word) : [],
      body,
    );
    setPending(false);
    if ("error" in result) setError(result.error);
    else if (!result.ok) setError(result.message);
    else setAnswer(result.state);
  }
  const play = rehearsalPlay(question, phase, { answer, ballot, beat });
  const snapshot = {
    phase,
    players: [],
    serverNow: clockNow,
    deadlineAt:
      question.kind === "choice" && question.push && phase === "collect"
        ? startedAt + question.push.windowMs + pausedDuration
        : null,
    remainingMs:
      question.kind === "choice" && question.push
        ? Math.max(0, startedAt + question.push.windowMs + pausedDuration - clockNow)
        : null,
    paused,
    held: !interactive,
    play,
    trolls: { active: [] },
  } as unknown as LobbySnapshot;
  return (
    <ControllerRoot>
      <PhoneShell
        nickname="Preview guest"
        connection="idle"
        immersive
        scrollKey={phase}
      >
        <p className="phone-preview-notice">
          Private rehearsal · no live game is connected.
          {limitation ? ` ${limitation}` : ""}
        </p>
        <AnimatePresence>
          {error && question.kind !== "wordle" ? (
            <motion.p
              key="rehearsal-error"
              role="alert"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {error}
            </motion.p>
          ) : null}
        </AnimatePresence>
        <PhaseTransition phase={phase}>
          {question.kind === "chess" ? (
            <Suspense fallback={<p role="status">Loading chess engine…</p>}>
              <ChessRehearsal snapshot={snapshot} />
            </Suspense>
          ) : (
            <GuestPlay
              snapshot={snapshot}
              observedAt={clockNow}
              onChoose={(optionId) =>
                setAnswer({
                  kind: "choice",
                  optionId,
                  ...(question.kind === "choice" && question.push
                    ? {
                        pushLine: Math.min(
                          question.push.lines.length - 1,
                          Math.floor(
                            Math.max(0, Date.now() - startedAt - pausedDuration) /
                              question.push.lineMs,
                          ),
                        ),
                      }
                    : {}),
                })
              }
              selectedId={selectedId}
              pending={pending}
              onSelect={setSelectedId}
              onSubmit={() => {
                if (selectedId) setAnswer({ kind: "choice", optionId: selectedId });
              }}
              onMapPin={(pin) => setAnswer({ kind: "map-guess", pin })}
              onEstimate={(value) => setAnswer({ kind: "slider", value })}
              onRank={(placements) => setAnswer({ kind: "rank", placements })}
              onText={(body) => void sendText(body)}
              wordleFeedback={error}
              onWordleEdit={() => setError(undefined)}
              onBallot={(candidateId) => setBallot({ candidateId })}
              onDuel={(value) => setAnswer({ kind: "duel", value })}
            />
          )}
        </PhaseTransition>
        {phase === "prompt" && question.kind === "choice" && question.optionSequence ? (
          <Button
            variant="secondary"
            disabled={beat >= question.options.length}
            onClick={() => setBeat((value) => value + 1)}
          >
            Reveal next option
          </Button>
        ) : null}
        {phase === "vote" && question.kind === "vote" && question.flow ? (
          <Button
            variant="secondary"
            onClick={() => {
              setBeat((value) => value + 1);
              setBallot(null);
            }}
          >
            Next rehearsal ballot
          </Button>
        ) : null}
        <Button
          variant="secondary"
          onClick={() => {
            const now = Date.now();
            if (paused) setPausedDuration((value) => value + now - clockNow);
            setClockNow(now);
            setPaused((value) => !value);
          }}
        >
          {paused ? "Resume preview" : "Pause preview"}
        </Button>
      </PhoneShell>
    </ControllerRoot>
  );
}

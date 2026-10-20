import { useCallback, useEffect, useState } from "react";
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
          {error ? (
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
          <GuestPlay
            snapshot={snapshot}
            selectedId={selectedId}
            pending={pending}
            onSelect={setSelectedId}
            onSubmit={() => {
              if (selectedId) setAnswer({ kind: "choice", optionId: selectedId });
            }}
            onEstimate={(value) => setAnswer({ kind: "slider", value })}
            onRank={(placements) => setAnswer({ kind: "rank", placements })}
            onText={(body) => void sendText(body)}
            onBallot={(candidateId) => setBallot({ candidateId })}
            onDuel={(value) => setAnswer({ kind: "duel", value })}
          />
        </PhaseTransition>
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
        <Button variant="secondary" onClick={() => setPaused((value) => !value)}>
          {paused ? "Resume preview" : "Pause preview"}
        </Button>
      </PhoneShell>
    </ControllerRoot>
  );
}

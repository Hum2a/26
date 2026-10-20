import { useCallback, useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import type { LobbySnapshot } from "@26/shared";
import { PhaseTransition } from "../anim/PhaseTransition";
import { StagePlay } from "../play/stage-play";
import { SafeArea } from "../stage/SafeArea";
import { SkinMotif } from "../theme/skin-motif";
import { Wordmark } from "../theme/wordmark";
import { Button } from "../ui/primitives";
import { rehearsalPhase, rehearsalPlay } from "./question-rehearsal";
import { readQuestionPreview } from "./sections-api";
import { useSection } from "./use-section";
import "../stage/projector.css";
import "./phone-preview.css";

/** Authenticated projection only: no room, countdown, socket, scores or answer key. */
export function QuestionStagePreview() {
  const { version = "", questionId = "" } = useParams();
  const [params] = useSearchParams();
  const reader = useCallback(
    () => readQuestionPreview(version, questionId),
    [version, questionId],
  );
  const content = useSection(reader);
  const data = !content.loading && !content.error ? content.data : undefined;
  useEffect(() => {
    document.title = "Big-screen preview · 26";
  }, []);
  if (!data?.question)
    return (
      <div className="phone-preview-unavailable">
        <p className="entry-eyebrow">Big-screen preview</p>
        <h1>{content.loading ? "Loading the big screen…" : "Preview unavailable"}</h1>
        <p role="status">{content.error || data?.limitation}</p>
        {content.error ? (
          <Link
            className="entry-text-link"
            to={`/admin/login?returnTo=${encodeURIComponent(`/admin/stage-preview/${version}/${questionId}`)}`}
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
  const phase = rehearsalPhase(params.get("phase"), data.question);
  const snapshot = {
    phase,
    paused: false,
    held: !data.interactive,
    play: rehearsalPlay(data.question, phase),
  } as unknown as LobbySnapshot;
  return (
    <SafeArea dev={false}>
      <div className="skin-ground" aria-hidden="true">
        <SkinMotif />
      </div>
      <main className="stage-presentation" aria-label="Big-screen rehearsal">
        <header className="projector-top">
          <Wordmark />
          <p>Private rehearsal</p>
        </header>
        <PhaseTransition phase={`${questionId}/${phase}/${params.get("take")}`} stage>
          <StagePlay snapshot={snapshot} />
        </PhaseTransition>
        <p className="stage-rehearsal-notice">
          No live game is connected. Phone actions stay in the phone preview. Answers,
          countdowns and scores are not simulated.
          {data.limitation ? ` ${data.limitation}` : ""}
        </p>
      </main>
    </SafeArea>
  );
}

import { phaseLabel } from "../live/phase-label";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { RoomPhaseName } from "@26/shared";
import {
  Button,
  ConfirmDialog,
  Dialog,
  Disclosure,
  LinkButton,
} from "../ui/primitives";
import { usePhaseCountdown } from "../live/use-phase-countdown";
import { useAdminRoom, type AdminCommand } from "./room-provider";
import { CommandFeedback } from "./command-feedback";
import { WallQuickPanel } from "./wall-page";
import { RoomExtras } from "./room-extras";
import { KartCourseControls } from "./kart-course-controls";
import { KartTrackControls } from "./kart-track-controls";
import { KartDrivingFeel } from "./kart-driving-feel";
import { DangerZone } from "./danger-zone";

const revealPhases = new Set<RoomPhaseName>(["reveal", "scores", "final", "podium"]);
type Confirmation = {
  command: AdminCommand;
  title: string;
  detail: string;
  label: string;
  context: string;
};
export function LiveConsole() {
  const { snapshot, observedAt, connection, busy, execute, command } = useAdminRoom();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const locked = busy || connection !== "open" || command.retryable;
  const phase = snapshot.phase;
  const kartLobby = Boolean(snapshot.kartLobby);
  const playing = phase !== "lobby" && phase !== "podium";
  const canHide = revealPhases.has(phase);
  const context = `${phase}:${snapshot.play?.question.id ?? "lobby"}`;
  const countdown = usePhaseCountdown(snapshot, observedAt);
  // Players whose phones are connected now; absent or removed players do not count.
  const connectedPlayers =
    snapshot.adminPlayers?.filter((player) => player.connected && !player.removed)
      .length ?? snapshot.players.length;
  /** Starting is one-way, so every start asks first and says what will happen. */
  function askStart(action: "start-birthday" | "start-kart" | "start") {
    if (locked) return;
    const people = snapshot.players?.length ?? 0;
    const joined = `${people} ${people === 1 ? "player is" : "players are"} in.`;
    setConfirmation({
      command: { action },
      context,
      title:
        action === "start-birthday"
          ? "Start the birthday game?"
          : action === "start-kart"
            ? "Start the kart race?"
            : "Start the illustrative demo instead?",
      detail:
        action === "start-birthday"
          ? `${joined} The running order freezes now and every phone moves to the first question.`
          : action === "start-kart"
            ? `${joined} The starting grid freezes now. Anyone who joins later watches this race.`
            : `${joined} This plays the illustrative demo questions, not the birthday game. Use it only for a rehearsal.`,
      label:
        action === "start-birthday"
          ? "Start birthday game"
          : action === "start-kart"
            ? "Start kart race"
            : "Start the demo",
    });
  }
  function ask(action: "skip" | "finish") {
    if (locked) return;
    setConfirmation({
      command: { action },
      context,
      title:
        action === "skip"
          ? "Skip this question?"
          : phase === "facts"
            ? "Skip to the podium?"
            : phase === "final"
              ? kartLobby
                ? "Show the podium?"
                : "Finish the quiz?"
              : kartLobby
                ? "Finish after this race?"
                : "Finish after this question?",
      detail:
        action === "skip"
          ? "The server will skip the current question. Guests will move to the next step; this cannot be undone from this screen."
          : phase === "facts"
            ? "The remaining facts are skipped. The podium follows, and the archive starts after that."
            : phase === "final"
              ? "End the quiz and show the podium. Guests will see their final results."
              : "The current question will finish first. The server will then end the quiz instead of starting another question.",
      label:
        action === "skip"
          ? "Skip question"
          : phase === "facts"
            ? "Skip to the podium"
            : phase === "final"
              ? kartLobby
                ? "Show podium"
                : "Finish quiz"
              : kartLobby
                ? "Finish after this race"
                : "Finish after this question",
    });
  }
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (
        locked ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        confirmation ||
        document.querySelector("dialog[open], [role=dialog]:not([hidden])")
      )
        return;
      if (
        target instanceof HTMLElement &&
        (target.matches("input,textarea,select") || target.isContentEditable)
      )
        return;
      const key = event.key.toLowerCase();
      if (key === "s" && playing && phase !== "final" && phase !== "facts") {
        event.preventDefault();
        ask("skip");
      } else if (key === "f" && playing && !snapshot.finishAfterRound) {
        event.preventDefault();
        ask("finish");
      } else if (key === "arrowright" && phase === "final") {
        event.preventDefault();
        ask("finish");
      } else {
        const action =
          key === "n" && phase === "lobby"
            ? "reveal-names"
            : key === "p" && playing
              ? snapshot.paused
                ? "resume"
                : "pause"
              : key === "arrowright" && playing
                ? snapshot.paused
                  ? "resume"
                  : "advance"
                : key === "h" && canHide
                  ? snapshot.stageHidden
                    ? "show"
                    : "hide"
                  : key === "r" && canHide
                    ? "rereveal"
                    : null;
        if (action) {
          event.preventDefault();
          void execute({ action }, action === "advance" ? "Advance" : "Update room");
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const onLastFact =
    phase === "facts" &&
    snapshot.funFactList != null &&
    snapshot.funFactList.index + 1 >= snapshot.funFactList.total;
  const primary =
    phase === "lobby"
      ? "start"
      : snapshot.paused
        ? "resume"
        : phase === "final"
          ? "finish"
          : "advance";
  const primaryLabel =
    primary === "start"
      ? "Start the illustrative demo instead"
      : primary === "resume"
        ? "Resume"
        : primary === "finish"
          ? kartLobby
            ? "Show podium"
            : "Finish quiz"
          : phase === "facts"
            ? onLastFact
              ? "Show the podium"
              : "Next fact"
            : "Advance";
  const shownFact =
    phase === "facts"
      ? snapshot.funFactList?.cards[snapshot.funFactList.index]
      : undefined;
  const upcomingFact =
    phase === "facts" && snapshot.funFactList
      ? snapshot.funFactList.cards[snapshot.funFactList.index + 1]
      : undefined;
  return (
    <section className="admin-section live-console">
      <header className="admin-page-heading">
        <div>
          <p className="entry-eyebrow">Tonight</p>
          <h1>Live controls</h1>
        </div>
        <Link className="entry-text-link" to="../players">
          Manage players →
        </Link>
      </header>
      <CommandFeedback scope="live" />
      {connection !== "open" ? (
        <p role="status" className="admin-inline-warning">
          Reconnecting. Controls are unavailable until the room is connected.
        </p>
      ) : (
        <p className="admin-connection">Connected to the room.</p>
      )}
      {kartLobby ? (
        <section className="admin-current" aria-label="Kart lobby details">
          <h2>Kart-only lobby</h2>
          <p>
            One lap · up to 80 racers. The saved course and time limit are shown below.
          </p>
          <p>
            Created {new Date(snapshot.kartLobby!.createdAt).toLocaleString("en-GB")}.
            The starting grid freezes when you start. Late arrivals watch this race;
            create a fresh kart lobby for another race.
          </p>
        </section>
      ) : null}
      <KartDrivingFeel />
      <KartTrackControls />
      <div className="admin-live-actions" aria-label="Live actions">
        {phase === "lobby" ? (
          <Button
            disabled={locked}
            onClick={() => askStart(kartLobby ? "start-kart" : "start-birthday")}
          >
            {kartLobby ? "Start kart race" : "Start birthday game"}
          </Button>
        ) : null}
        {import.meta.env.DEV && phase === "lobby" && !kartLobby ? (
          <Button
            variant="secondary"
            disabled={locked}
            onClick={() =>
              void execute(
                { action: "start-kart-rehearsal" },
                "Start local kart rehearsal",
              )
            }
          >
            Start local kart rehearsal
          </Button>
        ) : null}
        {phase !== "podium" && !(kartLobby && phase === "lobby") ? (
          <Button
            variant={primary === "start" ? "secondary" : "primary"}
            disabled={locked}
            onClick={() =>
              primary === "finish"
                ? ask("finish")
                : primary === "start"
                  ? askStart("start")
                  : void execute({ action: primary }, primaryLabel)
            }
          >
            {primaryLabel}
          </Button>
        ) : phase === "podium" ? (
          <p>{kartLobby ? "The race is complete." : "The quiz is complete."}</p>
        ) : null}
        {playing && !snapshot.paused ? (
          <Button
            variant="secondary"
            disabled={locked}
            onClick={() => void execute({ action: "pause" }, "Pause")}
          >
            Pause
          </Button>
        ) : null}
        {phase === "lobby" && !kartLobby ? (
          <Button
            variant="secondary"
            disabled={locked}
            onClick={() =>
              void execute({ action: "reveal-names" }, "Reveal nickname votes")
            }
          >
            Reveal nickname votes
          </Button>
        ) : null}
        {canHide ? (
          <Button
            variant="secondary"
            disabled={locked}
            onClick={() =>
              void execute(
                { action: snapshot.stageHidden ? "show" : "hide" },
                "Update stage visibility",
              )
            }
          >
            {snapshot.stageHidden ? "Show stage content" : "Hide stage content"}
          </Button>
        ) : null}
        <Disclosure title="More controls">
          <div className="admin-actions">
            {playing && phase !== "final" && phase !== "facts" ? (
              <Button variant="secondary" disabled={locked} onClick={() => ask("skip")}>
                Skip question
              </Button>
            ) : null}
            {playing &&
            phase !== "final" &&
            phase !== "facts" &&
            !snapshot.finishAfterRound ? (
              <Button
                variant="secondary"
                disabled={locked}
                onClick={() => ask("finish")}
              >
                Finish after this question
              </Button>
            ) : null}
            {canHide ? (
              <Button
                variant="secondary"
                disabled={locked}
                onClick={() =>
                  void execute({ action: "rereveal" }, "Show the reveal again")
                }
              >
                Show the reveal again
              </Button>
            ) : null}
            {!playing && !canHide ? (
              <p>Skip and finish controls appear once the quiz starts.</p>
            ) : null}
            <Dialog
              title="Keyboard shortcuts"
              triggerLabel="Keyboard shortcuts"
              triggerVariant="secondary"
            >
              <p>
                N: reveal names in the lobby. P: pause or resume. Right arrow: advance.
                S: review a skip. F: review finishing. H: hide/show a reveal. R: show it
                again. Shortcuts pause while typing or while a dialog is open.
              </p>
            </Dialog>
          </div>
        </Disclosure>
      </div>
      <div className="admin-live-grid">
        <div className="admin-live-main">
          <section className="admin-round" aria-label="Current question">
            <div className="admin-round-top">
              <p className="entry-eyebrow">
                {phaseLabel(phase)}
                {snapshot.paused ? " · paused" : ""}
                {snapshot.held ? " · waiting for control" : ""}
              </p>
              {countdown ? (
                <p className="admin-phase-clock" aria-label={countdown.label}>
                  {countdown.value}
                </p>
              ) : null}
            </div>
            <h2>
              {shownFact?.text ??
                snapshot.play?.question.prompt ??
                (phase === "lobby"
                  ? "Gather the guests."
                  : "The room is between questions.")}
            </h2>
            {upcomingFact ? <p>Next: {upcomingFact.text}</p> : null}
            {snapshot.play && phase !== "facts" ? (
              <p className="admin-next-up">
                Round {snapshot.play.question.index} of {snapshot.play.question.total}
                {snapshot.nextQuestion
                  ? ` · Next: ${snapshot.nextQuestion.title}`
                  : snapshot.play.question.index >= snapshot.play.question.total
                    ? " · Last round"
                    : ""}
              </p>
            ) : null}
            {phase === "facts" && snapshot.funFactList && !upcomingFact ? (
              <p>Next: the podium.</p>
            ) : null}
            <p>
              {snapshot.play
                ? `${snapshot.play.submissionCount} of ${connectedPlayers} connected players answered · ${snapshot.players.length} in the room`
                : `${snapshot.players.length} guests in the lobby. Share the join code, then start when you are ready.`}
            </p>
            {snapshot.play?.presenterNotes ? (
              <div className="admin-private-notes">
                <h3>Presenter notes · private</h3>
                <p>{snapshot.play.presenterNotes}</p>
              </div>
            ) : null}
            {snapshot.finishAfterRound && phase !== "podium" ? (
              <p className="admin-inline-warning">
                The quiz will finish after this question.
              </p>
            ) : null}
            {snapshot.play?.explanation ? <p>{snapshot.play.explanation}</p> : null}
          </section>
          <LiveResponses locked={locked} />
          <WallQuickPanel />
          <KartCourseControls />
          {snapshot.hostEffects?.length || snapshot.trolls.announcement ? (
            <section className="admin-task-section">
              <h2>On the screens now</h2>
              {snapshot.hostEffects?.map((effect) => (
                <div className="admin-response-row" key={effect.effectId}>
                  <p>
                    {effect.label} on {effect.targetNickname}
                  </p>
                  <Button
                    variant="secondary"
                    disabled={locked}
                    onClick={() =>
                      void execute(
                        { action: "cancel-effect", effectId: effect.effectId },
                        `Cancel ${effect.label}`,
                      )
                    }
                  >
                    Cancel {effect.label}
                  </Button>
                </div>
              ))}
              {snapshot.trolls.announcement ? (
                <Button
                  variant="secondary"
                  disabled={locked}
                  onClick={() =>
                    void execute({ action: "dismiss-cue" }, "Dismiss announcement")
                  }
                >
                  Dismiss announcement
                </Button>
              ) : null}
            </section>
          ) : null}
          {snapshot.media.length ? (
            <section className="admin-task-section">
              <h2>Accepted media · quick moderation</h2>
              {snapshot.media.map((item) => (
                <div key={item.mediaId} className="admin-response-row">
                  <p>
                    {item.kind} from {item.nickname}
                    {item.hidden ? " · hidden" : ""}
                  </p>
                  <Button
                    variant="secondary"
                    disabled={locked || item.hidden}
                    onClick={() =>
                      void execute(
                        { action: "hide-media", mediaId: item.mediaId },
                        `Hide ${item.kind}`,
                      )
                    }
                  >
                    Hide {item.kind} from {item.nickname}
                  </Button>
                </div>
              ))}
            </section>
          ) : null}
          <RoomExtras />
        </div>
        <aside className="admin-live-side" aria-label="Room context">
          <p className="entry-eyebrow">Guests join with</p>
          <p className="admin-side-code">{snapshot.joinCode}</p>
          <dl>
            <div>
              <dt>Phones connected</dt>
              <dd>{snapshot.connections?.guests ?? "Unavailable"}</dd>
            </div>
            <div>
              <dt>Stage connection</dt>
              <dd>
                {snapshot.connections
                  ? snapshot.connections.stage
                    ? "Connected"
                    : "No stage connected"
                  : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Stage content</dt>
              <dd>{snapshot.stageHidden ? "Hidden" : "Visible"}</dd>
            </div>
          </dl>
          <a
            className="entry-text-link"
            href={`/host?code=${snapshot.joinCode}`}
            target="_blank"
            rel="noreferrer"
          >
            Open the stage ↗
          </a>
          <LinkButton variant="secondary" to="../players">
            Players ({snapshot.players.length})
          </LinkButton>
          <Link className="entry-text-link" to="..">
            Room overview
          </Link>
        </aside>
      </div>
      <DangerZone />
      <ConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation?.title ?? "Review action"}
        confirmLabel={confirmation?.label ?? "Confirm"}
        disabled={locked || confirmation?.context !== context}
        onClose={() => setConfirmation(null)}
        onConfirm={() => {
          if (confirmation && confirmation.context === context && !locked) {
            void execute(confirmation.command, confirmation.label);
            setConfirmation(null);
          }
        }}
      >
        <p>{confirmation?.detail}</p>
        {confirmation && confirmation.context !== context ? (
          <p>
            The room has moved on. Close this dialog and review the current question.
          </p>
        ) : null}
      </ConfirmDialog>
    </section>
  );
}

/**
 * Where the room accepts hide/restore for written answers (shortlists keep
 * their own Include/Remove): an all-answer ballot while answers are collected
 * or voted on (a bracket only before voting), and a commonness question, the
 * typed format that shows answers in public. The room checks again.
 */
function answerModeration(
  play: ReturnType<typeof useAdminRoom>["snapshot"]["play"],
  phase: string,
): "ballot" | "reveal" | null {
  if (play?.question.kind === "vote" && play.question.candidateMode === "all") {
    if (phase === "collect") return "ballot";
    if (phase === "vote" && !play.question.flow) return "ballot";
    return null;
  }
  if (
    play?.question.kind === "typed" &&
    play.question.scoring === "commonness" &&
    (phase === "collect" || phase === "reveal" || phase === "scores")
  ) {
    return "reveal";
  }
  return null;
}

function LiveResponses({ locked }: { locked: boolean }) {
  const { snapshot, execute } = useAdminRoom();
  const play = snapshot.play;
  const shortlist =
    play?.question.kind === "vote" && play.question.candidateMode === "shortlist";
  const moderation = answerModeration(play, snapshot.phase);
  const choices = play?.question.kind === "choice" ? play.question.options : [];
  return (
    <section className="admin-task-section">
      <h2>Responses on this question</h2>
      {moderation ? (
        <p className="text-sm">
          Hide an answer to take it off guests' phones and the stage. Answers with the
          same text are hidden together, and nothing is deleted.
          {moderation === "ballot"
            ? " Votes already cast for it stop counting until you restore it."
            : ""}
        </p>
      ) : null}
      {play?.hostResponses?.length ? (
        <ul>
          {play.hostResponses.map((row) => (
            <li className="admin-response-row" key={row.playerId}>
              <p>
                <strong>{row.nickname}</strong>
                <br />
                {row.summary}
                {row.included === false
                  ? shortlist
                    ? " (not on the ballot)"
                    : " (hidden from guests and the stage)"
                  : ""}
                {row.votes !== undefined ? ` · ${row.votes} votes` : ""}
              </p>
              <div className="admin-actions">
                {moderation && row.included !== undefined ? (
                  <Button
                    variant="secondary"
                    disabled={locked}
                    onClick={() =>
                      void execute(
                        {
                          action: row.included ? "exclude" : "include",
                          playerId: row.playerId,
                        },
                        row.included ? "Hide answer" : "Restore answer",
                      )
                    }
                  >
                    {row.included
                      ? `Hide ${row.nickname}'s answer`
                      : `Restore ${row.nickname}'s answer`}
                  </Button>
                ) : null}
                {shortlist && snapshot.phase === "collect" ? (
                  <Button
                    variant="secondary"
                    disabled={locked}
                    onClick={() =>
                      void execute(
                        {
                          action: row.included ? "exclude" : "include",
                          playerId: row.playerId,
                        },
                        "Update ballot",
                      )
                    }
                  >
                    {row.included
                      ? `Remove ${row.nickname}`
                      : `Include ${row.nickname}`}
                  </Button>
                ) : null}
                {row.candidateId &&
                ["vote", "reveal", "scores"].includes(snapshot.phase) ? (
                  <Button
                    variant="secondary"
                    disabled={locked}
                    onClick={() =>
                      void execute(
                        { action: "feature", candidateId: row.candidateId },
                        "Feature on stage",
                      )
                    }
                  >
                    Feature on the stage
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : play?.hostAnswers?.length ? (
        <ul>
          {play.hostAnswers.map((row) => (
            <li className="admin-response-row" key={row.playerId}>
              <p>
                <strong>{row.nickname}</strong> ·{" "}
                {choices.find((option) => option.id === row.optionId)?.label ??
                  row.optionId}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          {play
            ? "No responses to show yet."
            : "Responses appear here during a question."}
        </p>
      )}
    </section>
  );
}

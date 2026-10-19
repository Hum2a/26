import "../results/results.css";
import { useCallback, useState } from "react";
import { Link } from "react-router";
import { publicResultsSchema } from "@26/shared";
import { Button, ConfirmDialog } from "../ui/primitives";
import { EntryNotice } from "../ui/entry-frame";
import { downloadScoreSummary } from "../live/room-api";
import { StandingsList } from "../results/results-report";
import { useAdminRoom } from "./room-provider";
import { useSection } from "./use-section";
import { readSection } from "./sections-api";
import { CommandFeedback } from "./command-feedback";

export function AdminResultsPage() {
  const { snapshot, connection, command, busy, execute } = useAdminRoom();
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState("");
  const [review, setReview] = useState(false);
  const read = useCallback(
    () => readSection(`/api/rooms/${snapshot.gameId}/results`, publicResultsSchema),
    [snapshot.gameId],
  );
  const result = useSection(
    read,
    `${snapshot.archive?.revision}:${snapshot.archive?.status}`,
  );
  const locked = busy || connection !== "open" || command.retryable;
  async function download() {
    setDownloading(true);
    try {
      const failure = await downloadScoreSummary(snapshot.gameId);
      setMessage(failure?.error ?? "The score summary downloaded.");
    } catch {
      setMessage("The score summary is unavailable. Try again.");
    } finally {
      setDownloading(false);
    }
  }
  const standings =
    result.data?.state === "ready"
      ? result.data.standings
      : snapshot.play?.standings?.map((row) => ({
          position: row.place,
          nickname: row.nickname,
          points: row.points,
        }));
  return (
    <section className="admin-section">
      <header className="admin-page-heading">
        <div>
          <p className="entry-eyebrow">The event report</p>
          <h1>Results & exports</h1>
        </div>
        <Button
          variant="secondary"
          disabled={result.loading}
          onClick={() => void result.refresh()}
        >
          Refresh results
        </Button>
      </header>
      <CommandFeedback scope="results" />
      <EntryNotice message={result.error || message} />
      <div className="admin-report-grid">
        <div>
          <section className="admin-task-section">
            <h2>
              {snapshot.phase === "podium" ? "Final standings" : "Current scores"}
            </h2>
            {standings ? (
              <StandingsList standings={standings} />
            ) : snapshot.adminPlayers?.length ? (
              <>
                <p>Live totals. Final positions appear when the game finishes.</p>
                <ul className="results-standings">
                  {snapshot.adminPlayers.map((player) => (
                    <li key={player.playerId}>
                      <span>
                        {player.nickname}
                        {player.removed ? " · removed" : ""}
                      </span>
                      <strong>{player.points} points</strong>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>No player scores are available yet.</p>
            )}
          </section>
          <section className="admin-task-section">
            <h2>Highlights</h2>
            {snapshot.highlights?.length ? (
              <ul className="results-highlights">
                {snapshot.highlights.map((card) => (
                  <li key={card.id}>{card.results}</li>
                ))}
              </ul>
            ) : (
              <p>Comparison cards appear when the room has enough accepted answers.</p>
            )}
          </section>
        </div>
        <aside className="admin-report-aside">
          <h2>Archive & sharing</h2>
          <p>
            {snapshot.phase !== "podium"
              ? "The quiz is still running. The final archive follows the podium."
              : snapshot.archive?.status === "completed"
                ? "The archive export is complete."
                : snapshot.archive?.status === "failed"
                  ? "The archive export failed. Live final standings remain available."
                  : "The archive export is preparing. The podium remains available."}
          </p>
          {snapshot.archive?.status === "failed" ? (
            <Button
              variant="secondary"
              disabled={locked}
              onClick={() => setReview(true)}
            >
              Retry archive export
            </Button>
          ) : null}
          <Link
            className="entry-text-link"
            to={`/r/${snapshot.gameId}`}
            target="_blank"
          >
            Open public results ↗
          </Link>
          <p>
            {result.data?.state === "ready"
              ? "The public report is ready."
              : "The public report may still be preparing. Refresh to check again."}
          </p>
          <Button
            variant="secondary"
            disabled={locked || downloading}
            onClick={() => void download()}
          >
            {downloading ? "Downloading…" : "Download score summary"}
          </Button>
          <Link className="entry-text-link" to="../health">
            Email delivery & export health →
          </Link>
          <p>
            Personal results and delivery information stay separate from the public
            report.
          </p>
        </aside>
      </div>
      <ConfirmDialog
        open={review}
        title="Retry archive export?"
        confirmLabel="Retry archive export"
        disabled={locked || snapshot.archive?.status !== "failed"}
        onClose={() => setReview(false)}
        onConfirm={() => {
          if (!locked && snapshot.archive?.status === "failed") {
            void execute(
              { action: "retry-archive" },
              "Retry archive export",
              "results",
            );
            setReview(false);
          }
        }}
      >
        <p>
          Retry the failed export using the existing archive record. The podium remains
          available.
        </p>
      </ConfirmDialog>
    </section>
  );
}

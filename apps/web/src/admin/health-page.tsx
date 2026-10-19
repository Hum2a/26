import { useCallback, useState } from "react";
import { Link } from "react-router";
import { roomDiagnosticsSchema, type RoomDiagnostics } from "@26/shared";
import { Button, ConfirmDialog } from "../ui/primitives";
import { EntryNotice } from "../ui/entry-frame";
import { useSection } from "./use-section";
import { readSection } from "./sections-api";
import { useAdminRoom, type AdminCommand } from "./room-provider";
import { CommandFeedback } from "./command-feedback";

export function HealthPage() {
  const { snapshot, execute, connection, busy, command } = useAdminRoom();
  const [review, setReview] = useState<{
    action: AdminCommand;
    title: string;
    detail: string;
  } | null>(null);
  const read = useCallback(
    () =>
      readSection(`/api/rooms/${snapshot.gameId}/diagnostics`, roomDiagnosticsSchema),
    [snapshot.gameId],
  );
  const report = useSection<RoomDiagnostics>(read);
  const data = report.data;
  const locked =
    busy ||
    connection !== "open" ||
    command.retryable ||
    report.loading ||
    Boolean(report.error);
  return (
    <section className="admin-section">
      <header className="admin-page-heading">
        <div>
          <p className="entry-eyebrow">Private operations</p>
          <h1>Room health</h1>
        </div>
        <Button
          variant="secondary"
          disabled={report.loading}
          onClick={() => void report.refresh()}
        >
          Refresh room health
        </Button>
      </header>
      <p>
        Connections update live. Processing, archive and email counts are from the last
        successful check.
      </p>
      <CommandFeedback scope="health" />
      <EntryNotice message={report.error} />
      <p role="status">
        {report.loading
          ? "Checking room health…"
          : report.checkedAt
            ? `Last checked ${new Date(report.checkedAt).toLocaleTimeString("en-GB")}.${report.error ? " These details may be out of date." : ""}`
            : "Health information is unavailable."}
      </p>
      <section className="admin-task-section">
        <h2>Live connections</h2>
        <p>
          {connection === "open"
            ? "Connected"
            : "Reconnecting · live counts may be out of date"}
        </p>
        <div className="admin-facts">
          {["guests", "stage", "control"].map((role) => (
            <div key={role}>
              <span>
                {role === "guests" ? "Phones" : role === "stage" ? "Stage" : "Control"}
              </span>
              <strong>
                {snapshot.connections?.[
                  role as keyof NonNullable<typeof snapshot.connections>
                ] ?? "Unavailable"}
              </strong>
            </div>
          ))}
        </div>
      </section>
      {data ? (
        <div className="admin-operations-grid">
          <section className="admin-task-section">
            <h2>Scheduler</h2>
            <p>
              {data.scheduler.pending} pending · {data.scheduler.failed} failed
            </p>
            <p>
              {data.scheduler.alarmAt
                ? `Next alarm ${new Date(data.scheduler.alarmAt).toLocaleString("en-GB")}.`
                : "No alarm is armed."}
            </p>
            <ul>
              {data.scheduler.jobs.map((job, index) => (
                <li key={index}>
                  {job.jobType} · {job.status} · {job.retryCount} retries
                  {job.dueAt
                    ? ` · due ${new Date(job.dueAt).toLocaleTimeString("en-GB")}`
                    : ""}
                </li>
              ))}
            </ul>
          </section>
          <section className="admin-task-section">
            <h2>Media processing</h2>
            <p>
              {data.media.accepted} accepted · {data.media.leased} checking ·{" "}
              {data.media.staged} prepared · {data.media.rejected} rejected
            </p>
            <p>
              {data.media.open} open · {data.media.expired} expired ·{" "}
              {data.media.cancelled} cancelled
            </p>
            <ul>
              {data.media.attention.map((item, index) => (
                <li key={index}>
                  {item.nickname} · {item.status}: {item.failure}
                </li>
              ))}
            </ul>
            <Link to="../media" className="entry-text-link">
              Review accepted media →
            </Link>
            {data.media.leased + data.media.staged > 0 ? (
              <Button
                variant="secondary"
                disabled={locked}
                onClick={() =>
                  setReview({
                    action: { action: "release-stuck-media" },
                    title: "Release stuck media?",
                    detail:
                      "The server releases expired processing leases only. Guests must send those files again. Active checks are left alone.",
                  })
                }
              >
                Release stuck media
              </Button>
            ) : null}
          </section>
          <section className="admin-task-section">
            <h2>Archive export</h2>
            {data.archive ? (
              <>
                <p>
                  {data.archive.status} · target revision {data.archive.targetRevision}{" "}
                  · verified {data.archive.verifiedRevision ?? "Not yet"} ·{" "}
                  {data.archive.attempts} attempts
                </p>
                {data.archive.lastError ? <p>{data.archive.lastError}</p> : null}
                {data.archive.status === "failed" ? (
                  <Button
                    variant="secondary"
                    disabled={locked}
                    onClick={() =>
                      setReview({
                        action: { action: "retry-archive" },
                        title: "Retry archive export?",
                        detail:
                          "Ask the server to retry the failed export. The podium remains available while it runs.",
                      })
                    }
                  >
                    Retry archive export
                  </Button>
                ) : null}
              </>
            ) : (
              <p>No archive export has been scheduled. The quiz must finish first.</p>
            )}
            <Link to="../results" className="entry-text-link">
              Results and exports →
            </Link>
          </section>
          <section className="admin-task-section">
            <h2>Email delivery</h2>
            {data.delivery.available ? (
              <>
                <p>
                  {data.delivery.pending} pending · {data.delivery.uncertain} uncertain
                  · {data.delivery.failed} failed · {data.delivery.sent} sent
                </p>
                {data.delivery.pending +
                  data.delivery.failed +
                  data.delivery.uncertain >
                0 ? (
                  <Button
                    variant="secondary"
                    disabled={locked}
                    onClick={() =>
                      setReview({
                        action: { action: "retry-delivery" },
                        title: "Retry email jobs?",
                        detail:
                          "Retry eligible waiting jobs using their existing delivery records. An uncertain provider response cannot guarantee delivery; no new recipient is created.",
                      })
                    }
                  >
                    Retry email jobs
                  </Button>
                ) : (
                  <p>No email jobs need a retry.</p>
                )}
              </>
            ) : (
              <p>Email job counts are unavailable. Refresh to check again.</p>
            )}
            {data.delivery.testRecipient ? (
              <p>Test delivery is limited to the configured recipient.</p>
            ) : null}
          </section>
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(review)}
        title={review?.title ?? "Review recovery"}
        confirmLabel="Confirm recovery action"
        disabled={locked}
        onClose={() => setReview(null)}
        onConfirm={() => {
          if (review && !locked) {
            void execute(review.action, review.title.replace("?", ""), "health").then(
              () => report.refresh(),
            );
            setReview(null);
          }
        }}
      >
        <p>{review?.detail}</p>
      </ConfirmDialog>
    </section>
  );
}

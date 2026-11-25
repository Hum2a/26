import "./analytics-explorer.css";
import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { AnalyticsAnswer, RoomAnalytics } from "@26/shared";
import { Button } from "../ui/primitives";
import {
  ArchiveMetrics,
  ChoiceDistribution,
  Facts,
  Metric,
  NumericSummary,
  QuestionTrends,
} from "./analytics-insights";

type Question = RoomAnalytics["questions"][number];
type Guest = RoomAnalytics["players"][number];
type Score = RoomAnalytics["scores"][number];
type DetailRow = {
  id: string;
  name: string;
  answers: AnalyticsAnswer[];
  score?: Score;
  empty?: string;
};
const gbDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  dateStyle: "medium",
  timeStyle: "medium",
});

export function AnalyticsExplorer({
  data,
  rehearsal = false,
  eventReport,
}: {
  data: RoomAnalytics;
  rehearsal?: boolean;
  eventReport?: ReactNode;
}) {
  const [view, setView] = useState<"Questions" | "Guests" | "Room">("Questions");
  const [questionId, setQuestionId] = useState("");
  const [guestId, setGuestId] = useState("");
  const reduced = useReducedMotion();
  const question =
    data.questions.find((item) => item.id === questionId) ??
    data.questions.find((item) => item.state !== "no-records") ??
    data.questions[0];
  const guest = data.players.find((item) => item.id === guestId) ?? data.players[0];
  const answered = new Set(data.answers.map((answer) => answer.questionId));
  return (
    <section
      className="admin-task-section analytics-explorer"
      aria-label="Response explorer"
    >
      <div className="admin-page-heading">
        <h2>{rehearsal ? "Sample response explorer" : "Response explorer"}</h2>
        {!rehearsal && (
          <Button variant="secondary" onClick={() => download(data)}>
            Download room JSON
          </Button>
        )}
      </div>
      <dl className="analytics-totals">
        <Metric name="Guests" value={data.players.length} />
        <Metric name="Questions with responses" value={answered.size} />
        <Metric name="Response records" value={data.answers.length} />
        <Metric name="Score records" value={data.scores.length} />
      </dl>
      {!data.questionScriptAvailable && data.questions.length > 0 && (
        <p>
          The original question script is unavailable. Records are listed under their
          stored question IDs.
        </p>
      )}
      <nav className="analytics-toolbar" aria-label="Explore room by">
        {(["Questions", "Guests", "Room"] as const).map((name) => (
          <Button
            key={name}
            variant={view === name ? "primary" : "secondary"}
            aria-pressed={view === name}
            onClick={() => setView(name)}
          >
            {name}
          </Button>
        ))}
      </nav>
      <motion.div
        key={view}
        className="analytics-view"
        initial={{ opacity: 0, y: reduced ? 0 : 3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
      >
        {view === "Questions" &&
          (question ? (
            <>
              <label className="analytics-field">
                Question
                <select
                  value={question.id}
                  onChange={(event) => setQuestionId(event.target.value)}
                >
                  {data.questions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.position === null ? "" : `${item.position}. `}
                      {item.title}
                      {item.state === "no-records" ? " (no records)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <QuestionView
                key={question.id}
                data={data}
                question={question}
                rehearsal={rehearsal}
                openGuest={(id) => {
                  setGuestId(id);
                  setView("Guests");
                }}
              />
            </>
          ) : (
            <p>Questions will appear when this room starts a game.</p>
          ))}
        {view === "Guests" &&
          (guest ? (
            <>
              <label className="analytics-field">
                Guest
                <select
                  value={guest.id}
                  onChange={(event) => setGuestId(event.target.value)}
                >
                  {data.players.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nickname}
                      {item.removedAt ? " (removed)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <GuestView
                key={guest.id}
                data={data}
                guest={guest}
                openQuestion={(id) => {
                  setQuestionId(id);
                  setView("Questions");
                }}
              />
            </>
          ) : (
            <p>No guests have joined this room.</p>
          ))}
        {view === "Room" && (
          <>
            <dl className="admin-room-facts">
              <Metric name="Game" value={data.gameId} />
              <Metric name="Created" value={displayDate(data.createdAt)} />
              <Metric name="Question set" value={data.questionSetVersion} />
              <Metric name="Scoring version" value={data.scoringVersion} />
              <Metric name="Room revision" value={data.revision} />
            </dl>
            {eventReport}
            <Facts facts={data.facts.filter((fact) => fact.scope === "game")} />
            {!rehearsal && <ArchiveMetrics data={data} />}
          </>
        )}
      </motion.div>
    </section>
  );
}

function QuestionView({
  data,
  question,
  rehearsal,
  openGuest,
}: {
  data: RoomAnalytics;
  question: Question;
  rehearsal: boolean;
  openGuest: (id: string) => void;
}) {
  const answers = data.answers.filter((row) => row.questionId === question.id);
  const byGuest = groupAnswers(answers, "playerId");
  const scores = new Map(
    data.scores
      .filter((row) => row.questionId === question.id)
      .map((score) => [score.playerId, score]),
  );
  const rows = data.players.map((guest) => ({
    id: guest.id,
    name: guest.removedAt ? `${guest.nickname} (removed)` : guest.nickname,
    answers: byGuest.get(guest.id) ?? [],
    score: scores.get(guest.id),
  }));
  return (
    <>
      <header>
        <h3>{question.prompt ?? question.title}</h3>
        <p>
          {byGuest.size} guests with records · {answers.length} response records ·{" "}
          {scores.size} scored
        </p>
      </header>
      {question.state === "no-records" ? (
        <p>This question has no retained response or score records.</p>
      ) : (
        <>
          <ChoiceDistribution question={question} answers={answers} />
          <NumericSummary question={question} answers={answers} />
          <DetailTable
            label="Guest responses"
            subject="Guest"
            rows={rows}
            open={openGuest}
          />
          {!rehearsal && (
            <QuestionTrends
              gameId={data.gameId}
              questionId={question.id}
              revision={data.revision}
            />
          )}
          <Facts
            facts={data.facts.filter(
              (fact) => fact.scope === "question" && fact.scopeId === question.id,
            )}
          />
        </>
      )}
    </>
  );
}

function GuestView({
  data,
  guest,
  openQuestion,
}: {
  data: RoomAnalytics;
  guest: Guest;
  openQuestion: (id: string) => void;
}) {
  const byQuestion = groupAnswers(
    data.answers.filter((row) => row.playerId === guest.id),
    "questionId",
  );
  const scores = data.scores.filter((row) => row.playerId === guest.id);
  const byScore = new Map(scores.map((score) => [score.questionId, score]));
  const adjustments = data.adjustments.filter((row) => row.playerId === guest.id);
  const earned = scores.reduce((sum, row) => sum + row.points, 0);
  const adjusted = adjustments.reduce((sum, row) => sum + row.points, 0);
  return (
    <>
      <header>
        <h3>
          {guest.nickname}
          {guest.removedAt ? " · Removed" : ""}
        </h3>
      </header>
      <dl className="admin-room-facts">
        <Metric name="Joined" value={displayDate(guest.joinedAt)} />
        {guest.removedAt && (
          <Metric name="Removed" value={displayDate(guest.removedAt)} />
        )}
        <Metric name="Questions with records" value={byQuestion.size} />
        <Metric name="Question points" value={earned} />
        <Metric name="Adjustments" value={adjusted} />
        <Metric name="Total points" value={earned + adjusted} />
      </dl>
      <DetailTable
        label="Responses by question"
        subject="Question"
        open={openQuestion}
        rows={data.questions.map((item) => ({
          id: item.id,
          name: item.prompt ?? item.title,
          answers: byQuestion.get(item.id) ?? [],
          score: byScore.get(item.id),
          empty: item.state === "no-records" ? "No round records" : undefined,
        }))}
      />
      {adjustments.length > 0 && (
        <section>
          <h4>Score adjustments</h4>
          <ul className="admin-data-list">
            {adjustments.map((row) => (
              <li className="admin-data-row" key={row.id}>
                <span>
                  {row.points > 0 ? "+" : ""}
                  {row.points} points · {row.reason}
                </span>
                <time dateTime={new Date(row.at).toISOString()}>
                  {displayDate(row.at)}
                </time>
              </li>
            ))}
          </ul>
        </section>
      )}
      {guest.connection && (
        <details>
          <summary>Connection and upload metrics</summary>
          <dl className="admin-room-facts">
            <Metric name="Socket opens" value={guest.connection.opens} />
            <Metric name="Reconnects" value={guest.connection.reconnects} />
            <Metric name="Latency samples" value={guest.connection.samples} />
            <Metric name="Median round trip" value={ms(guest.connection.medianMs)} />
            <Metric name="Upper round trip" value={ms(guest.connection.upperMs)} />
            <Metric
              name="Submission retries"
              value={guest.connection.submissionRetries}
            />
            <Metric name="Upload attempts" value={guest.connection.uploadAttempts} />
            <Metric name="Upload failures" value={guest.connection.uploadFailures} />
            <Metric
              name="Measured upload time"
              value={ms(guest.connection.uploadDurationMs)}
            />
            <Metric
              name="Upload duration samples"
              value={guest.connection.uploadDurationCount}
            />
          </dl>
        </details>
      )}
      <Facts
        facts={data.facts.filter(
          (fact) => fact.scope === "player" && fact.scopeId === guest.id,
        )}
      />
    </>
  );
}

function DetailTable({
  label,
  subject,
  rows,
  open,
}: {
  label: string;
  subject: string;
  rows: DetailRow[];
  open: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const query = search.trim().toLocaleLowerCase("en-GB");
  const filtered = rows.filter(
    (row) =>
      (status === "all" ||
        (status === "recorded" ? row.answers.length > 0 : row.answers.length === 0)) &&
      [row.name, row.score?.detail, ...row.answers.map((answer) => answer.label)].some(
        (text) => text?.toLocaleLowerCase("en-GB").includes(query),
      ),
  );
  return (
    <section className="analytics-table-section">
      <div className="analytics-toolbar">
        <label className="analytics-field">
          Search responses
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="analytics-field">
          Response status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All</option>
            <option value="recorded">Response recorded</option>
            <option value="missing">No response recorded</option>
          </select>
        </label>
      </div>
      <p role="status">
        {filtered.length} of {rows.length} rows
      </p>
      {filtered.length > 0 && (
        <div
          className="analytics-table-scroll"
          tabIndex={0}
          role="region"
          aria-label={`${label} table`}
        >
          <table className="analytics-table">
            <caption className="sr-only">{label}</caption>
            <thead>
              <tr>
                <th scope="col">{subject}</th>
                <th scope="col">Recorded response</th>
                <th scope="col">Points & scoring</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <th scope="row">
                    <button
                      className="entry-text-link analytics-jump"
                      onClick={() => open(row.id)}
                    >
                      {row.name}
                    </button>
                  </th>
                  <td>
                    {row.answers.length ? (
                      <ul className="analytics-answer-list">
                        {row.answers.map((answer, index) => (
                          <li key={`${answer.kind}:${answer.receivedAt}:${index}`}>
                            <AnswerRecord answer={answer} />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted">
                        {row.empty ?? "No response recorded"}
                      </span>
                    )}
                  </td>
                  <td>
                    {row.score ? (
                      <>
                        <strong>{row.score.points} points</strong>
                        <br />
                        {row.score.detail}
                        <br />
                        <time
                          className="text-muted"
                          dateTime={new Date(row.score.at).toISOString()}
                        >
                          {displayDate(row.score.at)}
                        </time>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AnswerRecord({ answer }: { answer: AnalyticsAnswer }) {
  return (
    <>
      <span className="analytics-answer-label">{answer.label}</span>
      {answer.hidden && (
        <span className="admin-badge" data-tone="warn">
          Hidden or excluded
        </span>
      )}
      <details>
        <summary>
          {answer.kind === "kart" || answer.kind === "chess"
            ? "Game details"
            : "Submission details"}
        </summary>
        <dl className="admin-room-facts">
          <Metric name="Type" value={answer.kind} />
          <Metric
            name={
              answer.kind === "wordle"
                ? "Last guess received"
                : answer.kind === "chess"
                  ? "Game ended"
                  : "Received"
            }
            value={displayDate(answer.receivedAt)}
          />
          <Metric name="Recorded deadline" value={displayDate(answer.deadlineAt)} />
          {answer.receivedAt !== null && answer.deadlineAt !== null && (
            <Metric
              name="Time left at receipt"
              value={ms(answer.deadlineAt - answer.receivedAt)}
            />
          )}
          {answer.deviceContextId && (
            <Metric name="Device context ID" value={answer.deviceContextId} />
          )}
        </dl>
        <pre>{JSON.stringify(answer.data, null, 2)}</pre>
      </details>
    </>
  );
}

function groupAnswers(rows: AnalyticsAnswer[], key: "questionId" | "playerId") {
  const grouped = new Map<string, AnalyticsAnswer[]>();
  for (const row of rows) {
    const list = grouped.get(row[key]);
    if (list) list.push(row);
    else grouped.set(row[key], [row]);
  }
  return grouped;
}

function displayDate(value: number | string | null) {
  if (value === null) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? gbDate.format(date) : "—";
}

function ms(value: number | null) {
  return value === null ? "—" : `${value.toLocaleString("en-GB")} ms`;
}

function download(data: RoomAnalytics) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `26-${data.gameId}-analytics.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

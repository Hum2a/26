import { useCallback, useState } from "react";
import { useReducedMotion } from "motion/react";
import {
  analyticsTrendsSchema,
  archivedAnalyticsSchema,
  type AnalyticsAnswer,
  type RoomAnalytics,
} from "@26/shared";
import { Button } from "../ui/primitives";
import { TrendCardView } from "../play/trends";
import { readSection } from "./sections-api";
import { useSection } from "./use-section";

type Question = RoomAnalytics["questions"][number];
const gbNumber = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 3 });

export function ChoiceDistribution({
  question,
  answers,
}: {
  question: Question;
  answers: AnalyticsAnswer[];
}) {
  const choiceAnswers = answers.filter((answer) => answer.kind === "choice");
  if (question.choices.length === 0 || choiceAnswers.length === 0) return null;
  const counts = new Map<string, number>();
  for (const { data } of choiceAnswers) {
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      !Array.isArray(data.optionIds)
    )
      continue;
    for (const id of new Set(data.optionIds)) {
      if (typeof id === "string") counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  if (!question.choices.some((choice) => counts.has(choice.id))) return null;
  return (
    <section className="analytics-distribution" aria-label="Choice distribution">
      <h4>Choice distribution</h4>
      <ul>
        {question.choices.map(({ id, label }) => {
          const count = counts.get(id) ?? 0;
          const percent = Math.round((count / choiceAnswers.length) * 100);
          return (
            <li key={id}>
              <span>{label}</span>
              <meter
                min={0}
                max={choiceAnswers.length}
                value={count}
                aria-label={label}
              />
              <span>
                {count} / {choiceAnswers.length} · {percent}%
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function NumericSummary({
  question,
  answers,
}: {
  question: Question;
  answers: AnalyticsAnswer[];
}) {
  const field =
    question.kind === "kart"
      ? "durationMs"
      : question.kind === "map-guess"
        ? "distanceKm"
        : question.kind === "slider" ||
            question.kind === "duel" ||
            question.kind === "finale"
          ? "value"
          : null;
  if (!field) return null;
  const values = answers
    .flatMap(({ data }) => {
      if (!data || typeof data !== "object" || Array.isArray(data)) return [];
      const value = data[field];
      return typeof value === "number" ? [value] : [];
    })
    .sort((left, right) => left - right);
  if (values.length === 0) return null;
  const middle = Math.floor(values.length / 2);
  const centre =
    values.length % 2 ? values[middle]! : (values[middle - 1]! + values[middle]!) / 2;
  const caption =
    field === "durationMs"
      ? "Race finish times"
      : field === "distanceKm"
        ? "Distance from the target"
        : "Submitted values";
  const unit = field === "durationMs" ? " ms" : field === "distanceKm" ? " km" : "";
  return (
    <section aria-label={caption}>
      <h4>{caption}</h4>
      <dl className="admin-room-facts">
        <Metric name="Recorded" value={values.length} />
        <Metric name="Minimum" value={`${gbNumber.format(values[0]!)}${unit}`} />
        <Metric name="Median" value={`${gbNumber.format(centre)}${unit}`} />
        <Metric name="Maximum" value={`${gbNumber.format(values.at(-1)!)}${unit}`} />
      </dl>
    </section>
  );
}

export function QuestionTrends({
  gameId,
  questionId,
  revision,
}: {
  gameId: string;
  questionId: string;
  revision: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Question trend cards</summary>
      {open && (
        <TrendRead gameId={gameId} questionId={questionId} revision={revision} />
      )}
    </details>
  );
}

function TrendRead({
  gameId,
  questionId,
  revision,
}: {
  gameId: string;
  questionId: string;
  revision: number;
}) {
  const reduced = useReducedMotion();
  const read = useCallback(
    () =>
      readSection(
        `/api/admin/rooms/${encodeURIComponent(gameId)}/analytics?question=${encodeURIComponent(questionId)}`,
        analyticsTrendsSchema,
      ),
    [gameId, questionId],
  );
  const result = useSection(read, String(revision));
  if (result.loading) return <p role="status">Loading question trends…</p>;
  if (result.error)
    return (
      <p role="alert">
        {result.error}{" "}
        <Button variant="secondary" onClick={() => void result.refresh()}>
          Retry
        </Button>
      </p>
    );
  if (!result.data || result.data.source === "unavailable")
    return <p>No trend analysis is available for this question.</p>;
  const { responses, classified, cards } = result.data;
  return (
    <div className="analytics-view">
      <p>
        Reconstructed from retained records. Labels reflect the current settings and
        card selection. The room does not keep a historical projector playback log.
      </p>
      <p>
        {responses} responses analysed · {classified} with device classification ·{" "}
        {cards.length} cards
      </p>
      {cards.length === 0 ? (
        <p>No cards met the trend rules.</p>
      ) : (
        <ul className="admin-card-grid-wide">
          {cards.map((card) => (
            <li key={card.id}>
              <span className="admin-badge" data-tone={card.hidden ? "warn" : "muted"}>
                {card.hidden
                  ? "Currently hidden"
                  : card.selected
                    ? "Selected by the trend rules"
                    : "Candidate"}{" "}
                · Rank score {gbNumber.format(card.score)}
              </span>
              <TrendCardView card={card} size="compact" reduce={Boolean(reduced)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ArchiveMetrics({ data }: { data: RoomAnalytics }) {
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Archived metric inputs and counts</summary>
      {open && <ReadArchiveMetrics data={data} />}
    </details>
  );
}

function ReadArchiveMetrics({ data }: { data: RoomAnalytics }) {
  const [scope, setScope] = useState("");
  const read = useCallback(
    () =>
      readSection(
        `/api/admin/rooms/${encodeURIComponent(data.gameId)}/analytics?archive=1`,
        archivedAnalyticsSchema,
      ),
    [data.gameId],
  );
  const result = useSection(read, String(data.revision));
  if (result.loading) return <p role="status">Loading archived metrics…</p>;
  if (result.error)
    return (
      <p role="alert">
        {result.error}{" "}
        <Button variant="secondary" onClick={() => void result.refresh()}>
          Retry
        </Button>
      </p>
    );
  if (result.data?.state !== "ready" || result.data.facts.length === 0)
    return <p>No archived metric records are available.</p>;
  const { facts, revision } = result.data;
  const questionIds = [
    ...new Set(
      facts.filter((fact) => fact.scope === "question").map((fact) => fact.scopeId),
    ),
  ];
  return (
    <div className="analytics-view">
      <p>
        {facts.length} retained {facts.length === 1 ? "metric" : "metrics"} from archive
        revision {revision}.
      </p>
      <label className="analytics-field">
        Archived metric scope
        <select value={scope} onChange={(event) => setScope(event.target.value)}>
          <option value="">Whole room</option>
          {questionIds.map((id) => (
            <option key={id} value={id}>
              {data.questions.find((question) => question.id === id)?.title ?? id}
            </option>
          ))}
        </select>
      </label>
      <FactsList
        facts={facts.filter((fact) =>
          scope
            ? fact.scope === "question" && fact.scopeId === scope
            : fact.scope === "game",
        )}
      />
    </div>
  );
}

export function Facts({ facts }: { facts: RoomAnalytics["facts"] }) {
  if (facts.length === 0) return null;
  return (
    <details>
      <summary>Metric inputs and counts ({facts.length})</summary>
      <FactsList facts={facts} />
    </details>
  );
}

function FactsList({ facts }: { facts: RoomAnalytics["facts"] }) {
  if (facts.length === 0) return <p>No metrics were recorded for this selection.</p>;
  return (
    <ul className="admin-data-list">
      {facts.map((fact) => (
        <li key={fact.id} className="analytics-fact">
          <strong>{fact.metric.replaceAll("-", " ")}</strong>
          <span>
            {gbNumber.format(fact.numerator)} / {gbNumber.format(fact.denominator)} ·{" "}
            {fact.unknownCount} unknown · {fact.display}
          </span>
          <span className="text-muted">{fact.grouping}</span>
          {fact.labels.length > 0 && <span>{fact.labels.join(" · ")}</span>}
          {fact.parts.length > 0 && (
            <ul>
              {fact.parts.map((part, index) => (
                <li key={index}>
                  {part.label} · {gbNumber.format(part.count)}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Metric({ name, value }: { name: string; value: number | string }) {
  return (
    <div>
      <dt>{name}</dt>
      <dd>{typeof value === "number" ? gbNumber.format(value) : value}</dd>
    </div>
  );
}

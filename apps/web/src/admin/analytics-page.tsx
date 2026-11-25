import { useCallback, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { publicResultsSchema, roomAnalyticsSchema } from "@26/shared";
import { Button } from "../ui/primitives";
import { AnalyticsExplorer } from "./analytics-explorer";
import { analyticsRehearsal } from "./analytics-rehearsal";
import { useAdminRoom } from "./room-provider";
import { readSection } from "./sections-api";
import { TrendsPanel } from "./trends-panel";
import { useSection } from "./use-section";

export function AnalyticsPage() {
  const [params] = useSearchParams();
  const exploring = params.get("view") === "responses";
  const { snapshot } = useAdminRoom();
  return (
    <section className="admin-section">
      <header className="admin-page-heading">
        <div>
          <p className="entry-eyebrow">This room</p>
          <h1>Analytics</h1>
        </div>
      </header>
      <nav className="analytics-toolbar" aria-label="Analytics pages">
        <Link
          className="entry-text-link"
          to="."
          aria-current={exploring ? undefined : "page"}
        >
          Live analytics
        </Link>
        <Link
          className="entry-text-link"
          to="?view=responses"
          aria-current={exploring ? "page" : undefined}
        >
          Explore responses
        </Link>
      </nav>
      {exploring ? (
        <RoomResponses key={snapshot.gameId} gameId={snapshot.gameId} />
      ) : (
        <LiveAnalytics />
      )}
    </section>
  );
}

function RoomResponses({ gameId }: { gameId: string }) {
  const [rehearsal, setRehearsal] = useState(false);
  return (
    <>
      <div className="admin-page-heading">
        <p>Browse retained answers and scores by question or guest.</p>
        <Button
          variant="secondary"
          aria-pressed={rehearsal}
          onClick={() => setRehearsal(!rehearsal)}
        >
          {rehearsal ? "Return to room data" : "Try sample data"}
        </Button>
      </div>
      {rehearsal ? (
        <AnalyticsExplorer data={analyticsRehearsal} rehearsal />
      ) : (
        <ReadRoomResponses gameId={gameId} />
      )}
    </>
  );
}

function ReadRoomResponses({ gameId }: { gameId: string }) {
  const read = useCallback(
    () =>
      readSection(
        `/api/admin/rooms/${encodeURIComponent(gameId)}/analytics`,
        roomAnalyticsSchema,
      ),
    [gameId],
  );
  const result = useSection(read);
  return (
    <>
      <div className="analytics-toolbar">
        <Button
          variant="secondary"
          disabled={result.loading}
          onClick={() => void result.refresh()}
        >
          Refresh records
        </Button>
        {result.loading && <p role="status">Loading room records…</p>}
        {result.error && <p role="alert">{result.error}</p>}
      </div>
      {result.data && (
        <AnalyticsExplorer
          data={result.data}
          eventReport={<ArchivedCards gameId={gameId} />}
        />
      )}
    </>
  );
}

function ArchivedCards({ gameId }: { gameId: string }) {
  const read = useCallback(
    () =>
      readSection(
        `/api/rooms/${encodeURIComponent(gameId)}/results`,
        publicResultsSchema,
      ),
    [gameId],
  );
  const result = useSection(read);
  return (
    <section className="admin-task-section" aria-label="Published report">
      <h3>Published report</h3>
      {result.loading ? (
        <p role="status">Loading the published report…</p>
      ) : result.error ? (
        <p role="alert">
          {result.error}{" "}
          <Button variant="secondary" onClick={() => void result.refresh()}>
            Retry
          </Button>
        </p>
      ) : result.data?.state === "ready" ? (
        <>
          <h4>Archived podium highlights</h4>
          {result.data.highlights?.length ? (
            <ol className="admin-data-list">
              {result.data.highlights.map((card) => (
                <li key={card.id} className="analytics-fact">
                  <strong>{card.stage}</strong>
                  <span>{card.results}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p>No highlights were archived.</p>
          )}
          <h4>Archived fun facts</h4>
          {result.data.funFacts?.length ? (
            <ol className="admin-data-list">
              {result.data.funFacts.map((card) => (
                <li key={card.id} className="analytics-fact">
                  {card.text}
                </li>
              ))}
            </ol>
          ) : (
            <p>No fun facts were archived.</p>
          )}
        </>
      ) : (
        <p>The published report is unavailable for this room.</p>
      )}
    </section>
  );
}

function LiveAnalytics() {
  const { snapshot } = useAdminRoom();
  const highlights = snapshot.highlights ?? [];
  const eligible = highlights.filter((card) => card.display === "eligible");
  const held = highlights.filter((card) => card.display === "suppressed");
  const history = snapshot.trollHistory ?? [];
  const trollCounts = countBy(
    history.filter((item) => item.status !== "refunded").map((item) => item.label),
  );
  const wall = snapshot.wall;
  const wallShown = wall?.recent?.filter((item) => item.status === "shown") ?? [];
  const wallReactions = wallShown.reduce((sum, item) => sum + item.reactions, 0);

  return (
    <>
      <p>
        Live totals for this room, and the statistics the stage will show at the podium.
        Cards update as the game goes on.
      </p>

      <section className="admin-task-section" aria-label="Totals">
        <h2>Totals</h2>
        <dl className="admin-room-facts">
          <Fact label="Players" value={snapshot.players.length} />
          <Fact
            label="Phones connected"
            value={snapshot.connections?.guests ?? "Unavailable"}
          />
          <Fact
            label="Stage screens"
            value={snapshot.connections?.stage ?? "Unavailable"}
          />
          <Fact label="Question photos and clips" value={snapshot.media.length} />
          <Fact label="Wall photos shown" value={wallShown.length} />
          <Fact label="Wall reactions" value={wallReactions} />
          <Fact label="Wall photos waiting" value={wall?.queue?.length ?? 0} />
          <Fact
            label="Trolls sent"
            value={history.filter((item) => item.status !== "refunded").length}
          />
        </dl>
      </section>

      <TrendsPanel />

      <section className="admin-task-section" aria-label="Podium highlights">
        <div className="admin-page-heading">
          <h2>Podium highlights ({eligible.length})</h2>
          <span className="admin-badge" data-tone="ok">
            <span className="admin-status-dot" data-tone="ok" aria-hidden="true" />
            Stage ready
          </span>
        </div>
        {eligible.length === 0 ? (
          <p>No highlights yet. They appear as answers come in.</p>
        ) : (
          <ul className="admin-card-grid-wide">
            {eligible.map((card) => (
              <li key={card.id} className="admin-card">
                <div className="admin-card-header">
                  <span className="admin-card-title">
                    <span
                      className="admin-status-dot"
                      data-tone="ok"
                      aria-hidden="true"
                    />
                    Podium card
                  </span>
                  {card.illustrative ? (
                    <span className="admin-badge" data-tone="muted">
                      Illustrative
                    </span>
                  ) : null}
                </div>
                <div className="admin-card-body">
                  <p className="text-lg font-bold">{card.stage}</p>
                  <p className="text-muted">{card.results}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {held.length > 0 ? (
        <section className="admin-task-section" aria-label="Held back">
          <div className="admin-page-heading">
            <h2>Held back ({held.length})</h2>
            <span className="admin-badge" data-tone="warn">
              Sample too small
            </span>
          </div>
          <p>
            These groups are too small for a fair percentage, so the stage will not show
            them.
          </p>
          <ul className="admin-card-grid">
            {held.map((card) => (
              <li key={card.id} className="admin-card">
                <div className="admin-card-body">
                  <p>{card.results}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="admin-task-section" aria-label="Fun facts">
        <h2>End-of-night fun facts</h2>
        {snapshot.funFactList ? (
          <ol className="grid gap-2">
            {snapshot.funFactList.cards.map((card, index) => (
              <li
                key={card.id}
                aria-current={
                  index === snapshot.funFactList?.index ? "step" : undefined
                }
                className={
                  index === snapshot.funFactList?.index ? "font-bold" : undefined
                }
              >
                {card.text}
              </li>
            ))}
          </ol>
        ) : (
          <p>Fun facts are chosen after the final scores and listed here then.</p>
        )}
      </section>

      <section className="admin-task-section" aria-label="Trolls by type">
        <h2>Trolls by type</h2>
        {trollCounts.length === 0 ? (
          <p>No trolls sent yet.</p>
        ) : (
          <ul className="admin-data-list">
            {trollCounts.map(([label, count]) => (
              <li key={label} className="admin-data-row">
                <span>{label}</span>
                <span className="admin-mono-tag">
                  {label}: <strong>{count}</strong>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Fact({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function countBy(values: string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts].sort((left, right) => right[1] - left[1]);
}

import { useAdminRoom } from "./room-provider";

/**
 * Room analytics for the host: the statistics the room has already
 * calculated, shown before the guests see them. Highlights include the ones
 * held back because a group is too small (fewer than 5), so the host knows
 * why a card will not reach the stage. Nothing here is collected for this
 * page; it reads the host's snapshot.
 */
export function AnalyticsPage() {
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
    <section className="admin-section">
      <header className="admin-page-heading">
        <div>
          <p className="entry-eyebrow">This room</p>
          <h1>Analytics</h1>
        </div>
      </header>
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

      <section className="admin-task-section" aria-label="Podium highlights">
        <h2>Podium highlights ({eligible.length})</h2>
        {eligible.length === 0 ? (
          <p>No highlights yet. They appear as answers come in.</p>
        ) : (
          <ul className="admin-card-grid-wide">
            {eligible.map((card) => (
              <li
                key={card.id}
                className="rounded-3xl border border-line bg-surface p-4"
              >
                {card.illustrative ? <p className="font-bold">Illustrative</p> : null}
                <p className="text-lg font-bold">{card.stage}</p>
                <p>{card.results}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {held.length > 0 ? (
        <section className="admin-task-section" aria-label="Held back">
          <h2>Held back ({held.length})</h2>
          <p>
            These groups are too small for a fair percentage, so the stage will not show
            them.
          </p>
          <ul className="admin-card-grid">
            {held.map((card) => (
              <li key={card.id}>{card.results}</li>
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
          <ul className="grid gap-1">
            {trollCounts.map(([label, count]) => (
              <li key={label}>
                {label}: <strong>{count}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
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

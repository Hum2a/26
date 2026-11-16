import { useAdminRoom } from "./room-provider";

/**
 * Chess round admin view - aggregate status and rehearsal.
 * Displays games in progress, finished, results breakdown.
 */
export function ChessAdminPage() {
  const { snapshot } = useAdminRoom();
  const play = snapshot.play;

  // Admin reads control projection (ChessControlSnapshot) with aggregate fields
  const chessSnapshot =
    play?.question.kind === "chess" && play.chess ? play.chess : null;

  if (!chessSnapshot) {
    return (
      <section className="admin-section">
        <header className="admin-page-heading">
          <div>
            <p className="entry-eyebrow">Mechanics</p>
            <h1>Chess Round</h1>
          </div>
        </header>
        <section className="admin-card" aria-label="Chess status">
          <div className="admin-card-header">
            <span className="admin-status-dot" data-tone="muted" aria-hidden="true" />
            <span className="admin-mono-tag">STANDBY</span>
            <h2 className="admin-card-title">Live Chess Monitor</h2>
          </div>
          <div className="admin-card-body space-y-3">
            <p>No active chess round. Chess rounds show aggregate game status here.</p>
            <h3>Rehearsal</h3>
            <p>When a chess round is active, this view shows:</p>
            <ul className="admin-data-list">
              <li className="admin-data-row">Total games</li>
              <li className="admin-data-row">Games in progress</li>
              <li className="admin-data-row">Games finished</li>
              <li className="admin-data-row">Results breakdown (wins, losses, draws, aborts)</li>
            </ul>
          </div>
        </section>
      </section>
    );
  }

  // Narrow union: control/stage snapshots have totalGames, guest snapshot does not
  if (!("totalGames" in chessSnapshot)) {
    return (
      <section className="admin-section">
        <header className="admin-page-heading">
          <div>
            <p className="entry-eyebrow">Mechanics</p>
            <h1>Chess Round</h1>
          </div>
        </header>
        <section className="admin-card" aria-label="Chess error">
          <div className="admin-card-header">
            <span className="admin-status-dot" data-tone="warn" aria-hidden="true" />
            <h2 className="admin-card-title">Snapshot error</h2>
          </div>
          <div className="admin-card-body">
            <p>Guest snapshot received (unexpected in admin)</p>
          </div>
        </section>
      </section>
    );
  }

  const {
    totalGames,
    inProgress: gamesInProgress,
    finished: gamesFinished,
    results,
  } = chessSnapshot;

  const { playerWins, botWins, draws, aborts } = results;

  return (
    <section className="admin-section">
      <header className="admin-page-heading">
        <div>
          <p className="entry-eyebrow">Mechanics</p>
          <h1>Chess Round</h1>
        </div>
      </header>
      <div className="space-y-4">
        <section className="admin-card" aria-label="Game Status">
          <div className="admin-card-header">
            <span className="admin-status-dot" data-tone="ok" aria-hidden="true" />
            <span className="admin-mono-tag">ACTIVE MATCHES</span>
            <h2 className="admin-card-title">Game Status</h2>
          </div>
          <div className="admin-card-body">
            <dl className="admin-stat-grid">
              <div className="admin-stat">
                <dt>Total Games</dt>
                <dd>{totalGames}</dd>
              </div>
              <div className="admin-stat">
                <dt>In Progress</dt>
                <dd>{gamesInProgress}</dd>
              </div>
              <div className="admin-stat">
                <dt>Finished</dt>
                <dd>{gamesFinished}</dd>
              </div>
            </dl>
          </div>
        </section>

        {gamesFinished > 0 && (
          <section className="admin-card" aria-label="Results">
            <div className="admin-card-header">
              <span className="admin-mono-tag">BREAKDOWN</span>
              <h2 className="admin-card-title">Results</h2>
            </div>
            <div className="admin-card-body">
              <dl className="admin-stat-grid">
                <div className="admin-stat">
                  <dt>Player Wins</dt>
                  <dd>{playerWins}</dd>
                </div>
                <div className="admin-stat">
                  <dt>Bot Wins</dt>
                  <dd>{botWins}</dd>
                </div>
                <div className="admin-stat">
                  <dt>Draws</dt>
                  <dd>{draws}</dd>
                </div>
                <div className="admin-stat">
                  <dt>Aborts</dt>
                  <dd>{aborts}</dd>
                </div>
              </dl>
            </div>
          </section>
        )}
      </div>
    </section>
  );
}

import { useAdminRoom } from "./room-provider";
import { Panel } from "../ui/primitives";

/**
 * Chess round admin view - aggregate status and rehearsal.
 * Displays games in progress, finished, results breakdown.
 */
export function ChessAdminPage() {
  const { snapshot } = useAdminRoom();
  const play = snapshot.play;
  
  // Admin reads aggregate projection (ChessStageSnapshot), not guest schema (ChessGuestSnapshot)
  // Backend projects play.chess as stage aggregate with totalGames, gamesInProgress, etc.
  const chessSnapshot = play?.question.kind === "chess" && play.chess ? play.chess : null;

  if (!chessSnapshot) {
    return (
      <Panel title="Chess Round" display="admin">
        <p>No active chess round. Chess rounds show aggregate game status here.</p>
        <h3>Rehearsal</h3>
        <p>When a chess round is active, this view shows:</p>
        <ul>
          <li>Total games</li>
          <li>Games in progress</li>
          <li>Games finished</li>
          <li>Results breakdown (wins, losses, draws, aborts)</li>
        </ul>
      </Panel>
    );
  }

  const { 
    totalGames, 
    gamesInProgress, 
    gamesFinished,
    whiteWins,
    blackWins,
    draws,
    aborts 
  } = chessSnapshot;

  return (
    <Panel title="Chess Round" display="admin">
      <div className="grid gap-4">
        <section>
          <h2 className="text-xl font-semibold mb-2">Game Status</h2>
          <dl className="grid grid-cols-3 gap-4">
            <div>
              <dt className="text-sm text-muted-foreground">Total Games</dt>
              <dd className="text-2xl font-bold">{totalGames}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">In Progress</dt>
              <dd className="text-2xl font-bold">{gamesInProgress}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Finished</dt>
              <dd className="text-2xl font-bold">{gamesFinished}</dd>
            </div>
          </dl>
        </section>

        {gamesFinished > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-2">Results</h2>
            <dl className="grid grid-cols-4 gap-4">
              <div>
                <dt className="text-sm text-muted-foreground">Player Wins</dt>
                <dd className="text-2xl font-bold">{whiteWins}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Bot Wins</dt>
                <dd className="text-2xl font-bold">{blackWins}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Draws</dt>
                <dd className="text-2xl font-bold">{draws}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Aborts</dt>
                <dd className="text-2xl font-bold">{aborts}</dd>
              </div>
            </dl>
          </section>
        )}
      </div>
    </Panel>
  );
}

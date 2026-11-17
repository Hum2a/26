import { useAdminRoom } from "./room-provider";

export function ChessControls() {
  const { snapshot } = useAdminRoom();
  const chess = snapshot.play?.chess;
  if (!chess || !("gameStatuses" in chess)) return null;
  return (
    <section className="admin-task-section" aria-label="Chess games">
      <h2>Chess games</h2>
      <p>
        {chess.inProgress} playing · {chess.finished} finished · {chess.totalGames}{" "}
        total
      </p>
      <p>
        Use Pause to freeze every clock. Advance closes this round and keeps
        captured-piece points.
      </p>
      <a className="entry-text-link" href="/chess" target="_blank" rel="noreferrer">
        Rehearse against the real bot
      </a>
      <div className="admin-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Guest</th>
              <th>Status</th>
              <th>Moves</th>
              <th>Your clock</th>
              <th>Bot clock</th>
              <th>Captures</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {chess.gameStatuses.map((game) => (
              <tr key={game.playerId}>
                <th scope="row">{game.nickname}</th>
                <td>{game.status}</td>
                <td>{game.plyCount}</td>
                <td>{Math.ceil(game.playerTimeMs / 1000)}s</td>
                <td>{Math.ceil(game.botTimeMs / 1000)}s</td>
                <td>{game.capturedPoints}</td>
                <td>{game.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {chess.recentEvents.length ? (
        <ul>
          {chess.recentEvents.map((event) => (
            <li key={`${event.playerId}-${event.timestamp}`}>
              {event.nickname}: {event.event} · {event.score} points
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

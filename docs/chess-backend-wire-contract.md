# Chess Backend Wire Contract (PR #12)

**Status:** Backend ~75% complete. Core mechanic working, alarm system wired, tests 24/26 passing.

## Server Commands (Authenticated Guest → Room)

### Move Command
```typescript
{
  kind: "command",
  requestId: string,
  name: "chess-move",
  gameId: string,           // "{roundId}-{playerId}"
  from: string,             // "e2" (a-h, 1-8)
  to: string,               // "e4"
  promotion?: "q"|"r"|"b"|"n",
  positionRevision: number  // REQUIRED: server-issued revision, increments on every position change
}
```

**Server validates:**
- Ownership (gameId contains player's ID)
- Position revision matches current game state (rejects stale/delayed commands)
- Side to move (must be player's turn)
- Clock hasn't expired
- Move legality (chess.js validation)

**Returns:** `{ ok: true }` or `{ ok: false, message: string }`

**Side effects on success:**
- Game state updated with new FEN, PGN, incremented ply, incremented positionRevision
- Clock updated (player time decreased by elapsed)
- If terminal: scores written to ledger exactly once
- If not terminal: bot move needed, schedule bot clock alarm

### Resign Command
```typescript
{
  kind: "chess-resign",
  requestId: string,
  gameId: string
}
```

**Server validates:** Ownership, game in progress

**Side effects:** Game terminated (status: "resigned", winner: "bot"), scored immediately

## Server Snapshots (Room → Client)

### Guest Snapshot (Own Game Only)
```typescript
{
  gameId: string,
  status: "in-progress" | "checkmate-win" | "checkmate-loss" | "timeout" | 
          "timeout-draw" | "draw" | "resigned" | "aborted",
  fen: string,              // Current position
  playerTimeMs: number,     // Remaining time (decreases in real-time)
  botTimeMs: number,
  lastMoveAt: number,       // Timestamp for client clock calculation
  sideToMove: "white"|"black",
  plyCount: number,
  positionRevision: number, // Client MUST echo this in move commands
  winner?: "player"|"bot"|"draw",
  terminationReason?: string
}
```

**Note:** PGN and positionHistory are server-only (not sent to guest)

### Stage/Control Aggregate Snapshot
```typescript
{
  totalGames: number,
  inProgress: number,
  finished: number,
  results: {
    playerWins: number,
    botWins: number,
    draws: number,
    aborts: number     // Distinct from draws, score 0
  },
  recentEvents: Array<{
    playerId: string,
    nickname: string,
    event: "checkmate-win" | "checkmate-loss" | "draw" | "timeout" | "resign" | "abort",
    timestamp: number
  }>,
  // Control-only:
  gameStatuses?: Array<{
    playerId: string,
    nickname: string,
    status: ChessGameStatus,
    plyCount: number,
    playerTimeMs: number,
    botTimeMs: number
  }>
}
```

## Bot Move Flow (Casual Trust with Revision Validation)

**Frontend responsibility:**
1. Guest receives snapshot with `positionRevision: N`
2. Client engine calculates move for `N` (must capture revision when dispatching search)
3. Client submits bot move via separate endpoint (TBD - likely server-side processing)

**Server MUST validate:**
```typescript
// Bot move command (server-side processing)
{
  gameId: string,
  move: { from: string, to: string, promotion?: string },
  positionRevision: number  // MUST match current game state
}
```

**Rejection scenarios:**
- Position changed (player resigned, timeout, pause incremented revision)
- Stale response from pre-pause engine calculation
- Cross-game contamination (wrong gameId)

## Clock Authority & Alarms

**Server-authoritative clocks:**
- Clocks tick server-side via PartyRoom job scheduler
- Alarm fires even with NO inbound messages (silent flag)
- Job payload: `"chess-clock:{gameId}"`
- Scheduled at: `now + remainingTime` for side to move

**Timeout handling:**
- On alarm: check elapsed time vs remaining
- If flagged: determine outcome (timeout vs timeout-draw based on mate material)
- Update game status, score once, broadcast snapshot

## Pause/Resume Behavior

**Pause (Host Command):**
1. Increment `positionRevision` for ALL active games (even if FEN/ply unchanged)
2. Cancel all pending chess-clock jobs
3. Reject any subsequent move commands with old revision

**Resume (Host Command):**
1. Reschedule clock alarms based on current state
2. Clocks resume from paused state (elapsed time during pause not counted)

**Critical:** Position revision increment invalidates ALL in-flight client state:
- Pending engine calculations
- Queued move submissions
- Any cached position data

## Round Lifecycle

**Initialization (Enter Collect Phase):**
- Create game for each frozen participant
- Initial state: FEN = starting position, clocks = 60000ms each, positionRevision = 0
- Schedule initial clock alarm for all games (player to move first)

**Termination:**
- Game terminal when: checkmate, stalemate, insufficient material, 50-move rule, timeout (if opponent has mate material), resignation
- Force-end (host): all active games → status "aborted", score 0

**Scoring:**
- Win: 100 points
- Draw (any type): 50 points  
- Loss / Abort: 0 points
- Written to score_ledger exactly once (dedup via `scored` flag)

## Error Handling & Edge Cases

**Position Revision Mismatch:**
- Error: `"Position revision mismatch: expected X, got Y"`
- Client must fetch fresh snapshot and retry

**Clock Expired:**
- Handled by server alarm, no client action needed
- Timeout result depends on opponent's mate material

**Engine Timeout/Failure (Frontend):**
- Client should handle locally (cancel search, show error)
- Do NOT submit malformed or invented moves
- Server will eventually timeout via clock if no bot move received

**Eviction Recovery:**
- Game state persisted to SQLite (FEN, PGN, clocks, revision)
- PGN preserved for threefold repetition detection
- Alarms rescheduled on room wake-up

## SQL Schema

```sql
CREATE TABLE chess_game (
  game_id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  fen TEXT NOT NULL,
  pgn TEXT NOT NULL,
  position_history TEXT NOT NULL,  -- JSON array of FENs
  player_time_ms INTEGER NOT NULL,
  bot_time_ms INTEGER NOT NULL,
  last_move_at INTEGER NOT NULL,
  side_to_move TEXT NOT NULL,
  ply_count INTEGER NOT NULL,
  position_revision INTEGER NOT NULL,
  status TEXT NOT NULL,
  winner TEXT,
  terminated_at INTEGER,
  termination_reason TEXT,
  scored INTEGER NOT NULL DEFAULT 0
);
```

## Known Limitations / TODO

1. ❌ Round initialization not yet wired (enter collect → create games)
2. ❌ Host pause/resume commands not yet wired
3. ❌ Integration tests not written (2-game isolation, silent flag, pause/resume)
4. ⚠️ 2/26 unit tests failing (eviction simulation edge cases)
5. ❌ Bot move submission endpoint TBD (currently casual trust flow incomplete)

## Frontend Handoff Notes

**Stockfish Worker:**
- MUST capture `positionRevision` when dispatching search
- Check revision still valid before submitting result
- Handle position changed during search (discard stale result)
- Implement UCIstop drainage for cancellation

**Guest UI:**
- Display `positionRevision` for debugging
- Validate server snapshot before rendering (check revision sequence)
- Handle revision mismatch errors gracefully (refetch snapshot)

**Pause Detection:**
- Position revision jumps without position change = pause occurred
- Discard any in-flight engine work
- Wait for fresh snapshot after resume

**80-Game Isolation:**
- Server handles per-player games independently
- No cross-game contamination (gameId enforced)
- Concurrent games proven via integration tests (TODO)

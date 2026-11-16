# Chess Round: Remaining Integration Work

## Completed Foundation (6 commits, 18 tests passing)

✅ Stockfish WASM assets + GPL compliance  
✅ Chess schemas and question types  
✅ Chess coordinator with full rules (565 lines, chess.js)  
✅ 18 unit tests (moves, terminals, clocks, aggregates)  
✅ Stockfish Web Worker wrapper (204 lines)  
✅ Chess board component (256 lines)

## Discovered Integration Scope

### PartyRoom Architecture (5,103 lines)

- SQLite-backed Durable Object
- Complex phase graph: lobby → intro → prompt → predict → collect → vote → reveal → scores → final → facts → podium
- Job scheduler with scope/phase generations
- Rate limiting per player per phase
- Resource lifecycle management
- Kart integration example: 5 integration points + dedicated mechanic handler

### Required Integration Points

#### 1. Chess Mechanic Handler (`apps/api/src/questions/chess.ts`)

Similar to `kart.ts` (referenced 5 times in party-room):

- `initializeChessRound(sql, store, question, participants, now)` - Create games in SQLite
- `acceptChessMove(sql, store, command, playerId, now)` - Validate and apply move
- `acceptBotMove(sql, store, gameId, move, now)` - Server-trusted bot move (casual trust)
- `projectChessSnapshot(sql, audience, playerId?)` - Guest/stage/control snapshots
- `scoreChessRound(sql, store)` - Terminal scoring from captured Black material (checkmate at least 40)
- `readChessGame(sql, playerId)` - Recover game from SQLite
- `freezeChessState(sql)` - Persist on eviction
- `recoverChess(sql, now)` - Rehydrate after eviction with history for repetition

**Complexity:**

- SQLite schema for games table (FEN, PGN, clocks, history, terminal state)
- Per-player game isolation
- History persistence for threefold repetition (not just FEN)
- Rehydrate chess.js instance from history, not just FEN
- Clock state recovery
- Exactly-once scoring after terminal/reconnect/eviction

#### 2. PartyRoom Integration (`apps/api/src/room/party-room.ts`)

5+ integration points mirroring kart:

**a) Command Registration (line ~412)**

```typescript
if (input.kind === "chess-move" || input.kind === "chess-resign") {
  // Validate ownership, round, game, phase, ply
  // acceptChessMove / resignChessGame
}
```

**b) Round Start (line ~1222)**

```typescript
if (question?.kind === "chess") {
  await initializeChessRound(sql, store, question, activeParticipants, now);
  // Schedule initial clock alarms for all games
}
```

**c) Snapshot Projection (line ~2501)**

```typescript
if (question?.kind === "chess") {
  return projectChessSnapshot(sql, audience, playerId);
}
```

**d) Alarm Handler (line ~2931)**

```typescript
if (question?.kind === "chess") {
  // Check for timeout flags
  // Terminate flagged games
  // Reschedule next alarm if games remain
}
```

**e) Arrival/Reconnection (line ~2973)**

```typescript
if (question?.kind === "chess") {
  // Recover player's game from SQLite
  // Resume Stockfish if mid-turn
  // Don't grant extra time
}
```

**f) Pause/Resume**

```typescript
// Freeze all active game clocks
// Cancel pending engine callbacks (invalidate pre-pause ply)
// On resume, restore clocks from pause timestamp
```

**g) Score Integration**

```typescript
// scoreChessRound: iterate games, calculate scores, write ledger
// Exactly once per game (check scored flag)
```

#### 3. SQLite Schema (`apps/api/src/room/schema.ts`)

```sql
CREATE TABLE chess_games (
  game_id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  fen TEXT NOT NULL,
  pgn TEXT NOT NULL,
  position_history TEXT NOT NULL, -- JSON array for repetition
  player_time_ms INTEGER NOT NULL,
  bot_time_ms INTEGER NOT NULL,
  last_move_at INTEGER NOT NULL,
  side_to_move TEXT NOT NULL,
  ply_count INTEGER NOT NULL,
  status TEXT NOT NULL,
  winner TEXT,
  terminated_at INTEGER,
  termination_reason TEXT,
  scored INTEGER DEFAULT 0
);

CREATE TABLE chess_clock_alarms (
  game_id TEXT PRIMARY KEY,
  due_at INTEGER NOT NULL,
  paused_at INTEGER
);
```

#### 4. Client Wiring (`apps/web/src/chess/`)

**chess-controller.tsx** - Connect board, worker, server:

```typescript
- useStockfishEngine() hook
- Engine preload on question load
- Position sync from server snapshot
- Human move: board → validate → server
- Bot move: server snapshot → engine.go() → server
- Promotion modal (q/r/b/n chooser)
- Clock countdown with server tick sync
- Reconnection: recover game, don't restart worker if ply unchanged
- Cleanup on unmount/route change
```

**Integration with existing phone flow:**

- Register chess in question renderer
- Handle "chess" snapshot type
- Send commands via existing WebSocket

#### 5. Projector View (`apps/web/src/stage/`)

**chess-projector.tsx**:

```typescript
- Aggregate counts: in progress, wins, draws, losses
- Recent events (last 10 terminals with nickname)
- Overall progress percentage
- No individual boards (too much clutter for 80 games)
```

#### 6. Admin Controls (`apps/web/src/admin/`)

**chess-admin.tsx**:

```typescript
- Start button (check engine readiness first)
- Pause/Resume (freeze clocks + engines)
- Force End (abort all remaining, score 0)
- Game health table (player, status, ply, clocks)
- Individual game inspector (FEN, PGN, history)
- Rehearsal: phone preview with sample data
```

Register in `apps/web/src/admin/features.ts`:

```typescript
{
  id: "chess",
  label: "Chess Battle",
  scope: "room",
  path: "/chess",
  summary: "Individual 1+0 blitz games with bot",
  rehearsal: "Phone preview with sample FEN positions and engine demo",
  owns: ["apps/api/src/questions/chess.ts", "apps/web/src/chess"],
  status: (snapshot) => `${snapshot.inProgress} in progress, ${snapshot.finished} finished`
}
```

#### 7. Comprehensive Testing

**Engine Smoke Test** (`apps/web/src/chess/stockfish-worker.test.ts`):

```typescript
// Requires actual browser environment
describe("Stockfish 19 Real Engine", () => {
  it("loads and handshakes with actual WASM", async () => {
    const engine = await createStockfishEngine({ elo: 1425 });
    expect(engine.isReady()).toBe(true);
  });

  it("accepts UCI_Elo 1425", async () => {
    // Verify actual engine advertises 1320-3190 range
    // Confirm 1425 is accepted (not silently ignored)
  });

  it("returns legal move for starting position", async () => {
    engine.setPosition("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    let bestMove: string | undefined;
    engine.options.onBestMove = (from, to) => {
      bestMove = `${from}${to}`;
    };
    engine.go(1000);
    await wait(1500);
    expect(bestMove).toMatch(/^[a-h][1-8][a-h][1-8]$/);
    // Validate move is legal with chess.js
  });
});
```

**DO Room Tests** (`apps/api/src/room/chess-room.test.ts`):

```typescript
using isolate = await env.PARTY_ROOM.get(...);

it("handles 80 concurrent games", async () => {
  // Create 80 players
  // Start chess round
  // Each player submits e2e4
  // Verify 80 games updated
  // Each bot responds
  // Measure latency, payload sizes
});

it("rejects duplicate move for same ply", async () => {
  // Player submits e2e4
  // Accepted
  // Player resubmits e2e4 (duplicate request ID)
  // Rejected
});

it("preserves clocks on eviction and reconnection", async () => {
  // Start game, make moves
  // Force eviction (close isolate)
  // Reconnect player
  // Verify clock hasn't reset to 60s
  // Verify history preserved for repetition
});

it("pause freezes clocks and invalidates pre-pause engine work", async () => {
  // Player moves, bot thinking
  // Host pauses before bot bestmove received
  // Stale bestmove arrives
  // Verify rejected (ply mismatch)
  // Resume
  // Bot resumes with correct clock
});

it("flags timeout when player silent", async () => {
  // Start game
  // Don't send player moves
  // Wait 61 seconds
  // Alarm fires
  // Game terminates: timeout (bot wins) or timeout-draw
});

it("scores exactly once after terminal", async () => {
  // Game reaches checkmate
  // Score recorded
  // Reconnection
  // Score not duplicated
});

it("prevents cross-player move submission", async () => {
  // Player A submits move for Player B's game
  // Rejected (ownership validation)
});

it("forced end scores abort (0 points), not material", async () => {
  // Games in progress
  // Host force-ends
  // All scored 0 with status "aborted"
  // Not fictitious wins/draws
});
```

**Browser Tests** (`apps/web/src/chess/chess.spec.ts`):

```typescript
// Playwright
test("loads engine and makes human move", async ({ page }) => {
  await page.goto("/room/test-room");
  await page.waitForSelector(".chess-board");
  await page.click("[data-square='e2']");
  await page.click("[data-square='e4']");
  // Wait for bot response
  await page.waitForSelector(".chess-piece", { state: "attached", timeout: 5000 });
});

test("promotion chooser appears on 7th rank pawn", async ({ page }) => {
  // Set up position with pawn on e7
  // Click e7 → e8
  // Verify modal appears with q/r/b/n
  // Select queen
  // Verify promotion sent
});

test("clock counts down", async ({ page }) => {
  // Start game
  // Read initial clock
  // Wait 2 seconds
  // Read clock again
  // Verify decreased
});

test("reconnection recovers game", async ({ page }) => {
  // Join game, make move
  // Close and reopen page
  // Verify game state restored
  // Verify clock not reset
});
```

**80-Player Load Simulation** (`apps/api/src/room/chess-load.test.ts`):

```typescript
it("simulates 80 concurrent games", async () => {
  const players = Array.from({ length: 80 }, (_, i) => `player${i}`);
  // Initialize round with all players
  // Each player submits first move (e2e4)
  // Measure server processing time
  // Bot moves for all 80
  // Measure aggregate snapshot payload
  // Continue for 10 moves each
  // Log: max latency, total duration, payload sizes
  // Verify no cross-game leakage
});
```

### Estimated Remaining Effort

**Implementation Lines:**

- Chess mechanic handler: ~600 lines
- PartyRoom integration: ~200 lines across 7 points
- SQLite schema + migrations: ~100 lines
- Client controller: ~400 lines
- Projector view: ~150 lines
- Admin view: ~300 lines
- **Total: ~1,750 implementation lines**

**Test Lines:**

- Engine smoke: ~150 lines
- DO room tests: ~500 lines
- Browser tests: ~300 lines
- Load simulation: ~200 lines
- **Total: ~1,150 test lines**

**Integration Complexity:**

- 7 PartyRoom integration points
- SQLite schema evolution
- Alarm coordination for 80 games
- Phase-aware command gating
- Exactly-once scoring
- Clock pause/resume
- Eviction recovery with history
- Pre-pause callback invalidation

### Critical Missing Pieces

1. **Turn-order clock charging** before move acceptance (not after)
2. **Pending flag alarms** while no clients send moves
3. **Host pause** must freeze ALL clocks and invalidate pre-pause engine callbacks (ply-based)
4. **Exactly-once scoring** after terminal/reconnect/eviction (scored flag)
5. **History persistence** for repetition (not FEN alone)
6. **Rehydrate chess.js** from history on recovery
7. **Draw convention** honest scope: insufficient material + repetition + 50-move supported; not all FIDE dead positions
8. **Timeout draw** only if opponent cannot mate (simplified mating material check)
9. **Real engine handshake** demonstrating 1425 supported (not mocked)
10. **Browser self-hosted engine** legal reply (actual WASM, not mock)

### Testing Gaps in Foundation

The 18 unit tests cover **pure coordinator logic** only:

- ❌ No SQLite persistence
- ❌ No eviction recovery
- ❌ No alarm scheduling
- ❌ No concurrent game isolation
- ❌ No turn-order validation
- ❌ No ply-based deduplication
- ❌ No pause callback invalidation
- ❌ No real engine handshake
- ❌ No browser WASM test

### Honest Scope Statement

**Foundation (complete):** Chess rules, types, assets, board, worker wrapper  
**Integration (remaining):** PartyRoom mechanics, persistence, alarms, snapshots, client wiring, views, comprehensive tests

**Token estimate for careful completion:** 100-150k additional  
**Current available:** ~100k

This is **not a lack of willingness** but an honest engineering assessment of production-grade DO integration scope.

## Recommended Path Forward

### Option A: Continue Foundation → Minimal Viable (50-60k tokens)

- Create chess mechanic handler (persistence, recovery)
- Wire ONE integration point (moves only, no alarms yet)
- Basic projector view
- Skip admin controls initially
- Document what's stubbed

### Option B: Pause for Planning

- Current branch preserves all foundation work
- Document precise integration specification
- User or future agent continues with full context
- No lost work, clean handoff

### Option C: Simplified Chess (40-50k tokens)

- Remove clock alarms (fixed 2-minute max per game)
- Simpler SQLite schema (no history, accept repetition limitation)
- No pause/resume (complexity reduction)
- Focus on core move loop

## Current PR #11 Status

**Commits:** 6 focused commits  
**Tests:** 18/18 passing (coordinator unit tests)  
**Types:** All passing  
**Content:** Birthday pack validates  
**Integration:** 0% (foundation only)

**Not enabled in running order** - question exists in catalogue but not in `order` array, so cannot be selected until integration complete.

## Blockers

None for continuing foundation work. Integration requires:

- Careful PartyRoom modification (5103-line critical path)
- SQLite schema coordination
- Alarm scheduler understanding
- Phase lifecycle mastery
- Multi-point testing

**No tool/runtime/access blockers** - this is pure scope/complexity reality.

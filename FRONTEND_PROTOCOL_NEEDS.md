# Chess Frontend Protocol Needs

**Branch:** cursor/chess-frontend-integration-da22  
**For integration with:** cursor/chess-round-followup-3212 (backend)

## Current Implementation Status

Frontend implements:

- ✅ Chess game UI with board and engine integration
- ✅ Promotion chooser (all 4 pieces including underpromotion)
- ✅ Search generation tracking to prevent stale bestmoves
- ✅ Position revision captured at search dispatch
- ✅ Engine lifecycle management (one worker per phone)
- ✅ Watchdog timers for search timeout

## Missing from ChessGuestSnapshot for Clock Interpolation

**Current schema** (chess-schemas.ts lines 105-125):

```typescript
export const chessGuestSnapshotSchema = z.object({
  gameId: z.string(),
  fen: z.string(),
  pgn: z.string(),
  status: chessGameStatusSchema,
  playerColor: chessColorSchema,
  botColor: chessColorSchema,
  playerTimeMs: z.number().int().min(0),
  botTimeMs: z.number().int().min(0),
  sideToMove: chessColorSchema,
  plyCount: z.number().int().min(0),
  winner: z.enum(["player", "bot", "draw"]).optional(),
  terminationReason: z.string().optional(),
  inCheck: z.boolean(),
  isGameOver: z.boolean(),
});
```

**MISSING for correct clock interpolation:**

```typescript
// Need ONE of these approaches:

// Option A: Server-side timestamp approach
serverTime: z.number().int(), // Timestamp when snapshot was generated
lastMoveAt: z.number().int(), // Timestamp of last move (for elapsed calculation)

// Option B: Pre-calculated elapsed approach
elapsedSinceLastMove: z.number().int().min(0), // Ms elapsed since last move

// Also need:
paused: z.boolean(), // Is game currently paused? (clocks frozen)
```

**Problem without this:** Client cannot accurately interpolate running clocks. Using wall-clock time from snapshot receipt will:

- Drift due to network latency
- Show incorrect time on reconnection
- Not handle pause/resume correctly

**Recommended:** Option A (serverTime + lastMoveAt) - allows client to sync with server time and calculate accurate elapsed.

## Missing Readiness Command Protocol

**Engine states that need backend handling:**

1. Engine initialization failed → Guest needs UI showing they cannot play
2. Engine ready → Allow round start
3. Engine error during game → Need recovery or abort

**Potential approaches:**

### Option 1: Client-side readiness only (no server command)

- Frontend shows loading/error states locally
- Server starts round regardless of client readiness
- Games where client can't load engine just timeout naturally
- **Pro:** Simple, no protocol changes needed
- **Con:** Poor UX for guests with load failures

### Option 2: Explicit readiness reporting (needs backend)

```typescript
// New command schema needed:
{
  kind: "chess-ready",
  gameId: string,
  ready: boolean,
  error?: string // If ready=false
}
```

Host view could show: "23/80 guests ready, 2 loading, 1 failed"

**Current implementation:** Frontend handles engine state locally, no server readiness command. Recommend Option 1 for initial release unless readiness visibility is critical for host.

## Room Transport Envelope

**Need to verify:** Actual command sending mechanism. Is it:

```typescript
// Direct command?
socket.send({ kind: "chess-move", gameId, from, to, positionRevision, promotion? })

// Or wrapped in envelope?
socket.send({
  requestId: generateId(),
  command: { kind: "chess-move", gameId, from, to, positionRevision, promotion? }
})

// Or room-specific format?
socket.send({
  type: "round-command",
  roundCommand: { kind: "chess-move", ... }
})
```

**Current frontend assumption:** Commands sent via existing room transport mechanism (likely similar to kart/wordle).

## Stage/Control Snapshots

**Confirmed structure** (chess-schemas.ts lines 127-184):

```typescript
ChessStageSnapshot: {
  totalGames: number,
  inProgress: number,
  finished: number,
  results: { playerWins, botWins, draws, aborts },
  recentEvents: Array<{ playerId, nickname, event, timestamp }>
}

ChessControlSnapshot: extends ChessStageSnapshot + {
  gameStatuses: Array<{ playerId, nickname, status, plyCount, playerTimeMs, botTimeMs }>
}
```

✅ No additional fields needed for projector/host aggregate views.

## Pause/Resume Position Revision

**Confirmed:** Backend increments positionRevision on pause/resume (per report).

**Frontend handling:**

```typescript
// On snapshot update:
if (snapshot.positionRevision !== searchState.positionRevision) {
  // Cancel any in-flight search
  engine.stop();
  searchStateRef.current = null;
  // Next snapshot with sideToMove=bot will trigger new search
}
```

✅ Already implemented in chess-game.tsx

## Summary of Integration Needs

### Blocking for accurate clocks:

1. **Add to ChessGuestSnapshot:** `serverTime` + `lastMoveAt` (or `elapsedSinceLastMove`)
2. **Add to ChessGuestSnapshot:** `paused` boolean

### Optional enhancements:

3. **Readiness command:** `chess-ready` for engine load tracking (recommend defer to post-MVP)
4. **Room transport:** Verify command envelope format matches existing room patterns

### Already handled by backend (per report):

- ✅ Move command parsing (`chess-move`, `chess-resign`)
- ✅ Position revision increment on pause
- ✅ Stage/control aggregate snapshots

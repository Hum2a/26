# Chess Frontend Protocol Requirements

**Branch:** cursor/chess-frontend-integration-da22  
**Last Updated:** 2026-11-08 22:58 UTC  
**Backend Status:** round-init/host-pause in progress, bot route TBD

## Critical Protocol Gaps

### 1. BOT MOVE SUBMISSION ROUTE (BLOCKING)

**Status:** TBD per backend report, not yet implemented

**Frontend needs:**
```typescript
// Bot move must use SAME command as human move
{
  kind: "chess-move",
  gameId: string,
  from: string,        // e.g. "e7"
  to: string,          // e.g. "e5"
  promotion?: "q" | "r" | "b" | "n",
  positionRevision: number  // Captured at search dispatch
}
```

**Server must:**
- Accept bot moves via same `chess-move` command
- Infer side (player vs bot) from `sideToMove` in game state
- Validate positionRevision matches current game state
- Reject stale moves (positionRevision mismatch)

**Frontend behavior:**
- Engine generates bestmove on bot's turn
- Frontend sends `chess-move` command with bot's from/to
- Server validates and applies, then sends updated snapshot

**Alternative if separate bot route required:**
```typescript
{
  kind: "chess-bot-move",  // Different kind?
  gameId: string,
  from: string,
  to: string,
  promotion?: string,
  positionRevision: number
}
```

**Question for backend:**
- Is `chess-move` command sufficient for both player AND bot?
- Or does bot need separate command kind?
- What is exact room transport envelope format?

---

### 2. CLOCK INTERPOLATION FIELDS (BLOCKING)

**Current ChessGuestSnapshot missing:**
```typescript
// Option A: Server timestamp approach (RECOMMENDED)
{
  serverTime: number,      // Timestamp when snapshot generated (ms)
  lastMoveAt: number,      // Timestamp of last move (ms)
  paused: boolean         // Is game paused?
}

// Option B: Pre-calculated elapsed
{
  elapsedSinceLastMove: number,  // Ms since last move
  paused: boolean
}
```

**Why needed:**
- Current implementation cannot interpolate running clocks
- Using wall-clock from snapshot receipt causes drift
- Reconnection shows incorrect time
- Pause/resume handling broken

**Frontend calculation with Option A:**
```typescript
const elapsed = paused ? 0 : (Date.now() - serverTime) + (serverTime - lastMoveAt);
const playerTimeRemaining = snapshot.playerTimeMs - (sideToMove === 'white' ? elapsed : 0);
const botTimeRemaining = snapshot.botTimeMs - (sideToMove === 'black' ? elapsed : 0);
```

**Impact if not added:**
- Clocks will appear static (snapshot values only)
- No countdown animation
- Poor UX, but game still playable

---

### 3. ENGINE READINESS/ERROR REPORTING (OPTIONAL)

**Status:** Not implemented, client-side only

**Current behavior:**
- Engine init/errors shown only to local guest
- No server notification
- Game proceeds regardless of client readiness
- Guests with failed engines will timeout naturally

**Potential server commands:**
```typescript
// If host needs visibility:
{
  kind: "chess-engine-status",
  gameId: string,
  status: "initializing" | "ready" | "error",
  error?: string  // If status=error
}
```

**Host could display:**
- "23/80 guests ready"
- "2 guests loading engine"
- "1 guest engine failed"

**Recommendation:**
- **Defer to post-MVP** - adds complexity
- Current approach: engine failures are invisible to host
- Failed engines → natural timeout → 0 points
- Acceptable for casual trust model

**If implementing:**
- Add `chess-engine-status` command to room
- Frontend sends on init complete/error
- Host control snapshot includes readiness counts
- Consider whether to delay round start for engine loads

---

### 4. ROOM COMMAND TRANSPORT ENVELOPE

**Unknown:** Exact format for sending commands

**Possibilities:**
```typescript
// A) Direct command (unlikely)
socket.send({ kind: "chess-move", gameId, from, to, ... })

// B) Wrapped in request envelope
socket.send({
  requestId: generateId(),
  kind: "chess-move",
  gameId, from, to, ...
})

// C) Room-specific wrapper
socket.send({
  type: "round-command",
  command: { kind: "chess-move", gameId, from, to, ... }
})

// D) Existing room pattern (like kart/wordle)
// Need to verify actual mechanism
```

**Frontend assumption:**
- Commands sent via existing room transport
- Likely similar to kart input submission
- Needs verification from backend

**Action needed:**
- Backend document exact command sending mechanism
- Frontend will adapt to match existing room patterns

---

### 5. GAME ID SOURCE

**Question:** Where does gameId come from?

**Options:**
```typescript
// A) In initial snapshot
ChessGuestSnapshot {
  gameId: string,  // ✅ Already in schema
  ...
}

// B) Constructed by client
gameId = `${roundId}-${playerId}`

// C) Separate readiness exchange
- Server: "Your game is ready, gameId=abc123"
- Client: Uses that gameId for commands
```

**Current schema has gameId** in ChessGuestSnapshot ✅

**Frontend will:**
- Extract gameId from snapshot
- Use that gameId in all commands
- No client-side construction

---

### 6. RESIGN COMMAND

**Confirmed in schema:**
```typescript
{
  kind: "chess-resign",
  requestId: string,
  gameId: string
}
```

**Status:** ✅ Schema complete, assumes works same as move command

---

### 7. PAUSE/RESUME POSITION REVISION

**Confirmed:** Backend increments positionRevision on pause/resume

**Frontend handling:** ✅ Already implemented
- On snapshot with new positionRevision:
  - Cancel any in-flight search
  - Clear searchStateRef
  - Next bot turn triggers new search with new revision

---

### 8. SNAPSHOT UPDATE FREQUENCY

**Question:** How often does server send snapshots?

**Scenarios:**
- After every move (player or bot)?
- On timer (e.g. every 100ms for clock updates)?
- Only on state changes?
- Mixed (state changes + periodic for clocks)?

**Frontend impact:**
- If only on moves: clocks are static between moves
- If periodic: smooth countdown animation possible
- Current implementation handles any frequency

---

## Summary for Backend Integration

### Must Have (Blocking)
1. **Bot move submission route** - which command? same as player or different?
2. **Clock interpolation fields** - serverTime/lastMoveAt/paused
3. **Command envelope format** - how to send commands via room transport

### Nice to Have (Post-MVP)
4. Engine readiness reporting - defer unless host visibility critical
5. Snapshot frequency clarity - works either way, just affects UX

### Already Handled
- ✅ Position revision tracking
- ✅ Pause/resume invalidation
- ✅ Resign command schema
- ✅ Game ID from snapshot

---

## Testing Without Backend

**Currently testable:**
- ✅ Engine initialization
- ✅ UCI protocol
- ✅ Legal move generation
- ✅ Search lifecycle (start/stop/timeout)
- ✅ Promotion chooser UI
- ✅ Board interaction
- ✅ Component state management

**Blocked without backend:**
- ❌ Full command roundtrip (no server to accept commands)
- ❌ Snapshot updates (no server sending snapshots)
- ❌ Multi-game isolation (need real room)
- ❌ Clock interpolation (missing fields)

**Workaround for integration testing:**
- Mock server responses with proper schema
- Test command formatting independently
- Verify UI state transitions
- Integration tests run once backend ready

# Chess Room Transport Envelope

**Authoritative reference for frontend integration**

## Client → Server: Command Submission

All chess commands go through the standard room `/rooms/{gameId}/play` endpoint:

```typescript
POST /rooms/{gameId}/play
Content-Type: application/json

{
  credentialId: string,     // Guest credential
  secret: string,           // Guest secret
  requestId: string,        // Idempotency key
  name: "chess-move",       // Command discriminator
  gameId: string,           // "{roundId}-{playerId}" format
  from: string,             // "e2" (a-h, 1-8)
  to: string,               // "e4"
  promotion?: "q"|"r"|"b"|"n", // Required for pawn reaching 8th rank
  positionRevision: number  // REQUIRED: server-issued revision from snapshot
}
```

### Bot Moves (Casual Trust)

**CRITICAL SECURITY:** Every player submits moves **ONLY for their OWN game**. They submit BOTH human moves (when it's their turn) AND bot moves (when it's bot's turn).

Bot moves use the **same** `chess-move` command. The server determines human vs bot path from `game.sideToMove`:

- **Human move:** `game.sideToMove === game.playerColor` — validates legality as player's move
- **Bot move:** `game.sideToMove === game.botColor` — validates legality as bot's move

**Ownership validation:** Server ALWAYS validates `game.playerId === authenticatedPlayerId` BEFORE either path. Attempting to submit moves for another player's game is rejected with `"Not your game"`.

**Casual trust:** Guest chooses bot moves for their OWN game (computed locally via Stockfish), never controls other players' games.

Server validates `positionRevision` for BOTH player and bot moves. Stale commands are rejected regardless of path.

### Resign Command

```typescript
POST /rooms/{gameId}/play

{
  credentialId: string,
  secret: string,
  requestId: string,
  name: "chess-resign",
  gameId: string
}
```

## Server → Client: Response Envelope

### Success

```typescript
{
  kind: "ack",
  scope: "private",
  requestId: string,     // Echoed from request
  accepted: true
}
```

### Rejection

```typescript
{
  kind: "ack",
  scope: "private",
  requestId: string,
  accepted: false,
  error: string          // Human-readable error message
}
```

**Common error reasons:**
- `"Not your game"` — ownership validation failed
- `"Position revision mismatch: expected X, got Y"` — stale command, client must fetch fresh snapshot
- `"Not a chess round"` — wrong question type or phase
- `"Invalid move: ..."` — chess.js legality check failed
- `"It's not your turn"` — side to move mismatch
- Phase/paused/late gate failures (see submission gate in lifecycle)

## Server → Client: Snapshot Broadcast

Snapshots arrive via WebSocket as broadcast messages:

```typescript
{
  kind: "snapshot",
  scope: "private",  // Guest sees own game only
  chess: {
    gameId: string,
    fen: string,
    pgn: string,
    status: "waiting" | "in-progress" | "checkmate" | "stalemate" | 
            "insufficient-material" | "threefold-repetition" | "fifty-move-rule" |
            "timeout" | "timeout-draw" | "resignation" | "aborted",
    playerColor: "white" | "black",
    botColor: "white" | "black",
    playerTimeMs: number,      // Remaining time in milliseconds
    botTimeMs: number,
    sideToMove: "white" | "black",
    plyCount: number,
    positionRevision: number,  // REQUIRED: echo this in next move command
    lastMoveAt: number,        // Server timestamp (ms since epoch) for clock interpolation
    paused: boolean,           // Room pause state - clocks freeze when true
    winner?: "player" | "bot" | "draw",
    terminationReason?: string,
    inCheck: boolean,          // Computed from fen
    isGameOver: boolean        // Terminal status check
  }
}
```

### Clock Interpolation

To display live countdown:

```typescript
const snapshot = /* latest chess snapshot */;

if (snapshot.paused || snapshot.isGameOver) {
  // Clocks frozen - display snapshot times directly
  displayPlayerTime = snapshot.playerTimeMs;
  displayBotTime = snapshot.botTimeMs;
} else {
  const elapsed = Date.now() - snapshot.lastMoveAt;
  if (snapshot.sideToMove === snapshot.playerColor) {
    displayPlayerTime = Math.max(0, snapshot.playerTimeMs - elapsed);
    displayBotTime = snapshot.botTimeMs;
  } else {
    displayPlayerTime = snapshot.playerTimeMs;
    displayBotTime = Math.max(0, snapshot.botTimeMs - elapsed);
  }
}
```

## Stage and Control Snapshots

Stage (projector) and control (host admin) receive aggregate snapshots only, not individual board states:

```typescript
{
  kind: "snapshot",
  scope: "stage" | "control",
  chess: {
    totalGames: number,
    inProgress: number,
    finished: number,
    results: {
      playerWins: number,
      botWins: number,
      draws: number,
      aborts: number
    },
    recentEvents: [
      {
        playerId: string,
        nickname: string,
        event: "checkmate-win" | "checkmate-loss" | "draw" | "timeout" | "resign" | "abort",
        timestamp: number
      }
    ],
    // Control-only: individual game monitoring
    gameStatuses?: [
      {
        playerId: string,
        nickname: string,
        status: ChessGameStatus,
        plyCount: number,
        playerTimeMs: number,
        botTimeMs: number
      }
    ]
  }
}
```

## Critical Invariants

1. **positionRevision is required** — Commands without it or with stale revision are rejected
2. **Server is authoritative** — Client never computes scores, flags, or terminal conditions
3. **Bot moves use same route** — No separate bot command; ownership inference from gameId
4. **Pause increments revision** — Any pause/resume invalidates in-flight client state (including bot engine)
5. **Clock authority** — `lastMoveAt` is server time; client interpolates but server enforces flags

## Idempotency

All commands are idempotent via `requestId`. Replay of same request returns cached result without re-execution.

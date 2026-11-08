# Chess Round Implementation Status

## Overview

Individual simultaneous 1+0 blitz chess games for up to 80 concurrent players against Humza bot.

**Time Control:** 1+0 (60 seconds each, no increment)  
**Colors:** All guests play White, bot plays Black  
**Engine:** Stockfish 19 lite-single (1.8 MB WASM) running client-side  
**Trust Model:** Casual trust (server validates legality but not bot strength)  
**Scoring:** Win 100, Draw 50, Loss/Abort 0

## Implementation Status

### ✅ Complete

#### Phase 1: Assets & Dependencies (commit b5c9764)
- [x] Vendor Stockfish 19 WASM assets (1.8 MB + 28 KB)
- [x] GPL-3.0 compliance documentation
- [x] Install chess.js@1.4.0 and stockfish@19.0.1
- [x] Source provenance in THIRD_PARTY_NOTICES.md

#### Phase 2: Server Logic (commits f3d95f1, 96b149f, 9fc72fe)
- [x] Chess schemas in packages/shared
  - Game state, moves, clocks, snapshots
  - Wire protocol for commands
- [x] Question type definitions
  - ChessBody, AuthoredChess, ChessQuestion
  - chessQuestion() authoring helper
- [x] Chess battle question in birthday pack
  - Content preflight passing
- [x] **Chess coordinator with full rules** (565 lines)
  - chess.js integration for move validation
  - Server-authoritative 1+0 clocks
  - Special moves: castling, en passant, promotion (all variants)
  - Terminal detection: checkmate, stalemate, insufficient material, threefold repetition, 50-move rule
  - Timeout with insufficient-material draw logic
  - Snapshot projections (guest, stage, control)
  - Score calculation
- [x] **Unit tests: 18/18 passing**
  - Move validation (legal/illegal, turn order, promotion)
  - Terminal conditions
  - Clock management
  - Resignation
  - Aggregates

#### Phase 3: Client Foundation (commit 4359af2)
- [x] **Stockfish Web Worker wrapper** (204 lines)
  - UCI protocol handshake
  - UCI_LimitStrength + UCI_Elo configuration
  - Position setup from FEN
  - Best move requests with time limit
  - Worker lifecycle and error handling
  - 10-second initialization timeout
- [x] **Chess board component** (256 lines)
  - FEN parsing and display
  - Interactive square selection
  - Unicode piece symbols
  - Clock display (both sides)
  - Check/checkmate/game-over states
  - Accessible labels

**Files:** 8 created/modified  
**Lines:** ~1,800 implementation + 368 test  
**Tests:** 18 passing

### 🚧 Remaining Work

#### Phase 3b: Client Integration
- [ ] Wire chess board to Stockfish worker
- [ ] Handle bot move responses
- [ ] Legal move highlighting (query server or client chess.js)
- [ ] Promotion chooser modal (q/r/b/n selection)
- [ ] Clock countdown with server sync
- [ ] Reconnection state recovery
- [ ] Engine preload and readiness UX
- [ ] Worker cleanup on unmount/route change

#### Phase 4: Projector & Admin
- [ ] Projector aggregate view
  - Win/draw/loss counts
  - Games in progress
  - Recent terminal events (last 10)
  - Restrained updates (no per-move spam)
- [ ] Admin controls
  - Start round (after engine preload)
  - Pause/resume (freeze clocks + engines)
  - Force-end (abort remaining games)
  - Game health monitoring
  - Individual game inspection
- [ ] Rehearsal mode
  - Phone preview with sample data
  - Isolated (no live room/socket)

#### Phase 5: Room/DO Integration
- [ ] Add chess commands to PartyRoom
  - `chess-move`, `chess-resign`
- [ ] Room state management
  - Initialize chess round
  - Apply moves (human + bot)
  - Update aggregates
- [ ] SQLite persistence
  - Game state after each move
  - History for repetition
  - Eviction recovery
- [ ] Broadcast snapshots
  - Per-player guest snapshots
  - Aggregate stage snapshot
  - Host control snapshot
- [ ] Clock scheduler
  - Alarm for each active game
  - Flag timeout detection
  - Pause/resume handling
- [ ] Frozen participant roster

#### Phase 6: Testing & Verification
- [ ] Engine smoke test
  - Real UCI handshake with Stockfish 19
  - Verify UCI_Elo 1425 accepted
  - Confirm legal move response
  - Measure initialization time
- [ ] Browser tests (Playwright)
  - Load board and engine
  - Make human move
  - Receive bot response
  - Promotion flow
  - Clock display
  - Reconnection
- [ ] DO room tests
  - 80 concurrent games isolation
  - Duplicate/out-of-order move rejection
  - Eviction/reconnection with clock preservation
  - Pause at engine response
  - Alarm flag when phone silent
  - Terminal scoring exactly once
- [ ] Server load simulation
  - 80-player payload sizes
  - Snapshot broadcast performance
  - SQLite write throughput
- [ ] Integration test
  - End-to-end: phone move → bot reply → score

## Architecture

```
┌─────────────┐         WebSocket          ┌──────────────┐
│   Guest     │◄─────────────────────────►│  DO Room     │
│   Phone     │                            │              │
│             │                            │  chess.js    │
│ ┌─────────┐ │   Submit move (from+to)    │  coordinator │
│ │Stockfish│ │───────────────────────────►│              │
│ │ Worker  │ │                            │  - Legality  │
│ │UCI 1425 │ │◄──────Bot move if valid────│  - Clocks    │
│ └─────────┘ │                            │  - Persist   │
│             │                            │  - Broadcast │
└─────────────┘                            └──────────────┘
```

## Key Decisions

1. **Client engine with casual trust:** Server validates legality but not bot strength. Accepted risk of weak legal move selection in party context.
2. **Everyone White:** Identical opportunity and UX consistency.
3. **Standard 26 scoring:** Win 100, draw 50, loss 0. Abort 0 distinct from played loss.
4. **No material scoring:** Prevents deadline farming. Game must reach terminal state.
5. **Server clocks:** Authoritative time tracking despite client engines. No extra time on reconnect.
6. **UCI_Elo 1425:** Nominal strength. Not calibrated to Chess.com. Within documented 1320-3190 range.
7. **Repetition history:** Full position history persisted for threefold repetition after eviction.
8. **Timeout draw:** If opponent cannot mate (insufficient material), timeout is a draw per standard rules.

## Testing Evidence

### Unit Tests (18/18 passing)

```bash
$ npx vitest run apps/api/src/questions/chess-coordinator.test.ts

 ✓ Chess Coordinator (18)
   ✓ initializeChessRound (2)
   ✓ applyChessMove (4)
   ✓ applyBotMove (2)
   ✓ Terminal conditions (2)
   ✓ resignGame (1)
   ✓ calculateChessScore (4)
   ✓ projectGuestSnapshot (1)
   ✓ updateRoundAggregates (2)

 Test Files  1 passed (1)
      Tests  18 passed (18)
   Duration  194ms
```

### Type Safety

All TypeScript compilation passes:
- `packages/shared` types
- `apps/api` coordinator and question
- `apps/web` Stockfish worker and board component

## Files

**Added:**
- `apps/web/public/chess-engine/stockfish-19-lite-single.{wasm,js}`
- `apps/web/public/chess-engine/README.md`
- `packages/shared/src/chess-schemas.ts`
- `apps/api/src/questions/chess-coordinator.ts`
- `apps/api/src/questions/chess-coordinator.test.ts`
- `apps/api/src/questions/packs/birthday/chess-battle.ts`
- `apps/web/src/chess/stockfish-worker.ts`
- `apps/web/src/chess/chess-board.tsx`

**Modified:**
- `THIRD_PARTY_NOTICES.md`
- `packages/shared/src/index.ts`
- `apps/api/src/questions/definition.ts`
- `apps/api/src/questions/authoring.ts`
- `apps/api/src/questions/packs/birthday/manifest.ts`
- `apps/web/package.json`, `package-lock.json`

## Next Steps

1. **Client wiring:** Connect board → worker → server commands
2. **Projector view:** Aggregate display
3. **Admin controls:** Start/pause/monitor
4. **DO integration:** Room commands + persistence + alarms
5. **Testing:** Engine smoke, browser, DO, load simulation
6. **Documentation:** Event runbook, rehearsal guide

## Verification Commands

```bash
# Type check
npm run typecheck

# Unit tests
npx vitest run apps/api/src/questions/chess-coordinator.test.ts

# Content check
npm run content:check

# Build (includes web bundle)
npm run build
```

## Deployment Blockers

Before merge:
- [ ] Complete remaining phases
- [ ] All tests passing (unit + integration + browser)
- [ ] 80-player server simulation
- [ ] Real browser engine verification
- [ ] Documentation updated
- [ ] No unrelated changes
- [ ] Focused commits preserved

## Notes

- **GPL compliance:** Stockfish assets GPL-3.0-or-later, documented with source availability. 26 project not GPL.
- **Casual trust caveat:** Documented in runbook and admin notes. No claims of perfect anti-cheat.
- **1+0 timing:** Each side 60 seconds total, no increment. ~2 minutes max game duration.
- **Up to 80 concurrent:** Server capacity target, not venue/device validation.
- **Venue rehearsal:** Physical testing with older phones and WiFi remains user step.

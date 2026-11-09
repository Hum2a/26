# Chess Frontend Implementation

**Branch:** cursor/chess-frontend-integration-da22  
**Base:** 6c300be2d7137aa20d235140d52df2bcf92b4895  
**For integration with backend PR12:** cursor/chess-round-followup-3212

## Components Implemented

### Core Game Components
- **chess-game.tsx** - Main phone UI controller
  - Server-authoritative state (never sets FEN/clock/result)
  - Engine lifecycle: one worker per active phone
  - Search generation tracking prevents stale bestmoves
  - Position revision captured AT search dispatch
  - Bounded movetime based on remaining bot clock
  - Watchdog timer for search timeout
  - Handles pause/resume position revision invalidation

- **chess-board.tsx** - Interactive board display
  - Touch-friendly square selection
  - Server validates all move legality
  - Accessible with ARIA labels

- **promotion-chooser.tsx** - Modal for piece selection
  - All 4 pieces (Q/R/B/N) including underpromotion
  - Animated with motion/react
  - Cancellable

- **stockfish-worker.ts** - Engine wrapper (existing, verified)
  - UCI protocol implementation
  - 1425 Elo configuration
  - Move generation

- **chess.css** - Complete styling
  - Theme variable integration
  - Responsive (320px+)
  - Reduced motion support
  - Accessible controls

## Tests Implemented

### Component Tests (chess-game.test.tsx)
- ✅ Stale bestmove rejection (positionRevision mismatch)
- ✅ Search generation tracking
- ✅ Promotion trigger
- ✅ Engine states (init/ready/error)
- ✅ Unmount cleanup
- ✅ Bounded movetime
- ✅ Resign action
- ✅ Disabled states

### Smoke Tests (stockfish-engine.smoke.test.ts)
- ✅ Real WASM binary UCI handshake
- ✅ Legal move generation (chess.js validation)
- ✅ 1425 Elo acceptance
- ✅ Promotion handling
- ✅ Search stop/cancel
- ✅ Init timeout bounds
- ✅ Movetime respect

Run smoke tests:
```bash
npx vitest run --browser.enabled --browser.name=chromium stockfish-engine.smoke.test.ts
```

## Protocol Needs (see FRONTEND_PROTOCOL_NEEDS.md)

### Blocking for Clock Interpolation
Current `ChessGuestSnapshot` lacks:
```typescript
serverTime: number,        // Server timestamp when snapshot generated
lastMoveAt: number,        // When last move occurred
paused: boolean           // Is game currently paused?
```

Without this, clocks will:
- Drift from network latency
- Show incorrect time on reconnect
- Not handle pause correctly

### Room Transport
Need verification of command envelope format for:
- `chess-move` commands
- `chess-resign` commands

Currently assumes standard room transport mechanism.

### Readiness Commands (Optional)
No engine readiness reporting to server. Engine failures handled client-side only.
Recommend defer to post-MVP unless host visibility critical.

## Files Modified
- `apps/web/src/chess/chess-game.tsx` (new)
- `apps/web/src/chess/promotion-chooser.tsx` (new)
- `apps/web/src/chess/chess-board.tsx` (updated)
- `apps/web/src/chess/chess.css` (new)
- `apps/web/src/chess/chess-game.test.tsx` (new)
- `apps/web/src/chess/stockfish-engine.smoke.test.ts` (new)
- `FRONTEND_PROTOCOL_NEEDS.md` (new - root level docs)

## Files NOT Modified (Backend Ownership)
- ❌ `packages/shared/src/chess-schemas.ts`
- ❌ `apps/api/**`
- ❌ `package.json` / `package-lock.json`
- ❌ Backend tests

## Integration Next Steps

1. **Backend adds clock interpolation fields** to ChessGuestSnapshot
2. **Verify room command transport** format
3. **Wire ChessGame component** into phone question renderer
4. **Add host/projector views** (basic scaffolds provided separately)
5. **Test full roundtrip** with backend

## Commits

1. `0fa354f` - Game controller + promotion chooser
2. `d12a897` - Board updates + styling
3. `18377de` - Component tests
4. `<this>` - Smoke tests + documentation

## Branch Status

**Ready for integration** with backend PR12 once clock interpolation fields added.

Frontend components are isolated and reusable. No breaking changes to shared schemas.

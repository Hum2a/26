# Kart rollback and trusted device timing

Decision, 17 November 2026: the owner explicitly chose **trusted device-reported finish times** for this casual party game. This supersedes the earlier rule that only room-simulated laps can decide kart results. The room still owns identities, admission, phase changes, persistence, tie handling and points.

## Current gaps

The current `createSelfPrediction` is cosmetic, freezes after 600 ms, reconstructs velocity from a rounded pose, and approximates the replay anchor from RTT. It cannot produce a trustworthy replay of the original physics state. `inputCursor` concerns accepted ingress and must not be confused with a simulation checkpoint. The server currently expires controls and computes every finish itself.

## Implementation contract

- Extend the existing kart reducer, predictor and `openRoomSocket`; no second engine, socket, scheduler or score store.
- New races freeze an explicit versioned `device-v1` timing mode. Existing stored races retain server timing. Show the timing source in host race controls and results.
- Send each guest only their own complete physics/lap checkpoint and last **simulated** input sequence. Include lateral velocity, drift, boost, ramp/cooldown and recovery state. Keep other guests’ input histories/private held items off the wire.
- Record controls against a monotonic race clock. Keep bounded input/state history. On a newer checkpoint, restore the exact state and replay subsequent local inputs in the existing fixed 20 ms steps. Reject stale frames; smooth small visual correction offsets separately from simulation. Work is bounded to the local kart; other racers are interpolated snapshots, not eighty complete rollback simulations per phone.
- Handle host pause, resume, recovery, race replacement, tab suspension and reconnect explicitly. A host pause excludes time; network delay does not shorten elapsed racing time. A long gap must not trigger an unbounded catch-up loop.
- Detect laps through the existing shared checkpoint logic. Freeze a completed local duration once. Show finish submission as pending until a receipt; retry with the same request id after reconnect.
- Submit an authenticated `kart-finish` intent with race id, monotonic elapsed duration and ordered lap splits. The room checks current race membership, finite integer bounds, split consistency, CPU exclusion, host closure and idempotency. It deliberately does **not** claim to verify the reported performance against physics, because the owner chose the casual trust model.
- In device mode, simulated human crossings are provisional and cannot prematurely close the race or award a competing time. CPU finish timing remains room-simulated. Accepted device reports drive the existing standings, recap and score ledger. Equal durations share places. Unreported players at closure are DNFs; reports after final settlement are refused.
- Rehearse the actual phone renderer and existing host controls with latency, frame reordering, correction, pause, recovery, reconnect and pending/accepted finish states. Do not add a browser runner.

## Required checks

Extend `self-prediction.test.ts`, `kart.test.tsx` (including the socket hook), `room-socket.test.ts`, kart component/host-control tests, and shared kart scoring/replay tests. Add Worker coverage in `apps/api/test/kart-device-room.spec.ts` and pure timing coverage in `apps/api/test/kart-device-timing.spec.ts` and register it in the current Worker test project: accepted report, malformed time/splits, wrong race/identity, late report, duplicate/replay, restart durability, CPU exclusion, ties, host pause/end, and stage/guest privacy.

Run unit tests, Worker tests, typecheck, lint, content preflight and build/bundle budget. Use the existing realtime harness to measure the additional checkpoint payload and avoid increasing the server’s current input bottleneck. Local mocks are insufficient to claim physical-phone or venue readiness.

References: [GGPO design](https://github.com/pond3r/ggpo/blob/master/doc/README.md), [prediction and reconciliation](https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html).

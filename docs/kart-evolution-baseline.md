# Kart evolution baseline

Phase 0 local baseline COMPLETE, 4 November 2026. The eleven-case rendering/profile/runtime matrix passes; all fifteen browser scenarios have current passing evidence across a fourteen-pass batch and the corrected power-up run. Required unit/type/API/load/tooling checks pass. No physical-device or production capacity sign-off.

## Reproduce

Use Node 22 (verified temporary runtime: 22.23.4), then:

```powershell
npm run load:kart-baseline
npm run load:kart-baseline -- --extended
npm run load:kart-baseline -- --extended --idle
npm run load:kart-baseline -- --extended --neutral
```

The portable launcher fixes the imported track and populations explicitly. Default is 1/16/21/50/80 racers for six seconds at 10Hz; extended is 50/80 for twenty seconds each. Idle sends no controls; neutral sends 10Hz controls without gas or steering. The general load:realtime command retains legacy ring/quiz mode and supports custom bindings. Verify emitted track/population before interpreting results: earlier shell-based assignments were lost and measured ring defaults.

The test uses real isolated kart-only rooms, authenticated sockets and the existing host command. It asserts imported track and participant count, then pauses and closes each room before the next population. Quiz latency is null because no quiz runs. UTF-8 payload counts and existing server counters are retained.

## Initial imported-circuit sample

Before the input optimisation; six-second local samples with other checks running. [Raw baseline](kart-evolution-baseline-data.json).

| Racers | Stage updates/s | Stage gap p95, ms | Stage KiB/s | Mean guest KiB/s |
| ------ | --------------- | ----------------- | ----------- | ---------------- |
| 1      | 4.5             | 241               | 5.0         | 5.19             |
| 16     | 4.2             | 250               | 39.3        | 8.39             |
| 21     | 4.5             | 248               | 55.1        | 9.13             |
| 50     | 4.3             | 283               | 123.1       | 8.92             |
| 80     | 1.5             | 1402              | 67.1        | 3.11             |

Lower throughput at 80 reflects fewer updates, not an efficiency improvement. No full guest snapshots were sent during the measured race windows.

## Twenty-second comparison

No competing test suite ran during these measurement windows. [Raw comparison](kart-evolution-load-comparison.json) includes existing server diagnostics. All listed load cases passed their functional assertions; a pass does not certify smooth capacity.

| Racers | Inputs       | Version      | Stage updates/s | Stage gap p95, ms |
| ------ | ------------ | ------------ | --------------- | ----------------- |
| 50     | 10Hz driving | Before cache | 2.7             | 863               |
| 80     | 10Hz driving | Before cache | 0.9             | 2103              |
| 50     | None         | Before cache | 4.4             | 235               |
| 80     | None         | Before cache | 4.4             | 233               |
| 50     | 10Hz neutral | Before cache | 3.5             | 552               |
| 80     | 10Hz neutral | Before cache | 0.4             | 6323              |
| 50     | 10Hz neutral | Roster cache | 4.2             | 308               |
| 80     | 10Hz neutral | Roster cache | 1.7             | 2820              |

Movement is not required to reproduce the local stall. PartyRoom now caches the frozen roster by durable scope, phase, question and pack version. A cold-loaded clock hint now refreshes after durable transitions; each durable tick flush still validates current phase/pause/hold and persists controls against durable state. Cold instances reconstruct the hint; it is not a score or identity authority.

The roster-cache sample improved after removing repeated full-clock and roster reads, but 80-racer gaps remain too large. The later clock-hint sample below shows no additional cadence gain. Runtime variability and local workerd socket overhead require further investigation. Do not present these samples as production capacity.

## Pure simulation comparison

`node --experimental-strip-types scripts/kart-simulation-baseline.ts` advances the same reducer without sockets, SQLite or a renderer. On Node 22, twenty seconds of eighty moving racers took 603ms wall time / 626ms process CPU. Raw 50/80 and idle/driving measurements are in the comparison data. This is Node process CPU, not Worker CPU or billed Cloudflare usage.

## Current driving comparison

| Racers | Version                      | Stage updates/s | Stage gap p95, ms |
| ------ | ---------------------------- | --------------- | ----------------- |
| 50     | Roster cache                 | 4.6             | 236               |
| 80     | Roster cache                 | 2.0             | 982               |
| 50     | Clock hint plus roster cache | 4.5             | 244               |
| 80     | Clock hint plus roster cache | 1.8             | 1026              |

Each extended case lasts twenty seconds, with no competing suite. All 50/all 80 racers were observed moving. Roster-only run passed in 63.81s; clock-hint run passed in 58.06s. These samples do not demonstrate a cadence gain from the clock hint, and do not establish 80-racer capacity. Raw samples remain in the comparison JSON.

## Current local browser baseline

Run `npm run perf:kart-render` with Node 22.15 or later. Optional projects: `-- --project=rendering`, `--project=profiled`, `--project=runtime`. The launcher builds through existing content/artifact checks with an ephemeral local proof key; this is an isolated rehearsal bundle, not a deployment.

The explicit local-only adapter `scripts/kart-test-runtime.mjs` selects the Miniflare/workerd backend already locked for API tests (5.20261023.3-beta / 1.20261023.1) for Vite/Wrangler. Dependency versions and lockfile are unchanged. Ordinary developer preview still uses its pinned older backend; its high-population availability problem remains a tooling limitation to review in compatibility work. The adapter rejects non-rehearsal and non-isolated environments. Five guard tests passed, exit 0.

All eleven unchanged-assertion cases passed in 6.1 minutes (exit 0, no signal): ten rendering/profile cases plus the runtime-only 50-driver check. [Canonical measurements](kart-evolution-browser-baseline.json) retain exact samples and CPU-profile hashes. Evidence log: `artifacts/kart-fix-checks/baseline-test-runtime-all.log`.

| Racers | Phone RAF callbacks/s | Mean draws/frame | Rendering pause, ms | Profile samples | Profile duration, s |
| ------ | --------------------- | ---------------- | ------------------- | --------------- | ------------------- |
| 1      | 4.7                   | 25.3             | 645                 | 367             | 22.3                |
| 16     | 4.7                   | 25.4             | 499                 | 886             | 20.2                |
| 21     | 4.7                   | 25.4             | 327                 | 1087            | 21.6                |
| 50     | 4.5                   | 25.4             | 388                 | 2459            | 23.1                |
| 80     | 4.5                   | 25.4             | 378                 | 4037            | 25.0                |

Each population verifies every expected bot sent gas, positive human movement, canvas bounds, authoritative pause, error absence and (in profiled mode) actual inspector CPU samples. Rendering-only records intentionally have no Worker profile. RAF/draw submissions are not GPU presentation FPS; profile samples and native/idle/program/GC time are not billed CPU. Physical phones and production budgets remain unmeasured.

At DPR 2 the High canvas is 538×288 native pixels inside 359×192 CSS pixels; Balanced is 359×192 and Low is 269×144, all fitting the same CSS area. The existing sizing rule now covers the actual canvas mount.

The runtime-only 50-driver case passed with 98 frames, all 50 sending gas, verified movement, health 123ms and pause 375ms. The same workerd PID remained alive. Whole local process CPU rose from 109.8125s to 120.25s; this includes other local runtime work and is not an isolate/billing measurement.

## Method corrections and retained failures

Before method 10, population counts were not accompanied by per-bot sent-input evidence. Those older active-traffic claims are unqualified. The earlier assertion that a second control tab necessarily closes the bot fleet was incorrect: source closes older guest/projector sockets, not control sockets. Explicit credential rotation may replace access. Navigating away from Developer tools stops that page's fleet; its useful same-page kart start/pause controls remain covered by component/registry tests.

Method 10 keeps the Developer fleet and commands on the same page and checks sent input explicitly. Existing failed runs and partial data are retained; none are reclassified as passes.

A minimal fixture reproduced a separate old-runtime in-memory alarm crash. Disk-backed, bridged, inspector and SQLite variants passed, but the actual app disk trial still failed. A synchronous constructor trial also failed in the real app and was reverted. Fixture version 1 had unread POST bodies: its barrier/reset conclusions were confounded. Version 2 drains POST bodies; both the empty async barrier and combined barrier/pong/attachments/SQL cases pass on the old runtime. No speculative core initialisation change remains. [Diagnostic records](kart-evolution-runtime-probe.json).

The decisive unchanged-app comparison was the explicit already-locked test backend: the 50-driver check passed before adopting the guarded local test adapter. This establishes a reproducible test setup, not the precise upstream cause of the ordinary preview stall.

## Final verification and remaining limitations

The final broad browser run passed 14/15 in 9.5 minutes (exit 1), including the complete quiz, admin/results, connected race/podium/privacy, media/wall, graphics/course, driving, layouts and asset recovery. Its sole failed power-up setup remains failed. The corrected power-up test passed separately in 41.7s (1.6m total), exit 0/no signal. Thus all fifteen scenarios have current passing evidence across those runs, not a single green fifteen-case batch. Logs: `browser-phase0-final.log` and `browser-phase0-powers-final.log`.

Solo drift scenarios use a real 390×844 phone viewport and the real Clear track UI, retaining every original speed/boost/recovery assertion and deadline. The default-course trace showed a sweeper erasing a charged drift before release; dedicated sweeper/ramp/boost and desktop graphics tests remain unchanged. The item test now proves the kart passed all three box locations and recovered beyond them, and that recovery retained the exact held item before use; all previous pickup/use/empty/reset assertions remain. These are explicit test preconditions, not physics/input/rule changes. Diagnostic source and bounded DOM/input traces remain in `artifacts/kart-fix-checks`; temporary specs were moved outside test discovery.

Final verification: exact root unit **116 files /458 tests /185.73s**, main/solo typecheck, ten kart/room/phase/facts API suites **88 tests /52.30s**, five-population realtime load **45.66s**, five runtime guard tests, changed-file lint, content and whitespace all passed, exit0/no signal. Exact results: `artifacts/kart-fix-checks/phase0-final-checks.json`; formatting results are recorded separately. The four deferred content drafts remain incomplete as requested.

[Final six-second API load](kart-evolution-baseline-final-load.json): stage updates/s1/16/21/50/80 =4.5/4.3/4.5/4.7/2.5; p95 gaps230/242/239/228/536ms. All racers moved; no full guest snapshots during measured windows. This in-runtime DO stub/RPC harness differs from browser TCP; shorter windows and runtime variability prevent claims of a gain over the earlier20s sample. Eighty racers are not certified smooth.

Current DPR2 captures fit the canvas; the initial phone view still puts lower pedals partly behind the fixed dock. Carry that to Phase6 HUD work. Physical phones, projector hardware, venue networking and production Worker budgets remain unverified. The ordinary preview backend limitation above remains explicit.

Phase0 is complete as a reproducible local baseline. Next: Phase1 contracts/assets/readiness with same-change admin coverage, per the [plan](kart-evolution-plan.md) and [checkpoint](kart-evolution-checkpoint.md). No deployment or live-resource change was made.

# Verification report

[Home](../README.md) · [Documentation](README.md) · [Event runbook](event-runbook.md)

Prompt 18 evidence. These checks ran locally on 23 September 2026. They describe this machine's Cloudflare Vitest emulator. They are not a production performance result. Production was not load-tested, and no email was sent.

<details>
<summary>On this page</summary>

- [Environment](#environment)
- [Load sample](#load-sample)
- [Defects fixed](#defects-fixed)
- [What the suites cover](#what-the-suites-cover)
- [Commands and results](#commands-and-results)
- [Realtime fan-out, 21 October 2026](#realtime-fan-out-21-october-2026)
- [Still to check at the venue](#still-to-check-at-the-venue)

</details>

## Environment

- Windows 10.0.26200, Node v22.12.0, npm 11.19.1.
- Vitest 4.1.11 with `@cloudflare/vitest-plugin` 1.2.3 and workerd 1.20260921.1.
- One synthetic Durable Object room per scenario. `apps/api/.dev.vars` is absent, so Neon and Resend were not contacted.

## Load sample

Command, from `apps/api`, which prints the summary line:

```text
npx vitest run test/load.spec.ts --disableConsoleIntercept
```

`LOAD_GUESTS` defaults to 75 and `LOAD_UPLOADS` defaults to 8. This printed run used those defaults. One sample. Duration 73.69s inside a 83.58s Vitest run. The later full `npm test` passed the same scenario and did not reprint the line.

```json
{
  "environment": "cloudflare vitest local durable object, not production",
  "guests": 75,
  "uploads": 8,
  "burstMs": 1025,
  "ackMs": { "p50": 506, "p95": 981, "p99": 1025 },
  "voteBurstMs": 1945,
  "voteAckMs": { "p50": 959, "p95": 1863, "p99": 1945 },
  "errors": 0,
  "voteErrors": 0,
  "collectRemainingMsAtBurst": 19552,
  "voteRemainingMsAtBurst": 19220,
  "timerLatenessMs": 482,
  "reconnectsCompleted": 8,
  "stageSnapshotMs": 6,
  "counts": {
    "players": 75,
    "choiceAnswers": 75,
    "ballots": 75,
    "receipts": 280,
    "media": 8,
    "jobs": 58
  }
}
```

`burstMs` and `voteBurstMs` are the slowest acknowledgements in each parallel burst, which is the burst duration. The shape collect window had 19,552 ms left when the answer burst started. The guess collect window had 19,220 ms left when the ballot burst started. Both finished with zero rejections. The stage snapshot after the answer burst took 6 ms and reported 75 submissions. Eight phones closed and reconnected; the first phone then had 2 socket opens and 1 reconnect. The shape deadline was observed 482 ms after it was due. During that same run workerd also logged a later overdue alarm of about 2.9 s. The full suite logged further overdue alarms, including one of about 5.4 s. Those are emulator observations. Re-measure them on the staging Durable Object before treating them as an event limit.

The 75 guests are lightweight WebSocket clients on the room stub. A stage socket checks that the live count arrives. Playwright is the real UI path: `apps/web/e2e/quiz.spec.ts` drives one host, one stage, and three phone contexts through the illustrative quiz. Running 75 full browsers was not attempted.

## Defects fixed

Accepted answers, estimates, rankings, text, ballots, and duels were rebuilding a full snapshot for every connected phone. A 75-phone burst then missed the 20-second collect window: 28 answers were rejected with "That answer is too late." The sending phone still receives its own snapshot and acknowledgement. The stage and the host receive the live count. Troll effects, reactions, phase changes, and alarms still reach every connected phone.

An expired upload left its temporary object in the store. Finalising after the upload window now deletes that object and publishes nothing.

## What the suites cover

| Concern                                                                                                                                   | Where it is exercised                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Answer, ballot, score adjustment, and finish survive one restart; a changed payload is rejected                                           | `apps/api/test/hardening.spec.ts`                                        |
| Token spend survives a restart and is applied once                                                                                        | `apps/api/test/troll.spec.ts`                                            |
| Finalisation survives a crash at each handoff                                                                                             | `apps/api/test/media.spec.ts`                                            |
| Lost acknowledgement, reordered command, reused request id, stale phase                                                                   | `hardening.spec.ts`, plus archive and email retries below                |
| Idle alarm, pause across restart, duplicate alarm, host-then-alarm, deadline before the alarm                                             | `apps/api/test/phase.spec.ts` and `apps/api/test/schedule.spec.ts`       |
| Paused or idle alarm does not skip, and one advance races one alarm                                                                       | `hardening.spec.ts`                                                      |
| Transfer, newer tab, spoofed player id, cross-room cookie                                                                                 | `apps/api/test/room.spec.ts`                                             |
| Kick revokes the phone immediately                                                                                                        | `apps/api/test/social.spec.ts`                                           |
| Foreign origin, cross-site fetch, guest used as host, reused transfer                                                                     | `hardening.spec.ts` and `apps/api/test/auth.spec.ts`                     |
| Pre-reveal payloads omit the answer key                                                                                                   | `apps/api/test/quiz.spec.ts`, `hardening.spec.ts`, and the load scenario |
| Client bundle omits `demo-answer-key-v1`, `truthNickname`, and the circle prompt                                                          | `scripts/check-artifacts.mjs`                                            |
| Browser frames omit the answer key before the reveal                                                                                      | `apps/web/e2e/quiz.spec.ts`                                              |
| Oversized and invalid media, rewritten temporary objects, concurrent finalisation, crash recovery, expired temporary object, hidden media | `apps/api/test/media.spec.ts`                                            |
| Hidden gallery response uses `no-store`                                                                                                   | `apps/api/test/results-room.spec.ts`                                     |
| Missing browser APIs stay unknown                                                                                                         | `apps/api/test/device-normalise.spec.ts`                                 |
| Malformed telemetry does not change the player; reconnects are counted once each                                                          | `hardening.spec.ts` and `apps/api/test/device-context.spec.ts`           |
| Archive write failure, retry, and a lost acknowledgement                                                                                  | `apps/api/test/archive.spec.ts` and `apps/api/test/archive-room.spec.ts` |
| Uncertain email uses the same idempotency key                                                                                             | `apps/api/test/results.spec.ts` and `apps/api/test/results-room.spec.ts` |

The email and archive tests use injected adapters. They do not call Resend or Neon.

## Commands and results

- `npm run typecheck` passed.
- `npm run lint` passed with no warnings.
- `npm run format:check` passed.
- `npm test` passed: 33 files, 166 tests, in 203.32 s.
- `npm run build` passed. Checked 227 build files. The Worker bundle is about 1,637.17 kB. The client script is `index-BMsU_KPZ.js` (506.49 kB) and the stylesheet is `index-BGtPbWpf.css` (16.78 kB). Content preflight passed. The build reported PGlite's direct `eval` warnings.
- `npx playwright test --workers=1` passed 9 tests in 44.9 s against `http://localhost:4173`, including the host, stage, and three-phone quiz.

`.github/workflows/check.yml` runs those commands on Ubuntu with one Playwright worker. GitHub Actions was not executed for this report.

## Realtime fan-out, 21 October 2026

`npm run load:realtime` joins simulated phones, sends one answer each, then drives a live kart race for 6 seconds with every phone sending 10 controls a second. A stage and a control screen are connected throughout. This is local workerd in one process with the simulated phones, not production.

| Guests | Measure                                  | Before    | After    |
| ------ | ---------------------------------------- | --------- | -------- |
| 8      | Answer ack p95                           | 581 ms    | 98 ms    |
| 8      | Stage race updates per second (target 5) | 2.8       | 4.6      |
| 8      | Worst gap between stage race updates     | 841 ms    | 226 ms   |
| 8      | Phone traffic during the race            | 14.5 KB/s | 7.4 KB/s |
| 30     | Answer ack p95                           | 541 ms    | 264 ms   |
| 30     | Stage race updates per second            | 0.8       | 4.7      |
| 30     | Worst gap between stage race updates     | 11.3 s    | 232 ms   |
| 80     | Answer ack p95                           | 3,113 ms  | 785 ms   |
| 80     | Stage race updates per second            | 0.7       | 4.0      |
| 80     | Worst gap between stage race updates     | 31.8 s    | 317 ms   |
| 80     | Full snapshots to phones during the race | 320       | 0        |

The "before" figures are the unchanged room with the harness added. Phones idle (`LOAD_INPUT_HZ=0`) showed the remaining cost at 80 guests was one transaction per control message, which is why controls are now written once per tick. The full plan, the reasons for each change and what was left out are in [docs/jackbox-realtime-plan.md](jackbox-realtime-plan.md).

Test results for this change on the development machine:

- `npm run test:unit`: 70 files, 276 tests passed.
- `npm run typecheck` passed. `npm run build` passed, with 513 build files checked for secrets and content preflight passing.
- API suite with `operations.spec.ts` and `results-room.spec.ts` excluded: 310 of 313 tests passed. Two of the three failures were re-run on their own: `auth.spec.ts` passed 13 of 13 (the full-run failure was PGlite starting under load) and the patch test was fixed and passed 3 runs of 3. `archive-room.spec.ts` "reports preparing and ready" fails the same way on unmodified HEAD.
- `operations.spec.ts` and `results-room.spec.ts` assumed a `.dev.vars` without `DATABASE_URL` and `EMAIL_TEST_RECIPIENT`. On this machine both are set. After the shared-pool fix they no longer hang. They still fail on those two assumptions: three tests between them, which expect the local outbox and no test recipient.
- After the cleanup commit, `npm run lint` reports no errors. Twelve React Fast Refresh warnings remain, all from before this work.
- GitHub Actions has not run since at least `43cbce4`: GitHub refused to start the job because of the account's billing or spending limit.

## Still to check at the venue

- A physical phone, a real rotation, and the venue Wi-Fi.
- A projector or HDMI output at the hall resolution.
- The staging Durable Object under a real 75-guest burst. Repeat the latency, error, reconnect, and timer-lateness figures there.
- Remote Neon export and Resend delivery, once credentials exist. Local adapters already cover a failed export and an uncertain send.
- Party questions, the party sting, and question media are still the illustrative pack.

## Player control and late entry, 30 October 2026

- Final `npm run test:unit -- -- --maxWorkers=1`: **99 files, 401 tests passed**
  (235 seconds), including fresh-phone recovery, same-identity socket replacement,
  definitive refusal retries, uncertain transfer retries and request timeouts.
- Final `npm run typecheck` and targeted ESLint on all changed source/test files
  passed. Formatting checks and `git diff --check` passed.
- The real Worker runtime passed the first four player-control cases: entry
  persistence and private projection, reconnect/transfer while closed, transfer
  revocation and score-preserving recovery, and authorisation/replay for both entry
  commands. This is partial evidence, not a passing room suite.
- Two later filtered real-runtime runs passed the recovered-phone/removal replay
  case and reveal-time late-join/pause/reconnect case, one selected test each.
  Unselected cases were excluded by the diagnostic filter and are not passes.
- The nickname-collision rollback test stalls in the native runtime. A separate
  native SQLite constraint probe and an existing constraint test also stall.
  The exact machine/runtime cause remains unresolved. Tests were retained without
  disabling cases or weakening assertions. The compatible Cloudflare test plugin update
  to 1.4.11 resolves the previous test-import stall; production Wrangler is unchanged.
- The final connected player-control browser rehearsal passed: close → refused
  fresh join → reopen → successful retry, rename/score adjustment, removal,
  fresh-phone private recovery while entry is closed, reload and stage privacy.
  It also passed viewport checks from 320px to 1920px. A prior attempt timed out
  waiting for the rename acknowledgement; the retained assertion passed on rerun
  without a timeout increase or a test bypass.
- The quiz browser run exercised the late join through pause/resume and accepted
  answers, then exposed a real layout issue: the answer dock intercepted the
  cracked-screen Dismiss control. Live guest screen effects now render outside the
  scroll stacking context with a portal. Its placement, escape dispatch and
  cleanup regression plus the existing screen-effect cases passed **11 tests**.
  The final separate three-phone quiz run passed in **1.4 minutes**, through all
  mixed rounds and the podium. Its helper was updated for real fact-advance labels,
  fact-content changes within one phase and the exact podium heading, with a
  15-second bound on command-response waits. Both targeted browser rehearsals
  therefore passed on their final runs; the full Playwright suite was not run.
- No deployment, physical-phone test or venue rehearsal was performed for this
  change. See `docs/event-runbook.md` for the entry and private recovery drill.

## Kart-only lobbies, 31 October 2026

- Full unit suite: **99 files / 403 tests passed** (286.55 seconds).
- New real room suite: **3 tests passed**, covering durable creation/replay,
  unchanged birthday order, private mode metadata, authorised start/refusal/replay,
  late spectators and direct podium. Alternate quiz/rehearsal starts are guarded.
- The connected `kart-lobby.spec.ts` browser flow passed in **59.0 seconds**:
  create → join phone/stage → kart-only start → late spectator → pause/resume and
  reload → results → podium → saved room overview. Control visibility and overflow
  were checked at 320, 390, 430 and 844×390px with reduced motion. The loaded Admin
  screenshot at 1440px was visually inspected.
- Root typecheck, targeted lint, formatting and `git diff --check` passed.
- No deployment or new full-room load/physical venue rehearsal ran. These focused
  room tests do not establish a full API-suite pass; the earlier native rollback
  limitation remains. Another kart race uses a fresh lobby.

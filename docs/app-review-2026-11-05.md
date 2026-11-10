# App review — 5 November 2026

**Implementation update:** the seven source defects below now have fixes and
regression tests in the working tree. Production email handling and Phase 4 Look
integration are also implemented. Focused web70/70 and release35/35 checks pass;
full type/API/browser/release verification is still in progress. The review below
records the original findings; use the latest build-progress/checkpoint for status.

Review of the clean local checkout at `e3ae926`, the approved kart evolution plan,
recent Stage A/B/C work, and read-only staging/production pages. This is a review,
not an implementation or release. No live room, deployment, email or secret was
changed. Forbidden local generated directories and secret files stayed closed.

## Release mismatch — address first

Both deployed **clients** identify their source build as `4182604`, whereas the
local HEAD is `e3ae926` (`git rev-list --count 4182604..HEAD`: 46 commits).
Their public health endpoints both return HTTP 200 and version `0.0.5`, but that
shared version does not establish source parity or identify the Worker revision.

Evidence from read-only HTTP on 5 November, around 19:08–19:10 UTC:

- Production HTML loads `/assets/index-CajNT0mX.js`; its health-page chunk contains
  the rendered build identity `4182604`.
- Staging HTML loads `/assets/index-BJkjYOSm.js`; its health-page chunk also contains
  the rendered build identity `4182604`.
- Production Question packs has neither the show-length estimate nor **Suggest a
  mixed order**, both unconditionally present in the current
  `apps/web/src/admin/running-order.tsx` (lines 92–115).
- Both sites' `/admin` responses lack the security headers added in local source.

Reconcile the source revision, built client and Worker deployment before treating
the merged changes as released. The review did not rebuild or redeploy either
remote environment.

## Confirmed source defects

1. **[P1] The new anti-framing policy would break real admin rehearsals.**
   `apps/web/public/_headers:31–33` applies `X-Frame-Options: DENY` and
   `frame-ancestors 'none'` to `/admin*`. The app embeds its real phone and stage
   rehearsals at `/admin/phone-preview/...` and `/admin/stage-preview/...`
   (`apps/web/src/admin/phone-preview-panel.tsx:15–16,103–106,136–139`). Those
   same-origin iframes will be refused when the new headers are applied. Preserve
   protection against external framing while allowing the intended same-origin
   preview routes. Current production previews render because those new headers
   are not currently delivered; this is a defect in the newer local release.
   Cloudflare documents that [`_headers` applies to static responses](https://developers.cloudflare.com/workers/static-assets/headers/),
   so Worker-generated API responses need their own policy if one is required.

2. **[P2] Own-kart prediction does not stop at its advertised stall limit.**
   `apps/web/src/kart/self-prediction.ts:219–222` limits time since the previous
   render and then advances `bodyAt`; it does not limit the age of the last fresh
   room frame. Identical room frames return early at line 190. With an unchanged
   accepted frame, held throttle and a render every 16 ms, the actual source moved
   the kart **33.51 metres in ten seconds**, despite its documented 600 ms limit.
   Phones can show fictitious travel during a network stall and snap back on
   recovery. Scores remain authoritative. Bound prediction from the last fresh
   server anchor and test repeated animation frames, rather than only one large
   time jump.

3. **[P2] Existing rehearsal bots can enter the real birthday game.**
   `apps/api/src/developer/bots.ts:56` refuses adding more bots after a birthday
   script exists. `apps/api/src/room/party-room.ts:1318–1336` checks only the lobby
   phase when starting that script. Create a normal lobby, add bots, then start
   the birthday game: those synthetic players are retained. Refuse the start
   until bots are removed, with a clear host message and start/receipt tests.

4. **[P2] The request body limit is neither a byte limit nor a bounded read.**
   `apps/api/src/room/routes.ts:1115–1124` names a 65,536-byte limit, but fully reads
   undeclared/chunked bodies and checks `text.length`. Unicode bodies can be much
   larger in UTF-8 while passing the check, and arbitrarily large bodies are
   buffered before rejection. Count streamed bytes and stop at the limit.

5. **[P2] The safe browser-test wrapper does not cover all supported environment
   syntax.** `scripts/test-safe-env.mjs:21` blanks only a column-zero
   `DATABASE_URL=...`. The application parser accepts whitespace around the name
   and equals sign (`apps/web/vite.config.ts:46–77`). A valid whitespace variant
   therefore survives the wrapper and can leave tests connected to a real
   database. Prefer explicit isolated bindings, or cover all accepted assignment
   syntax. No real environment file was opened or altered during this review.

6. **[P2] The release script checks currently fail on Windows.**
   `npm run test:release` produced **24 passes and one failure**. The temporary-file
   test at `scripts/test-safe-env.test.mjs:17` fails because `runSafely` uses a
   Windows shell (`scripts/test-safe-env.mjs:39`), which strips the quotes from its
   `node -e` argument. The child reports `Expected ',', got ':'` for the Windows
   path, and the test receives exit 1 instead of 0. Fix argument preservation;
   retain the assertion. This was a synthetic temporary fixture, not a real
   secret file.

7. **[P2] Production freeze/check safeguards are bypassed by advertised deploy
   commands.** `release.sh:65–67,153` enforces production confirmation, the party
   freeze and checks. `package.json` also exposes `deploy:prod`, `deploy:both` and
   their full variants, which call `scripts/release.ts` directly. That entry point
   builds and deploys without the confirmation, freeze or full validation gate.
   Put essential release guards at the common deployment boundary, or clearly
   restrict and document those bypasses. No deploy command was run.

## Approved kart work still missing

The recent merged work improves party readiness and mobile multiplayer, but does
not finish the approved kart plan. These are source omissions, not just stale
checkpoint labels:

| Phase | Still missing                                                                                                                                                                                                                                              |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4     | Boost wind/chromatic effects, lens dirt, bloom, optional AO/tilt-shift, live Look settings/safety/history and final verification. The actual Look bench is still labelled work in progress; ordinary live phone/stage renderers do not receive its preset. |
| 5     | Connected gamepad/mouse steering, item/recovery shortcuts and the planned tuning/contact-response work. Solo gamepad already exists.                                                                                                                       |
| 6     | Real checkpoint-validated solo time trials, lap variants, best/total records and record persistence. The visual countdown exists; the versioned grid-hold countdown remains deferred.                                                                      |
| 7     | Tennis-ball projectile, bomb, homing projectile and agreed treats behaviour. `packages/shared/src/kart/kart-powers.ts:3` still permits only turbo, shield and oil.                                                                                         |
| 8     | Additional original playable course/track catalogue, mode selection, kart audio/soundboard and scoped offline solo practice. The existing imported circuit and development ring remain.                                                                    |
| 9–10  | Complete capability rehearsals, remaining integration/browser coverage, repeated-race soak, measured device/venue performance and release sign-off.                                                                                                        |

The Look bench copy also says solo integration is still to follow, although its
isolated native solo rehearsal now exists (`environment-bench.tsx:88–91`).

## Other unfinished party work and operational checks

- Projector pairing without signing the projector laptop into admin.
- Typed-answer moderation and round-media pre-moderation. Nickname screening does
  not moderate the text displayed by answer reveals.
- Excluding an individual answer in all-answer voting mode. The current domain
  refuses exclusion unless the round uses a shortlist (`questions/vote.ts:460`).
- Automatically skipping a photo that fails to load. The frame shows a fallback
  but remains until its normal expiry (`wall/framed-photo.tsx:60–73`).
- Check production result-email restrictions. Whenever `EMAIL_TEST_RECIPIENT`
  exists, `auth/create-email.ts:47–58` still restricts recipients, including in
  production. Deployment does not remove that binding. Its current remote state
  was not inspected and no email was sent.
- The latest saved full browser run is partial: unresolved admin-question-details
  and draft-polish direct-request 403s, the price-card layout tolerance failure,
  and the developer-tools disconnect-timeline failure; remaining specs were not
  run. Some are test defects, but the complete browser gate is not green.
- Real iPhone/Android, projector/HDMI, venue Wi-Fi, permission/network failure and
  the long repeated-race/resource soak remain unsigned. Chromium and bots do not
  replace those checks.
- The four factual content drafts remain intentionally deferred: Reddit tribunal,
  Ferrier estate, Nextdoor and property-price roulette. Content validation confirms
  they remain drafts. Figurine and Cursed Search History are ready but outside the
  saved order; inclusion is a host/content choice.

## Verification from this review

- Clean initial working tree; local HEAD `e3ae926`.
- Both public health endpoints: HTTP 200, correct environment, version `0.0.5`.
- Chrome production admin, question catalogue, real isolated phone/stage preview
  and early Look bench inspected; staging public home and admin sign-in inspected.
  Staging has no existing admin session; no sign-in email was requested.
- `npm run content:check`: **passed**, retaining the four expected drafts.
- `npm run test:release`: **failed**, 24/25 tests passed; Windows quoting failure
  above. No tests were changed, skipped or weakened.
- Type checks on both the shell's default runtime and explicit Node 22 stalled
  without a result and were stopped (approximately eight and five minutes,
  respectively). They are **unverified**, not passed.
- `npm run test:unit` then ran alone on Node 22. After more than three minutes it
  had produced no Vitest banner or test result and was stopped. Its interruption
  is **not a passing result or an assertion failure**; the current full unit suite
  remains unverified. No unrelated processes were stopped.
- The review document was formatted with Prettier and `git diff --check` passed.

Check logs are local under `artifacts/review-2026-11-05/`. No current full API,
production-build or complete cross-device browser pass is claimed by this review.

Recommended next work: reconcile the deployed client/Worker revisions, fix the
confirmed defects, obtain fresh complete verification, then resume the unfinished
kart plan. This review did not implement those fixes or mark any phase complete.

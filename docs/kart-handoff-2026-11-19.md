# Kart handoff — 19 November 2026

Point Claude at this folder and nothing else:

`c:\Users\aden\Documents\Humza Bday Game\26`

That is the whole project. The kart code, the handoff, and the progress note all live inside it. There is no second folder. The edits were never stored somewhere else on this PC. They are files in that folder, and they are in its git history.

Aden drove a new race after the acceleration fix and said it is working very well. Read this file, then `AGENTS.md` and `docs/build-progress.md` (section “18 November 2026 — Phone-owned kart”).

Do not push or deploy unless Aden asks in that turn. Do not push `master`. Do not force-push. Do not add Playwright. Do not restart `npm run dev` unless the server has actually stopped. The commit below is authored only as Aden Butt.

## Dev server

`npm run dev` is already running from the repo root (Vite on port 5173, started 19 November 2026 00:02 UTC). It hot-reloaded the kart client after the acceleration fix.

- This machine: http://localhost:5173/
- Phone or tablet on the same Wi-Fi: http://192.168.1.161:5173/ (Ethernet). Use that.
- Do not use the NordLynx address `10.5.0.2`. A phone cannot reach the game through the VPN.
- Do not start a Cloudflare tunnel unless Aden asks. The last trycloudflare URL is dead.
- Guest cookies on localhost are not Secure. Phones must use the `http://192.168.1.161:5173` address.

No process restart is required for the current fix. Refresh the phone page and start a **new** race. An already-open race keeps the prediction object that was created when that page loaded, so a refresh is the reliable way to pick up the fix. `GuestKart` creates that object once with `useState(createSelfPrediction)`.

## Git

The kart commit is `9a196140b9bee5ffcbf58cb1c5c0280297bcbe78` on `master`. Author and committer are both Aden Butt `<adenreh@gmail.com>` only. Aden asked for it to be pushed to `origin/master` (`https://github.com/Hum2a/26.git`). `origin/master` before that push was `9223693` (`Merge pull request #47 from Hum2a/kart-server-poses`, https://github.com/Hum2a/26/pull/47).

Message: “Drive the kart on the phone, and keep full throttle when the room clock is ahead.”

These are the files in that commit. Each path is on this PC under the project folder:

- `c:\Users\aden\Documents\Humza Bday Game\26\apps\web\src\kart\self-prediction.ts`
- `c:\Users\aden\Documents\Humza Bday Game\26\apps\web\src\kart\self-prediction.test.ts`
- `c:\Users\aden\Documents\Humza Bday Game\26\apps\web\src\kart\TouchController.tsx`
- `c:\Users\aden\Documents\Humza Bday Game\26\apps\web\src\kart\kart.css`
- `c:\Users\aden\Documents\Humza Bday Game\26\apps\web\src\kart\kart.test.tsx`
- `c:\Users\aden\Documents\Humza Bday Game\26\apps\web\src\kart\controller-input.test.tsx`
- `c:\Users\aden\Documents\Humza Bday Game\26\docs\build-progress.md`
- `c:\Users\aden\Documents\Humza Bday Game\26\docs\kart-handoff-2026-11-19.md`

Stashes from the earlier experiment were dropped after PR #47. Do not try to recover them. The merged pose work is in `9223693`. Phone-owned driving, the control-button move, and the acceleration fix are `9a19614`.

## What this race is

Party “Start kart race” is the room (`PartyRoom`), not the solo practice game.

- Practice `/kart` and Admin → Kart → Drive are `apps/kart-solo`. Client physics every frame, one driver, the glider is the solo one. Do not turn the party race into that engine.
- The party race shares `npm run dev`. New races freeze `timingMode = "device-v1"` in `apps/api/src/questions/kart/kart.ts`. The phone measures the finish. The room still checks identity, membership, admission, settlement, ties, and points, persists before ack, and owns phases. See `docs/kart-rollback-plan.md`.
- Birthday `kart-sprint` is Mario circuit, 3 minutes, one lap. The demo/rehearsal pack override is party ring, 45 seconds. Default lobby track is `mario-circuit-v1`.
- Course features (boost, ramp, moving sweeper) sit on the **opening** straight of Mario circuit, not the finish. `courseEnabled` is true for `mario-circuit-v1` and `26-park-v1`.

## What Aden and Humza decided

Humza: this kart is a quiz time trial. Seeing other people is fun. What matters is how fast you finish.

Aden: the phone is the kart you drive. The room pose is what other people see. It should not tug the driven kart. Finish time stays the phone clock. Back to track still snaps to the room.

That is implemented and committed in `9a19614`, which is on `origin/master`. After the opening placement the driven kart ignores ordinary device-v1 position packets. Recovery (Back to track) still adopts the room body and clears stored controls. The legacy predictor (races that are not `device-v1`) is unchanged, including its 0.75 m quiet band and 6 m snap. New races do not use that predictor.

## Why the kart was crawling, and the fix

Aden tested the phone-owned build and the kart barely accelerated.

Cause: `createRollbackPrediction` in `apps/web/src/kart/self-prediction.ts` treated a room clock that was ahead of the phone clock as an oil slow. The public effect list always includes the driver, and `slowedMs` is `0` when they are not slowed. The check was `roomElapsed + slowedMs > phoneSimTime`, so a lead of even one millisecond put the kart on the off-road throttle for every step (`0.58` thrust plus extra drag, terminal speed around 4 m/s on Mario circuit).

The lead is normal. The intro snapshot is elapsed 0. The predictor initialised there while the race was not running, so the phone clock did not move. The first collect snapshot was already ahead, and that gap never closed because later packets advance at the same rate.

Fix, in the same file:

- A slow applies only when `slowedMs > 0` and the phone sim time is still inside that window.
- While the kart is still parked (almost no speed, lap not started), a later room clock moves the phone clock forward. It does not step the skipped time and does not move the kart. Once the kart is moving, the phone clock is left alone.
- A stronger boost on the room body (the start boost, or an item boost) is copied onto the phone body. The room position is not copied.

Measured while diagnosing, not as a live lap: one second of gas on Mario circuit was about 11 m/s with a synced clock, and about 4 m/s while the false slow was on. The server launch boost is level 2 (about 9× thrust for a perfect start) or level 1 for a good start, for up to a second. Copying `boostMs` / `boostLevel` is what puts that back on the phone without the position snap.

## Controls

During a race, the driving view shows one **Controls** button at the top, beside the view switch. “Use steering slider” / “Use thumb pad” and “Swap sides” are inside that panel. Opening the panel releases the pedals. The steer zone is linear to the edge (no dead zone); that part is already on `master` via PR #47.

Admin phone preview (`/admin/phone-preview/...`) does not set `data-layout="race"`, so it will not show the race overlay. It also does not pass `allowLandscape`, so a landscape preview shows “Rotate your phone”. A real kart race does allow landscape (`guest-page.tsx`: question kind kart, or mode kart).

## Checks already run

For the acceleration fix, on 19 November 2026:

- `npm run typecheck` passed.
- `npm run lint` — 0 errors, 30 existing react-refresh warnings, structure check passed.
- `npx vitest run src/kart` in `apps/web` — 45 files, 233 passed.

Not run: `npm run test:unit`, `npm run build`, `npm run budget:web`. Do not describe those as passed.

Aden drove a new race after the fix, on 19 November 2026, and said it is working very well. The crawl is gone. He did not separately narrate the finish-straight spike or the landscape button placement.

Earlier the same uncommitted change also had typecheck, lint, and 231 kart tests, before the two new prediction tests. `npm install` was required once because `leaflet` was missing from `node_modules` even though it is in the lockfile. The lockfile did not change. Do not run `npm audit fix`.

## What Aden already confirmed

He refreshed, started a new race, and said it is working very well. Acceleration feels right.

Still worth a look if the night continues, not because the last race failed:

1. The end of Mario circuit (the bend into the finish straight, then the straight) should no longer teleport the driven kart. Other karts may still blend between room poses.
2. Landscape: Controls is a small top button. Slider and swap-sides are inside it.
3. Race again should leave Ranks and return the phone to Play. That behaviour was already on `master` before this commit.

If it is still slow, check the phone really loaded the new module (hard refresh). Then look at `advance()` in `createRollbackPrediction`: gas samples must have `at <= simulatedAt`, `running(true)` must stay set during collect, and `env.offRoad` must be false on the Mario grid (`importedSurfaceAt` is `"road"` at the grid slot around `x = -8, z = 1.5`). Do not “fix” a crawl by copying the room position back onto the driven kart. That was the end-of-lap spike.

## Layout of the prediction

`apps/web/src/kart/self-prediction.ts`

- `createSelfPrediction()` sends `device-v1` to `createRollbackPrediction()`, everything else to `createLegacyPrediction()`.
- `GuestKart` calls `prediction.running`, `prediction.server(race, performance.now(), 0)`, and `prediction.pose` on its own frame. It also calls `prediction.input` from the pedals.
- `KartCanvas` `predictSelf` calls `prediction.server(race, now, serverRoundTrip() ?? 120)` then `prediction.pose(now)`, and overwrites the self participant. The camera is glued to that pose. The driven kart is not glide-blended. Other karts use `blendKartPose` in `apps/web/src/kart/presentation.ts` via `circuit.ts`.
- Tick and input gap, already on `master`: `kartTickMs = 100`, `kartInputGapMs = 50` in `packages/shared/src/kart/kart-race-schema.ts`. The phone sends a little slower than that (`kartInputGapMs + 5` in `useKartSocket.ts`). Heartbeat is 100 ms.
- `stepDriving` ignores a step longer than 20 ms. Both the room (`arcade-v2`) and the phone step at 20 ms.

## Leave alone

- Do not deploy, and do not change staging or production secrets.
- Do not open or quote `.env`, `.dev.vars`, or `apps/api/.data/local-admin-proof.key`.
- `apps/web/public/chess-engine/README.md` still has old conflict markers from before this work. Do not clean them unless asked.
- One socket: `openRoomSocket`. One room: `PartyRoom`. No second score engine.
- Server stays authoritative except the approved `device-v1` finish time and this phone-owned driving pose.
- British English in guest and stage copy. No answer keys or personal diagnostics on the projector.
- Plan file, do not edit unless Aden changes the plan: `c:\Users\aden\.cursor\plans\kart_spikes_and_phone_controls_fdc00b1f.plan.md`.

## After this commit

`9a19614` is on `origin/master`, authored only as Aden Butt (`adenreh@gmail.com`), author and committer. Do not push further commits, and do not open a PR, unless Aden asks. The next session starts in `c:\Users\aden\Documents\Humza Bday Game\26`.

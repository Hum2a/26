# One-lap kart sprint

Each phone has its own playable 3D chase view, touch controls and local driver HUD. The TV is a whole-room spectator map and live scoreboard for 50-plus players, with five leaders pinned and five more drivers cycling every four seconds. All public kart positions appear on the map; only the top three get number labels to keep the map readable. A phone can switch to a lightweight personal map without changing controls or race authority. The sprint ends after one lap per driver or at the server's 45-second deadline. Finished times rank ahead of DNFs; equal times share a place. DNF scores zero. Finisher points are `round(question.points × (participants − place + 1) / participants)`.

## Try the real multiplayer rehearsal

Run `npm run dev`. Sign in, create a fresh lobby, connect a presentation screen and join from phones using its room code. In Admin → Live controls, choose **Start local kart rehearsal**. Advance through the illustrative quiz question, then the kart get-ready and prompt beats. The answering beat is the race. The server reveals the sprint podium, then the existing scores/final/podium flow continues. Pause and Resume work on the same saved scheduler. Closing/reloading a phone releases the throttle after its last input expires; reconnect restores its kart.

This is an explicit local development start action. The button is development-only and the server requires `APP_ENV=local` as well as a valid control credential. Staging/production reject it. It pins `kart-rehearsal-v2` (the stored v1 fixture remains resolvable with its original wording), containing an existing illustrative quiz fixture and the kart round; it does not edit the demo version or release a birthday running order. The normal authenticated Question packs preview rehearses the controller layout only, with no room, simulation or fabricated result.

`kart-sprint` is ready in the birthday catalogue, excluded from the running order. To use it at the party, include it in a separately released birthday version. The engine follows whatever stored version a room already owns.

## Deliverables

- `apps/web/src/kart/KartGameWrapper.tsx`: identity comes from the public room snapshot. Renders the spectator map/scoreboard and observes server completion once per race/player through `onRaceComplete({ playerId, lapTimeMs, status })`. DNF has a null lap time. No upstream menu, external links or external multiplayer service.
- `apps/web/src/kart/useKartSocket.ts`: an adapter to the existing `openRoomSocket`, sending fresh controls every 100ms. It opens no additional connection and never queues old controls after reconnect. The display reads server elapsed time; no local timer can finish or score the race.
- `apps/web/src/kart/TouchController.tsx`: React and native pointer/range/keyboard APIs only. Normalised steering, A accelerate, B brake/reverse, R drift. Pointer cancellation, lost capture, blur, hidden document, disabled state and unmount release controls. Gestures are suppressed on the controller surface; accessibility zoom elsewhere remains available.
- `packages/shared/src/kart.ts`: pure server reducer, injected elapsed time, acceleration/steering damping, drift charging/release boost, annular track boundaries, eight ordered checkpoints, lap completion and standings.
- `apps/api/src/questions/kart.ts`: small persisted input queues, frozen participants, saved simulation, existing scheduler tick integration and idempotent score ledger settlement.

The requested JSX/JS deliverables use TSX/TypeScript to match this repository's checked React code.

## Transport contracts

This project already has authenticated native WebSockets, retries, role credentials and snapshot recovery. The requested signals use that transport; adding a Socket.io server beside the Durable Object would split room authority. Socket.io wire framing is not supported by this adapter.

| Requested signal          | Actual room contract                                                                                                                                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `START_MINIGAME`          | The existing public snapshot changes to `play.question.kind = "kart"`. `play.kart` includes `raceId`, `trackId`, `timeLimitMs`, frozen `participants`, and `elapsedMs`. The race is interactive only in the unpaused, unheld `collect` phase.  |
| Phone input               | `{ kind: "command", name: "kart-input", requestId, input: { raceId, sequence, steer, gas, brake, drift } }`. The authenticated socket supplies identity; a payload cannot select a player or room.                                             |
| `SUBMIT_LAP`              | Deliberately replaced by server checkpoint/physics completion. No client time, frame total or checkpoint hash can award a lap. A hash of client-controlled data does not authenticate a finish.                                                |
| `LIVE_LEADERBOARD_UPDATE` | Each saved tick broadcasts the existing snapshot with `play.kart.leaderboard`: player id, name, time, finished flag, place and eventual points. Reconnect gets the same full state.                                                            |
| `MINIGAME_ENDED`          | Server snapshot has `kart.ended=true`, final statuses and leaderboard; existing phase progression enters reveal → scores → next question or final/podium. The host sends an ordinary Advance intent, never an arbitrary winner or score bonus. |

Phones receive their own kart plus the leading eight results and their own place; the TV receives the full race. The guest-only input cursor lets a replacement phone continue the saved sequence without relying on its device clock.

Inputs are shape-checked, range-checked, race-scoped, sequence-checked, throttled to at most one accepted input per 80ms, and persisted in a small per-driver queue before being applied. The session freezes participants at intro; late arrivals watch this race. Controls expire after 400ms of simulated active time. The stage is read-only. There is no client position or lap-time authority. The input channel is untracked and receives no success toast/receipt per thumb movement; replay protection is the saved sequence. Results use the existing score ledger's unique question/player key.

## State and timing

```text
quiz scores → kart intro (freeze roster) → prompt → collect (race)
     → all finish OR 45 seconds OR host advance
     → reveal (freeze results / settle ledger once)
     → scores → next round, or final → podium
```

The existing single durable scheduler owns both the collection cutoff and one `kart-tick` auxiliary job every 200ms. Physics integrates in steps of at most 50ms and never past the cutoff. An overdue wake-up catches up from saved elapsed time and accepted server-stamped controls. Ticks cannot act as phase deadlines. Stale generation jobs are discarded; if a tick finishes the round, the simultaneously due cutoff cannot advance it a second time. Pause stores job remainders and resume shifts them together. These are active race seconds; pausing does not consume the 45 seconds. No independent server interval, alarm owner or in-memory score store is added.

State lives in the existing `round_state` extension: `kart-session`, `kart-race`, and `kart-input:<player-id>`. Each input writes only its small bounded queue; the shared simulation is written per tick. A phone never writes the whole race. No Neon calls, media processing or new resources are in the input path. The original draft-polish change adds this table with room schema metadata version 14; kart needs no further migration.

## Engine provenance and rendering

Source inspected: [Nathan-Richard-21/mario-kart-js](https://github.com/Nathan-Richard-21/mario-kart-js), pinned at `0f7a4305981206193c5efba64bc90755e6e85773`, particularly `src/PlayerController.jsx` and `src/constants.js`. Its README declares MIT; retain the upstream permission notice in `THIRD_PARTY_NOTICES.md`. The related original [Mario-Kart-3.js](https://github.com/mustache-dev/Mario-Kart-3.js) was also inspected. No claim is made that a fork can grant rights to unrelated third-party artwork.

The connected party adaptation ports the driving model's damped acceleration/turning and charged release boost into pure server logic, retuned for a short party circuit. The circuit and low-poly karts are procedural. The connected party renderer does not load the upstream models, track, music, landing page, Playroom store or effect stack. A separate solo practice bundle, described below, now includes the upstream kart and circuit. This is a party sprint adaptation, not a drop-in build of the upstream game or a reproduction of its original track.

Three.js is pinned to `0.186.1` and its types to `0.186.0`. WebGL is lazy-loaded on participating phones. The stage map is SVG and needs no WebGL context. Rendering has no shadow maps, particles, bloom or post-processing. Low-poly trees, tiered stands, a raised plinth, lane markings and a themed 26 infield mark form the venue. Static scenery and kart bodies/wheels use shared/instanced meshes, with a phone scene bounded to one kart even if a full-room snapshot is supplied. The phone renderer caps DPR at 1 and frame rate at 30fps, disables antialiasing and requests low power. Theme variables supply all colours. The phone camera follows behind its own server-projected kart. Reduced motion uses a north-up overhead camera without rotating behind the kart, removes position smoothing and keeps leaderboard changes to short fades. Render resources and listeners are disposed on unmount. A lost/unavailable WebGL context offers Retry circuit while authoritative timing and the text leaderboard continue. Context restoration and theme changes rebuild and dispose the scene; hidden tabs stop the rendering loop. Position and heading smoothing are frame-rate independent, use the shortest turn, and never predict a future server pose. Existing optional stage audio remains controlled by the show audio adapter; no copyrighted soundtrack or phone audio is added.

Browser tests verify actual WebGL and cross-session input/score flow. Physical iOS/Android thermal behaviour and a 50-device venue network remain separate verification. This presentation change is local; the birthday running order remains unreleased.

## Enhanced driving feedback and input replay

Phones show server-projected drift charge, active boost and wrong-way velocity, along with gate markers, their current place and a separate finish/DNF card. These public fields have defaults for older snapshots and expose no private controls or score secrets. A drift boost requires a fresh, deliberate release while accelerating; expired controls and braking cannot cash it in. Speed is shown as a proportion of the game's maximum, not an invented real-world speed measurement.

The zero-dependency controller offers a steering slider or a captured thumb pad with a centre dead zone, and a Swap sides option. The native range input remains available to keyboard and assistive technology. Multiple pointers are independent; switching layout releases held inputs. The circuit remains a flat ghost-kart time trial: R charges a drift boost, not a physical jump or collision/item mechanic.

`reduceKartTimeline` advances each ghost's accepted server-stamped input history independently and clones race state once per tick. Another driver's packet timing cannot subdivide its physics. Retroactive/stale queue entries cannot renew a throttle; only active server time advances and all drivers stop at the same 45-second cutoff. Full-room tests cover 80 persisted queues across eviction and independent controls, plus pure timeline isolation and renderer resource budgets. This is simulated full-room verification, not an 80-device venue network benchmark.

## Personal driving and spectator broadcast

`KartDriverView` lazy-loads the existing renderer with the authenticated `selfPlayerId`. `createCircuit` restricts its dynamic meshes to that driver, omits number sprites, and shares the existing low-poly venue. `kartCameraPose` frames the same smoothed public pose as the rendered kart; it neither predicts movement nor submits a lap. Switching to the personal SVG map unmounts and disposes WebGL. The map remains behind the canvas during loading/recovery, so graphics failure does not remove all track context. Existing pause, disconnect, hidden-tab input release, GPU retry, touch ownership and server timing continue to apply.

`KartMap` renders all stage participants and labels the three leaders, with checkpoint sectors, finish stripe and theme colours. `KartLeaderboard` pins the first five server-ordered rows, cycles the remaining field in groups of five every four seconds, offers previous/next controls and stops cycling while paused or hidden. Ties retain their server places; it never locally sorts or calculates points. This pagination is a display preference, not a room phase or gameplay timer.

The implementation follows the current [Three.js perspective camera](https://threejs.org/docs/pages/PerspectiveCamera.html), [WebGL renderer](https://threejs.org/docs/pages/WebGLRenderer.html) and [Motion animation](https://motion.dev/docs/react-animation) documentation. One existing room socket and its 100ms control heartbeat remain the only input transport; the server's saved 200ms ticks still own all driving simulation, finish/DNF decisions and score settlement.

The server projection carries the frozen `participantCount` separately from each phone's top-eight-plus-self leaderboard. The HUD uses this count for “Position 1 of 50”; older snapshots without it show position alone. Guest pose and leaderboard shortlists remain restricted, and the full-room DO test checks the count alongside those restrictions.

## Play the actual upstream circuit in solo practice

Run `npm install` if dependencies changed, then `npm run dev` and open [solo practice](http://localhost:5173/kart). Admin → Question packs → select `kart-sprint` → Phone & big screen also offers **Play standalone kart**. The existing phone/stage rehearsal remains a layout rehearsal; the link opens a separate playable mode.

Press **Start driving**. On a keyboard, use the arrow keys to accelerate/reverse/steer and Space to hop/drift. On a phone, hold A and steer with the other thumb; B brakes/reverses and R hops/drifts. Hold a turn and drift at speed, then release drift for the upstream charged boost. Switch between the steering slider and thumb pad, or swap control sides. Pause and Reset kart are always available after loading. Hiding/leaving the game pauses it and releases controls; Resume requires a deliberate action. A lost WebGL context or failed model download offers Retry circuit.

`apps/kart-solo` is a separate static Vite/React Three Fiber bundle embedded by the public `/kart` route. Web development and production builds run its build first; generated files live under the ignored `apps/web/public/kart-engine/`. Rebuild with `npm run build -w @26/kart-solo` and refresh after editing engine source during web development. The same Worker serves the generated assets in production. No additional hosting service is needed.

This copies the pinned upstream kart and circuit GLBs and adapts its real ground-following/wheel, steering, drift and chase-camera code. Draco decoding stays on the site's own origin. The bundle pins Three 0.176.0, Fiber 9.1.2 and Drei 10.0.7 independently of the existing party renderer. Mobile settings use DPR 1, low-power rendering, no shadows, post-processing or particles. Copyright/provenance notices are retained in `THIRD_PARTY_NOTICES.md`, `apps/kart-solo/UPSTREAM.md` and the served bundle.

This is explicitly free solo practice. The upstream store holds transient solo input/physics only: no room, multiplayer, party scores, validated lap or 45-second cutoff. There is no alternative socket client or score engine. Existing live races continue to use authoritative server physics and the procedural party circuit. Full collision, opponents and items are not supplied by this slim upstream adaptation. Connecting this engine to the room is a later stage, as requested.

Automated coverage: `solo-page.test.tsx` checks the public engine frame and kart-only admin link. `kart-solo.spec.ts` plays the actual WebGL circuit, verifies both GLBs and the same-origin WASM decoder, drives and drifts, checks pause/reset and context recovery, holds/releases touch input at 320/390/430px and short landscape, and exercises failed asset recovery. Physical iOS/Android performance remains unverified.

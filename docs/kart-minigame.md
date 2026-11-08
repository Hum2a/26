# One-lap kart sprint

[Home](../README.md) · [Documentation](README.md) · [Event runbook](event-runbook.md)

Open **Admin → Kart** (`/admin/kart`) for direct access. **Create kart lobby** makes a fresh multiplayer room for just the real Mario circuit. **Drive** embeds solo practice, with **Open kart full screen** for a separate tab. **Phone & stage** opens the existing layout comparison. Solo driving and layout previews do not start a room race.

## Kart-only lobbies

Choose **Create kart lobby**, share its normal guest link/code and connect the stage.
When everyone is in, choose **Start kart race** in Live controls, then advance the
get-ready and prompt beats. The race is one lap with a three-minute server limit,
up to 80 racers, the normal pause/resume and course switches, and saved race results.
After the race, reveal → scores → final → podium uses the existing scheduler;
kart-only rooms skip the birthday phone-facts interlude.

This is a real room mode available in deployed environments, separate from the
development-only ring rehearsal. Creation freezes the existing `kart-sprint`
question in that room, without saving or replacing the birthday running order.
The lobby cannot be switched into a quiz or developer rehearsal. Ordinary rooms
keep their existing start options. A retry reuses the same creation request;
reopening a room preserves its type and frozen script.

The grid freezes when Start kart race is accepted. Late arrivals may join and
watch, but cannot enter that race. Create a fresh kart lobby for another race;
this version does not restart a completed race in place. To rehearse without
guests, join from a private second browser tab and connect the stage from the
host browser. Players, removal, recovery, joining controls and score tools remain
on their existing Admin pages.

Each phone has its own playable 3D chase view, touch controls and local driver HUD. The TV is a whole-room spectator map and live scoreboard for up to 80 players, with five leaders pinned and five more drivers cycling every four seconds. All public kart positions appear on the map; only the top three get number labels to keep the map readable. A phone can switch to a lightweight personal map without changing controls or race authority. The sprint ends after one lap per driver or at the server's three-minute birthday deadline (45 seconds for the legacy ring rehearsal). Finished times rank ahead of DNFs; equal times share a place. DNF scores zero. Finisher points are `round(question.points × (participants − place + 1) / participants)`.

<details>
<summary>On this page</summary>

- [Try the real multiplayer rehearsal](#try-the-real-multiplayer-rehearsal)
- [Deliverables](#deliverables)
- [Transport contracts](#transport-contracts)
- [State and timing](#state-and-timing)
- [Engine provenance and rendering](#engine-provenance-and-rendering)
- [Enhanced driving feedback and input replay](#enhanced-driving-feedback-and-input-replay)
- [Personal driving and spectator broadcast](#personal-driving-and-spectator-broadcast)
- [Play the actual upstream circuit in solo practice](#play-the-actual-upstream-circuit-in-solo-practice)
- [Arcade handling and solid scenery (October 2026)](#arcade-handling-and-solid-scenery-october-2026)
- [Animated drift effects](#animated-drift-effects)
- [Collectable power-ups](#collectable-power-ups)
- [Drivers and guest faces (October 2026)](#drivers-and-guest-faces-october-2026)
- [Drift handling polish (21 October 2026)](#drift-handling-polish-21-october-2026)

- [Power, turbo tiers and course features (22 October 2026)](#power-turbo-tiers-and-course-features-22-october-2026)
- [Birthday integration (22 October 2026)](#birthday-integration-22-october-2026)

</details>

## Try the real multiplayer rehearsal

Run `npm run dev`. Sign in, create a fresh lobby, connect a presentation screen and join from phones using its room code. In Admin → Live controls, choose **Start local kart rehearsal**. Advance through the illustrative quiz question, then the kart get-ready and prompt beats. The answering beat is the race. The server reveals the sprint podium, then the existing scores/final/podium flow continues. Pause and Resume work on the same saved scheduler. Closing/reloading a phone releases the throttle after its last input expires; reconnect restores its kart.

This is an explicit local development start action. The button is development-only and the server requires `APP_ENV=local` as well as a valid control credential. Staging/production reject it. It pins `kart-rehearsal-v2` (the stored v1 fixture remains resolvable with its original wording), containing an existing illustrative quiz fixture and the kart round; it does not edit the demo version or release a birthday running order. The normal authenticated Question packs preview rehearses the controller layout only, with no room, simulation or fabricated result.

`kart-sprint` is last in the default birthday running order. Reorder it in Admin → Question packs, then use Start birthday game in a fresh room. The room freezes that script; existing games keep their stored version.

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
| `LIVE_LEADERBOARD_UPDATE` | Each saved tick broadcasts a compact `kart` frame, merged into `play.kart`, with leaderboard player id, name, time, finished flag, place and eventual points. Full snapshots and patches recover the current state on reconnect.               |
| `MINIGAME_ENDED`          | Server snapshot has `kart.ended=true`, final statuses and leaderboard; existing phase progression enters reveal → scores → next question or final/podium. The host sends an ordinary Advance intent, never an arbitrary winner or score bonus. |

Phones receive their own kart plus the leading eight results and their own place; the TV receives the full race. The guest-only input cursor lets a replacement phone continue the saved sequence without relying on its device clock.

Inputs are shape-checked, range-checked, race-scoped, sequence-checked, throttled to at most one accepted input per 80ms, and persisted in a small per-driver queue before being applied. The session freezes participants at intro; late arrivals watch this race. Controls expire after 400ms of simulated active time. The stage is read-only. There is no client position or lap-time authority. The input channel is untracked and receives no success toast/receipt per thumb movement; replay protection is the saved sequence. Results use the existing score ledger's unique question/player key.

## State and timing

### Multiplayer input boundaries

The existing room socket remains the only connection. Before buffering controls, the room checks that collection is open, the race id matches and the authenticated player belongs to its frozen roster. Inputs then pass the shared strict schema. Each driver has at most four transient arrivals, with increasing sequences and at least 80ms between arrivals; malformed or noisy controls cannot displace another driver's queue. These arrivals have no success acknowledgement and can be lost on eviction. The next saved tick commits validated input queues before applying them.

Host phase commands flush pending arrivals inside their existing transaction before changing the phase. Pause catches the saved simulation up to the pause boundary, releases throttle/steering/drift through the pure reducer and clears pending input histories while retaining each driver's sequence cursor. Resume requires fresh controls; pausing cannot cash in an old drift. Disconnect still uses the existing 400ms active-time expiry as a server fallback.

Race ticks use compact `kart` frames between full snapshots and patches. The client rejects older room versions, backwards race time, frames for paused/non-collecting views and attempts to reopen an ended race. Reconnect restores the same authenticated driver and its saved cursor; control packets are never added to the ordinary retry queue. The imported `/kart` circuit remains separate solo practice until the next integration stage.

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

Three.js is pinned to `0.186.1` and its types to `0.186.0`. WebGL is lazy-loaded on participating phones. The stage map is SVG and needs no WebGL context. Rendering has no shadow maps, bloom or post-processing. Drift feedback uses a bounded instanced spark batch. Low-poly trees, tiered stands, a raised plinth, lane markings and a themed 26 infield mark form the venue. Static scenery and kart bodies/wheels use shared/instanced meshes, with a phone scene bounded to one kart even if a full-room snapshot is supplied. The phone renderer caps DPR at 1 and frame rate at 30fps on Low and 60fps on Balanced/High, disables antialiasing and requests low power. Theme variables supply all colours. The phone camera follows behind its own kart, drawn from cosmetic local prediction (below). Reduced motion uses a north-up overhead camera without rotating behind the kart, removes position smoothing and keeps leaderboard changes to short fades. Render resources and listeners are disposed on unmount. A lost/unavailable WebGL context offers Retry circuit while authoritative timing and the text leaderboard continue. Context restoration and theme changes rebuild and dispose the scene; hidden tabs stop the rendering loop. Position and heading smoothing are frame-rate independent and use the shortest turn. Other racers are carried forward along their heading at their reported speed for at most 250 ms between 5 Hz frames, so they glide rather than stall; reduced motion keeps exact server poses. Existing optional stage audio remains controlled by the show audio adapter; no copyrighted soundtrack or phone audio is added.

Browser tests verify actual WebGL and cross-session input/score flow. Physical iOS/Android thermal behaviour and a 50-device venue network remain separate verification. This presentation change is local; the birthday running order remains unreleased.

## Enhanced driving feedback and input replay

Phones show server-projected drift charge, active boost and wrong-way velocity, along with gate markers, their current place and a separate finish/DNF card. These public fields have defaults for older snapshots and expose no private controls or score secrets. A drift boost requires a fresh, deliberate release while accelerating; expired controls and braking cannot cash it in. Speed is shown as a proportion of the game's maximum, not an invented real-world speed measurement.

The zero-dependency controller offers a steering slider or a captured thumb pad with a centre dead zone, and a Swap sides option. The native range input remains available to keyboard and assistive technology. Multiple pointers are independent; switching layout releases held inputs. The circuit remains a flat ghost-kart time trial: R charges a drift boost, not a physical jump or collision/item mechanic.

`reduceKartTimeline` advances each ghost's accepted server-stamped input history independently and clones race state once per tick. Another driver's packet timing cannot subdivide its physics. Retroactive/stale queue entries cannot renew a throttle; only active server time advances and all drivers stop at the same 45-second cutoff. Full-room tests cover 80 persisted queues across eviction and independent controls, plus pure timeline isolation and renderer resource budgets. This is simulated full-room verification, not an 80-device venue network benchmark.

## Personal driving and spectator broadcast

`KartDriverView` lazy-loads the existing renderer with the authenticated `selfPlayerId`. `createCircuit` restricts its dynamic meshes to that driver, omits number sprites, and shares the existing low-poly venue. `kartCameraPose` frames the same pose as the rendered kart and never submits a lap.

**Own-kart prediction (decision, 5 November 2026).** Drawing the phone's own kart only from 200 ms server ticks, with controls sent on a 100 ms heartbeat, made steering and pedals respond after roughly 300–500 ms. `self-prediction.ts` now runs the shared `stepDriving` with the same profile, walls, road surface and course features on the phone's recorded controls. Each server frame anchors it: the server body at `elapsedMs` is replayed with the phone's controls over the measured round trip (`serverRoundTrip`, median of recent pings, 120 ms until measured) and the difference from the drawn pose becomes a visual offset that eases away in about 100 ms; differences over 6 m snap. Lateral slip and vertical speed are not public, so they are rebuilt as zero and corrected by the next frame. Replay and extrapolation are bounded to 600 ms. This is drawing only: the room still owns gates, finishes, items, points and every saved pose, and no message format changed. `useKartSocket` sends a control change at once when 90 ms have passed since the last send (the room drops arrivals under 80 ms apart) and otherwise merges changes into one send at the gap; the 100 ms heartbeat continues. Switching to the personal SVG map unmounts and disposes WebGL. The map remains behind the canvas during loading/recovery, so graphics failure does not remove all track context. Existing pause, disconnect, hidden-tab input release, GPU retry, touch ownership and server timing continue to apply.

`KartMap` renders all stage participants and labels the three leaders, with checkpoint sectors, finish stripe and theme colours. `KartLeaderboard` pins the first five server-ordered rows, cycles the remaining field in groups of five every four seconds, offers previous/next controls and stops cycling while paused or hidden. Ties retain their server places; it never locally sorts or calculates points. This pagination is a display preference, not a room phase or gameplay timer.

The implementation follows the current [Three.js perspective camera](https://threejs.org/docs/pages/PerspectiveCamera.html), [WebGL renderer](https://threejs.org/docs/pages/WebGLRenderer.html) and [Motion animation](https://motion.dev/docs/react-animation) documentation. One existing room socket and its 100ms control heartbeat remain the only input transport; the server's saved 200ms ticks still own all driving simulation, finish/DNF decisions and score settlement.

The server projection carries the frozen `participantCount` separately from each phone's top-eight-plus-self leaderboard. The HUD uses this count for “Position 1 of 50”; older snapshots without it show position alone. Guest pose and leaderboard shortlists remain restricted, and the full-room DO test checks the count alongside those restrictions.

## Play the actual upstream circuit in solo practice

Run `npm install` if dependencies changed, then `npm run dev` and open [solo practice](http://localhost:5173/kart). Admin → Question packs → select `kart-sprint` → Phone & big screen also offers **Play standalone kart**. The existing phone/stage rehearsal remains a layout rehearsal; the link opens a separate playable mode.

Press **Start driving**. On a keyboard, use the arrow keys to accelerate/reverse/steer and Space to hop/drift. On a phone, hold A and steer with the other thumb; B brakes/reverses and R hops/drifts. Hold a turn and drift at speed, then release drift for the upstream charged boost. Switch between the steering slider and thumb pad, or swap control sides. Pause and Reset kart are always available after loading. Hiding/leaving the game pauses it and releases controls; Resume requires a deliberate action. A lost WebGL context or failed model download offers Retry circuit.

`apps/kart-solo` is a separate static Vite/React Three Fiber bundle embedded by the public `/kart` route. Web development and production builds run its build first; generated files live under the ignored `apps/web/public/kart-engine/`. Rebuild with `npm run build -w @26/kart-solo` and refresh after editing engine source during web development. The same Worker serves the generated assets in production. No additional hosting service is needed.

This copies the pinned upstream kart and circuit GLBs and adapts its real ground-following/wheel, steering, drift and chase-camera code. Draco decoding stays on the site's own origin. The bundle pins Three 0.176.0, Fiber 9.1.2 and Drei 10.0.7 independently of the existing party renderer. Mobile settings use DPR 1, low-power rendering, no shadows or post-processing; drift feedback uses bounded instanced sparks. Copyright/provenance notices are retained in `THIRD_PARTY_NOTICES.md`, [apps/kart-solo/UPSTREAM.md](../apps/kart-solo/UPSTREAM.md) and the served bundle.

This is explicitly free solo practice. The upstream store holds transient solo input/physics only: no room, multiplayer, party scores, validated lap or 45-second cutoff. There is no alternative socket client or score engine. Existing live races continue to use authoritative server physics and the procedural party circuit. The later arcade model adds static collisions and local power-ups; opponents are not supplied by this solo adaptation. Connecting this engine to the room is a later stage, as requested.

Automated coverage: `solo-page.test.tsx` checks the public engine frame and kart-only admin link. `kart-solo.spec.ts` plays the actual WebGL circuit, verifies both GLBs and the same-origin WASM decoder, drives and drifts, checks pause/reset and context recovery, holds/releases touch input at 320/390/430px and short landscape, and exercises failed asset recovery. Physical iOS/Android performance remains unverified.

## Arcade handling and solid scenery (October 2026)

New ring races store private physicsVersion arcade-v2. Their server simulation and the imported solo circuit use packages/shared/src/kart-driving.ts: velocity-based acceleration, braking before reverse, speed-sensitive steering, lateral grip, deliberate drift-release boosts and swept circular contacts with sliding. Adapters advance in bounded 20 ms steps. Solo rendering interpolates resolved poses; neither interpolation nor the hop visual changes collision authority. Saved races without a physics version retain the previous movement rules. Public snapshot fields are unchanged for client compatibility.

The procedural ring uses shared inner/outer bounds (34/50 units) and 128 collision segments per boundary. The imported track uses generated static edges from its pinned GLB, transformed with the same scale/position as the renderer. Run npm run kart:colliders (or append -- --audit for a projected geometry dump). The generator records the asset SHA-256 and slices solid meshes Object_10, Object_12, Object_13 and Object_47 at kart body height (-1.05 world Y). Object_24 is road; Object_11 is traversable dirt. Low kerbs, the distant backdrop and overhead sign are excluded. No visual asset was modified. Spatial indexing limits each solo step to nearby edges. Off-road driving reduces speed and grip; unsupported ground requires manual recovery. This is a ground-plane arcade collision model, not a vertical rigid-body simulation, and karts do not collide with one another.

Back to track restores a recent clear road pose with space to steer, stops motion and charge/boost, and requires fresh controls. Solo Reset kart still returns to the starting grid. The connected action is a tracked kart-recover command containing raceId and requestId; identity comes only from the authenticated guest socket. The room validates live phase, membership, race id and a two-second active-race cooldown, catches up accepted inputs, clears queued controls and persists the result and ordinary idempotency receipt before acknowledging. Recovery retains the saved checkpoint/progress and cannot advance the race clock or award progress. Paused/held/completed races cannot recover. Replays reuse the request id. Large server-pose discontinuities snap the camera rather than flying across the circuit.

Try locally with npm run dev, then Admin → Kart → Drive for the imported track. Connected races use the existing multiplayer rehearsal/workspace; they still use the procedural ring, not the imported solo circuit.

## Animated drift effects

Both 3D kart views emit eight recycled rear-wheel sparks while drifting. Their spread/size grows with the existing drift charge; charged sparks use the theme highlight, and boost release turns the stream into longer, faster trails. Emission eases in/out. Reduced motion replaces travelling particles with two stationary wheel glows. These visuals read the existing solo physics body or authoritative connected driver feedback and never calculate boosts, change grip, submit controls or change scoring. The ring combines its previous solid boost cone and the new drift feedback into one instanced batch, preserving the existing full-room draw-object budget and disposal path. Solo uses one instanced mesh, shared geometry/material and its existing render loop; pause freezes the scene and reset remounts the effect.

Visual maths lives in apps/web/src/kart/drift-effects.ts and is reused by apps/kart-solo/src/DriftEffects.tsx. No textures, dependencies, audio, bloom or per-frame React state were added. The SVG spectator/lightweight map remains unchanged. Try Admin → Kart → Drive: hold A, steer gently with R held, then release R while continuing to accelerate.

## Collectable power-ups

New races store powerUpVersion 1. Drive through a glowing box to fill one inventory slot, then press Use power-up (the button names the held item). Turbo gives 1.2 seconds of boost while accelerating. Bubble shield lasts five active seconds and blocks one oil hit; it does not remove wall collisions. Oil drops three units behind the kart, lasts eight active seconds and slows a kart for 1.6 seconds, cancelling its drift/boost. Its owner has a 750 ms grace period before they can hit their own slick; this makes oil/shield practice possible in solo. A slick can hit each kart once. The world keeps at most 64 active slicks.

Connected races have six rows of three boxes at shared track positions. Each box recharges separately for each driver after eight active seconds, so one guest cannot take another's box. A full slot cannot be overwritten. Item choice rotates reproducibly through turbo/shield/oil from the driver's game-scoped id and collection count. Swept position checks, item choice, inventory, effects and timers all live in the shared pure reducer. The phone submits only raceId/requestId through the tracked kart-use-item command; the room catches up accepted inputs and persists item use, hazards and its ordinary idempotency receipt before acknowledgement. Paused/held/completed races, spectators, stale race ids and empty inventory are rejected. Using an item does not release driving controls or directly alter scoring/progress/time. Held inventory is private to its phone; public views contain box availability and active shields/slows/hazards. Existing stored races without the power-up version keep their original rules.

Solo practice uses the same item rules locally in its existing ephemeral store and has three boxes on the opening road straight. It has no opponents or live room. Reset clears inventory/cooldowns/hazards; manual recovery retains a held item but clears active buffs/slows. Both 3D renderers show boxes, oil and shields; the SVG map shows boxes, slicks and shield rings. Existing theme roles supply colours and reduced motion keeps boxes stationary. The finish-line tiles are now two instanced batches to make room for the new visuals. The solo inventory subscribes to item/effect changes rather than rerendering the game on every physics frame.

Reload clients after a deployment that introduces the new power-up projection. Older saved races are supported by the optional power-up fields, but an already loaded pre-power-up client has the previous strict wire schema.

## Drivers and guest faces (October 2026)

Every kart now has a driver. A guest chooses one of six styles in the lobby (Racer, Party animal, Royalty, Weekend driver, DJ, Bandit) and may put their own photo on the driver's face. A guest who does not choose gets a stable default from their join order. The choice can change until the podium.

**Room.** `player.driver_style` and `player.driver_face_media_id` hold the choice. The `driver` socket command is persisted before its acknowledgement and replayed from its receipt on retry, like other guest commands. The style must be in the shared roster (`packages/shared/src/kart-driver.ts`). The face must be the guest's own accepted, unhidden `face` photo. Every snapshot player carries `driver: { style, faceMediaId? }`, so the phone, stage and admin all see the same driver. The field is optional, so an older cached phone still reads newer snapshots.

**Face photos.** These reuse the existing upload pipeline with `purpose: "face"`. Unlike question media, a face can be taken in the lobby, is not cancelled when the question changes, and has its own allowance (5 per guest, 400 per room) that does not use up question photos. Faces are excluded from the stage's question media, the results gallery, statistics and troll media. Admin → Media lists them with a face marker; hiding one there returns that guest to a plain driver at once. The phone crops the photo square around the centre at up to 512px before upload. The picker says where the photo appears (on the guest's kart and the big screen) and that it is not added to the gallery.

**3D driver.** `apps/web/src/kart/driver-rig.ts` builds a low-poly driver from shared, instanced parts posed through one node rig per frame: torso, head, arms, steering wheel and per-style headgear, tinted from the theme. Only face photos are per-driver meshes. Geometry, material and draw-object counts are the same for one driver as for eighty (`circuit.test.ts`). The driver leans into turns, glances outward on a drift, looks back at the chase camera for the first two seconds of the race so a guest sees their own face, and turns round to wave on finishing. Reduced motion keeps the poses without the looping wave.

**Stage.** The leaderboard shows each driver's face or style emblem. The live map shows faces in the three leaders' markers; showing all eighty would be unreadable.

**Not covered.** The solo `/kart` practice bundle (separate Three.js version) has no room and therefore no chosen driver. Physical phones and the projector have not been checked; the driver rendering was checked in headless Chromium with a stand-in face.

## Drift handling polish (21 October 2026)

The shared arcade model now latches drift direction at entry. Neutral steering and counter-steering preserve charge while drift and throttle stay held; steer into the corner to tighten/charge faster, or out to widen. Minimum entry speed is 40% of normal top speed, with a lower 25% sustain threshold. Releasing throttle, braking, stale controls, off-road or contact cancels charge. A deliberate throttle-held drift release awards a tiered turbo: 700/1400/2400 charge-ms gives 600/900/1200 ms of boost. Stronger turbo acceleration makes the payoff immediate, with no additive boost stacking. Charge is capped; collision/recovery still cancels drift and boost. Legacy pre-arcade races retain their old simulation. The compact connected ring retains gentler steering tuning than the imported solo circuit.

Solo presentation reads the same simulation for gamepad, touch and keyboard. It adds eased slip-angle body yaw/lean, an entry hop, a wider chase camera on boost, three named charge levels, and 32 recycled world-space wake sparks alongside the existing eight wheel sparks. The wake stays on the curved racing line rather than rotating rigidly with the kart. Reduced motion keeps static wheel feedback and removes hop, lean and camera travel/FOV changes. No audio, assets, dependencies, sockets or score engine were added.

Try `/kart`: accelerate, steer and hold Space (or the touch drift button), adjust steering while holding drift, then release drift while continuing to accelerate. The HUD says when a turbo is ready. These are deliberately tuned arcade mechanics inspired by Nintendo's documented hold/turn/release mini-turbo and Sega-style controllable slides; they are not a claim to reproduce either game's proprietary physics or every mechanic.

Run the focused real-engine drift regression with `npx playwright test --config playwright.kart.config.ts`. It builds the solo engine and serves its production files locally, without party credentials. The test charges on the opening straight, returns steering to neutral, verifies the bank survives, releases drift, observes Boost and over 100 km/h, then verifies recovery stops the kart. The broader `/kart` iframe rehearsal remains in `kart-solo.spec.ts`; it now starts the manoeuvre earlier on a gentler line and retains its speed and distance checks. Turbo feedback stays visible alongside terrain warnings, so dirt cannot hide an active boost.

## Power, turbo tiers and course features (22 October 2026)

Forward speed now follows engine acceleration and power per unit mass, with rolling resistance and quadratic aerodynamic drag. There is no forward-speed clamp or attraction to a target velocity. Turbo expiry removes extra thrust; it does not brake towards the old normal-speed target. The `maxSpeed` profile field is retained only as a steering/drift-entry reference. Solo uses 12 m/s² initial acceleration and 240 W/kg; the smaller party ring uses 5 m/s² and 32 W/kg. These are arcade tuning values, not a manufacturer specification. Reverse still has a bounded speed, and stale/disconnected controls apply additional resistance to bring the kart to rest.

The existing 700/1400/2400 ms drift thresholds now give **Mini / Super / Ultra** turbo, with increasing thrust (6/9/12 times engine thrust) and 600/900/1200 ms duration. Both phone and solo use the same three-segment gauge, with named ready and active tiers. Public `driftCharge` keeps its old first-tier normalisation for compatibility; `driftChargeMs` carries the full three-tier bank. Effects use the full bank too.

### Try the course

Run `npm run dev`, then open **Admin → Kart → Drive** or `/kart`. Course set-up has independent floor-boost, ramp and sweeper switches, Clear track, Restore course, Return to starting grid and direct rehearsal starts for each real interaction. Changing set-up resets and pauses practice; resume to drive. The imported opening straight has a boost and ramp in its left lane and a moving sweeper in its right lane. Rehearsal starts are placed on verified road, avoiding the imported start-grid surface gap around z = −30 to −32.

- **Floor boost:** drive forwards across the chevrons with A held for a Super-tier burst. Swept checks catch crossings between simulation steps; cooldown prevents repeated activation while sitting on the pad.
- **Ramp and glider:** cross a ramp forwards at speed to launch. The real physics body has height and vertical velocity. Hold A to glide, steer gently in flight, or hold B for a quicker descent. The wing deploys visually; landing retains horizontal momentum. Airborne karts clear floor sweepers and item/oil interactions. Boundary walls remain solid at all heights, so flying cannot escape the track.
- **Moving sweeper:** a visibly marked obstacle moves across its lane using active simulation time. Contact slows the kart and cancels drift/turbo. It freezes while paused. This is a track obstacle, so an oil shield does not block it.

### Connected race controls

New connected races start with course features **off**. In **Admin → room → Live controls → Kart course**, the host sees airborne/boosting counts, switches all features on or off, reads the latest 20 changes and opens solo rehearsal. Switching off lands every kart and clears course boost. Commands are validated in the room and persisted through the existing host receipts before success. Course history is control-only; guests and the projector receive the enabled state and public poses. Older races without the course field refuse the new switches.

The ring has one boost pad, one ramp and one moving sweeper, with the same pure collision/effect rules as solo. Both the 3D view and SVG map show enabled features; karts, drivers and chase cameras follow projected flight height. No new timers, sockets, score engines or external assets were added.

### Verification entry points

- API pure suites: `npm run test -w @26/api -- --project auth test/kart-driving.spec.ts test/kart-score.spec.ts test/kart-powers.spec.ts test/kart-guard.spec.ts`
- Room persistence/receipts: `npm run test -w @26/api -- --project room test/kart-room.spec.ts`
- Real solo browser rehearsals: `npx playwright test --config playwright.kart.config.ts --workers=1`

The imported solo circuit and multiplayer ring remain separate tracks. Gliding is ramp-launched flight with automatic landing; it does not add an unrestricted free-flight mode.

## Birthday integration (22 October 2026)

The birthday round uses the imported Mario circuit (`mario-circuit-v1`) with a three-minute server deadline. `kart-route.ts` supplies the centreline and ordered progress; `kart-track.ts` indexes baked solid walls and road/dirt triangles from the pinned GLB. `npm run kart:colliders` regenerates both the solo collider data and shared `kart-circuit.json`. The visible start-grid mesh bridges a small road-mesh seam. The connected GLB is raised 1.6 metres visually so its road matches the shared renderer’s ground plane; collision coordinates stay in X/Z.

At intro the server freezes up to 80 active players, sums their ledger points and manual adjustments, sorts highest score first and uses joining order for ties. Five columns and sixteen staggered rows give each kart a unique start slot. Karts remain ghosts. Initial safe recovery positions preserve the distance behind the line, so recovery cannot erase a starting disadvantage. Later score changes do not reseed an underway race.

The existing scheduler, control receipts, input queues, pause/resume, reconnect, score settlement and podium flow apply to this round. Imported races start with course features enabled; Live controls can switch them off and force a safe landing. The local `kart-rehearsal-v1/v2` fixtures retain their original ring and 45-second timing. Phones render their own kart; the stage uses the lightweight whole-field map. The admin Drive tab rehearses the real imported engine; the Phone & stage tab rehearses the real layout.

## Adaptive graphics (24 October 2026)

Connected phone views and the real solo engine offer **Auto**, **High** and
**Low** graphics. The choice stays in the current tab's session storage. Auto
starts at high detail up to 15 racers, balanced at 16–20 and low above 20. The
connected view uses the server's full participant count, not its phone-only pose
projection. Legacy snapshots fall back to their participant list.

High/balanced/low cap phone pixel density at 1.5/1/0.75 and draw every/every
second/every fourth decorative drift spark. Solo uses the same pixel densities
and keeps spark trails only on High. Course geometry, obstacles, items, shields,
physics, server ticks, input cadence and scoring do not change. The projector's
spectator map is unchanged. Changing graphics resizes the existing renderer.

Auto also watches actual visible frame cadence while racing: a two-second
warm-up, then 90 samples per window. More than 20% of gaps above 42ms marks the
view strained and selects Low. Hidden/suspended time is ignored. Two smooth
windows mark it smooth. A detected slowdown stays latched until the user changes
the mode, avoiding repeated quality oscillation; High always overrides Auto.
This is a practical in-view measurement, not a promise about a phone model or a
GPU fingerprint. Reduced motion continues to use the existing rendering rules.

To rehearse without guests, open **Admin → Kart → Drive → Course set-up**. Set
**Graphics rehearsal: room size** to 16 and 21 and inspect the detail status,
then choose High or Low. This exercises the real solo renderer and shared
policy without inventing live racers. Drive to check frame health on the actual
device. The control does not reset the kart; course-edit controls still do.

## Expanded kart items — locally verified

Before a race, open **Admin → room → Live controls → Kart items**. Choose the allowed expanded items and save. Empty selection gives no box pickups. **Use original items** restores the existing turbo/shield/oil pool. The current race freezes its choice when collection starts, including during pauses; after racing, changes apply to the next start. Older tabs are explicitly asked to refresh before expanded gameplay.

Treats give the holder a 600ms turbo and drop nothing. Tennis balls bounce, bombs drop behind with a 1.5-second fuse, and homing bolts select an eligible racer ahead. With nobody ahead, homing gives the same small personal boost. Shields absorb one item hit; item use changes driving, never directly steals quiz points.

Live controls show held items by player, active counts and recent accepted item history. **Stop item spawning** stops boxes and new oil/projectile use while retaining held inventory; held boosts/shields still work. **Clear track items** removes current projectiles/oil. **Resume item spawning** reopens pickups and hazards. Use the normal Pause/Resume for the entire race clock. Rehearse without guests in **Admin → Kart → Items sandbox**, including personal Treats, shields, fuses, height, full pools and restore/clear/stop. No room or score is changed by that sandbox. Mandatory hazards stay visible when decorative effects are off or graphics are Low.

No deployment or physical-device certification is implied by this local implementation note.

## Laps, slipstream and the race director (8 November 2026)

- **Laps:** a kart-only lobby's course control has a Laps choice (1, 2 or 3). The race window becomes the course window × laps. Each full set of gates then the line counts a lap; the finish time is the whole race, and each lap time is kept. Packs, including the birthday sprint, stay one lap.
- **Slipstream:** sit 2.5–16 m behind another kart at speed for a second and you get 1.6 s of lower drag, about 12% more top speed. It is server-authoritative; karts are still ghosts.
- **Phone:** place, `Lap n/N`, "Drafting…"/"Slipstream!", banners for a new lap, the final lap and places gained, and a finish card with race and lap times. "Race sound and buzzes" in Controls turns on a synthesised engine note, chimes and buzzes; it is off by default and remembered on that phone.
- **Projector:** lead changes, "Lap 2 of 3", "Final lap!" and finishers ("Amina wins!") are announced once each; standings show each driver's lap.
- **Try it:** Admin → Kart → Create kart lobby → choose a course and laps → join two phones → Start kart race. `apps/web/e2e/kart-race-laps.spec.ts` drives a real two-lap race. Plan: [kart-race-feel-plan.md](kart-race-feel-plan.md).

# Kart evolution: complete Mario-Kart-3.js incorporation plan

[Documentation](README.md) · [Current kart](kart-minigame.md) · [Progress](build-progress.md) · [Source inventory](kart-evolution-source-audit.json)

Drafted 3 November 2026. **Planning only: no gameplay, question order, dependency or deployment changes are authorised by this document.** Proposed defaults below become implementation decisions only when this plan is approved.

Implementation was subsequently approved in chat, including automatic continuation using ordinary quota. Current phase status and verification are recorded in [the checkpoint](kart-evolution-checkpoint.md); deployment still requires a new explicit request.

## What we are building

Evolve The 26 Grand Prix into a complete arcade kart experience: detailed vehicles and drivers, layered drift/exhaust/terrain effects, a convincing environment, visible opponents, reliable controls, proper time trials, a wider item set and a broadcast-quality projector view. Keep the birthday game easy to operate and capable of hosting its existing 80-player race.

“Everything” means a disposition for every feature in the upstream source, our imported fork and their written roadmaps. A disposition can be retain, port, finish, adapt to the party architecture, or replace an upstream supporting system with the equivalent we already own. It does not mean installing every dependency or importing a second multiplayer backend. Features mentioned only on a wishlist are explicitly new work.

The final result has three related experiences:

- **Party race:** guests race on phones in an existing room; Humza manages it and Baseer presents. Default remains one lap, three minutes, quiz-seeded grid, existing points and ghost karts.
- **Practice and time trial:** solo free driving, validated laps, best times, controls help and all applicable features, using the existing practice adapter. No party scores or guest accounts.
- **Admin rehearsal and broadcast:** try every interaction without guests, manage the live race and choose a safe projector presentation.

## Evidence and boundaries

### Pinned sources

1. [Original Mario-Kart-3.js source](https://github.com/mustache-dev/Mario-Kart-3.js/tree/83c3a8bb5aeab18b3d5f13084c5fba4a99cb78f7), main at **83c3a8bb5aeab18b3d5f13084c5fba4a99cb78f7**, last commit 18 December 2025, inspected 3 November 2026. The former Lunakepio project now resolves to mustache-dev.
2. [The fork our solo engine uses](https://github.com/Nathan-Richard-21/mario-kart-js/tree/0f7a4305981206193c5efba64bc90755e6e85773), **0f7a4305981206193c5efba64bc90755e6e85773**. Keep this reference distinct from the original repository.
3. Current local implementation: apps/kart-solo, apps/web/src/kart, packages/shared/src/kart*.ts, apps/api/src/questions/kart.ts, and Admin Kart/Live controls. See apps/kart-solo/UPSTREAM.md and THIRD_PARTY_NOTICES.md.

The accompanying inventory records upstream paths, git blob hashes, asset sizes and coverage groups. It is an inventory of these pinned revisions, not a claim about every independent fork or future upstream change.

### Findings that change the plan

- Our game already has acceleration/braking, counter-steer drifting, three turbo tiers, ramps/gliding, sweepers, oil/shield/turbo, ordered checkpoints, recovery, a minimap, drivers/faces, adaptive graphics and authoritative multiplayer. Preserve and extend these.
- Solo retains the upstream kart mesh, wheel/ground-following animation and circuit. Connected phones use the imported circuit but a simpler procedural kart. Matching their presentation is real work.
- A connected phone currently receives only its own pose; the projector gets the field. Showing opponents requires both a deliberate bounded public projection and renderer work, not merely enabling a mesh.
- Original upstream has dust, exhaust, sparks, wheel glow, shader arcs/trails, flames, animated models, sky/light/shadows, colour grading, bloom, collision helpers, a VFX builder and basic remote-player markers. Some effects/components are dormant; evaluate actual call sites rather than README checkboxes.
- Skid marks and optional AO/tilt-shift have code but are not enabled in the default scene. The skid implementation needs repair rather than direct activation.
- The fork has time-trial UI and timing state, but the audited sources contain no calls to its startLap/endLap methods outside their definitions. A complete checkpoint-driven lap and record system must be built.
- Tennis ball, bomb, red shell and treats are roadmap entries, not ready item implementations. Upstream “?” has no defined behaviour and cannot be treated as a finished fifth item.
- The file named WebGPUCanvas uses the ordinary Fiber Canvas. It is not evidence of a working WebGPU renderer. This plan does not silently add a WebGPU migration.
- Fork music, models, textures, font and promotional images have separate provenance concerns. Preserve the code notices; use the existing approved assets or original/approved replacements. Do not assume the README code notice establishes permission for every bundled media file.

## Complete feature disposition

**Retain** means implemented here, with regression coverage preserved. **Port** means real upstream behaviour to incorporate. **Finish** means incomplete/dormant upstream functionality requiring implementation. **Adapt** means its user-facing capability belongs here through our existing systems. Phase numbers refer to the delivery sequence below.

| ID  | Capability                                                     | Current state and planned disposition                                                                                                                                                       | Phase |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| K01 | Circuit and kart models                                        | Retain pinned circuit/kart; improve connected kart detail with approved models or an equivalent original mesh.                                                                              | 1–2   |
| K02 | Four-wheel animation, steering wheel, ground-following chassis | Retained in solo; port equivalent wheel spin/steering/suspension/pitch to connected view. Rendering must not decide collision or lap progress.                                              | 2     |
| K03 | Animated driver/model variants                                 | Retain six party styles/faces; adapt upstream idle/left/right/wind animation semantics. Treat Witch as one alternative rig, not a whole character roster.                                   | 2     |
| K04 | Hop, lean and slip-angle pose                                  | Retain existing solo pose; bring equivalent server-derived feedback to connected kart. Physical jumping is a separate explicit rule change.                                                 | 2     |
| K05 | Drift charge and three release turbos                          | Retain shared Mini/Super/Ultra mechanics and authoritative state; improve visual tier distinction. Do not revert to upstream client-calculated boost.                                       | 1–3   |
| K06 | Chase camera and boost camera response                         | Retain solo widening/FOV and smoothing; port suitable feedback to connected phones, with static reduced-motion alternative.                                                                 | 2     |
| K07 | Dirt/tyre dust                                                 | Port terrain- and wheel-contact-driven dust, with pooled particles and no emission while airborne.                                                                                          | 3     |
| K08 | Exhaust smoke                                                  | Port idle/accelerating/boost exhaust; short bounded emitters, no per-frame React state.                                                                                                     | 3     |
| K09 | Drift sparks and glow bursts                                   | Retain our instanced sparks; incorporate textured sparkle and brief tier-change bursts.                                                                                                     | 3     |
| K10 | Rear-wheel shader glow                                         | Port glow from both wheel contact points; use theme palette roles and non-colour tier labels.                                                                                               | 3     |
| K11 | Skate/drift arcs                                               | Port the upstream curved wheel-energy treatment, adapting its shader to our renderers.                                                                                                      | 3     |
| K12 | Curved, variable-length trails                                 | Retain solo world-space wake; finish trail length/curve controls for both views without unbounded mesh history.                                                                             | 3     |
| K13 | Boost flames and flame textures                                | Port real flame effect and finish texture integration; anchor to exhaust sockets and freeze while paused.                                                                                   | 3     |
| K14 | Skid marks                                                     | Finish dormant component: correct interpolation, surface alignment, lifetime and pool limits. Never copy its existing overshooting interpolation.                                           | 3     |
| K15 | Confetti                                                       | Adapt upstream confetti to finite race-start/finish celebrations; no permanent 10,000-particle loop during driving.                                                                         | 3     |
| K16 | Shared VFX emitter capabilities                                | Adapt time/burst modes, lifetime, gravity, fade/size/colour/easing and mesh/billboard/stretch modes to bounded shared effect descriptions.                                                  | 1, 3  |
| K17 | VFX authoring/export bench                                     | Adapt upstream builder into authenticated Admin Kart rehearsal with validated presets/export; never ship Leva/debug controls on guest or stage views.                                       | 3, 9  |
| K18 | Gradient sky, sun and horizon                                  | Port a theme-aware environment; keep signs, track and controls legible.                                                                                                                     | 4     |
| K19 | Reflections/environment lighting                               | Adapt environment-map lighting using local approved assets; no runtime warehouse/CDN fetch dependency.                                                                                      | 4     |
| K20 | Player-following directional light/shadows                     | Add quality-gated shadows and bounded shadow camera; retain cheap fallback lighting.                                                                                                        | 4     |
| K21 | Full colour grading                                            | Cover RGB channel mixer, brightness, contrast, exposure, gamma, temperature, hue, saturation, vibrancy, split toning, per-hue HSL and filmic tone mapping. Keep UI outside the effect pass. | 4     |
| K22 | Boost wind/speed lines and chromatic response                  | Port the shader capability that exists despite the old TODO; restrained effect from authoritative boost/speed, disabled under reduced motion.                                               | 4     |
| K23 | Lens dirt                                                      | Port as optional restrained presentation; never obscure the racing line, text or controls.                                                                                                  | 4     |
| K24 | Bloom                                                          | Port a quality-gated, clamped bloom pass rather than full-screen overexposure.                                                                                                              | 4     |
| K25 | AO and tilt-shift                                              | Finish dormant optional effects as off-by-default desktop/showcase settings with measured mobile fallbacks.                                                                                 | 4     |
| K26 | Static scenery collision                                       | Retain our baked swept collision; evaluate upstream capsule/BVH accuracy for height-aware walls/obstacles. Bake data offline; no client authority.                                          | 5     |
| K27 | Collision bounce/stun feedback                                 | Adapt upstream impact response behind a versioned arcade tuning preset; prevent repeated stun-lock. Add feedback without requiring kart-to-kart collisions.                                 | 5     |
| K28 | Touch steering and action buttons                              | Retain captured multitouch, range fallback, thumb pad, swap sides and release-on-blur. Add only useful shape/dead-zone/sensitivity options from upstream joystick.                          | 2, 5  |
| K29 | Keyboard/gamepad parity                                        | Retain keyboard and solo gamepad; share a browser adapter for connected gamepad, analog steering and held controls.                                                                         | 5     |
| K30 | Mouse steering                                                 | Complete README control option as opt-in captured pointer steering, with clear exit and unchanged touch defaults.                                                                           | 5     |
| K31 | Item/recovery shortcuts                                        | Map E/use-item and R/recovery through existing authenticated receipted commands; prevent key repeats and focus conflicts.                                                                   | 5     |
| K32 | Loading/progress/retry                                         | Retain progress and graphics recovery; add per-asset readiness, honest failure/retry and a useful grid preview. No forced start after a local timeout.                                      | 1, 6  |
| K33 | Ready check and 3–2–1–Go                                       | Adapt countdown presentation to server deadlines and existing scheduler; late-loading clients observe the server state.                                                                     | 6     |
| K34 | Race HUD and results                                           | Retain current place/remaining time/item/turbo/gates; add lap/sector UI, animated finish/DNF and useful race recap. Avoid controls covering the circuit.                                    | 6     |
| K35 | Proper time-trial mode                                         | Finish checkpoint-validated laps and lap transitions using shared route/physics. Practice remains isolated; connected variants retain DO authority.                                         | 6     |
| K36 | Best laps, total time and records                              | Complete real best-time comparison, versioned local solo records and optional bounded ghost replay; never accept a local record as a party score. Ghost replay is our extension.            | 6     |
| K37 | Minimap/navigation                                             | Retain projector and lightweight maps; add optional chase-view inset, heading/next-gate guidance and opponent markers from public data.                                                     | 2, 6  |
| K38 | Multiplayer and visible opponents                              | Replace upstream Playroom integration with our existing room socket. Add bounded nearby ghost poses/instances and preserve full-field spectator map.                                        | 2     |
| K39 | 3D spectator cameras                                           | Adapt upstream scene/camera capability into opt-in stage follow/overview/director views; SVG scoreboard/map remains immediately available.                                                  | 2, 9  |
| K40 | Existing item boxes/turbo/shield/oil                           | Retain pure simulation/receipts; version box placement and inventory UI for the expanded catalogue.                                                                                         | 7     |
| K41 | Tennis-ball projectile                                         | Build from roadmap: bounded bouncing projectile with swept hits and one hit per target per projectile.                                                                                      | 7     |
| K42 | Bomb                                                           | Build from roadmap: arming delay, visible fuse, bounded blast and server-timed detonation.                                                                                                  | 7     |
| K43 | Homing red-shell-style item                                    | Build from roadmap with approved/original art: server selects an eligible racer ahead, follows route geometry and respects barriers/height.                                                 | 7     |
| K44 | Treats                                                         | Define and implement the vague roadmap entry. Proposed default: a small collectible turbo reward; no invented health/repair system. Confirm before code.                                    | 7     |
| K45 | Additional tracks/checkpoints                                  | Retain imported circuit/ring; build a versioned track catalogue with surface/collision/route/grid/item metadata and at least one original additional course.                                | 8     |
| K46 | Free drive/race/time-trial menus and controls help             | Adapt fork mode selection/loading/tutorial/finish flow into our /kart and Admin surfaces. Existing party entry remains primary.                                                             | 6, 8  |
| K47 | Sound effects/music                                            | Adapt audio behaviours: optional engine, skid, turbo, impacts, pickup, countdown and finish sounds; original/approved music; separate stage/phone volume and mute.                          | 8     |
| K48 | Installable/offline solo practice                              | Adapt upstream PWA support to isolated practice caching and safe version updates; never cache credentials, API replies or pretend multiplayer is offline-capable.                           | 8     |
| K49 | Performance, preload and lifecycle                             | Retain local Draco, adaptive graphics, visibility pause and disposal; add shader warm-up, bounded instancing and capability/asset fallbacks.                                                | 1–10  |
| K50 | Collision/VFX/performance debug tools                          | Adapt upstream debug/BVH/Leva/r3f-perf ideas to authenticated rehearsal and development diagnostics. No personal telemetry on projector.                                                    | 5, 9  |
| K51 | Code quality/dependencies/attribution                          | Retain npm workspaces and lockfile; remove dead imported scaffolding when replaced; test dependency compatibility and track provenance.                                                     | 0–10  |

### Explicit dispositions for supporting and undefined material

- **PlayroomStarter/playroomStore:** retain the purpose (other racers visible); do not import its service, client-position authority or identity store. K38 covers the replacement.
- **Zustand gameManager/store:** retain the existing ephemeral solo adapter only. Server rules remain pure shared logic; no new connected state authority. K35/K36 cover the missing functionality.
- **HomePage/WebEvolution/marketing imagery:** adapt mode selection, controls help, animation polish and credits. The upstream developer’s sales links and web-history marketing do not belong in the party flow; preserve applicable attribution in notices/Admin credits.
- **GameReadyCheck forced start:** replace with visible readiness and host management; never let a browser timeout advance a live room.
- **Vendored joystick distribution:** use our existing accessible controller, incorporating useful interactions; do not add a parallel control library or its generated build copies.
- **Wawa VFX gitlink and src copy:** audit the gitlink revision and vendored implementation provenance before a port. Choose one bounded effect integration, not two copies or another global store.
- **“More items” and “?”:** all four named items above are accounted for. The unnamed slot stays an explicit design backlog entry; it has no source behaviour to incorporate.
- **Unreferenced alternate track/model assets:** inspect them before calling them additional playable content. Every new course needs its own verified route/collision manifest; an extra GLB filename is not another complete race.
- **Declared dependencies without a wired feature:** Rapier and other unused imports are not a second physics system to adopt. Reassess a dependency only when a phase needs its documented API.
- **WebGPU, anti-gravity, underwater racing, battle mode, every Nintendo character/item:** not implemented in the audited source and not implied by this parity scope. They would be separate expansion designs, not missing ports.

## Architecture decisions for the implementation

### Extend the existing engine

Keep packages/shared/src/kart.ts as race progression and packages/shared/src/kart-driving.ts as driving physics. Extend kart-powers, kart-course, kart-route and kart-track rather than creating another reducer. apps/api/src/questions/kart.ts remains the persistence/projection boundary. The single room scheduler owns collection deadlines, countdown transitions and ticks.

Use versioned rules for physics, items, tracks and race settings. Freeze the selected versions when a room starts. Existing stored races continue under their original rules; do not change an underway race by deploying a new tuning constant.

Keep both renderers initially: the party Three 0.186.1 renderer and the isolated solo Fiber/Drei/Three 0.176.0 bundle. Share render-neutral effect descriptions, pose helpers, asset metadata and quality policy, with thin renderer adapters. Assess convergence only after parity and measurements; do not pass Three object instances between incompatible bundles or upgrade both stacks in the middle of a gameplay phase.

### Visible opponents and events

Introduce a bounded public nearby-racer projection alongside the self pose. Proposed initial caps: self plus eight nearby racers on High, four on Balanced, two on Low. These are budgets to validate, not existing measurements. Use server-selected proximity/route distance with stable hysteresis so opponents do not flicker; keep full-field positions on the stage map. Omit raw input queues, private inventories, credentials and personal diagnostics.

Do not increase the current 10 Hz control send / 5 Hz saved-frame cadence without measurement. Interpolation is cosmetic. Use bounded event IDs with race id, sequence and active timestamp for collision/item/finish effects; persisted/recovered gameplay cannot be replayed as fresh damage, sound or confetti on every snapshot. Rendering may be skipped without changing the race.

### All new physics stays authoritative

Collision stuns, projectiles, targeting, explosions, pickups, shields, lap crossings and finish decisions run against injected active time in the shared simulation. Use the current room command/receipt path for discrete item use, recovery and host changes. Keep continuous controls on their existing bounded non-retry channel. Same request id means the same item use, including after an uncertain response.

New commands must follow execute → /api/rooms/play → readHostDetails → PartyRoom.hostAction → applyHostAction, with validation again inside the domain, a command notice and feedback scope. Add command success/refusal/replay tests. Store control-only history with exact bounded Zod fields and prove it is absent from guest/stage snapshots.

### Quality and accessibility

Auto/High/Low remains a local screen preference. Host configuration can disable an effect class for safety but cannot force audio, travel animation or expensive graphics on a phone. Low must preserve readable track, opponents/items relevant to gameplay, shadows/markers needed for height, collision cues and all controls; it reduces decoration first.

Place post-processing on the 3D scene only. HUD, phone dock and projector scoreboard remain sharp DOM content. Reduced motion removes camera jolts/FOV pumping, moving speed lines, looping confetti and aggressive chromatic changes, with short opacity/colour feedback instead. No effect can obscure a choice, race line or emergency recovery control.

## Delivery sequence

Each phase is independently reviewable. **Every phase ends with npm run test:unit and npm run typecheck passing**, relevant API/room/browser checks passing, admin registry coverage, updated progress and data inventory where needed. No phase is declared complete while runtime failures remain unresolved.

### Phase 0 — settle the baseline and lock the audit

**Status:** Complete as a local baseline, 4 November 2026. See [evidence and limitations](kart-evolution-baseline.md). Phases 1 and 2 are also complete locally; physical-device and production certification remain in Phase 10.

**Deliver:** complete current pending quiz/media/wall/results regressions; capture one real multiplayer circuit race from lobby to podium; attach this source audit to the implementation brief. Record current rendering, payload and Worker CPU baselines at 1/16/21/50/80 simulated racers.

**Admin:** use existing Developer tools and Kart pages to run and inspect that race. Label simulated populations distinctly from physical-device evidence.

**Verification:** existing kart-score, kart-driving, kart-powers, kart-room, kart-lobby and realtime-load suites; web circuit, spectator, graphics and controller tests; kart browser configs plus the pending general browser flows. Fix the local startup problem before making it the basis of further claims.

**Exit:** a reproducible baseline and a complete feature-disposition ledger. No dependency upgrades or game changes in this phase.

### Phase 1 — common contracts, asset manifests and render budgets

**Status:** Complete locally, 4 November 2026. [Implemented contracts and rehearsal](kart-render-contracts.md). Exact verification and remaining device/release constraints are in the checkpoint; Phase 2 is now complete locally.

**Deliver:** versioned render/asset manifests, shared effect/vehicle pose descriptions, bounded public events, capability-safe graphics profiles and asset readiness. Keep existing renderer adapters and race state. Inventory every model/texture/audio asset with source, hash, usage and replacement status. Resolve the Wawa/submodule provenance before vendoring new source.

**Files:** extend graphics.ts, presentation.ts, drift-effects.ts, solo session/controller adapters, shared kart schemas and API projections. Add only helpers within existing owned folders.

**Tests:** extend graphics.test.ts, circuit.test.ts, kart-guard.spec.ts and kart-room.spec.ts; new kart-events.spec.ts covers event bounds, stale versions, privacy and reconnect deduplication. New asset-manifest tests cover missing/invalid assets and local fallback.

**Admin:** readiness and render budgets in Kart rehearsal; live health data through the existing Health page. No invented “ready” or performance metrics.

### Phase 2 — detailed karts, animated drivers and visible racing

**Status:** Complete locally, 4 November 2026. See the checkpoint and render contracts for exact verification and remaining physical-device/release constraints. Phase 3 is next.

**Deliver:** connected kart detail comparable to solo, shared steering/wheel/chassis pose, driver animation semantics, boost camera feedback and nearby ghost racers. Carry the chosen driver/face into solo preview via explicit sample/local presentation settings without introducing room credentials into practice. Add optional 3D stage follow/overview and a one-action return to the full-field map.

**Tests:** vehicle-pose.test.ts, extend driver-rig.test.ts, circuit.test.ts, spectator.test.tsx and kart-room.spec.ts. Verify the self pose is always present, nearby limits stable, face hiding respected, resources bounded at 80 and old snapshots still usable. Browser coverage in kart-opponents.spec.ts and kart-spectator.spec.ts.

**Admin:** Driver/vehicle and Stage views rehearsals in Admin Kart using the real renderer. Room Live controls can select/stop stage modes; local phone camera preferences remain local.

### Phase 3 — the full drift/exhaust/terrain VFX suite

**Status:** Complete locally, 4 November 2026. Both native adapters, moving rehearsal scripts, host safety controls, measured-ground marks and resource/quality regressions pass. See the checkpoint and render contracts for exact results. Physical-device/venue performance and the long soak remain Phase 10. Phase 4 is next.

**Deliver:** K07–K17: dirt dust, exhaust, sparkle, glow/arcs, curved trails, textured flames, corrected tyre marks and finite celebrations. Upgrade the existing effect helpers; do not run a separate global VFX store beside the app’s scene ownership. Add the useful emitter/export controls to a real VFX bench.

**Proposed budgets:** Low ≤128 decorative particle instances and 64 skid segments; Balanced ≤512/128; High ≤1,024/256, per visible scene rather than per racer. Validate and revise in measurements. Mandatory hazards/projectiles have their own gameplay budget and cannot disappear because decoration filled the pool.

**Tests:** drift-effects.test.ts extended; vfx-budget.test.ts, vfx-bench.test.tsx, kart-vfx.spec.ts. Test expired/recycled effects, duplicate events, no dust in flight, theme changes, reduced motion, hidden tabs, pause and unmount disposal. Exported presets must validate against the same schema runtime uses.

**Admin:** See each effect’s actual state, tune only validated presentation presets, reset/export them and rehearse the real start/drift/boost/impact/finish paths.

### Phase 4 — environment, lighting and the complete look

**Status:** Started, incomplete. Isolated connected/native solo Look rehearsals now cover grading, procedural sky/environment light, reflections and bounded shadows. Optical effects, live host controls and the full final gate remain. Exact verification is in the checkpoint.

**Deliver:** K18–K25: sky/sun, reflection/environment setup, quality-gated follow-light shadows, full grading controls, boost wind/chromatic effect, lens dirt, bloom and optional AO/tilt-shift. Finish all named controls rather than presenting sliders that have no effect. Do not copy upstream numeric defaults blindly.

**Tests:** render-quality.test.ts, postprocessing.test.ts, environment-bench.test.tsx and kart-look.spec.ts. Neutral settings preserve the source image, parameter limits prevent invalid shaders, HUD remains outside the effect pass, low mode works without optional shader assets and WebGL loss recovers. Include projector readability and reduced-motion screenshots.

**Admin:** a Look bench with real scene preview, before/after, neutral reset, named presets, per-effect switches and visible local quality costs. No debug palette edits outside themes.ts; introduce any necessary theme roles there.

### Phase 5 — control parity and contact handling

**Deliver:** K26–K31: shared connected gamepad adapter; accessible keyboard shortcuts; opt-in pointer steering; configurable control sensitivity; contact flash/audio/haptics; an optional arcade bounce/stun preset. Preserve fresh-input-on-resume and release-on-disconnect. If 3D collisions are justified, bake conservative height-aware static data offline and keep the current swept solver as a versioned fallback. Do not build BVHs from a browser scene and send the outcome to the server.

**Tests:** gamepad.test.ts, controller input tests, kart-driving.spec.ts, kart-guard.spec.ts and kart-room.spec.ts extended; kart-inputs.spec.ts and kart-collision.spec.ts. Test gamepad unplug, competing pointers, keyboard focus, reset/item repeats, swept high-speed contacts, corners, flight height, repeated contacts, eviction and recovery progress retention.

**Admin:** a controller/contact bench and real course collision overlay. The host can inspect impact/recovery history and choose only pre-race gameplay tuning; reverting to the established handling remains possible for the next race.

### Phase 6 — race start, HUD and complete time trials

**Deliver:** K32–K37/K46: reliable asset-ready states, a server-timed countdown for connected races, lap/sector HUD and race recap. Solo gets free drive and time trial, shared ordered checkpoint validation, clean start/finish crossing, reset/invalid-lap feedback, best-lap and total-time records. Proposed options: one-lap sprint and three-lap practice; birthday default stays one lap. Replay ghosts are an explicitly new extension, not a pre-existing upstream feature.

Solo records are versioned by track, physics, assists, items and course settings so unlike runs are not compared. Keep local practice records separate from authenticated room results. Proposed persistence: opt-in browser-local bounded best runs, no new cross-game identity. A replay export contains track/settings and bounded input/pose samples, no credentials or face images. Recovered/assisted laps should be marked separately rather than silently becoming clean records.

**Tests:** kart-laps.spec.ts, kart-time-trial.test.tsx, kart-records.test.ts, countdown tests, kart-room.spec.ts and kart-timetrial.spec.ts. Cover reverse finish crossing, missed gates, teleport/recovery, pause, restart, storage denied, record version mismatch and mid-countdown disconnect. No client lap packet may score a room.

**Admin:** rehearse loading failures, countdown, every HUD/result state and time trial with the actual components; inspect room lap/sector results and finish/DNF reasons. New lap/configuration actions have receipt/refusal/replay coverage.

### Phase 7 — all named item ideas, made multiplayer-safe

**Deliver:** expand the existing power-up engine for tennis ball, bomb, homing shell-style projectile and the agreed treats behaviour. Retain turbo, oil and shield. Implement targeting, swept projectile paths, wall/height interaction, owner grace, expiration, one-hit rules, shield consumption, short damage immunity and cleanup. Proposed initial pool: at most 64 live projectiles across a room, separate from 64 existing oil slicks; reject/resolve capacity before consuming inventory. No unbounded per-projectile timers.

Use active simulation ticks for fuses/homing and deterministic persisted choices. The server selects a legal target ahead using route progress; no client supplies a victim’s score/position or hit result. Homing cannot pass through walls or hit a finisher. Item use affects driving state, not direct quiz-score theft. Any future placement-weighted item distribution must be a visible frozen rule, not an undocumented comeback multiplier.

**Tests:** expand kart-powers.spec.ts; kart-projectiles.spec.ts, kart-targeting.spec.ts, kart-items-room.spec.ts, power-up controls tests and kart-items.spec.ts. Cover simultaneous hits, targets leaving, late input, shields, air/ground separation, pause/eviction, expired objects, pool exhaustion, anonymous/stage refusal and exact replay of item commands.

**Admin:** catalogue/rules, enable/disable allowed items before start, live held/active counts as host-only fields, bounded item history and a real scripted two-racer sandbox. Disable new spawning and safely clear hazards via receipted host commands. Practice can use stand-in opponents without guest assistance; these remain clearly labelled test actors.

### Phase 8 — tracks, modes, audio and installable practice

**Deliver:** a track manifest with route, collision, surface, start-grid, recovery, item and course-feature metadata; inspect alternate upstream geometry and build at least one original course. Add mode selection and controls help to the existing /kart hub. Provide original/approved sound and music through small browser audio adapters: opt-in/unlock, engine pitch, drift tiers, turbo, collision, item, countdown and finish; separate phone/stage volume and immediate stop.

Add installable solo practice only after cache/update tests. Scope its service worker and start URL under /kart-engine/ so the parent party app is outside its interception scope. Cache immutable versioned engine assets, not /api, /ws, auth responses, results/private media or room credentials. Keep live rooms online-only and show an honest offline state. Updates activate between practice sessions and must not reload an active live game. Do not copy the upstream origin-wide automatic-update service worker unchanged.

**Tests:** kart-tracks.spec.ts, asset audit, kart-audio.test.ts, kart-mode-select.test.tsx, kart-offline.spec.ts and kart-track-catalogue.spec.ts. Validate every grid/recovery slot, route/collider alignment, model load failure, autoplay denial, hidden-tab audio stop, cache invalidation and returning online. Update data inventory for any actual stored solo records or cache metadata.

**Admin:** Track/mode catalogue with preview and frozen race selection; soundboard with exact file/status, mute/stop and volume; install/update/offline-state rehearsal using real solo components. No guest accounts or new CMS.

### Phase 9 — complete host coverage and rehearsal scripts

This is an integration audit, not permission to postpone earlier phases’ admin views.

Extend the existing Kart registry entry and Live controls rather than adding another admin app. Suggested Admin Kart tabs: Drive, Vehicles, Effects, Look, Tracks & modes, Controls, Audio, Phone & stage, Multiplayer. Populate them progressively with real renderers. Live controls owns stage mode, race rules, item/course safety and the current-race history; Health owns operational diagnostics and frame/traffic reports; Results owns persisted race results.

Provide one scripted rehearsal for each capability and presets for 1/16/21/50/80 simulated racers. Host views show source state and who changed what/when, not fabricated sample metrics. Stage snapshots never contain private histories, raw input queues, emails, device diagnostics or item inventories belonging to other guests.

**Tests:** extend admin/features.test.ts, controls tests using setupControls/mountControls, kart-room command tests and role-projection tests. Add kart-rehearsal-suite.spec.ts to run the actual quiz → grid → race → results → facts/podium sequence, plus kart-only mode.

### Phase 10 — performance, full regressions and release

**Proposed acceptance targets, to measure in phase 0:** target 30 fps on agreed mid-range iPhone/Android devices, with 95th-percentile frame gaps ≤50 ms during steady racing; 60 fps on the projector’s agreed High profile. Shader/model warm-up is measured separately. An 80-racer simulated room must stay within the selected Cloudflare plan’s measured CPU/memory/socket budgets; agree numerical budgets from baseline, not invented promises.

Run at 1/16/21/50/80 racers through lap completion, item bursts, hazard caps, network loss and reconnect. Conduct a 20-minute repeated-race/resource soak and compare payload volume, Worker CPU, draw calls, GPU resources and input latency with baseline. Decorative quality may drop; checkpoint accuracy, hazard visibility, controls and results may not.

Required checks: full unit/typecheck/API suites; lint/format/content checks; real Chromium/WebKit workflows; physical iPhone Safari and Android Chrome; 320/390/430 px phones, short landscape, text zoom and safe areas; reduced motion/audio denied; hidden/locked phones; permission denial; failed assets; context loss/restoration; projector/HDMI/venue Wi-Fi. Browser emulation and bots do not stand in for physical checks.

Release only through the existing staging → verify → explicitly authorised production flow. Log source/rules/asset versions and both deployment IDs. Keep stable race settings for existing rooms; rehearse the old-client/new-server snapshot boundary. Full checks must be green before calling this evolution complete.

## Order, dependencies and review points

Delivery chain: **0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10**. Low-level item/track designs can be prepared sooner, but public behaviour ships only with its tests/admin view. Visual work and rule changes stay independently switchable and independently reviewable.

Recommended release groups:

1. Foundation plus opponents/vehicle parity (0–2).
2. Effects and world presentation (3–4).
3. Controls, collision and time trials (5–6).
4. Items, tracks, sound and offline practice (7–8).
5. Full rehearsal/performance certification (9–10).

The large engineering portions are network-visible opponents, compatible renderer/effect adapters, server projectiles, lap modes and cache-safe PWA integration. This is several substantial iterations, not a one-file upstream merge. Calendar estimates should follow the baseline and the item/asset decisions.

## Decisions to settle at implementation start

These are proposed defaults, not blockers to writing this plan:

- **Scope:** include source features, dormant components and all four named roadmap items; leave the undefined “?” as a labelled backlog entry.
- **Party defaults:** preserve one lap/three minutes/80 participants, existing score formula and ghost karts. Kart-to-kart impacts are beyond parity and off unless separately requested.
- **Look:** rich effects with adaptive limits; AO/tilt-shift and intrusive screen effects off by default. Every capability must have a usable appropriate rehearsal, even when not enabled for ordinary phones.
- **Characters/assets:** keep the six party drivers/faces; use approved alternate rigs or original equivalents. Do not imply a full franchise roster.
- **Treats:** proposed small collectible turbo reward; agree the actual rule before coding.
- **Time trials:** one- and three-lap solo variants, clean versus assisted records, local records first; ghost replay optional within this phase.
- **Audio:** opt-in on phones, explicit host start/stop on the projector, approved/original sound pack.
- **PWA:** solo practice only, scoped cache and idle updates.

## Definition of complete

Every K01–K51 row has an implemented/rehearsable outcome or its documented equivalent in our existing architecture; all source files/assets in the inventory have a disposition; the four named wishlist items work under agreed rules; no orphan debug/client-authoritative engine is introduced; old rooms remain valid; required tests and real-device sign-off pass; progress, data inventory, notices and runbook are current. An unchecked README item or model filename alone is never evidence of a completed feature.

## Direct source evidence

- [Current scene wiring, active effects and debug panel](https://github.com/mustache-dev/Mario-Kart-3.js/blob/83c3a8bb5aeab18b3d5f13084c5fba4a99cb78f7/src/App.jsx).
- [Driving, collision reaction, gamepad and client-position broadcast](https://github.com/mustache-dev/Mario-Kart-3.js/blob/83c3a8bb5aeab18b3d5f13084c5fba4a99cb78f7/src/PlayerController.jsx).
- [Wheel/driver rig and animation](https://github.com/mustache-dev/Mario-Kart-3.js/blob/83c3a8bb5aeab18b3d5f13084c5fba4a99cb78f7/src/models/Witch.jsx) and [wheel effects](https://github.com/mustache-dev/Mario-Kart-3.js/blob/83c3a8bb5aeab18b3d5f13084c5fba4a99cb78f7/src/models/Wheels.jsx).
- [Colour grading and boost screen effects](https://github.com/mustache-dev/Mario-Kart-3.js/blob/83c3a8bb5aeab18b3d5f13084c5fba4a99cb78f7/src/ColorGradingEffect.jsx) and [active versus dormant post-processing](https://github.com/mustache-dev/Mario-Kart-3.js/blob/83c3a8bb5aeab18b3d5f13084c5fba4a99cb78f7/src/Composer.jsx).
- [Dormant skid-mark implementation](https://github.com/mustache-dev/Mario-Kart-3.js/blob/83c3a8bb5aeab18b3d5f13084c5fba4a99cb78f7/src/particles/drift/Skid.jsx), [VFX particle engine](https://github.com/mustache-dev/Mario-Kart-3.js/blob/83c3a8bb5aeab18b3d5f13084c5fba4a99cb78f7/src/wawa-vfx/VFXParticles.tsx) and [builder](https://github.com/mustache-dev/Mario-Kart-3.js/blob/83c3a8bb5aeab18b3d5f13084c5fba4a99cb78f7/src/wawa-vfx/VFXBuilder.tsx).
- [Collision helper](https://github.com/mustache-dev/Mario-Kart-3.js/blob/83c3a8bb5aeab18b3d5f13084c5fba4a99cb78f7/src/utils/KartCollision.js), [remote markers](https://github.com/mustache-dev/Mario-Kart-3.js/blob/83c3a8bb5aeab18b3d5f13084c5fba4a99cb78f7/src/PlayroomStarter.jsx) and [PWA setup](https://github.com/mustache-dev/Mario-Kart-3.js/blob/83c3a8bb5aeab18b3d5f13084c5fba4a99cb78f7/vite.config.js).
- [Original roadmap and named item ideas](https://github.com/mustache-dev/Mario-Kart-3.js/blob/83c3a8bb5aeab18b3d5f13084c5fba4a99cb78f7/README.md).
- [Imported fork timing/audio state](https://github.com/Nathan-Richard-21/mario-kart-js/blob/0f7a4305981206193c5efba64bc90755e6e85773/src/gameManager.js), [frame-driven timer wiring](https://github.com/Nathan-Richard-21/mario-kart-js/blob/0f7a4305981206193c5efba64bc90755e6e85773/src/App.jsx) and [mode/HUD interface](https://github.com/Nathan-Richard-21/mario-kart-js/blob/0f7a4305981206193c5efba64bc90755e6e85773/src/GameUI.jsx).

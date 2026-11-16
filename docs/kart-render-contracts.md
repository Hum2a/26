# Kart rendering contracts

Phase 1 implementation, 4 November 2026. [Plan](kart-evolution-plan.md) · [Checkpoint](kart-evolution-checkpoint.md) · [Baseline](kart-evolution-baseline.md)

## Asset inventory and readiness

The versioned source of truth is packages/shared/src/kart/kart-assets.json, validated by kartAssetManifestSchema in kart-assets.ts. It covers the five installed model/decoder files, their exact sizes and SHA-256, source/notice links, usage and retention status. Eighteen image textures embedded in the two GLBs have individual byte counts and fingerprints. No kart audio is currently installed. The Node inventory test reads only original public sources and checks every file and embedded texture against the manifest; generated build copies stay closed.

Both renderer adapters use kartAssetPaths. Their bundles retain separate pinned Three versions. Shared descriptions contain numbers and plain arrays, never Three instances, materials, textures or scene objects.

Admin → Kart → Files & limits reads the manifest through the authenticated, no-store GET /api/admin/kart-assets and the existing validated readSection path. Check kart files downloads sequentially without credentials or redirects into fixed manifest-sized buffers, then verifies size and SHA-256. It can be stopped, times out after30seconds and aborts on navigation. A stale/failed metadata refresh disables checking until refreshed. At most five timestamped check summaries remain in page memory; no guest/device readiness is uploaded or persisted.

A verified download is not decoded-model or GPU readiness. The connected circuit's real GLTF callback reports loading, ready or failed; failures after disposal cannot update the old view. Solo retains real loader progress and its existing error boundary. The map/retry paths remain usable. Rehearsal uses the actual isolated solo engine, not a stand-in model, and changing tabs unloads it.

## Render policy

| Tier     | Pixel ratio cap | Spark stride | Decorative scene spark cap | Solo world-trail cap |
| -------- | --------------- | ------------ | -------------------------- | -------------------- |
| High     | 1.5             | 1            | 640                        | 32                   |
| Balanced | 1               | 2            | 320                        | 0                    |
| Low      | 0.75            | 4            | 128                        | 0                    |

These are enforced visible-instance/emission limits for the existing effects, not certified FPS budgets. Existing instanced buffers retain their fixed maximum allocation and are reused across quality changes; item boxes, oils, shields, ramps, hazards, karts, input and scoring are outside the decorative cap. Zero decorative budget still retains those objects. Phase3 can extend this policy after measuring new effects.

safeGraphicsProfile lowers detail when the renderer's actual maximum texture size is below2048 and refuses an unusable capability below512 or a missing/non-finite capability. It respects an explicit renderer pixel-ratio limit. The connected adapter retains its device-pixel-ratio cap; Fiber retains its existing supersampling policy. The local manual preference is retained, even when effective capability requires Low. No hardware identity or capability data is sent to the server.

kartVehiclePose is version1, plain position/heading data. driftEffectDescription is version1 with kart-local bounded points (eight normally, two in reduced motion), consumed by both adapters. Mesh/resource ownership stays in each renderer. These helpers do not integrate velocity, predict finishes or change accepted game state.

## Public presentation events

An optional kart presentation envelope has version1, assetVersion kart-assets-v1 and at most32 accepted finish outcomes. Each contains only eventId, atMs, kind finish, public playerId and FINISHED/DNF status. The envelope never contains private input counters/queues, inventories, credentials, face data or diagnostics. Existing privacy assertions remain intact.

An eventId derives from accepted active milliseconds and the frozen public driver number: atMs ×100 +number. Finished lap times are stable; a DNF without a time is emitted only after the race is settled, when elapsedMs is final. Sorted batches retain the latest32 outcomes. It is presentation history, not a substitute for all-driver standings or a new gameplay journal. It adds no stored state and no scoring decisions.

readFreshKartEvents owns only a renderer-local cursor keyed by race and eventId. Initial/reconnect snapshots seed its cursor and suppress historical effects. An empty legacy snapshot seeds a racing baseline so the first subsequently accepted finish can be fresh. Repeated or older batches cannot replay an outcome; unknown versions, invalid fields and overlong/duplicate batches are rejected. Unsupported optional cosmetic metadata is omitted without invalidating the otherwise strictly validated authoritative race frame. Event effects are optional future consumers: existing HUD/results remain authoritative and complete independently.

Room Health shows the actual current accepted event batch, its bounded count, contract and asset version, with a link back to the real rehearsal. It does not fabricate guest asset/GPU telemetry. Existing host race controls can pause/finish/rehearse and no new host commands or receipt paths were introduced.

Current clients accept old snapshots without presentation. Rehearsing old-client/new-server deployment boundaries remains a release requirement in Phase10; this stage does not claim production rollout compatibility or authorise deployment.

## Provenance and compatibility decisions

The pinned upstream source audit inventories46 media entries across two trees (29 distinct Git blobs), with source URLs, Git blob hashes, byte sizes, usage group and an installed/pending-adaptation disposition. Installed files additionally have SHA-256 in the runtime manifest. Uninstalled assets are not presented as completed tracks, characters or audio.

The Wawa gitlink resolves to wass08/wawa-vfx at0ecd0e775da8dfd2587e44206dbc3e00db3c6f9e. Its manifest declaresMIT but that tree has no separate licence text; three copied blobs match and three differ. The implementation decision is to extend the existing original bounded instanced effects with original code using Wawa only as a capability reference. No new Wawa source, dependency or parallel Zustand store will be vendored. Retained model/decoder notices stay in place.

Keep dependency versions unchanged during this foundation work. The ordinary Vite native-backend limitation from Phase0 remains documented; isolated browser verification continues to use the guarded already-locked API-test backend. It is not a production performance fix. Physical devices, venue networking and billed Worker budgets remain later verification.

## Verification references

Tests: asset-manifest.test.ts, kart-asset-manifest.spec.ts, kart-assets-panel.test.tsx, kart-page.test.tsx, health-page.test.tsx, graphics.test.ts, circuit.test.ts, kart-events.spec.ts, kart-room.spec.ts, kart-guard.spec.ts and kart-foundations.spec.ts. Final exact results are recorded in build-progress and the checkpoint; an unrun check is never a pass.

Official API references checked for this work: [Three GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [Motion animations](https://motion.dev/docs/react-animation), [Web Crypto digest](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest), [Node22 JSON module attributes](https://nodejs.org/download/release/v22.23.0/docs/api/esm.html#json-modules).

## Phase 2: vehicles, nearby visibility and cameras

Connected High and Balanced graphics lazily load the retained seven-part kart model into bounded native instanced batches. Model wheel radii, spacing and orientation are explicit. Low graphics and failed downloads retain simple vehicles, with a local retry. Both stacks share steering, roll and travel calculations. The driver factory receives each adapter’s native Three constructors; geometry, materials and objects never cross bundles. Solo follows its native chassis anchor over terrain and in flight. Six styles share the start glance, drift lean and finish wave. Face meshes and textures cannot exceed visible capacity, including during an 80-driver rotation. Removed or failed images release resources; late callbacks after disposal do not update scenes.

The phone’s own pose remains in participants. Nearby contains at most eight unique public poses, excluding self. Server selection uses a 36 m entry radius, 44 m exit radius, 4 m retention advantage and wrapped route gap of at most 0.2. Only frozen roster numbers persist in the existing race’s nearbyNumbers. Opponents default off; host switches use existing receipts and state versions. Graphics cap visible neighbours at eight, four or two. The lightweight phone map retains the bounded public shortlist. Collision, checkpoints, input cadence and scoring are unchanged.

Stage defaults to the full-field map. Host map, overview, follow and director commands are reversible; the latest 20 history entries remain control-only. Public mode, revision and target exclude credentials, diagnostics and inventories. Follow selects the leading active racer. Director rotates among the leading three using eight-second slots of accepted race time. Pause does not advance selection. A local button immediately returns to the complete map; a later receipted host selection can resume 3D. Changing director target reuses the scene. Overview bounds derive from the existing centreline.

Practice accepts only a valid style and optional PNG, JPEG or WebP Blob up to 2 MB from its same-origin parent. The parent alone fetches authorised room media, with bounded streaming and a timeout. Practice receives no credentials or media URLs, revokes its local object URLs, and has no score, socket or persistence path. Admin Vehicles offers a local sample image and real-engine rehearsal. Stage views uses the actual stage renderer with 80 server-projected stand-ins.

Checked official APIs: [Fiber hooks and invalidation](https://r3f.docs.pmnd.rs/api/hooks), [Three instancing](https://threejs.org/docs/pages/InstancedMesh.html), [Three orthographic camera](https://threejs.org/docs/pages/OrthographicCamera.html). Exact verification and remaining device and release constraints are in the checkpoint.

The solo build explicitly deduplicates Three from its own app root so hoisted Fiber/Drei use the same pinned 0.176 runtime as the native driver. Runtime Scene and Renderer checks and a browser assertion verify this boundary. TypeScript adapters bridge the two retained nominal declaration sets only. The unchanged solo regression caught the incompatible-matrix error before this fix. See [Vite dependency deduplication](https://vite.dev/config/shared-options.html#resolve-dedupe).

## Phase 3: scene-owned effects (complete locally)

Both native adapters use the same strict version 1 presentation preset and plain bounded pool. Connected Three186 and solo Three176 create and dispose their own meshes/materials/texture; no Three instance crosses bundles. The installed two-version asset graph is unchanged. No Wawa source/dependency or second store was added.

K07–K15 use original in-memory neutral alpha masks and the theme's existing accent/highlight/muted/foreground roles: dirt-only grounded wheel dust, idle/moving exhaust, spark/tier/contact bursts, rear-wheel rings/arcs, world-space wake, socket-anchored flames, slope-aligned tyre marks and observed-start/accepted-finish confetti. Wake samples form a bounded piecewise curve with heading-aligned segments; distance and lifetime caps limit length. They do not copy upstream overshooting interpolation. Low/Balanced/High active caps are 128/512/1,024 particles and 64/128/256 tyre segments. Separate preallocated quad1,024, solid1,024 and mark256 buffers share one atlas/material. Low reduces active instances, not allocation. No performance target is claimed from instance counts.

K16–K17 expose validated time/burst, emission, lifetime, size, gravity, fade easing, mesh/billboard/stretch, wake length and tyre lifetime controls and JSON import/export in authenticated Admin → Kart → Effects. Colour comes from theme palette roles and the existing Theme picker; arbitrary colour values are deliberately excluded. The bench includes finite start/drift/boost/dirt/flight/impact/finish scripts with explicit replay/reset/pause. Scripts use projected public stand-ins and zero sample points; they never create a room, simulate a collision or advance scoring. Solo can be opted in, tuned with a local face and switched to legacy. Local GPU draw/triangle/geometry/texture counts are admin-only and never uploaded or projected.

Imported ground Y is baked from the retained unchanged GLB beside existing X/Z triangles, using the same spatial index. Barycentric height and upward normal account for the 1.6m model-origin difference. Skids distinguish flight clearance from world Y and interpolate endpoint heights. The pre-existing start-grid seam uses an explicit approximate flat fallback; it is not measured mesh geometry. Collision edges/X/Z and source hash are unchanged. Public contact is only an optional accepted boolean, never client hit authority.

An optional public race flag selects absent=legacy, true=new default, false=decoration disabled. Existing host authentication/receipts persist enable/off plus at most20 private injected-time history entries; guest/stage receive no history. Live controls offers both actions and the real rehearsal link. Phone/stage pause freezes cosmetic history separately from reduced motion, which clears decoration and responds to preference changes. Visibility resets prevent stale trails/celebrations. Hazards/projectiles retain their separate gameplay budgets and visibility.

Solo presentation preserves one authorised/local photo Blob per parent cache key. Metadata-only updates omit face; the receiver preserves its current URL/texture. New frame revisions resend cached bytes; null explicitly clears. Presets are cloned/validated and cleared with receiver cleanup. Runtime native-constructor guards, actual browser shader tests and face/preset/legacy checks protect both adapters. No practice credentials, room state or new persisted identity.

See the checkpoint/build progress for the completed local checks and remaining release constraints. Physical-device budgets, venue/projector checks and the 20-minute soak belong to Phase10 and remain unverified.

### Local Phase3 resource sample

The recorded Chromium phone rehearsal warmed High, then ran Low/Balanced/High twice with moving script restarts. Geometries43 and textures19 stayed constant across all seven samples. After fixing start bursts to honour their preset, Low used33 draw calls,128 particles and60–64 marks; Balanced39/372/100; High46/679/180 (static warm-up45/720/0). Scene triangles ranged462,582–499,573. These totals include the retained track/vehicles and are not GPU byte counts, physical frame-rate guarantees or an80-racer performance certification. Final numeric samples are in artifacts/kart-fix-checks/phase3-final-resources.json; phase3-resources.json retains the earlier pre-fix comparison. The mandatory 20-minute soak and device/venue budgets remain Phase10.

## Phase 4 look and optical integration (verification in progress)

The shared v1 Look preset now defaults missing optics to neutral, preserving older JSON exports. All optics are off in neutral. The real bench exposes speed lines, boost colour split, procedural lens dirt, bounded bloom, depth-crease occlusion and tilt shift, with validated strengths and focus settings. It can run the existing finite stand-in scripts or the actual solo engine. The central racing line is protected from dirt, colour splitting, wind and defocus.

The renderer keeps one bounded colour target and the existing two-pass path. High can add one owned depth texture; its lightweight occlusion samples four neighbouring depths, rather than running full SSAO. Tilt shift reuses those neighbours with depth-edge rejection. The combined shader has at most12 texture reads per fragment. Balanced omits depth effects and reduces other strengths; Low skips optics. Reduced motion removes wind, chromatic movement and tilt; pause removes moving wind/chromatic effects. The neutral path releases its targets and renders the original scene directly. HUD and controls remain separate DOM content. These are bounded implementation costs, not a physical-device FPS guarantee.

Both Three186 connected and Three176 solo adapters construct their own native resources, sharing plain configuration and shader descriptions only. Frame input contains accepted speed/boost; it is never a scoring or control channel. Source palette roles provide colours. No dependencies, network textures or parallel effect store were added.

A room can select off/daylight/warm/crisp/cool/race using the existing receipted host command path. Absence preserves legacy output. History is capped at20 injected-time entries and goes only to control snapshots. Guests and stage receive the current named choice and retain local graphics/reduced-motion preferences. Original-look recovery stays available through reveal/scores and ended races. The race preset is deliberately mild and opt-in; depth effects are showcase settings.

Focused web70/70, script35/35 and relevant API78/78 checks passed. Connected GPU pixel/neutral/Low/context proof and80-driver stage passed in the first browser run; native and live-room cases require a fresh run after correcting local auth bootstrap/creation readiness. Full gates and native GPU verification remain pending in the checkpoint. No Phase4 completion or physical performance sign-off is claimed here.

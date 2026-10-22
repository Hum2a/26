# Standalone Mario Kart 3.js practice

Source: https://github.com/Nathan-Richard-21/mario-kart-js at `0f7a4305981206193c5efba64bc90755e6e85773`, derived from https://github.com/mustache-dev/Mario-Kart-3.js.

`src/upstream/` retains the upstream ground raycasts, chassis/wheel animation, kart and circuit mesh layout. The adapted controller now uses the shared arcade movement/collision model and a resolved-pose chase camera. The two GLBs are copied unchanged:

- `kart.glb`: SHA-256 `a46534917b07f4585669d26968d7a59c5d0e517fc665f128884462646ec9fd1f`
- `mario-circuit-test-transformed.glb`: SHA-256 `4fc464ce325ec1fa765ea9bd11be7eafc474ed33ee2219b261f429ca19ba6bf9`

Changes: removed the upstream landing page, multiplayer provider, time-trial manager, music, post-processing, particles and VFX. Added an adapter for the site's shared touch/keyboard controller, explicit acceleration on touch devices, pause/visibility handling, reset by remounting the player, frame-delta caps, capped camera interpolation, frame-rate-independent wheel rotation and restricted ground queries. Undefined drift thresholds resolve to zero. GSAP hop animations clean up on unmount and reduce their travel when reduced motion is requested. Models and Draco decoders load from the same origin after Start, with no decoder CDN request.

The isolated upstream Zustand store is ephemeral solo practice state only. It has no room credentials, sockets, multiplayer telemetry, scores, lap validation or persistence. It is intentionally not an alternative authority for the existing party race. This mode is free driving with ground-following visuals and static scenery collisions, with local collectable power-ups and no opponents. `src/track/colliders.json` is derived from the pinned circuit GLB by `scripts/kart-colliders.mjs`; it retains the asset provenance and notices. See `docs/kart-minigame.md` for extraction choices and recovery behaviour.

Three 0.176.0, Fiber 9.1.2 and Drei 10.0.7 are pinned together in this workspace. The party renderer keeps its separate Three version. `npm run dev` and `npm run build` build this workspace first and serve its generated files under `/kart-engine/`; `/kart` embeds it. After editing the engine while the web dev server runs, run `npm run build -w @26/kart-solo` and reload `/kart`.

See the root `THIRD_PARTY_NOTICES.md` and `public/draco/LICENSE` for attribution and notices.

Original bounded drift sparks and boost trails now render beside the adapted kart, using existing simulation charge and theme colours. These are newly written instanced effects, not the removed upstream particle/VFX system.

Track item boxes, local turbo/shield/oil rules and the item inventory use newly written shared pure logic; they do not import upstream multiplayer or persistence. The solo render loop owns only its practice simulation, and item visuals use existing theme colours.

Drift polish (21 October 2026) adds latched slide steering, shared tiered release turbos, slip-based kart/camera feedback, a bounded world-space spark wake and charge-tier HUD text. These remain original local changes over the pinned upstream renderer. The existing ephemeral solo store remains the sole practice adapter; connected physics stays in the shared authoritative model.

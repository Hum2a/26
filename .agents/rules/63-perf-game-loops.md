---
description: requestAnimationFrame, kart/chess/troll loops, workers and WASM
trigger: glob
globs:
  - apps/web/src/kart/**/*.ts
  - apps/web/src/kart/**/*.tsx
  - apps/web/src/chess/**/*.ts
  - apps/web/src/chess/**/*.tsx
  - apps/web/src/troll/**/*.ts
  - apps/web/src/troll/**/*.tsx
  - apps/web/src/play/**/*.ts
  - apps/web/src/play/**/*.tsx
  - apps/web/public/chess-engine/**
  - apps/web/public/kart-engine/**
  - packages/shared/src/kart/**/*.ts
  - packages/shared/src/chess/**/*.ts
---

# Game loops, workers, and WASM

React renders **beats** (intro, collect, reveal). Canvas, Stockfish, and particle systems render **frames**. Do not mix them.

## requestAnimationFrame

One rAF (or one Three.js `setAnimationLoop`) per visible canvas. Pause it when the tab is hidden, the round is paused, or the component unmounts. Never `setState` inside the frame callback.

```ts
// ❌ BAD
function tick() {
  setPose(readPose());
  requestAnimationFrame(tick);
}

// ✅ GOOD — KartCanvas: mutate Three objects from `live.current`, then render
renderer.setAnimationLoop(() => {
  const race = live.current;
  // ...update meshes from race / prediction refs
  renderer.render(scene, camera);
});
```

`useKartControls` may poll gamepads in rAF; it must cancel the frame on disable. Troll overlays that use rAF (`screen-trolls`) must stop on effect cleanup and on reduced motion.

Clamp delta time so a backgrounded tab does not step 5s of physics on wake. The **room** still owns race time; the phone only interpolates public poses plus local self-prediction.

## Kart (Three.js)

- Import `three` only from `apps/web/src/kart/**`. Guest and stage entry must `lazy()` the canvas (`GuestPlay`, `KartDriverView`, `KartStageView`, `stage-play`).
- `warmKart()` during the kart **intro**, not at `/play` join (`usePreloadQuestion`).
- Bound work to **self + nearby** racers (`graphicsProfiles.nearbyLimit`). Do not draw 80 full vehicle rigs at phone resolution.
- Respect `safeGraphicsProfile` / frame probe: drop pixel ratio, sparks, and trails when the canvas is strained. Decoration never changes race state.
- On unmount: dispose geometries, materials, textures, renderer, and the animation loop (`KartCanvas` already disposes look, circuit, renderer).
- `powerPreference: "low-power"` on phones. No antialias on mobile.

## Chess (Stockfish WASM)

- Engine code stays in `apps/web/src/chess/stockfish-worker.ts` and `/chess-engine/`. Do not import the `stockfish` npm package from guest-play, stage, or admin chrome.
- Run UCI on a **Worker**. Never on the window thread.
- One init worker per mounted game. `terminate()` it on unmount, on round exit, and before creating a replacement. Isolate in-flight searches so a stale `bestmove` cannot apply; still **tear down** workers so a long game does not accumulate them.
- Warm the engine on chess intro / first board paint, with a visible “Loading chess engine…” fallback. Do not fetch the WASM on `/join`.
- The room validates moves and scores captures. The phone worker is a bot, not authority.

```ts
// ❌ BAD — leave workers alive when the guest leaves the round
await engine.initialize();

// ✅ GOOD
useEffect(() => {
  void engine.initialize();
  return () => engine.terminate();
}, [engine]);
```

## Trolls and VFX

Stage VFX and phone troll overlays must budget particles (`vfx-budget`, `kartVfxBudgets`). A troll that runs on 80 phones cannot allocate unbounded canvases or decode a unique video per guest. Prefer CSS/Motion on the phone; keep WebGL on the projector unless the troll is explicitly a phone effect.

Reduced motion: no loops, no screen shake that hides the question, no colour-only meaning.

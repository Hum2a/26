# Third-party adaptation notices

## mario-kart-js driving model

Adaptation reference: https://github.com/Nathan-Richard-21/mario-kart-js at commit `0f7a4305981206193c5efba64bc90755e6e85773`.

The upstream README declares the following permission notice. It is retained for the server-side handling adaptation and the separately bundled solo practice game in `apps/kart-solo`. The solo game includes adapted upstream controller/model source, `kart.glb` and `mario-circuit-test-transformed.glb` from the pinned repository. No upstream music, landing-page artwork or service worker is distributed. The upstream README describes a fan project and states that Mario Kart intellectual property belongs to Nintendo; its code permission notice does not change that attribution.

> MIT License
>
> Copyright (c) 2025 Infinity Cybertech
>
> This is a work by Infinity Cybertech.
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

The project's dependencies retain their respective licences. See their published package sources; this file is not a replacement for those licences.

## Draco decoder

`apps/kart-solo/public/draco/` contains the self-hosted glTF Draco decoder distributed by Three.js r176. Draco is copyright The Draco Authors and licensed under Apache-2.0. The full licence is retained beside the decoder as `LICENSE` and copied into the served game bundle.

## Solo practice provenance

See `apps/kart-solo/UPSTREAM.md` for the upstream commit, asset checksums and the changes made for this site. The same notice is included with the standalone game at `/kart-engine/THIRD_PARTY_NOTICES.md`.

## Stockfish chess engine

Chess round uses Stockfish 19 compiled to WebAssembly, distributed via npm package `stockfish@19.0.1`.

**Source:** https://github.com/nmrugg/stockfish.js (WASM compilation by Nathan Rugg)  
**Upstream engine:** https://github.com/official-stockfish/Stockfish  
**Package version:** 19.0.1  
**Assets:** `stockfish-19-lite-single.wasm` (1.8 MB) and `stockfish-19-lite-single.js` (28 KB) copied to `apps/web/public/chess-engine/`  
**License:** GPL-3.0-or-later

The full GPL-3.0 license text is available in `node_modules/stockfish/Copying.txt`. Stockfish is copyright The Stockfish developers.

Per GPL-3.0 requirements:
- Source code is available at the repositories above
- This distribution includes the compiled WebAssembly binary and JavaScript wrapper unmodified from the npm package
- Recipients have the same rights to use, modify, and distribute under GPL-3.0-or-later
- No warranty is provided

The 26 birthday game project uses Stockfish as a separate work; the entire project is not licensed under GPL. Only the Stockfish chess engine components are GPL-licensed.

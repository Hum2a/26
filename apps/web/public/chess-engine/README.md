# Stockfish Chess Engine Assets

This directory contains the Stockfish 19 chess engine compiled to WebAssembly.

## Files

- `stockfish-19-lite-single.wasm` (1.8 MB) - Single-threaded lite WASM binary
- `stockfish-19-lite-single.js` (28 KB) - JavaScript wrapper/loader

## Source

- **Package:** stockfish@19.0.1 from npm
- **WASM compiler:** https://github.com/nmrugg/stockfish.js
- **Upstream engine:** https://github.com/official-stockfish/Stockfish
- **License:** GPL-3.0-or-later

## Usage

<<<<<<< HEAD
The planned chess-round phone UI will load these assets in a Web Worker for bot opponents; browser integration is not yet present in this revision.

Once integrated, the engine is intended to run entirely in the guest's browser; there is no server-side chess engine execution.
=======
**Status:** Assets vendored, worker wrapper implemented. Full phone UI integration in progress.

These assets will be loaded by the chess round's phone UI to provide bot opponents running at approximately 1425 Elo strength (UCI_LimitStrength + UCI_Elo configuration).

The engine will run entirely in the guest's browser via Web Worker. No server-side chess engine execution.
>>>>>>> 904d731 (fix: address PR review findings 1-7)

## License Compliance

Stockfish is licensed under GPL-3.0-or-later. Source code and full license are available at the repositories above. These assets are unmodified from the npm package.

See ../../THIRD_PARTY_NOTICES.md for complete licensing information.

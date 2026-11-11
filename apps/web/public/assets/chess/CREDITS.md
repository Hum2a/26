# Chess asset pack — credits and licences

All files in this pack are free to use in this game (including commercially)
under the licences below. None use CC-BY-SA, CC-BY-NC, or GPL-only terms.

**Short credit line (for an about screen or README):**

> Chess pieces based on the Cburnett set by Colin M. L. Burnett (3-clause BSD).
> Board textures: White Maple Veneer and American Walnut Veneer by Jenelle van
> Heerden; table from Brown Leather by Rob Tuytel — all via Poly Haven (CC0).
> Sounds, carved shading and win animation original, CC0.

---

## pieces/ — 12 SVG files

`wK.svg` `wQ.svg` `wR.svg` `wB.svg` `wN.svg` `wP.svg`
`bK.svg` `bQ.svg` `bR.svg` `bB.svg` `bN.svg` `bP.svg`

| Field            | Detail                                                                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Author**       | Colin M. L. Burnett (Cburnett)                                                                                                                                    |
| **Source**       | Wikimedia Commons chess piece SVGs, e.g. https://commons.wikimedia.org/wiki/File:Chess_klt45.svg (and the eleven sibling `Chess_{k,q,r,b,n,p}{l,d}t45.svg` files) |
| **Author page**  | https://commons.wikimedia.org/wiki/User:Cburnett                                                                                                                  |
| **Licence used** | 3-clause BSD Licence (permissive, MIT-compatible)                                                                                                                 |
| **Licence text** | reproduced below                                                                                                                                                  |

The set is multi-licensed by the author (GFDL 1.2+, GPL 2/3, CC-BY-SA 3.0, and
the 3-clause BSD Licence). This pack uses **only the 3-clause BSD option**.
See also https://en.wikipedia.org/wiki/User:Cburnett/GFDL_images/Chess and the
licence block on each Commons file page.

**Modifications (this pack):**

- Shared 512×512 canvas, consistent scale across the set, pieces centred
  horizontally and sitting on a common baseline, with about 8% padding around
  the largest piece (the queen’s width and the black queen’s height).
- Carved, slightly glossy ivory / ebony fills (linear gradients, top-left light).
- White pieces given a warm dark outline (`#1c140c`).
- Black pieces given a light cream rim (`#efe4d0`) so they read on dark squares;
  existing white detail strokes kept as cream.

These derived SVGs should be redistributed under the same 3-clause BSD Licence,
with the copyright notice below retained.

### 3-clause BSD Licence (Cburnett pieces)

```
Copyright (c) Colin M. L. Burnett
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

 * Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.
 * Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.
 * Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from this
   software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
```

Individual source URLs:

- wK — https://commons.wikimedia.org/wiki/File:Chess_klt45.svg
- wQ — https://commons.wikimedia.org/wiki/File:Chess_qlt45.svg
- wR — https://commons.wikimedia.org/wiki/File:Chess_rlt45.svg
- wB — https://commons.wikimedia.org/wiki/File:Chess_blt45.svg
- wN — https://commons.wikimedia.org/wiki/File:Chess_nlt45.svg
- wP — https://commons.wikimedia.org/wiki/File:Chess_plt45.svg
- bK — https://commons.wikimedia.org/wiki/File:Chess_kdt45.svg
- bQ — https://commons.wikimedia.org/wiki/File:Chess_qdt45.svg
- bR — https://commons.wikimedia.org/wiki/File:Chess_rdt45.svg
- bB — https://commons.wikimedia.org/wiki/File:Chess_bdt45.svg
- bN — https://commons.wikimedia.org/wiki/File:Chess_ndt45.svg
- bP — https://commons.wikimedia.org/wiki/File:Chess_pdt45.svg

---

## sounds/ — 8 MP3 files

`move.mp3` `capture.mp3` `check.mp3` `castle.mp3`
`promote.mp3` `win.mp3` `lose.mp3` `low-time.mp3`

| Field       | Detail                                              |
| ----------- | --------------------------------------------------- |
| **Author**  | Original, generated for this project                |
| **Source**  | Procedural synthesis (Python / NumPy + ffmpeg)      |
| **Licence** | CC0 1.0 (original, generated for this project, CC0) |

All clips are mono 44.1 kHz MP3, under 60 KB, with leading silence trimmed
(`ffmpeg silenceremove`).

| File         | Intended sound                               |
| ------------ | -------------------------------------------- |
| move.mp3     | A wooden piece placed on a board             |
| capture.mp3  | A sharper clack, with a short second contact |
| check.mp3    | A short two-tone alert (perfect fourth)      |
| castle.mp3   | Two quick placements about 110 ms apart      |
| promote.mp3  | A bright rising major-arpeggio chime         |
| win.mp3      | A short C-major fanfare, about 2 seconds     |
| lose.mp3     | A short descending sting                     |
| low-time.mp3 | A single soft clock tick                     |

---

## board/board-light.webp

| Field             | Detail                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| **Author**        | Jenelle van Heerden                                                                                 |
| **Source**        | Poly Haven — White Maple Veneer, 2K diffuse map. https://polyhaven.com/a/white_maple_veneer         |
| **Licence**       | CC0 1.0 (https://polyhaven.com/license)                                                             |
| **Modifications** | Resized to a seamless 512×512 tile; grain contrast increased slightly. Encoded as WebP under 80 KB. |

## board/board-dark.webp

| Field             | Detail                                                                                                                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Author**        | Jenelle van Heerden                                                                                                                                                                                         |
| **Source**        | Poly Haven — American Walnut Veneer, 2K diffuse map. https://polyhaven.com/a/american_walnut_veneer                                                                                                         |
| **Licence**       | CC0 1.0 (https://polyhaven.com/license)                                                                                                                                                                     |
| **Modifications** | Resized to a seamless 512×512 tile; recolored from the source’s cool grey-brown veneer to a warmer furniture-walnut tone while keeping the original grain; contrast increased. Encoded as WebP under 80 KB. |

## board/table.webp

| Field             | Detail                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Author**        | Rob Tuytel                                                                                                                                                                      |
| **Source**        | Poly Haven — Brown Leather, 2K albedo map. https://polyhaven.com/a/brown_leather                                                                                                |
| **Licence**       | CC0 1.0 (https://polyhaven.com/license)                                                                                                                                         |
| **Modifications** | Cropped to 16:10 and resized to 1600×1000; Gaussian soft-focus; darkened; mild vignette. Encoded as WebP under 150 KB. Nothing busy — a dark leather backdrop behind the board. |

---

## board/win.json

| Field       | Detail                                                           |
| ----------- | ---------------------------------------------------------------- |
| **Author**  | Original, generated for this project                             |
| **Source**  | Hand-authored Lottie 5.7 JSON (confetti burst + soft gold flash) |
| **Licence** | CC0 1.0 (original, generated for this project, CC0)              |

800×800, 30 fps, 2.4 s. Gold, cream, deep red, forest green, white and amber
confetti radiating from the centre, for a checkmate celebration on the big
screen. Not taken from LottieFiles.

---

## preview-pieces.png

Rendered for review from the pack’s own SVGs and board tiles. Same licences as
the source files above (BSD pieces + CC0 textures). Not required at runtime.

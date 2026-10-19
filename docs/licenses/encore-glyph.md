# Encore Glyph adaptation

The classic five-letter marking algorithm and allowed-word list were adapted from the user-provided sibling Encore project. The phone layout is rebuilt with 26’s shared components and motion kit; Encore’s answer-bearing puzzle state is never sent to guests. No multi-board, daily puzzle, drill or hard-mode features are included.

Sources: `packages/game-glyph/src/mark.ts`, `play.ts`, `dictionary/validity-words.ts`, and the shared `apps/web/src/games/letter-guess` board/keyboard in Encore. The dictionary is copied verbatim; its ordering has no scoring significance here. Original word-list attribution is preserved beside it in `apps/api/src/questions/wordle-dictionary/LICENSE.txt`, with the full upstream [SCOWL notice](https://github.com/jacksonrayhamilton/wordlist-english/blob/master/Copyright) in `SCOWL-Copyright.txt`.

Encore licence:

MIT License

Copyright (c) 2026 Encore contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

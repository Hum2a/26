# Content guide

[Home](../README.md) · [Documentation](README.md) · [Event runbook](event-runbook.md)

Questions stay in versioned TypeScript. There is no CMS. How to add one is in [question-authoring.md](question-authoring.md).

The pack a new room plays is the illustrative demo, version `demo-2026-09-22`, in `apps/api/src/questions/packs/demo/`. It is not Humza's party script. Fixture names there exist so a round can be scored. They are not statements about guests. `apps/api/src/questions/demo-set.ts` re-exports that pack.

Humza's own questions go in `apps/api/src/questions/packs/birthday/`. That catalogue starts empty. Its version `birthday-draft` is not pinned to a room. Do not paste generated lines into the demo pack and call them the party questions.

## Add a party question

1. Describe the idea. The agent creates `apps/api/src/questions/packs/birthday/<id>.ts` with an existing helper and records any missing answer or asset.
2. The file is listed in the birthday catalogue and left out of `order` while it is a draft.
3. Guest JavaScript must not import the question file. Correct answers stay on the server.
4. Run `npm run content:check`. It checks the demo pack and the birthday catalogue. Incomplete drafts are reported. Invalid data, a draft in a running order, and a missing ready asset fail the check.
5. Run `npm run content:export`. That rewrites the offline answer keys and presenter running orders in `docs/content/`.

Releasing a birthday version, and pointing new rooms at it, is a separate step from adding a question. Rooms already playing `demo-2026-09-22` keep that pack.

A collection or vote window has to be a whole number of milliseconds from 15 to 45 seconds. Points are a whole number from zero. A choice's correct id has to be one of its options. A complete ranking places every item once. A duel target has to sit on its scale.

Live typing is only compatible with a question whose attribution is `live`. Double or nothing only changes the score when that choice lists `modifiers: ["double"]`. The other selected trolls are presentation. Effects named in `unsupportedEffects` in `apps/api/src/questions/preflight.ts` are rejected if a phone asks for them.

`npm run build` runs the same preflight after the client build. A broken pack fails the build. A missing sound file at runtime does not stop the round: the stage says the cue or photo did not load and continues.

## Selected trolls in this build

Screen invasion, call from Mum, cracked screen, dodging button, nickname swap, hidden score, double or nothing, live typing, voice clip, theme song, and sponsor break.

The theme song plays `apps/web/public/assets/theme-song.mp3`, a 3.1 second Thomas the Tank Engine flute clip. Keep a replacement under about three seconds. Benjamin Netanyahu has his face and music, and the cracked screen has a glass smash. The full list of trolls still waiting for an asset is in `apps/api/src/troll/README.md`.

## Still needed from Humza

- The real question list, in running order, with the answer or scoring rule for each.
- How long each answer and vote should stay open.
- Which rounds allow double or nothing, and which stay unscored.
- Whether long vote rounds show every answer or a shortlist.
- The party sting, and any face or caption art for the selected trolls.
- Photos or voice the questions themselves need. Guest uploads during the night are separate.
- Which comparison cards should be read on the projector.

Until those arrive, use the illustrative pack and the exports under `docs/content/` as the offline fallback. The birthday export states that the catalogue has no playable questions.

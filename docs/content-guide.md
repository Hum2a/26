# Content guide

Questions stay in versioned TypeScript. There is no CMS. The pack that ships today is the illustrative demo, version `demo-2026-09-22`, in `apps/api/src/questions/demo-set.ts`. It is not Humza's party script. Fixture names in that file are there so a round can be scored. They are not statements about guests.

Humza has not supplied party questions or party media in this repository. Do not paste generated lines into the demo set and call them the party questions.

## Replace the demo

1. Edit `demoQuestions` in `apps/api/src/questions/demo-set.ts`.
2. Keep each prompt starting with `Illustrative demo:` until the line is one Humza wrote. Then change `demoQuestionSetVersion` in `apps/api/src/room/limits.ts` and drop that prefix on the real lines.
3. Set the correct option, slider truth, rank order, guess name, or duel target in that same server module. Guest JavaScript must not import it.
4. Run `npm run content:check`. It checks ids, durations, scoring, phase windows, attribution, the selected trolls, and the sting file.
5. Run `npm run content:export`. That rewrites the offline answer key and the presenter running order in `docs/content/`.

A collection or vote window has to be a whole number of milliseconds from 15 to 45 seconds. Points are a whole number from zero. A choice's correct id has to be one of its options. A complete ranking places every item once. A duel target has to sit on its scale.

Live typing is only compatible with a question whose attribution is `live`. Double or nothing only changes the score when that choice lists `modifiers: ["double"]`. The other selected trolls are presentation. Effects named in `unsupportedEffects` in `apps/api/src/questions/preflight.ts` are rejected if a phone asks for them.

`npm run build` runs the same preflight after the client build. A broken pack fails the build. A missing sound file at runtime does not stop the round: the stage says the cue or photo did not load and continues.

## Selected trolls in this build

Screen invasion, call from Mum, cracked screen, dodging button, nickname swap, hidden score, double or nothing, live typing, voice clip, theme song, and sponsor break.

The theme song looks for `apps/web/public/assets/demo-sting.wav`. The file in the repo is a short illustrative tone. Replace it with the party sting and keep it under about three seconds. There is no party face asset. The invasion, call, and crack effects are labelled demos until those assets exist.

## Still needed from Humza

- The real question list, in running order, with the answer or scoring rule for each.
- How long each answer and vote should stay open.
- Which rounds allow double or nothing, and which stay unscored.
- Whether long vote rounds show every answer or a shortlist.
- The party sting, and any face or caption art for the selected trolls.
- Photos or voice the questions themselves need. Guest uploads during the night are separate.
- Which comparison cards should be read on the projector.

Until those arrive, use the illustrative pack and the two exports under `docs/content/` as the offline fallback.

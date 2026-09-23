# Question authoring

Questions are versioned TypeScript. There is no CMS. Give a coding agent a question idea in ordinary language. It should choose an existing mechanic, create one file, and leave anything it does not know as an explicit gap.

Do not invent personal facts, guest names, photos, or anecdotes. The illustrative pack in `apps/api/src/questions/packs/demo/` is a fixture. It is not the party script.

## What to say

- `Next question idea: …`
- `Add a question where …`
- `Make this question ready.`
- `Move this question before …`
- `Change the answer/options for …`
- `Now customise the design of this question.`

A new idea becomes a draft in the birthday catalogue. It is not added to a live running order, it does not change a room, and it does not deploy anything.

## Where a question goes

Create `apps/api/src/questions/packs/birthday/<id>.ts`. The id is a stable lowercase slug, such as `childhood-photo`. Do not put a running-order number in the id or the filename.

Register that export in `catalogue` inside `apps/api/src/questions/packs/birthday/manifest.ts`. Leave it out of `order` until it is ready and you have explicitly included it.

Helpers live in `apps/api/src/questions/authoring.ts`. Defaults live only in `apps/api/src/questions/defaults.ts`.

| Idea                                    | Helper           | Mechanic |
| --------------------------------------- | ---------------- | -------- |
| Pick one option                         | `choiceQuestion` | `choice` |
| Estimate a number                       | `sliderQuestion` | `slider` |
| Put items in order                      | `rankQuestion`   | `rank`   |
| Write a line, then vote                 | `voteQuestion`   | `vote`   |
| Name a person                           | `guessQuestion`  | `guess`  |
| One-against-one number                  | `duelQuestion`   | `duel`   |
| Two contestants, everyone else predicts | `finaleQuestion` | `finale` |

If the idea needs an interaction that is not in that list, say so and still save a draft. Do not force it into the wrong mechanic, and do not start a new scoring engine.

## Draft, ready, and playable

These are separate:

- **Draft** can be saved with gaps. **Ready** means the mechanic and the required facts validate. Ready does not mean the question has a custom visual.
- **Catalogue** is every question file the pack knows. **Order** is the playable running order. A draft must not be in `order`.
- **`standard` presentation** uses the current phone and stage components. A custom layout is a later change to that question's `presentation` id. It does not change the question id or the scoring.

A missing fact uses `{ missing: { code, name, detail } }` or a required media ref with no `asset`. Do not invent an option id, a nickname, or a file.

```ts
import { guessQuestion } from "../../authoring.ts";

export const childhoodPhoto = guessQuestion({
  id: "childhood-photo",
  title: "Childhood photo",
  prompt: "Who is in this photo?",
  media: [{ name: "childhood-photo", kind: "image", required: true }],
  truth: {
    missing: {
      code: "correct-answer",
      name: "person",
      detail: "The person in the photo has not been named.",
    },
  },
});
```

That file is a draft. The photo and the person are still required. Nothing here is a claim about a real guest.

## Defaults

When an ordinary setting is omitted, the helper uses `apps/api/src/questions/defaults.ts`:

- 20 seconds to answer, attribution `after`, presentation `standard`, no score modifier, no speed bonus.
- Choice: 100 points.
- Slider: 100 points, with full points for an exact value.
- Rank: 80 points, complete order, ties forbidden.
- Vote: 60 points, 20 seconds to vote, every line, no self-vote, the authors of the winning lines score, a tie shares the points.
- Guess: 80 points, the whole room, named person.
- Duel: 50 points, a solo player if the room is odd, a shared tie, a missing opponent forfeits.
- Finale: 70 points for the contestants, 30 for a correct prediction, 20 seconds to predict.

Windows must be a whole number of milliseconds from 15 to 45 seconds. Points are a whole number from 0 to 1000. A question id is 1 to 40 characters, lowercase letters, digits, and hyphens. A prompt is 1 to 200 characters. Option ids are 1 to 16 characters in the same slug form. Labels are 1 to 80 characters. A pack order holds at most 40 questions.

## Versions

Editing the birthday catalogue does not change a room. `startDemo` still pins `demo-2026-09-22`.

- While drafting, edit the birthday files. Their version id is `birthday-draft`, and rooms cannot start it.
- A released version is a new id, for example `birthday-2026-09-23`, with `release: "released"` and a playable `order` of ready questions only. Register that id in `apps/api/src/questions/registry.ts` beside the old one.
- Rooms keep the version they already stored. Do not edit a released pack's question files in place. Do not hot-swap questions into an active game.
- `unreleased` means the lobby. An unknown id is unavailable. The game must not silently use a different pack.

## Checks

`npm run content:check` fails on invalid data, a draft in a running order, a duplicate id, a broken manifest reference, a ready question with a missing asset, or an unsupported presentation. An incomplete draft that is only in the catalogue is reported and does not fail the check.

`npm run content:export` rewrites the offline answer key and presenter order. Pass `birthday` to export that catalogue only. The default writes both. Those files stay in `docs/content/` and are not public web assets.

## Custom design, later

Say `Now customise the design of this question.` The question file keeps its id and mechanic. Set `presentation` to a new slug, register that slug in `apps/api/src/questions/presentation.ts`, and add a component in `apps/web/src/play/presentation.ts`. Until then, `resolvePresentation` returns nothing for `standard`, and the existing phone and stage components render the question. The client receives only the public presentation id, the prompt, and the fields that role and phase already allow.

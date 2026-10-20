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

| Idea                                    | Helper                                                      | Mechanic |
| --------------------------------------- | ----------------------------------------------------------- | -------- |
| Pick one option                         | `choiceQuestion`                                            | `choice` |
| Vote with no right answer               | `choiceQuestion` with `outcome: { kind: "poll" }`           | `choice` |
| The room's split decides who scores     | `choiceQuestion` with `outcome: { kind: "threshold", ... }` | `choice` |
| Solve a five-letter word in six guesses | `wordleQuestion`                                            | `wordle` |
| Drive a one-lap sprint                  | `kartQuestion`                                              | `kart`   |
| Type a short answer                     | `typedQuestion`                                             | `typed`  |
| Estimate a number                       | `sliderQuestion`                                            | `slider` |
| Put items in order                      | `rankQuestion`                                              | `rank`   |
| Write a line, then vote                 | `voteQuestion`                                              | `vote`   |
| Name a person                           | `guessQuestion`                                             | `guess`  |
| One-against-one number                  | `duelQuestion`                                              | `duel`   |
| Two contestants, everyone else predicts | `finaleQuestion`                                            | `finale` |

A choice option may include `image: "/assets/questions/<question-id>/<option-id>.png"`. Use a real PNG in `apps/web/public/assets/questions/`. Phone cards and stage options contain the illustration inside their existing dimensions; the visible label stays the accessible button name. Content preflight checks that every referenced option image exists.

For a quotation A/B round, use a choice with `presentation: "who-said-it"` and put the quote in its public `prompt`. Keep the ordinary 200-character prompt limit; do not silently shorten a quotation. A factual “who said it” needs an exact source and verified attribution. Keep unsourced lines as drafts with a `quote-source` requirement and a missing `verified-attribution` answer; preserve a supplied answer only in private notes until verified. Their phone rehearsal labels the quote and attribution unverified. Explicitly authorised parody needs clear fictional framing, without attributing invented statements to real people. The design bench uses invented stand-ins, never a real answer key.

A threshold outcome names an option, a share, and who scores either way. `{ kind: "threshold", optionId: "blue", above: 0.5, met: "everyone", otherwise: ["red"] }` means: if more than half of the answers are blue, everyone who answered scores; otherwise only red scores. A guest with no answer never scores.

A typed question lists its accepted spellings. The first is shown at the reveal. Matching ignores case, accents, punctuation, hyphens and spacing, and forgives a small typo: none up to 4 letters, one up to 9, two beyond that. Wrong answers stay off the stage.

A Wordle question supplies `answer: { known: "ABCDE" }` with exactly five uppercase letters. Defaults are six guesses, two minutes and 100 points for a solve, with no speed bonus. The server validates guesses against Encore Glyph’s frozen word list, always allowing the supplied target. Repeated letters use two-pass marking. Only the guest sees their own board; the stage gets finished-board progress and the target at reveal. A reconnect restores the saved board. In Question packs, its phone rehearsal checks guesses through an authenticated, stateless server endpoint; it never starts a room or awards points.

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
- Choice: 100 points, 2 to 6 options. A poll is 0 points, cannot have a speed bonus, and may list up to 16 options.
- Typed: 100 points, a 60-character box (at most 80).
- Slider: 100 points, with full points for an exact value.
- Rank: 80 points, complete order, ties forbidden.
- Vote: 60 points, 20 seconds to vote, every line, no self-vote, the authors of the winning lines score, a tie shares the points.
- Guess: 80 points, the whole room, named person.
- Duel: 50 points, a solo player if the room is odd, a shared tie, a missing opponent forfeits.
- Finale: 70 points for the contestants, 30 for a correct prediction, 20 seconds to predict.

Windows must be a whole number of milliseconds from 15 to 45 seconds. Points are a whole number from 0 to 1000. A question id is 1 to 40 characters, lowercase letters, digits, and hyphens. A prompt is 1 to 200 characters. Option ids are 1 to 16 characters in the same slug form. Labels are 1 to 80 characters. A pack order holds at most 40 questions.

The catalogue may hold more than 40 entries; that limit applies to the live running order. An unordered question's isolated phone rehearsal shows `1 / 1`. A question in a running order keeps its position and that order's total.

## Completed party variants

Use the existing helper/mechanic rather than a note that asks for a different interaction:

- Choice exact set: `outcome: { kind: "multiple", optionIds: [...] }`. No separate `correctOption` is needed. Phones select several, then send one set; all correct and no decoys scores the question's points.
- Typed crowd match: `scoring: "commonness", accepted: { known: [] }`. There is deliberately no fixed password answer. Normalised room-frequency scoring freezes at reveal.
- Price bid: slider helper with `scoring: "under", input: "number"`, an actual supplied/sourced truth and explicit bounds/step. Phones enter decimal pounds. Tied highest underbids share the win; all over means no winner.
- Subjective dial: slider helper with `scoring: "consensus", truth: { known: null }`. The room median is derived from accepted eligible responses; no dummy personal answer is stored.
- Ordered consensus: rank helper with `scoring: "consensus", input: "ordered", truth: { known: [] }`, complete mode, no ties in submissions and one tier per item. The target's equal mean positions remain tied. The phone offers drag handles and move buttons.
- Three awards: vote helper with `flow: { kind: "awards", labels: [...] }`, exactly three named categories. Question points are the total available across categories; the dating round uses 180, or 60 per award. Each tied category winner receives that category's points.
- Blind bracket: vote helper with `flow: { kind: "tournament" }`. The server freezes the random seed, pairing/byes, electorate and entries. Tied matches follow the frozen draw, no self-votes, no votes throughout means no prize.

All variants use existing intents, storage, scoring ledger and scheduler. Multi-step ballots carry an epoch so retries from earlier matches/categories cannot vote in later ones. Settlements persist once and do not change on reconnect or repeated score execution. New factual quotations require an exact source and speaker; use brief verified excerpts, and record any replacement of earlier unverified wording in private notes and the source audit. A genuine personal take can come from an actual earlier supplied message, with a prompt that names its real context.

Phone rehearsal now has a voting view for vote rounds, with clearly labelled stand-in submissions and a next-ballot control. This does not simulate winners or scores.

## Versions

Editing the birthday catalogue does not change a room. `startDemo` still pins `demo-2026-09-22`.

- While drafting, edit the birthday files. Their version id is `birthday-draft`, and rooms cannot start it.
- A released version is a new id, for example `birthday-2026-09-23`, with `release: "released"` and a playable `order` of ready questions only. Register that id in `apps/api/src/questions/registry.ts` beside the old one.
- Rooms keep the version they already stored. Do not edit a released pack's question files in place. Do not hot-swap questions into an active game.
- `unreleased` means the lobby. An unknown id is unavailable. The game must not silently use a different pack.

## Checks

`npm run content:check` fails on invalid data, a draft in a running order, a duplicate id, a broken manifest reference, a ready question with a missing asset, or an unsupported presentation. An incomplete draft that is only in the catalogue is reported and does not fail the check.

`npm run content:export` rewrites the offline answer key and presenter order. Pass `birthday` to export that catalogue only. The default writes both. Those files stay in `docs/content/` and are not public web assets.

## Custom design

The phone is a full-screen game controller. Give each question a clear action, large controls and a considered composition. Use the shared `QuestionExperience` frame around the existing standard or bespoke renderer. The show moves through get-ready, answering, locked-in and reveal beats, with eased transitions and reduced-motion fades; only the server advances the live game. Keep photos, sound and other secondary tools out of the main answer area.

Admin → Question packs now includes a selectable phone preview. Each question's detail page has the same preview. Try get-ready and answering, select/type/slide, submit a rehearsal answer, pause and reset, and open the preview on a phone. It uses the actual guest components with an authenticated public-field projection. Rehearsal inputs never reach a live room. Missing scales stay unavailable, unsupported mechanics are labelled as draft placeholders, and stand-in players are identified. Real answers, author notes and reveal keys never enter the preview payload. Use the development bench for stand-in reveal layouts.

Say `Now customise the design of this question.` The question file keeps its id and mechanic.

1. Add a slug to `customPresentationIds` in `packages/shared/src/index.ts`. The server accepts only those ids, and the web registry must draw every one, or the typecheck fails.
2. Set `presentation` to that slug on the question.
3. Write `apps/web/src/play/designs/<slug>.tsx` and its CSS. Use the kit in `designs/kit.tsx`: `useDesignMotion` for eased, reduced-motion-safe motion, `choiceView` or `typedView` for state, `ChoiceSend` or `TypedSend` for the dock button, and `StagePrompt` for the projector question. A design returns nothing for a kind it does not draw, and the standard view takes over.
4. Register it in `designs/registry.ts`.
5. Look at it in development at `/design?q=<slug>&surface=phone|stage&phase=prompt|collect|reveal`. Add `&still=1` to skip to the end of every animation. The bench uses public question fields only and a stand-in reveal, never the answer key.

A phone design receives the phone's `open`, `pending`, `selectedId`, and the select, send, rank, and text handlers. The stage keeps the standard scoreboard for scores, final, and podium. Colours come from the theme variables. A colour that is the content itself, such as the red and blue pill, is a named entry in `contentColours` in `themes.ts`.

`standard` keeps the existing phone and stage components. The client receives only the public presentation id, the prompt, and the fields that role and phase already allow.

## Kart sprint

`kartQuestion` uses the supported `party-ring-v1` circuit, a fixed 45-second collection window, live participant numbers/names and 100 ordinary points. It reuses intro → prompt → collect (race) → reveal → scores. The server freezes participants at intro and owns physics, ordered checkpoints, timing and scores. Phones send only normalised controls on the existing authenticated WebSocket. No client lap time or checkpoint hash awards a result.

The Question packs phone preview is an isolated controller layout rehearsal, labelled with no running race. For a real multi-device rehearsal, use a fresh local lobby and Admin → Live controls → Start local kart rehearsal. That explicit development start is rejected in staging/production. Full contracts, engine provenance, scoring, rendering limits and the quiz/race/podium sequence are in [kart-minigame.md](kart-minigame.md). `kart-sprint` remains out of the birthday running order until a separate release is requested.

The Tribunal/chaos ideas are recorded in [content/tribunal-and-chaos.md](content/tribunal-and-chaos.md). A real Reddit/community/listing round needs its genuine source and answer. Self-vote multipliers, live spoken debates and push-your-luck raids remain explicit unsupported drafts; ordinary polls or text ballots must not be presented as those finished mechanics.

---
description: Question authoring workflow
trigger: glob
globs:
  - apps/api/src/questions/**/*.ts
  - docs/question-authoring.md
---

# Question authoring

Read `docs/question-authoring.md` before adding or editing a question. Party questions are TypeScript files, not a CMS.

Recognise:

- "Next question idea: …"
- "Add a question where …"
- "Make this question ready."
- "Move this question before …"
- "Change the answer/options for …"
- "Now customise the design of this question."

For a new idea:

1. Read the birthday manifest, `authoring.ts`, `defaults.ts`, and any related question.
2. Choose an existing mechanic when it fits: choice (with a correct, poll, threshold or push-your-luck outcome), typed, wordle, slider, rank, vote, guess, duel, or finale.
3. Create `apps/api/src/questions/packs/birthday/<id>.ts` with the matching helper. The id and filename are a stable slug, with no running-order number.
4. Apply defaults from `defaults.ts` for ordinary settings the user did not specify.
5. Keep the user's wording. Record a material assumption in the question file only when it changes the mechanic.
6. Record a missing answer or asset with `{ missing: { code, name, detail } }` or a required media ref that has no `asset`. Do not invent the fact, the person, or the file.
7. Import the question in `packs/birthday/manifest.ts` `catalogue`. Do not add a draft to `order`. Do not change `startDemo`, the demo pack, a room, or a deployment.
8. Run `npm run content:check`.
9. Report the id, mechanic, draft or ready status, and anything still missing.

Wordle uses `wordleQuestion` with a supplied five-letter uppercase target. The default is six guesses, two minutes and 100 points for a solve. Keep the target and dictionary server-side; never substitute ordinary typed matching. Use the real authenticated phone rehearsal to check feedback.

Ask a short question only when the ambiguity changes the meaning or the mechanic. Otherwise save a draft.

If the interaction is not one of these mechanics, explain the gap and still save a draft. Do not force the wrong mechanic or rewrite scoring.

A later edit finds the existing file by id. Reordering changes `order` in the manifest only. "Make this question ready" fills real supplied facts and, once it validates, still does not enter `order` unless the user asked to include it.

"Now customise the design of this question" keeps the same id and mechanic. Add the slug to `customPresentationIds` in `packages/shared`, set `presentation` on the question, write the design in `apps/web/src/play/designs/<slug>.tsx` with the shared kit, and register it in `designs/registry.ts`. Follow the full-screen question experience rule. Check the actual question in Admin → Question packs → Phone preview, plus `/design` for stand-in reveal states in development. Do not put the answer key in the client.

Do not edit a released pack's question files in place. A content change needs a new version id. Rooms keep the version they stored.

# Decisions for Humza

[Home](../README.md) · [Documentation](README.md) · [Event runbook](event-runbook.md)

Written 5 November 2026 for the 21 November party. Everything below was built on branch `kart-mobile-multiplayer` while you could not be asked. Where a choice was yours to make, it is a **switch with a safe default** rather than a guess baked into code. Nothing has been deployed, no secrets or dashboards were changed, and no question content was invented.

## 1. Things only you can do

| When             | What                                                                                                                                                                                                        | Why                                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Before merging   | Read this page and the Stage A/B entries in [build-progress.md](build-progress.md). Merge `kart-mobile-multiplayer` into `master` when happy.                                                               | All work is on the branch.                                                                                                      |
| Before the party | Deploy to staging (`npm run release` — staging is now the default), rehearse with real phones and the projector, then deploy production with `npm run release -- --deploy=production --confirm-production`. | No deploy has been made. The release script now runs unit, lint and script checks first; add `--full-checks` for the API suite. |
| Before 20 Nov    | Production deploys are refused from 20 Nov 00:00 to 22 Nov 12:00 (London). Use `--override-freeze` only for an emergency fix.                                                                               | A deploy restarts every room and drops every phone.                                                                             |
| Party day        | Neon console: switch off autosuspend on the production branch for the night.                                                                                                                                | Host commands mostly use a two-minute session cookie cache now, but sign-in and archiving still need the database.              |
| Any time         | Supply or drop the four draft questions (table below).                                                                                                                                                      | Facts cannot be invented.                                                                                                       |
| Any time         | Fix GitHub Actions billing, or keep running `npm run github-actions:check` locally before a deploy.                                                                                                         | CI has not run since `43cbce4`.                                                                                                 |
| Optional         | Confirm the R2 access key is scoped to the one media bucket and the production bucket CORS allows the site origin.                                                                                          | Dashboard settings, not code.                                                                                                   |

## 2. Switches in Admin → Live controls → Driving feel (kart)

A change applies to the current race straight away and becomes the default for later races. Each change is receipted and kept in a private 20-entry history. None of these changes race rules, timing or points.

| Setting                   | Options                                    | Default        | When to change                                                                                                                                      |
| ------------------------- | ------------------------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Own-kart prediction       | Off · On · Conservative                    | On             | Phones draw their own kart from their controls before the room confirms. If karts visibly snap back on the venue Wi-Fi, try Conservative, then Off. |
| Other karts glide         | Off · On                                   | On             | Carries other karts forward between room updates. Off shows exact room positions only.                                                              |
| Sideways steering default | Steering strip · Slider · Fixed-centre pad | Steering strip | What a phone held sideways starts with. Guests can still switch.                                                                                    |
| Phone frame rate          | 30 · 60 · Auto                             | Auto           | Auto draws at 60 unless a phone is on Low graphics. 30 saves battery.                                                                               |
| Race start countdown      | 3-2-1-GO · None                            | 3-2-1-GO       | Shown over the last three seconds of the prompt; the room's timing is unchanged.                                                                    |

A countdown that _holds_ the grid inside the race (changing race timing) was not built: it would need a new question version and is planned for Phase 6.

## 3. Choices made for you (and how to undo them)

| Choice                     | What now happens                                                                                                                                                                                                                            | To change                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Starts confirm             | Start birthday game, Start kart race and the demo start all ask first and say how many players are in.                                                                                                                                      | `apps/web/src/admin/live-console.tsx` `askStart`.                 |
| Bots and the birthday game | Developer bots are refused once a room runs the birthday script, unless it is a dedicated rehearsal room.                                                                                                                                   | `apps/api/src/developer/bots.ts` `liveBirthdayGame`.              |
| Poll results               | Polls and rounds worth nothing say "Just for fun" instead of "No points this time".                                                                                                                                                         | `awardsPoints` in `apps/api/src/questions/multiple-choice.ts`.    |
| Projector full screen      | If full screen drops, the show stays up with a hint; Escape still opens setup. A reload keeps presenting.                                                                                                                                   | `apps/web/src/stage/stage-page.tsx`.                              |
| Session lengths            | Live desk credential 12 h, projector 14 h (was 15 min and 8 h). Host commands still need your admin session.                                                                                                                                | `apps/api/src/credentials/verify.ts`.                             |
| Admin session cache        | Your session is re-checked against the database at most every two minutes. A revoked session can act for up to two minutes.                                                                                                                 | `adminSessionCacheSeconds` in `apps/api/src/auth/create-auth.ts`. |
| Running order help         | Show length estimate and _Suggest a mixed order_ (nothing saves until you press Save).                                                                                                                                                      | Admin → Question packs → Running order.                           |
| Nickname screening         | Joining with a slur or explicit term is refused ("Choose a different nickname"); everyday swearing is allowed. Look-alike spellings are caught; words that merely contain a term (Scunthorpe, therapist) pass. You can still rename anyone. | `packages/shared/src/moderation.ts` (ROT13-encoded list).         |
| Production email           | Production sends to the requested guest address and ignores any leftover staging test-recipient binding. Staging stays restricted; this takes effect when the updated code is deployed.                                                     | `apps/api/src/auth/create-email.ts`.                              |

## 4. Draft questions waiting for facts

Each is a file in `apps/api/src/questions/packs/birthday/`. Fill its `requirements`, run `npm run content:check`, then add it in Running order.

| Round                   | File                         | Needs                                                                      |
| ----------------------- | ---------------------------- | -------------------------------------------------------------------------- |
| Reddit tribunal         | `tribunal-reddit.ts`         | Original thread, exact title, outcome, top comment, correct choice         |
| Ferrier estate          | `council-ferrier-sector.ts`  | Verified estate name and confirmed category                                |
| Nextdoor paranoia       | `nextdoor-paranoia.ts`       | Genuine post or screenshot and confirmed explanation                       |
| Property price roulette | `property-price-roulette.ts` | Dated listing, authorised photo, monthly rent, agent wording, slider scale |

Two rounds are ready but not in the order: **Figurine** (`group-chat-figurine`) and **Cursed Search History** (`cursed-search-history`). Add them in Running order if wanted.

## 5. Known gaps (not fixed yet)

- Physical phones, the projector and the venue Wi-Fi have never been tested. The [rehearsal steps](event-runbook.md#physical-device-and-venue-sign-off) are the way to find out.
- The projector pairing code (so the projector laptop need not sign in to admin) is not built.
- 27 lint warnings (`react-refresh/only-export-components`) remain; they affect development hot reload only.
- Typed-answer moderation, round-media pre-moderation and the vote "exclude in all mode" option from the plan are not built yet.

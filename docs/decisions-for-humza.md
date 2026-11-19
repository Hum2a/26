# Decisions for Humza

> **Superseded for the night:** print [Night of](night-of.md). This page is the
> older options list, corrected 19 November 2026 so it no longer contradicts
> the code.

[Home](../README.md) · [Documentation](README.md) · [Night of](night-of.md) · [Event runbook](event-runbook.md)

Written 5 November 2026 for the 21 November party, with stale rows corrected on
19 November. Where a choice was yours to make, it is a **switch with a safe
default** rather than a guess baked into code. Do not invent question content.

## 1. Things only you can do

| When             | What                                                                                                                                                                   | Why                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Before the party | Confirm **Workers Paid**, Neon autosuspend off, both laptops on production `/admin`, hotspot ready. See [Night of](night-of.md).                                       | One 80-driver kart race writes about 150,000 Durable Object rows; Free allows 100,000 a day.                                 |
| During the party | Do not deploy while a game is running. The date freeze was removed on 18 Nov at your request; `--override-freeze` is now ignored.                                      | A deploy restarts every room and drops every phone. Staging and production were last redeployed on 19 Nov 2026 at 18:36 GMT. |
| Party day        | Neon console: switch off autosuspend on the production branch for the night.                                                                                           | Host commands mostly use a two-minute session cookie cache now, but sign-in and archiving still need the database.           |
| Any time         | Supply or drop the two remaining draft questions (table below).                                                                                                        | Facts cannot be invented. `tribunal-reddit` and `council-ferrier-sector` were retired on 16 November.                        |
| Any time         | GitHub Check still runs on every push. Latest `master` is red at the Playwright step; that is known. Optional: `npm run github-actions:check` locally before a deploy. | CI is no longer stuck at `43cbce4`. Do not add or run Playwright for the party.                                              |
| Optional         | Confirm the R2 access key is scoped to the one media bucket and the production bucket CORS allows the site origin.                                                     | Dashboard settings, not code.                                                                                                |

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

| Round         | File              | Needs                                               |
| ------------- | ----------------- | --------------------------------------------------- |
| Where are we? | `where-are-we.ts` | Credited clue photo, place name and coordinates     |
| Ed or Humza?  | `ed-or-humza.ts`  | Speaker (`ed` or `humza`) for each of the 18 quotes |

Ready but not in the default 42-round order: **Property price roulette** (`property-price-roulette`, £750 pcm Winkworth listing), **Nextdoor paranoia** (`nextdoor-paranoia`, Marshall News Messenger 5 Feb 2024), **esports-tag**, the extra guess rounds, and **kart-park-grand-prix**. Figurine and Cursed Search History **are** in the default order. Add catalogue-only rounds in Running order if wanted.

## 5. Known gaps (not fixed yet)

- Physical phones, the projector and the venue Wi-Fi have never been fully signed off. The [rehearsal steps](event-runbook.md#physical-device-and-venue-sign-off) are the way to find out.
- The projector pairing code (so the projector laptop need not sign in to admin) is still not built. `/api/rooms/lookup` still requires a presentation cookie minted from admin. Workaround: sign the projector laptop in to production `/admin` and open `/host` from that room.
- About 30 lint warnings (`react-refresh/only-export-components`) remain; they affect development hot reload only.
- Typed-answer Hide/Restore is built. Round-media pre-moderation and the vote "exclude in all mode" option from the plan are not.

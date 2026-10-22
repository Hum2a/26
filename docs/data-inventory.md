# Data inventory

[Home](../README.md) · [Documentation](README.md) · [Event runbook](event-runbook.md)

What 26 stores, where it is stored, and how long it is kept. This describes the code as of 21 October 2026, taken from `apps/api/src/room/schema.ts`, `apps/api/src/archive/schema.ts` and `apps/api/src/auth/migrations/`. Update this file whenever a table or a collected field changes.

There are three stores: +

- **Room database.** One SQLite database per room, inside the room's Durable Object. It holds everything during the live game.
- **Neon Postgres.** It holds the published results archive, email delivery, and admin sign-in. It is outside the live guest path.
- **Cloudflare R2.** It holds photo and voice files. The room database only keeps references to them.

<details>
<summary>On this page</summary>

- [Room database (per room)](#room-database-per-room)
- [Neon Postgres](#neon-postgres)
- [Cloudflare R2](#cloudflare-r2)
- [Not stored anywhere](#not-stored-anywhere)

</details>

## Room database (per room)

### Room and players

| Table          | Holds                                                                                                                                                      | Notes                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `room`         | Game id, join code, phase, question set and scoring versions, timers, pause and stage state, `fun_fact_index`, `created_at`, `telemetry_retention_days`    | One row. `fun_fact_index` is which end-of-night fact the host is showing. |
| `player`       | Random `player_id`, nickname, join time, `client_class` (guest, host, test or synthetic), kart driver style and face photo id, current `device_context_id` | No email, real name or account. `revoked_at` marks removed players.       |
| `credential`   | Hashed secrets for guest, stage and control access, with expiry                                                                                            | Only the hash is stored.                                                  |
| `transfer`     | Hashed one-time codes for moving a player to another phone                                                                                                 | Expires.                                                                  |
| `receipt`      | Idempotency records: request id, payload digest and result                                                                                                 | Makes retries safe.                                                       |
| `audit`        | Host and system actions: kind, who did it, when, and detail                                                                                                |                                                                           |
| `counter`      | Rate-limit and sequence counters                                                                                                                           |                                                                           |
| `schedule_job` | The room's timers and background jobs                                                                                                                      |                                                                           |

### Answers and scoring

| Table                                                                                                          | Holds                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `choice_answer`                                                                                                | Multiple-choice option per player and question, with receive time and deadline                                                   |
| `round_response`                                                                                               | Answers to other round types, as JSON, with times                                                                                |
| `text_response`                                                                                                | Free-text answers, with times                                                                                                    |
| `vote_candidate`, `vote_elector`, `vote_order`, `vote_ballot`, `vote_shortlist`, `vote_feature`, `vote_freeze` | Voting rounds: the candidates, who can vote, the ballot order each voter saw, ballots, the host's shortlist and featured answers |
| `duel_pair`, `duel_role`, `duel_answer`, `duel_prediction`, `duel_freeze`                                      | Duel rounds: the pairings, roles, numeric answers and predictions                                                                |
| `fixture_answer`                                                                                               | Rehearsal answers                                                                                                                |
| `name_reaction`                                                                                                | Guests' reactions to each other's nicknames                                                                                      |
| `score_ledger`                                                                                                 | Points per player per question, with the scoring detail                                                                          |
| `score_adjustment`                                                                                             | Manual host adjustments, with a required reason                                                                                  |
| `round_state`, `round_resource`                                                                                | Working state for the current round                                                                                              |

Every answer table, plus `name_reaction` and `troll_effect`, also stores the `device_context_id` that was current when the row was accepted. It is null if the phone had not reported yet.

### Trolls

| Table          | Holds                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| `troll_token`  | Whether each player has used their one troll                                                               |
| `troll_effect` | Each troll: who sent it, who it targeted, the kind, when it started and ended, and whether it was refunded |
| `troll_switch` | Trolls the host has switched off for this room                                                             |
| `stage_cue`    | Announcements shown on the projector                                                                       |

### Media

| Table           | Holds                                                                                                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `media_upload`  | One row per photo or voice upload: owner, purpose (`round`, `face` or `wall`), R2 keys, status, size in bytes, width and height or duration, content type, whether the host hid it                                             |
| `wall_post`     | One row per photo sent to the photo wall: the upload, the sender, caption (up to 60 characters), frame, whether to keep it in the results gallery, status (pending, queued, showing, shown, declined or removed) and its times |
| `wall_reaction` | Reaction totals per wall photo and emoji, shown on the stage.                                                                                                                                                                  |
| `wall_reactor`  | How many reactions each guest has sent to each wall photo, and when the last one was, but not which emoji. Used only to enforce the per-guest cap of 20; it is never shown.                                                    |
| `wall_setting`  | The host's photo wall settings, including which players are muted                                                                                                                                                              |

The files themselves are in R2 (see below).

### Device and connection telemetry

| Table                 | Holds                                                                                                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `device_context`      | Normalised device reports, at most 8 per player. A new row is written only when the device changes meaningfully.                                                                                                                                                          |
| `connection_summary`  | Per player: socket opens, reconnects (capped at 40), up to 16 round-trip samples with median and upper estimate, submission retries, upload attempts, failures and duration, script error count, and the last error message (email addresses and long tokens are removed) |
| `telemetry_aggregate` | Device-family counts, written just before the detailed telemetry is purged                                                                                                                                                                                                |

**The device report** (`NormalisedDeviceReport`, collector version 1, in `packages/shared/src/device-context.ts`) keeps only these normalised fields:

- **Device:** family (iPhone, iPad, Android, desktop, other or unknown), how confident the classification is, and the operating system with its major version.
- **Browser:** the browser family and major version. The raw user agent string is not kept.
- **Screen:** width, height and short edge in CSS pixels, a narrower or wider screen group, window size, pixel ratio and orientation.
- **Input:** touch points, and whether the pointer is coarse or fine and whether it can hover.
- **Hardware:** logical processor count and a coarse memory estimate.
- **Locale:** up to four language tags and the time zone.
- **Preferences:** light or dark mode, reduced motion, and whether camera, microphone and WebSocket are supported.
- **Network:** a quality bucket (slow-2g to 4g), downlink speed, round-trip time and data saver.

The report does **not** contain IP addresses, the raw user agent, device model, location, contacts, or anything that needs a permission prompt. The join screen tells guests that device details are used for statistics after the game.

**Retention.** At `room.created_at` plus `telemetry_retention_days` (30 days by default), the `telemetry-retention` job:

1. writes family counts to `telemetry_aggregate`;
2. deletes every `device_context` row;
3. clears the round-trip samples, keeping only the median and upper estimate.

Answers, scores, players and media are kept. See [apps/api/src/device/README.md](../apps/api/src/device/README.md).

## Neon Postgres

### Results archive

The archive is frozen when the game ends. A later correction adds a new revision; it never edits an old one.

| Table                     | Holds                                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `archive_publication`     | Game id, revision, final or correction, question set version, completion time                                           |
| `archive_standing`        | Final standings: player id, nickname, position, points                                                                  |
| `archive_highlight`       | Published stat cards                                                                                                    |
| `archive_stat_fact`       | The facts behind those cards                                                                                            |
| `archive_fun_fact`        | The end-of-night sentences, frozen when the podium archive is written. A later read does not recompute them.            |
| `archive_fun_fact_member` | Which player ids a frozen sentence included. Read only into that guest's personal results. Absent from the public page. |
| `archive_media_ref`       | References to kept photos and voice clips, with nickname and whether each is hidden                                     |
| `archive_player_detail`   | Each player's personal results detail                                                                                   |
| `archive_device_detail`   | Device reports, each with a `retain_until` date. The index on that date supports expiring rows.                         |

### Results email

| Table                  | Holds                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `archive_email_grant`  | Email addresses guests gave for their results, the purpose (verify or results), a hashed token, and expiry and use times |
| `archive_delivery_job` | Each delivery: recipient, status, attempts, subject and body text                                                        |

A guest's email address exists only if that guest asks for their results by email.

### Admin sign-in

These tables cover the host only. Guests never sign in.

| Table                                        | Holds                                                                                                                                    |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `user`, `session`, `account`, `verification` | Better Auth sign-in for the admin. The `session` table records the admin's IP address and user agent, which Better Auth does by default. |
| `room_credential`                            | Hashed room credentials for the admin's rooms                                                                                            |
| `dev_inbox`                                  | Development only: emails caught locally instead of being sent                                                                            |

## Cloudflare R2

| Store          | Holds                                                                                                                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MEDIA_BUCKET` | Photos and voice clips that guests deliberately upload during rounds, plus kart driver face photos. Each file is first held under a temporary key, then given a final key. The host can hide any upload. |

## Not stored anywhere

- Guest IP addresses. (The room never reads them. The admin's sign-in session is the only place one is recorded.)
- The raw user agent string, device model, location, contacts or browsing history.
- Keystrokes as telemetry. While a "typing" troll is running, the stage can see that player's draft live, but draft keystrokes are not recorded as telemetry.
- Any data from a permission that the game does not already use for photo or voice rounds.

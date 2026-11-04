# Data inventory

[Home](../README.md) · [Documentation](README.md) · [Event runbook](event-runbook.md)

What 26 stores, where it is stored, and how long it is kept. This describes the code as of 24 October 2026, taken from `apps/api/src/room/schema.ts`, `apps/api/src/archive/schema.ts` and `apps/api/src/auth/migrations/`. Update this file whenever a table or a collected field changes.

There are three stores: +

Joining control (30 October 2026): the existing room `round_state` table stores
`__room` / `admission`: an open/closed flag and the latest 20 host changes
(`open`, server timestamp `at`). Existing rooms default to open. It is returned
only in control snapshots, never guest/stage snapshots, and follows room storage
retention. Joining commands use the existing durable receipts. Removal consumes
unused transfer codes; issuing another code consumes previous unused codes for
that player. Existing transfer records and receipts retain their normal lifetime.

- **Room database.** One SQLite database per room, inside the room's Durable Object. It holds everything during the live game.
- **Neon Postgres.** It holds the published results archive, email delivery, and admin sign-in. It is outside the live guest path.
- **Cloudflare R2.** It holds photo and voice files. The room database only keeps references to them.

<details>
<summary>On this page</summary>

- [Room database (per room)](#room-database-per-room)
- [Neon Postgres](#neon-postgres)
- [Cloudflare R2](#cloudflare-r2)
- [Not stored anywhere](#not-stored-anywhere)

- [Kart driving and course state (22 October 2026)](#kart-driving-and-course-state-22-october-2026)

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

### Developer rehearsal

`developer_bot` associates a synthetic player id with a monotonically increasing
bot number. `developer_tools` holds the population revision and latest 20 count
changes with server timestamps. These records stay in the room SQLite database;
only control snapshots expose the bot list and count history. Removed bots are
revoked rather than deleting their accepted actions, scores or history. The
existing room retention policy applies.

Bot credentials use the existing `credential` table: only hashes and expiry are
stored. An authenticated same-origin bootstrap returns ephemeral secrets to the
developer tab; they are sent in WebSocket protocol headers and never included
in public snapshots, URLs, downloads or browser storage. Browser memory holds
bot settings and bounded acknowledgement measurements (latest 1,000 timings)
for the current run. Bot sockets do not copy the host's device report or consume
its connection telemetry. Synthetic players remain excluded from guest
statistics, fun facts and the final guest archive. Downloadable reports contain
only room/question ids, counts, configuration and aggregate measurements.

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

## Kart driving and course state (22 October 2026)

The existing `round_state` kart race JSON now also holds optional vertical height/velocity, active simulation time, course-trigger cooldown and turbo tier on each physics body. Public kart frames project height, drift charge in milliseconds and drift/boost tiers; raw velocity, controls and cooldown state remain server-side. No new personal data or database table is introduced.

Course features are off by default for connected races. The race stores the enabled flag and the latest 20 host changes (`atMs`, `enabled`). Only the control snapshot receives `kartCourseHistory`; stage and guest snapshots omit it. Host on/off commands use the existing control receipts. Turning features off lands airborne karts and clears outstanding course boost. Existing race retention applies.

Standalone practice retains its course switches, practice starting point and flight state only in the existing in-memory solo store. Reset clears active physics and item effects; no room, archive or identity is created.

## Birthday order and frozen scripts

The existing room-code registry stores one `pack_order` row for birthday: ordered question ids, revision, save timestamp and the latest 20 revision/count/timestamp summaries. Its existing receipt table stores idempotent order-save results under `pack-order`. Access requires the administrator session and same-origin request validation. No answers are included in the ordering projection.

Each started birthday room stores its frozen private question script in existing `round_state` under `__pack` / `birthday-script`, with its revision and content-hashed version. It contains server-only answer/scoring definitions and is never serialised into control, guest or stage snapshots. It follows room storage retention. Public snapshots continue to use deliberate question projections. Kart state additionally records track, deadline and score-seeded grid positions; guest phone projections expose only that phone’s pose plus bounded standings.

## Graphics preferences and reversible photo treatment (24 October 2026)

- The browser keeps `26-kart-graphics` (`auto`, `high` or `low`) in session storage
  for that tab. Visible frame cadence is measured locally; no benchmark, GPU
  identifier or frame samples are uploaded or stored in the room. The admin's
  solo graphics rehearsal room-size value is temporary component state.
- `media_upload.photo_family` freezes `iphone`, `android` or `unknown` from the
  uploader's existing, explicitly reported device context when a photo slot is
  reserved. Voice uploads and pre-existing photos use `unknown`. This coarse
  presentation hint remains with the upload after detailed telemetry expires;
  it never grants identity, access or scoring authority. Admin media rows expose
  the hint; public snapshots do not.
- The room stores `photo_bias_enabled` (default on), `photo_bias_revision` and a
  bounded history of the latest 20 switches (time and enabled state). Host
  snapshots include the setting, history and accepted-photo counts by family.
  Guest/stage snapshots receive only a public `mediaDisplayRevision` counter to
  refresh displayed images when the setting changes.
- R2 retains the clean accepted JPEG, normalised within the existing 1280px and
  1MiB limits and stripped of source metadata. New client/server JPEG encoding
  starts at quality 95, lowering server quality only to meet the byte limit.
  This is the accepted clean copy, not a raw camera original. Existing discarded
  resolution cannot be recovered. iPhone display derivatives use a 256px edge
  and JPEG quality 20; Android and unknown-family photos use the clean copy.
- Rough derivatives are disposable entries in the Worker's private named Cache
  API namespace, with a 300-second lifetime and no extra R2 object. Every request
  still checks current room permissions and hidden/published status before
  cache access. Normal media responses retain private/no-store headers; gallery
  responses retain their existing freshness policy. Admin previews stay clean.
- The authenticated admin photo rehearsal processes a stand-in asset without
  saving media or room state. Its browser object URLs are revoked on replacement
  or unmount. No new service, bucket or retention job is
  introduced.

## Isolated developer rehearsals (27 October 2026)

- SQLite `developer_rehearsal` holds the validated pack/count/traffic/timing
  settings, runner state, replay revision, entry times and last failure scenario.
  `developer_event` holds at most 200 outcome events: time, kind, display nickname,
  short fixed outcome detail, status, phase and question id. No answer bodies,
  answer keys, raw diagnostics or credentials are recorded in that timeline.
- `developer_connection` records the latest connected flag and change time per
  test player. `developer_outage` records a five-second simulated reconnect block
  for selected bot ids or the controller. `developer_phone` marks real generated
  rehearsal phone identities. These rows follow the room's storage lifecycle;
  only the authenticated control snapshot receives settings, history and checks.
- Public snapshots receive only `rehearsalRevision`, an integer used to recognise
  fresh attempts. Resetting a question clears its accepted rehearsal submissions,
  votes, score entries and runtime state; diagnostic events and other questions
  remain. Ordinary rooms refuse reset/runner/scenario commands.
- Rehearsal phones are game-scoped test identities. Their random credentials
  stay in memory and travel in the existing scoped WebSocket protocol header;
  hashes use existing credential storage. The existing private join receipt
  retains the join response, including its credential, for idempotent recovery
  of the same test phone; this follows the ordinary guest join path. The browser
  does not persist that credential. The URL contains only a non-secret
  idempotent take id. These phones do not replace the browser's ordinary guest
  cookie. Dedicated rehearsal rooms do not queue final archives or email exports.
- Browser local storage `26-rehearsal-profiles-v1` keeps at most ten named validated
  setups, each name up to 40 characters. Names and settings contain no credentials
  or question answers. Delete controls remove them. Downloaded reports contain
  population, settings, aggregate reply metrics, private rehearsal events and
  check outcomes; reports are explicitly requested by the administrator.
- Local Vite development creates an in-memory random signing key for the existing
  Node administrator check. A ten-second proof binds the method, path and session
  cookie, avoiding a Worker HTTP loopback. Caller-supplied proof headers are
  stripped. The key is never a deployed configuration value or browser payload;
  staging and production always use their real administrator checks.
- Explicit local browser checks (`LOCAL_DATABASE_ID=browser-checks`, local serve
  without a deployment target) use temporary Worker storage as well as temporary
  auth. Normal development keeps persistent storage; remote data is unaffected.

## Kart-only lobby mode

- Creation accepts `kind: "kart"` on the existing authenticated room endpoint.
  The existing registry creation receipt stores the chosen kind, including while
  bootstrap is pending. Reusing the request for a different kind is refused.
  Old receipts without a kind retain ordinary-party behaviour.
- The existing room `round_state` stores `__room/kart-lobby` with the creation
  timestamp and `__pack/birthday-script` with the frozen, private kart question.
  Only that room's version is selected; the saved birthday running order is not
  written. No new table, external service or player identity is introduced.
- The validated optional `kartLobby` creation timestamp is control-only. Guests
  and stage get the existing public kart projection, never the script or host
  metadata. Start, pause, advance, course switches and results reuse existing
  receipts, scheduler, score ledger and room retention. These are real rooms:
  the normal final archive path runs at podium, unlike dedicated developer
  rehearsals.

## Ending and destroying a room (2 November 2026)

- **End game now** moves a running room straight to the podium. The current question is abandoned unscored; nothing new is stored beyond the existing control receipt and phase history.
- **Destroy room** needs the room's control credential and the typed join code. The room's Durable Object closes every socket with a "room closed" message, disarms its alarm and deletes all of its SQLite storage (players, answers, scores, credentials, receipts, media records, telemetry). The code registry then deletes the join-code row and keeps one receipt (`principal = 'destroy'`: request id, game id, join code) so a retried request replays. Temporary and accepted R2 objects listed in the room's `media_upload` table are deleted in the background after the response. An archive already exported to Neon is not touched.
- **Guest standings.** Guest snapshots now carry the leading ten standings (place, nickname, points) while scores are shown, for the phone's Ranks tab. Nothing new is stored. A guest under an active hidden-score troll receives no standings at all.

## Review follow-ups (3 November 2026)

- Push-your-luck rounds freeze one private `push-raid` record per question in
  existing `round_state`: the drawn line count, or null for no Raid. It is
  inserted before collection opens and follows room retention. Guests and the
  stage receive lines/banks and their public progress, never the frozen draw
  before reveal. Bail receipts reuse `choice_answer` with the server receipt
  time and deadline; score details reuse `score_ledger` (banked, held, raided).
- The figurine self-vote bonus reuses the existing ballot and score ledger with
  detail `self-vote`. It adds no identity, telemetry or storage table.
- Automatic deployment recovery stores only its last reload timestamp in this
  tab’s session storage. If storage is refused, recovery stays manual.
- Browser rehearsal uses ephemeral local authentication, rooms and media. It
  has no deployment routes or remote credentials and is separate from the
  ordinary development database. Generated browser evidence belongs under
  `artifacts/browser-checks`.

### Kart presentation foundations (4 November 2026)

Versioned kart asset metadata records project file paths, sizes, SHA-256 fingerprints, source/notice links and embedded texture fingerprints. It contains no player or device data; authenticated Admin Kart reads it through /api/admin/kart-assets. File availability/integrity checks, completion times and the last five check summaries exist only in the current admin page and disappear on navigation. They are not uploaded as guest readiness or persisted.

Public kart snapshots may include a version1 presentation batch of at most32 accepted finish outcomes: cosmetic eventId, playerId, active atMs and FINISHED/DNF status. IDs derive from existing frozen roster numbers and accepted finish times; no new product persistence. Private input counters, control queues, credentials, face media and inventories are absent. A renderer-local race cursor suppresses replayed outcomes on reconnect and rejects unknown presentation versions; it is not gameplay authority.

### Kart visible racers and practice presentation (Phase2, in progress)

The existing durable race optionally stores opponentsEnabled, max8 frozen roster numbers per driver (nearbyNumbers), and a max20-entry opponent-setting history (injected timestamp and boolean). Host commands are receipted through existing room actions. History is control-only; stage and guests never receive it. Self public pose remains separate from at most8 nearby public poses; accepted-motion turnRate is optional and bounded. No raw input, credential, held inventory or score secret is added to these poses.

The authenticated kart-preview endpoint creates labelled public stand-in poses without a room, socket or persistence. Browser practice uses a validated style plus optional PNG/JPEG/WebP Blob up to2MB passed to its same-origin isolated frame. The parent alone fetches authorised guest media; URLs/credentials/media IDs are never sent to the engine. Object URLs, local sample bytes and chosen practice style are memory-only, cleared on replacement/unmount. No upload, new identity, record, database table or shared store is introduced.

Stage presentation additionally stores optional stageMode, a monotonically increasing safe-integer revision and at most 20 injected-time mode changes in the same durable race. History is control-only and follows existing room retention. Public spectator metadata contains only mode, revision and the selected public player ID. Director selection derives from accepted race time and existing public progress; no new scheduler, telemetry stream or gameplay authority is introduced. A device-local map override lasts only in the mounted stage component. Solo driver appearance stays in the existing ephemeral practice store.

### Kart effects and isolated rehearsal (Phase 3)

Validated version 1 presentation presets, imported/exported JSON, scripts and actual renderer counts live only in the mounted Admin Kart Effects page and the opt-in solo frame. No browser persistence or upload. Authenticated preview reads project labelled public stand-ins. Script transforms and cosmetic clocks remain isolated from rooms, scores and physics. Local renderer counts contain draw calls, triangles, geometries and textures; they never enter snapshots or telemetry.

Scene-owned buffers retain at most 80 public actor histories, 1,024 decorative particles and 256 tyre segments, with lower active quality caps. Fixed renderer allocations are unchanged by lower caps. Public accepted contact is an optional boolean, never raw input or hit authority. Existing finite finish-event cursors and observed start edges suppress historical replays. Original neutral alpha masks are generated in memory; no new Wawa source or media is downloaded. Offline audited road/dirt triangles retain cosmetic height alongside their unchanged X/Z, and use the existing index.

The existing durable race additionally holds optional effectsEnabled and at most 20 effectsHistory entries of injected atMs and enabled. History is control-only, follows existing room retention, and is absent from guest/stage snapshots. Public effectsEnabled is optional: absent preserves legacy presentation, true selects the new validated default preset, false suppresses decoration. Host commands use existing authentication, receipts and persistence. Off remains available through the finished round; enabling is limited to an open active race. No new identity, table, score engine, scheduler or socket.

The same-origin practice message accepts an optional validated/cloned preset or null. Metadata-only messages omit face to preserve its object URL/texture; explicit null clears it. The parent caches one bounded authorised/local photo Blob per media key and frame revision, fetches it once and resends bytes only to a new frame or changed photo. Unknown/private fields reject the whole message. Native176 resources stay inside the solo renderer; the existing in-memory store and receiver clear state/URLs on replacement/unmount. Nothing sends credentials, media URLs or room state to practice.


### Early local kart Look bench (Phase4 incomplete)

The mounted authenticated Look bench holds a strict version1 presentation preset, before/after selection, optional exported/imported JSON and local pass/target counts. No browser persistence, upload or room changes. Grading parameters include bounded nine-channel mixer, globals, eight HSL bands, theme-role split tones and named renderer tone mapping. Environment parameters are bounded sun/sky/light/reflection/shadow settings. Old grading-only exports normalise to a disabled environment. All palette colours remain theme roles.

Connected scenes own at most one colour target (quality/capability edge cap1024/1536/2048), optional native procedural PMREM reflection and a single1024 shadow target with56m frustum. High/Balanced/Low colour MSAA is capped4/2/0 and by renderer capability. Neutral releases the colour target and restores source lights/environment/material flags; Low omits reflection/shadow allocations. No external sky/environment asset, dependency, telemetry or new identity. Procedural GPU resources are not retained as files.

The same existing practice presentation message additionally accepts an optional validated/cloned look preset or null, preserving the metadata-only face semantics. Parent photo caching remains unchanged; only presentation values and optional bounded Blob enter the frame. Native176 keeps the preset in the existing ephemeral practice store and releases scene-owned resources on unmount. Native176 browser verification passed for the opt-in rehearsal, including reflection, face preservation, before/after and legacy restoration. A one-shot soloLookReady flag keeps practice loading until its first successful look frame. Ordinary practice/live rooms remain legacy. No public snapshot or durable-room look field has been introduced yet.

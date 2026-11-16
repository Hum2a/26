# Photo wall: implementation plan

[Home](../README.md) · [Documentation](README.md) · [Event runbook](event-runbook.md)

Status: phases 1 to 9 built (21 and 22 October 2026); see docs/build-progress.md for what was verified. The Playwright spec has not been run. Defaults chosen: approve first, breaks only, gallery opt-in ticked.

Guests send a photo from their phone at any point in the night, and it appears on the projector. It works like the photo feature on a karaoke machine: pick a photo, add a caption and a frame, press send, then watch it drop onto the big screen while the room reacts.

<details>
<summary>On this page</summary>

- [What it feels like](#what-it-feels-like)
- [Ground rules](#ground-rules)
- [Decisions for Humza](#decisions-for-humza)
- [Data](#data)
- [The queue engine](#the-queue-engine)
- [Server commands](#server-commands)
- [Phone](#phone)
- [Projector](#projector)
- [Host](#host)
- [Results and archive](#results-and-archive)
- [Failure cases](#failure-cases)
- [Build order and tests](#build-order-and-tests)
- [To check against current documentation before building](#to-check-against-current-documentation-before-building)

</details>

## What it feels like

**On the phone.** A "Send to screen" button is always available in the guest app. Tap it and choose:

- **Take a photo** (opens the camera),
- **Choose from camera roll**, or
- **Selfie** (opens the front camera).

The phone shows a live preview inside the chosen frame, with the caption on it, exactly as it will look on the projector. Press **Send it** and a short "flying up" animation plays. The phone then shows the photo's status as it changes:

1. **Uploading** (with a progress bar)
2. **Waiting for the host** (if approval is on)
3. **In the queue**, with how many photos are ahead
4. **On screen now!** (with a vibration)
5. **Shown**, with the reactions it got

If the host declines a photo, the guest gets a gentle message.

**On the projector.** A photo arrives with a polaroid "develop" effect: it drops in, shakes, and fades from white into the picture. The guest's nickname and caption appear underneath, inside the frame they picked. Other guests can send reactions while it's up (🔥 😂 😍 👏 💀), which float up from the bottom of the screen. Then the next photo takes its place.

When the projector is busy with a question, new photos wait instead of covering it, and a small counter shows how many are waiting.

**At the end.** The podium is followed by a **Photo wall reel**: a mosaic of every photo shown that night, ending on a **Most loved photo** award for the one with the most reactions. Photos the guests chose to keep also appear in the results gallery.

## Ground rules

These follow the project rules.

- **The server decides what is shown.** The room decides what is on screen, for how long, and what comes next, using the one existing scheduler. Phones and the stage only display the room's state.
- **Reuse, don't duplicate.** Uploads go through the existing media pipeline (`apps/api/src/media`): slots, presigned PUT, ETag-checked finalise, re-encode, `tmp/` lifecycle cleanup and host hide. Do not build a second upload path, socket client or scheduler.
- **The projector is never ambushed.** A photo that has not been approved is never sent to the stage, and the stage cannot fetch one. The host can remove anything from the screen instantly.
- **Nothing covers a question.** Photos never hide a question, an option, a score or an answer.
- **Every phase has named tests.** A phase is done when `npm run test:unit` and `npm run typecheck` pass.

## Decisions for Humza

My recommendation is listed first for each.

1. **Moderation.** _Approve first_ by default: the host sees each photo before it goes up. The alternative is _Straight to screen_, where photos go up immediately and the host has a "pull it" button. The host can switch modes during the night, for example _Approve first_ while people arrive and _Straight to screen_ once it's going well.
2. **When photos show.** _In breaks_: the lobby, intro, scores, between rounds and the podium. Photos sent during a question wait for the next break. The alternative is _Corner during questions_, which also shows them as a small picture-in-picture during question phases, never over the question area.
3. **Results gallery.** Photos _opted in, on by default_: a "Keep in the results gallery" tick box, ticked, when sending. Guests can untick it later. The alternative is that the wall stays live-only and is never archived.

## Data

### Upload record

Add a new upload purpose, `wall`, to `media_upload` (`MediaPurpose` in `apps/api/src/media/records.ts`, currently `"round" | "face"`). A wall photo is:

- **Allowed** from the lobby until the podium ends. The finalise "late" rule for `wall` only cancels uploads after the game has finished.
- **Not tied to a question.** It never goes into question media, stats or trolls.
- **Counted separately.** It has its own player and room quotas, below.

### New room tables

```sql
CREATE TABLE wall_post (
  post_id      TEXT PRIMARY KEY,
  media_id     TEXT NOT NULL UNIQUE,     -- media_upload.media_id, purpose 'wall'
  player_id    TEXT NOT NULL,
  caption      TEXT,                     -- 0 to 60 characters, trimmed, control characters removed
  frame        TEXT NOT NULL,            -- an id from the frame catalogue
  keep         INTEGER NOT NULL,         -- show in the results gallery
  status       TEXT NOT NULL,            -- pending | queued | showing | shown | declined | removed
  queued_at    INTEGER,
  shown_at     INTEGER,
  until_at     INTEGER,                  -- when the current showing ends
  decided_by   TEXT,                     -- 'host' | 'auto'
  created_at   INTEGER NOT NULL,
  request_id   TEXT NOT NULL,            -- idempotent post creation
  UNIQUE (player_id, request_id)
);

CREATE TABLE wall_reaction (
  post_id   TEXT NOT NULL,
  emoji     TEXT NOT NULL,               -- one of 5 allowed reactions
  count     INTEGER NOT NULL,
  PRIMARY KEY (post_id, emoji)
);

CREATE TABLE wall_setting (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  enabled       INTEGER NOT NULL,        -- default 1
  moderation    TEXT NOT NULL,           -- 'approve' | 'direct'
  placement     TEXT NOT NULL,           -- 'breaks' | 'corner'
  show_ms       INTEGER NOT NULL,        -- default 8000, from 4000 to 20000
  captions      INTEGER NOT NULL,        -- 1 shows captions
  muted_json    TEXT NOT NULL            -- player ids the host has blocked from sending
);
```

Add these tables to `apps/api/src/room/schema.ts` with `CREATE TABLE IF NOT EXISTS`, and bump the schema version. Update [docs/data-inventory.md](data-inventory.md) in the same change.

### Limits

Put these in `apps/api/src/room/limits.ts`, each with a message in British English.

| Limit                     | Value                                                              | Why                                  |
| ------------------------- | ------------------------------------------------------------------ | ------------------------------------ |
| Accepted image size       | Existing 1 MB cap, longest edge 1280 px after the phone shrinks it | Fast on party Wi-Fi                  |
| Cooldown between sends    | 45 seconds per player                                              | Stops spam and gives everyone a turn |
| Photos waiting per player | 3 (pending and queued together)                                    | Stops one guest filling the queue    |
| Wall photos per player    | 15 per night                                                       |                                      |
| Wall photos per room      | 250 per night                                                      | About 250 MB of R2 at most           |
| Reactions                 | 1 per guest per second, at most 20 per guest per photo             |                                      |

## The queue engine

Write a pure function in `packages/shared/src/wall.ts`, following the reducer rule: time is passed in and nothing reads `Date.now()`.

```ts
nextWall(state: WallState, now: number): { state: WallState; effects: WallEffect[] }
```

- **Fair order.** Photos take turns by player (round-robin), oldest first within each player. Someone with three queued photos waits for each other guest's next one.
- **Placement.** With `placement: 'breaks'`, nothing starts during the prompt, collect, vote, predict or reveal phases. The photo currently showing finishes; queued photos wait.
- **Timing.** Each photo shows for `show_ms`. When the queue is longer than 6, that drops to 5 seconds so the queue drains during a break.
- **Effects.** `schedule` (the next change, using the existing scheduler's job, `wall-advance`) and `broadcast`.
- **Host overrides.** Skip, pull and "show next now" are events into the same function.

The room's Durable Object only feeds events in and carries out the effects. It holds no queue logic of its own.

## Server commands

| Command                           | Who   | Does                                                                                                                            |
| --------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------- |
| Media slot with `purpose: "wall"` | Guest | Existing upload slot route, with the wall quotas and cooldown                                                                   |
| `wall-post` (socket command)      | Guest | Turns a finalised wall upload into a `wall_post` with caption, frame and keep. Repeating the request id is safe.                |
| `wall-react` (socket command)     | Guest | Adds one reaction to the photo currently showing. Rate-limited, and only the photo on screen accepts reactions.                 |
| `wall-withdraw`                   | Guest | Withdraws their own photo at any stage, and unticks gallery inclusion                                                           |
| `wall-approve`, `wall-decline`    | Host  | Moderation                                                                                                                      |
| `wall-pull`                       | Host  | Takes the showing photo down immediately and marks it removed. It is also hidden everywhere through the existing `hidden` flag. |
| `wall-skip`, `wall-next`          | Host  | Queue control                                                                                                                   |
| `wall-settings`                   | Host  | Enabled, moderation, placement, duration, captions                                                                              |
| `wall-mute`, `wall-unmute`        | Host  | Blocks or unblocks a player. A muted player's waiting photos are declined.                                                      |

Host commands go through the existing `/api/rooms/play` host-action list and `readHostDetails`, in the same way as the troll switches.

### Who can fetch an image

Extend `readMedia` for `wall` media:

| Viewer                          | Can fetch                                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Stage (presentation credential) | Only photos with status `showing`, `shown` or the next `queued` photo (so it can preload), never `pending`, and never hidden |
| Host (control)                  | Everything, including pending, so they can moderate                                                                          |
| Guest                           | Their own photos, plus whatever is showing on stage now                                                                      |
| Results gallery                 | Only `shown` photos with keep on and not hidden                                                                              |

The existing `Cache-Control: private, no-store` stays.

### What each snapshot carries

- **Stage:** `wall: { now: { postId, mediaId, nickname, caption, frame, untilAt } | null, next: mediaId | null, waiting: number, reactions: { emoji, count }[] }`
- **Guest:** `wall: { enabled, cooldownUntil, mine: [{ postId, status, position, reactions }], showing: { postId, nickname } | null }`
- **Host:** the full queue with pending photos, the settings and the muted list.

Add these to the snapshot schema in `packages/shared/src/index.ts` with exact Zod limits.

## Phone

`apps/web/src/wall/`

- **Composer** (`wall-composer.tsx`): a camera or library picker (`<input type="file" accept="image/*">`, with `capture` for the camera buttons), then a framed live preview, a caption field with a character count, frame chips, the gallery tick box, and **Send it**.
- **Preparation:** reuse `compactJpeg` from `media/photo-prepare.ts`. It decodes the photo with `createImageBitmap`, so iPhone HEIC photos and the photo's rotation are handled on the phone, then re-encodes it as a JPEG of at most 1280 px. The re-encoded file carries no photo metadata, so GPS location from the camera is never uploaded.
- **Upload:** reuse `media-transfer.ts` (slot, PUT, finalise), with a progress bar. A failed send keeps the composer open with a **Try again** button that reuses the same request id, so a retry can't create a duplicate. The screen stays awake during the upload (existing wake lock).
- **Status tray:** the guest's photos with live status chips, their place in the queue, the cooldown ring, and **Withdraw**.
- **Reaction bar:** while any photo is on screen, 5 large emoji buttons appear on every phone. Tapping one gives a vibration and a small burst animation.
- **Copy:** "Your photo will appear on the big screen. The host can remove any photo." It sits on the composer itself, not hidden in a dialog.

Frame catalogue (`packages/shared/src/wall-frames.ts`). Frames are drawn on the stage with CSS and SVG; they are never burned into the uploaded image.

| Frame                | Look                                                          |
| -------------------- | ------------------------------------------------------------- |
| `polaroid` (default) | A white border, with the handwritten-style caption underneath |
| `birthday`           | Balloons, confetti and "26"                                   |
| `wanted`             | Old west poster: "WANTED: {nickname}"                         |
| `tabloid`            | Newspaper front page, with the caption as the headline        |
| `magazine`           | Glossy cover, with the nickname as the cover star             |
| `museum`             | Gilded frame with a gallery label                             |
| `vhs`                | Scanlines, a REC dot and a timestamp                          |

## Projector

`apps/web/src/stage/wall/`

- **Spotlight** (in breaks): the photo fills about 70% of the screen in its frame and arrives with the develop effect (Motion springs). Nickname and caption are large enough to read across the room. A thin countdown bar runs along the bottom.
- **Corner** (placement `corner` during questions only): a small framed photo in a safe corner that never overlaps the question layout. It does not take reactions, to keep attention on the question.
- **Preloading:** the stage loads `next` in the background before switching, so a photo never appears half-loaded. A photo whose image fails to load shows a "This photo could not be shown" card in its frame, and the projector reports it to the room (built 8 November: see Failure cases).
- **Reactions:** emojis float up the side using the snapshot's counts, with a combo burst when one emoji passes 10.
- **Waiting badge:** "📸 4 waiting" appears in a corner during questions.
- **Sound:** an optional shutter sound when a photo starts, through the existing stage sound adapter, following the stage's sound setting.
- **Reduced motion:** a simple fade with no shake and no floating emojis; the reaction counts show as numbers instead.
- **End reel:** after the podium, a scrolling mosaic of the photos shown that night, then the **Most loved photo** award card.

## Host

- **Photo wall** page in the room menu (`/admin/rooms/:gameId/wall`):
  - **Waiting for approval:** large thumbnails with nickname, caption and frame, plus **Approve** and **Decline**. Keyboard shortcuts: A approves, D declines, and the arrow keys move between photos.
  - **On screen now:** with **Pull it**, **Skip** and **Show next now**.
  - **The queue:** in order.
  - **Settings:** wall on or off, moderation, placement, how long each photo shows, captions on or off.
  - **Muted players.**
  - **Everything shown so far:** with Hide, using the existing media hide.
- **Live controls:** a small Photo wall panel on the existing live console: the waiting count, quick Approve and Decline for the next photo, and Pull it.
- **Statuses** on the existing Media page gain a "Wall" filter.

## Results and archive

- Photos that were shown, kept and not hidden go into the existing results gallery, using `archive_media_ref`, which already has a `hidden` flag.
- **Most loved photo** becomes a stat fact and card in `apps/api/src/stats`. It uses the reaction count, needs at least 5 reactions, and a tie means no award.
- Hiding or withdrawing a photo later removes it from new gallery reads, as hiding already does.

## Failure cases

| Case                                                      | Handling                                                                                                                                                                                                                                 |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The guest double-taps Send                                | The request id makes it one post                                                                                                                                                                                                         |
| Upload succeeds, then the socket drops before `wall-post` | The phone resends `wall-post` with the same request id after reconnecting. If it never arrives, the upload is cleaned up as an abandoned upload (existing).                                                                              |
| HEIC, a huge photo, or a sideways photo                   | Handled when the phone prepares it. The server still enforces size, format and re-encoding.                                                                                                                                              |
| A file that isn't an image, or a spoofed content type     | Rejected by the existing finalise check of the bytes                                                                                                                                                                                     |
| The projector reconnects mid-photo                        | It reads `now` and `untilAt` from the snapshot and carries on, using the existing time sync                                                                                                                                              |
| A photo fails to load on the projector                    | Built: the card says "Moving on in a moment." and the projector reports the post. The room ends it two seconds after it started. Not built: a 4-second timeout for a photo that never errors, and a "Couldn't display" note for the host |
| The host pulls a photo while it is loading                | The snapshot drops it; the projector never shows it                                                                                                                                                                                      |
| A guest is kicked                                         | Their waiting photos are declined. Photos already shown stay unless the host hides them.                                                                                                                                                 |
| A guest moves to another phone                            | Their photos, cooldown and quota stay with them                                                                                                                                                                                          |
| A rush at the break (20 photos at once)                   | Fair order, shorter showing time, and a per-player waiting limit                                                                                                                                                                         |
| The game ends with photos still waiting                   | Approved photos go into the end reel; pending ones are declined. Uploads after the game are rejected.                                                                                                                                    |
| R2 is unavailable                                         | The upload fails with a retry message. Nothing waits on the phone.                                                                                                                                                                       |
| A spammer                                                 | Cooldown, waiting limit, per-player cap and host mute                                                                                                                                                                                    |

## Build order and tests

| Phase | Work                                                                                                                                | Tests                                                                                                                                               |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `wall` upload purpose, quotas and cooldown; `wall_post`, `wall_setting` and `wall_reaction` tables; `wall-post` and `wall-withdraw` | `apps/api/test/wall-upload.spec.ts`: quotas, cooldown, idempotency, late uploads                                                                    |
| 2     | Pure queue engine and the `wall-advance` scheduler job                                                                              | `packages/shared/src/wall.test.ts`: fair order, placement, shorter times, host overrides. `apps/api/test/wall-queue.spec.ts`: job timing, reconnect |
| 3     | Moderation commands and the image access rules for each viewer                                                                      | `apps/api/test/wall-moderation.spec.ts`: the stage can never fetch a pending photo; mute; pull; kick                                                |
| 4     | Snapshots for each viewer                                                                                                           | Snapshot schema tests: the guest view contains no pending photos from others                                                                        |
| 5     | Phone composer, status tray, reactions                                                                                              | `apps/web/src/wall/*.test.tsx`: preview, retry with the same id, cooldown, withdraw                                                                 |
| 6     | Projector spotlight, corner, preloading, reactions, reduced motion                                                                  | `apps/web/src/stage/wall/*.test.tsx`                                                                                                                |
| 7     | Host Photo wall page and live console panel                                                                                         | `apps/web/src/admin/wall-page.test.tsx`                                                                                                             |
| 8     | End reel, Most loved photo, gallery                                                                                                 | Stats and archive tests                                                                                                                             |
| 9     | End to end and load                                                                                                                 | `apps/web/e2e/photo-wall.spec.ts`: phone sends, host approves, stage shows, reaction counts. Load harness: 30 bots sending at once at a break       |

Each phase also updates [docs/build-progress.md](build-progress.md) and [docs/data-inventory.md](data-inventory.md).

## To check against current documentation before building

- **Camera capture:** whether `capture` on `<input type="file">` behaves the same in current iOS Safari and Android Chrome. It is not guaranteed to open the camera directly.
- **Photo rotation:** whether `createImageBitmap` handles HEIC and EXIF rotation in the phones' browsers. Test on a real iPhone and Android phone.
- **Metadata on deployed uploads:** whether the deployed Cloudflare Images re-encode removes EXIF and GPS data. The media README notes that the binding does not accept `metadata: "none"`. The phone's own re-encode already removes it, but the server should not rely on that, because the server cannot trust what a phone sends.
- **Storage limits:** R2 storage and Images transformation usage at 250 photos, against the account's plan.

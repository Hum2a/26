# Room lobby

One Worker serves the app and the API. Each game is one SQLite Durable Object, `PartyRoom`, named by its game id. Join codes live in a second SQLite object, `RoomCodeRegistry`, addressed only with `getByName("codes")`. That registry is durable storage, so a lookup still works after the object sleeps. It is not a process-global map.

A join code is 6 characters. A game id is 12 characters. Both use the unambiguous alphabet from `gameIdSchema`. The game id is never reused. A join code can be deleted and issued again later; this stage does not release codes. Creating a room inserts the code and the game id in one statement. A unique index makes a collision fail that statement, and the creator tries a new code. Resolution is a `SELECT` by code, then `idFromName(gameId)` on `PARTY_ROOM`.

Both objects create their tables in the constructor inside `blockConcurrencyWhile`. A `schema_meta` row records schema version 13 for a room and version 1 for the code registry. Version 4 adds name reactions, score adjustments, the finish-after-this-question flag, the nickname-vote beat, and the stage-hidden flag. Version 5 adds `round_response` for one accepted slider or ranking payload per player per question. Version 6 adds `text_response`, `vote_candidate`, `vote_elector`, `vote_order`, `vote_ballot`, `vote_shortlist`, `vote_feature`, and `vote_freeze` for room-wide answer-and-vote and guess-the-guest. Version 7 adds `duel_freeze`, `duel_pair`, `duel_role`, `duel_answer`, and `duel_prediction` for simultaneous 1v1 pairings and a spectated finale. Version 8 adds `troll_token`, `troll_effect`, and `stage_cue`. Version 9 adds `media_upload`. Version 10 adds the cue's media id, audio asset, media kind, and question index. Version 11 adds `device_context`, `connection_summary`, and `telemetry_aggregate`, and a nullable context id on accepted answers. Version 12 adds `player.client_class` and `player.joined_at`. Version 13 adds `room_archive` for the final revision and the export job. Versions 1 to 12 upgrade to 13. Any other version is rejected. Device reports are statistics only. The notes are `apps/api/src/device/README.md`.

## Scheduler

`scheduler.ts` is the only module that calls `setAlarm` or `deleteAlarm`. `transactionSync` cannot contain that call: it is synchronous, and the alarm methods return promises. `commitAndArm` writes the SQLite change and the alarm inside one `storage.transaction`, using `setAlarm` on the transaction object. If the alarm write throws, the job insert rolls back with it. A saved deadline therefore has its wakeup in the same commit. After the object sleeps, that alarm still runs with no further guest message.

Jobs store an id, type, due time, remaining duration while paused, scope and phase generations, status, and retry count. The alarm is armed for the earliest pending due time. Gameplay jobs freeze on pause. Background jobs do not. A late alarm closes one phase; the next phase gets its full duration from the transition time. An obsolete or repeated alarm does not advance again. The stored due time rejects a late answer before the handler runs.

The phase graph is lobby, intro, prompt, optional predict, collect, optional vote, reveal, scores, final, and podium. Predict sits between prompt and collect so a finale prediction closes before contestants submit. A round plugin chooses whether vote or predict is included and how long each phase lasts. A question marked as a tie-break is skipped when the lead is unique, on the same advance that would have opened the next question. Host commands pause, resume, or advance. They do not name an arbitrary phase. Leaving collect while the controller is disconnected holds the next phase until that socket returns. The stage being disconnected does not hold it. `endPhase` releases round resources on the normal, manual, and failed paths.

The stage countdown reads `deadlineAt` and `serverNow` from the snapshot and animates locally. It does not create a durable job per tick.

## Directory

`createSqliteRoomCredentialDirectory` is the room's `RoomCredentialDirectory`. Control and presentation checks call `verifyRoomCredential` with the row loaded from that room. Guest recovery uses `verifyGuestSecret` in the same verifier module, because the shared role enum remains `control` and `presentation`.

The guest cookie is `26_guest`. Control and presentation cookies use `Path=/` as well, so the browser sends them on `/api/rooms` and `/ws`. All three are `HttpOnly` and `SameSite=Strict`. Control and presentation stay `Secure`. A local guest cookie omits `Secure` so a phone can join at the dev server's network address. Staging and production guest cookies stay `Secure`. Playwright uses `localhost:4173`. Node tests assert the `Set-Cookie` header and do not need a browser.

## Receipts

A receipt is unique on principal and request id. The same principal, request id, and payload digest returns the stored result. A different digest is rejected. The acknowledgement is that stored result, and it is written before the response. Join, transfer, and socket snapshot commands use this.

## Snapshots and sockets

`GET /ws/:gameId?role=guest|stage|control` checks the same-origin `Origin` before `acceptWebSocket`. The hibernation attachment stores the role, the player or credential id, and that connection's delivery sequence. Handlers read identity from the attachment. A `playerId` in the payload is ignored.

The newest guest socket for a player closes the older ones. One stage socket replaces the older stage socket. The close reason is `This game is open in a newer tab.` A transfer writes a new guest secret, revokes the previous verifier, and closes that player's open sockets in the same accepted action.

Stage snapshots include public nicknames, the join code, the lobby phase, the pinned `unreleased` versions, and the state version. They omit credential hashes, transfer codes, the admin email, and audit payloads. `stateVersion` increments on accepted public changes. A gap in that version asks the client for a snapshot. It is not treated as a missed private acknowledgement.

The browser client is `apps/web/src/live/room-socket.ts`. It is the only `WebSocket` constructor. It reconnects with backoff and jitter, replaces lobby state from snapshots, tracks commands as pending, sent, or accepted, and removes listeners on close. It does not reconnect after `This game is open in a newer tab.`, `This session was moved to another device.`, or `This phone was removed from the game.`

## Name votes and host controls

A guest can like or dislike another nickname only in the lobby. Ten active votes is the cap. Tapping the same reaction again removes it. Tapping the other reaction replaces it and does not use a second slot. The same request id returns the stored result, so a reconnect cannot add a vote. The public cloud is counts only. A phone receives its own votes so the buttons can show pressed.

Reveal nickname votes is a lobby beat. It does not write the score ledger. Starting the quiz ends the beat.

`POST /api/rooms/play` also accepts reveal-names, hide, show, rereveal, rename, swap, kick, recover, and adjust. Finish sets a flag and completes after the current question, except from the final screen, where it moves to the podium. Re-reveal clears a hidden stage and does not insert another ledger row. Adjustments are separate rows with a reason. The reason is on the control snapshot only. Kick revokes the guest credential and closes that phone's sockets. Recover clears the kick and issues a one-use transfer code; the old secret stays revoked. Rename and swap change nicknames and leave the player id in place.

`POST /api/rooms/demo-cloud` inserts demo nicknames up to 75 active players. It responds 404 unless `APP_ENV` is `local`.

## Local administrator check

Admin discovery uses authenticated, same-origin `GET /api/admin/rooms` with a bounded keyset cursor (`cursor`, `limit` 1–50). It reads identity/creation metadata from the existing code registry, without waking every room for live counts. `GET /api/admin/rooms/current` verifies the browser's selection hint and actual control credentials. `GET /api/admin/rooms/:gameId` verifies scoped access and reads the authoritative control snapshot.

`POST /api/admin/rooms/:gameId/resume` requires an administrator session, same-origin mutation and request id. The room persists renewed control/presentation credentials before responding; uncertain retries reuse the receipt. Only cookies carry secrets. Replacing access releases the credentials actually presented by that browser and closes matching sockets. Guest data, scores, content versions and other operators' credentials are preserved. Expired/revoked sockets cannot receive later snapshots. The `26_admin_room` HttpOnly cookie is only a location hint, never authentication.

`vite dev` and `vite preview` answer auth endpoints under `/api/auth`, `/api/admin`, `/api/dev`, and `/api/stage` from Node, excluding `/api/admin/rooms`. All room HTTP and `/ws` reach the Worker. When `APP_ENV` is `local`, privileged room routes forward the caller's cookie to `GET /api/admin/session`. Staging and production use the in-Worker session check and do not loop back. A missing session is 401. Browser checks set the explicit local-only `LOCAL_DATABASE_ID` adapter to use an ephemeral auth database; normal development keeps its existing database.

Player rows have nullable `device_context_id` and `device_context_version`. A guest device report writes the latest context id. Transfer clears that pointer. The notes are `apps/api/src/device/README.md`.

Inbound socket text is capped at 4 KB. The room allows 80 active players. Join, transfer, and message counters are SQLite rows, so a reconnect does not reset them. Device and connection reports do not use the gameplay message counter. The room does not store an IP address.

## Private player workspace projection

Only control snapshots include `adminPlayers`. `admin-players.ts` reads stable player records (including removed records for recovery), accepted score ledger plus adjustment totals, active guest sockets and available host answer state. It does not add scoring rules. Guests and the stage never receive this field, removed identities, score reasons, transfer codes or presenter notes. The worker regression covers idempotent adjustment, kick, eviction/recovery and projection boundaries.

## Administrative content and media

`GET /api/admin/content` requires the existing administrator session and same-origin checks. It projects versioned server packs explicitly: pack identity/release/illustrative state and question title/prompt/mechanic/presentation/status/order plus recorded missing requirements. Answer fields, truth, presenter notes and reveal copy are never serialised. No write/release endpoint exists.

`GET /api/admin/rooms/:gameId/media?cursor=…` also requires current scoped control credentials. It reads 50 accepted records newest-first from existing SQLite storage and returns a stable rowid cursor, owner nickname/kind/hidden state only. Rejected/unfinished uploads and storage keys stay out. The preview at the same path plus `/:mediaId` verifies the admin session and control credential explicitly (ignoring unrelated/stale guest cookies), reuses the accepted-media reader and R2 adapter, and returns no-store headers. Hidden bytes remain unavailable to every role. A metadata listing grants no authority to read bytes.

Published result reads return preparing when a verified archive cannot actually be read, instead of advertising an empty ready report. Archive storage, RLS, scoring and delivery policies are unchanged.

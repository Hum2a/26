# Results and optional email

`/r/:gameId` reads the published archive. Standings, comparison cards, and the shared gallery are the public projection. A guest cookie, or a personal link, is required for one player's position, scored answers, troll counts, and recap.

The public JSON does not include player ids, credential hashes, device reports, private drafts, or another player's detail. Hidden media is left out of the gallery list. A gallery image is served only while the room still marks that photo as shared. The response uses `public, max-age=60, must-revalidate`. A hidden photo responds with `no-store`. A copy that was already downloaded cannot be recalled.

The gallery name is the person who sent the photo. Photos are described as shared with the room.

Named standings, shared photos, comparison cards, and the end-of-night fun facts stay with the archive. Detailed device rows still expire 30 days after the room was created. A verification link lasts 1 hour. A personal results link lasts 14 days. Those are the selected defaults. The frozen sentences are not recomputed after the device rows go.

## Email

Collection happens on the results page after the archive is ready, and only for the signed-in guest session. The address is confirmed before the personal result is sent.

Jobs live in `archive_delivery_job` when `DATABASE_URL` is set, and in the room's `dev_delivery_job` table for local development. The idempotency key is the job id, or that id plus the attempt when a replacement message is drafted. Resend receives the key on `emails.send`. A lost response is stored as `uncertain` and the next request sends the same body with the same key. That does not make network delivery exactly once: the provider keeps a key for a limited time, and a replacement message after an expired link uses a new key.

Local play writes the message into the room outbox and does not call Resend. `GET /api/rooms/:gameId/results/outbox` is local only and requires the control credential. Tests use an injected sender.

The personal link is a random token stored as a hash. It is not the guest session secret, and a player id on its own does not open a recap.

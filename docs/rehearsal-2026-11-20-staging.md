# Staging dress rehearsal with 80 bots

[Home](../README.md) · [Documentation](README.md) · [Night of](night-of.md) · [Event runbook](event-runbook.md)

Run on **Thursday 19 November 2026, 20:33–21:36 GMT** against
https://26-staging.humza.website, ahead of the Friday sign-off. Nothing was
deployed. Production was not touched. Bot traffic came from the Developer tools
bot fleet in one browser tab (real WebSockets through `openRoomSocket`, no phone
rendering, no venue Wi-Fi). Room health came from Admin → Health (the room's
`/diagnostics` report) and from `npx wrangler tail --env staging` for the whole
hour.

## Verdict

**Not ready for 80 guests as it stands.** Ordinary rounds work at 80, but the
room slows down as a game builds up history. In the two knockout rounds it
becomes overloaded: phones drop, votes are refused and Live controls lock. The
kart race start overloads the room by itself, even in a fresh room, and every
connected phone drops. Issues 1–4 below need fixing or a decision before
Saturday.

## What was and was not verified

| Area                                    | Result                                                                                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Birthday order, 42 rounds, 80 bots      | **Ran to the podium**, with failures (see the round table). About 46 minutes.                                                                         |
| Answers, votes, reveals                 | Verified for every mechanic the bots send: choice, text, estimate, rank, ballots, awards. Scoring correctness was not checked against the answer key. |
| Answer trends                           | **Not exercised.** The Analytics page renders, but bots are excluded from statistics, so every round shows 0 answers.                                 |
| Trolls                                  | **Not exercised.** Bots never send trolls; 0 sent.                                                                                                    |
| Chess (round 39)                        | **Not exercised.** Bots do not play chess.                                                                                                            |
| Kart race with 80 bot drivers           | **Failed.** Both attempts overloaded the room at the start, and both races ended within 20–40 s with no finishers.                                    |
| Archive and public results              | **Passed** in a kart-only lobby with one test guest. Archive completed and `/r/VW47BHF2R243` rendered. Rehearsal rooms are never archived by design.  |
| Result email                            | **Not sent.** Humza chose not to name a recipient.                                                                                                    |
| Stage gap p95 during the race           | **Not measured.** The projector tab was a background tab, and Health has no gap metric.                                                               |
| Physical phones, projector, venue Wi-Fi | Not covered by this run.                                                                                                                              |

Sign-in: the browser was signed in to staging admin by Humza himself. The
`npm run auth:agent` route could not be used from this worktree because its
dependencies were not installed. No codes or cookies were handled by the agent.

## Rooms

| Room           | Purpose                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------ |
| `3GUH6GB7B74H` | Fresh rehearsal: saved birthday order, 80 bots, automatic answers, 1–2 s answer delay, 8 s answering window. |
| `9GAPYECPJFA4` | Fresh rehearsal: 80 bots with kart traffic at 10 controls a second, jumped to `kart-sprint`.                 |
| `VW47BHF2R243` | Kart-only lobby: archive and results with one test guest.                                                    |

Question set `birthday-r0-128b7b5f5955a5bac4b2`, scoring `demo-rounds-v4`, admin
footer `v0.0.5`. The deployed commit was not checked.

Setup notes. In room `3GUH6GB7B74H` my automated tick on "Kart traffic" did not
register, so bots drove no kart in that room. I fixed this at 21:01 through the
page. At the same time I turned off "Stop on failed checks", so the runner would
not keep pausing on disconnects. The second room was configured correctly from
the start.

## Birthday order, round by round

"Accepted" is the number of bot answers or ballots accepted by the room, from the
rehearsal timeline. After 21:03 that timeline (latest 200 events) was crowded by
reconnect events, so counts for later rounds may undercount. "Ack p95" is the
Developer tools 95th-percentile time from send to server acknowledgement over the
latest 1,000 commands. Measurements were reset once, at 20:46:15.

| #     | Round                                 | Result             | Notes                                                                                                                                                                                                           |
| ----- | ------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–3   | `accommodation-01` … `-03`            | Pass               | Finished before per-round logging started. All automatic checks passed and nothing was refused.                                                                                                                 |
| 4     | `apology-video-auction`               | Pass, **slow**     | 80 entries became 79 knockout matches. 5,879 ballots, 0 refused, about 10 minutes (20:35:41–20:45:49). Ack p95 rose from 1.5 s to 9.8 s. Reconnect wave at 20:40:26 (23 of 80 connected) recovered by 20:40:57. |
| 5–11  | `favourite-genre` … `trolley-problem` | Pass               | 80/80 accepted in each. Rank (`ignorance-triggers`) included.                                                                                                                                                   |
| 12–16 | `real-name-*` (five)                  | Pass               | 80/80 text answers in each.                                                                                                                                                                                     |
| 17–19 | Pokémon rounds, `common-password`     | Pass               | 80/80 in each.                                                                                                                                                                                                  |
| 20    | `complete-a-wordle`                   | Pass (accepted)    | 80 text guesses accepted. The check says answer counting does not apply to this mechanic.                                                                                                                       |
| 21–25 | `inflation-*` (five)                  | Pass               | 80/80 estimates in each.                                                                                                                                                                                        |
| 26–28 | Italian, Christianity, Trump          | Pass               | 80/80 in each.                                                                                                                                                                                                  |
| 29–32 | `guess-tab-*` (four)                  | Pass               | 80/80 in each. By now ack p95 was **8–15 s** for ordinary answers.                                                                                                                                              |
| 33    | `heathrow-search-query`               | **Fail**           | 79 matches over about 23 minutes (20:52–21:15). Overload and restarts, a mass disconnect (1 of 80 at 21:06:18), 7 "That ballot has closed" refusals, host locked out. See issues 2–4.                           |
| 34    | `rank-driving-sins`                   | Degraded           | 59 accepted, with 56–75 of 80 bots connected.                                                                                                                                                                   |
| 35    | `dating-exit-excuse`                  | Degraded           | 262 award ballots recorded amid reconnects.                                                                                                                                                                     |
| 36–38 | `dial-*` (three)                      | Degraded           | 69, 67 and 40 accepted. The last had 31 disconnects.                                                                                                                                                            |
| 39    | `chess-battle`                        | Not exercised      | Bots do not play chess.                                                                                                                                                                                         |
| 40    | `group-chat-figurine`                 | Degraded           | 70 ballots.                                                                                                                                                                                                     |
| 41    | `cursed-search-history`               | Degraded           | 64 accepted, 1 refused ("This phase is not accepting answers", a late answer).                                                                                                                                  |
| 42    | `kart-sprint`                         | Not exercised here | The rehearsal runner moved from intro to podium in 15 s (its answering window governs the race), so no race was driven. Tested separately below.                                                                |

The podium was reached at 21:20:48. Totals since the 20:46 reset: 7,599 accepted,
12 refused, ack p95 78 s.

## Kart numbers (room `9GAPYECPJFA4`, 80 bot drivers)

| Measure                      | Race 1 (21:28:07)                                                               | Race 2 (21:30:33, repeat)                                                 |
| ---------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Race-start alarm CPU         | **4,390 ms** (wall 4,745 ms)                                                    | **7,776 ms** (wall 8,444 ms)                                              |
| Bot sockets at start         | All 80 closed at 21:28:11                                                       | All 80 closed at 21:30:35–36. 86 failed reconnects in the browser console |
| Phones connected during race | 33 of 80 at the sample                                                          | 0–13 of 80 for the first 15 s                                             |
| Stage updates per second     | **9.3** (93 kart broadcasts in 10 s, mid-race)                                  | Not sampled mid-race                                                      |
| Tick lateness                | 112 ticks, mean 46 ms, 1 tick over 250 ms                                       | 96 ticks after a meter reset, mean 110 ms, 3 over 250 ms                  |
| Traffic out                  | Kart frames 163/s, 1.4 MB/s. Snapshot patches 28/s, 1.3 MB/s (about 45 KB each) | —                                                                         |
| Race length                  | About 20 s, no finishers                                                        | About 40 s, no finishers                                                  |
| Stage gap p95                | Not measured                                                                    | Not measured                                                              |

Answer ack p95 for question 1 in this fresh room was **87 ms** for 80 answers.
Compare 8–15 s late in the first room's game.

## `wrangler tail --env staging` (20:35–21:35)

2,414 events: 1,762 ok, 393 cancelled, 241 exceptions (all WebSocket upgrades),
18 response streams disconnected.

- **62 × "Durable Object is overloaded. Requests queued for too long."**: 21:06:07–21:06:16 in the first room, then 21:28:09–21:30:44 at the two race starts.
- **2 × "Durable Object storage operation exceeded timeout which caused object to be reset."** at 21:13:01. The room's meter totals reset twice, consistent with this.
- Room CPU per invocation: WebSocket messages p50 5 ms, p95 383 ms, max 4.4 s. Alarms p50 165 ms, p95 3.3 s, max 8.3 s (21:02:34, during the second knockout).
- **No "rows written" errors and no CPU-limit errors.** Invocations of 5–8 s CPU completed. A Workers Free account would not allow that, so the account in `apps/api/wrangler.jsonc` (staging and production share it) appears to be on a paid plan. This is an inference; the dashboard was not checked.
- 14 × Better Auth warning: rate limiting could not determine a client IP and fell back to one shared bucket per path.

## What broke, most serious first

1. **Kart race start overloads the room and drops every phone (blocker).** In a
   fresh room with 80 drivers, the alarm that starts the race took 4.4–7.8 s of CPU.
   The object queued requests past Cloudflare's limit and every socket closed. Both
   races then ended within 20–40 s with no finishers. A race ends once no guest
   driver is `RACING` (`packages/shared/src/kart/kart.ts:411`). My unverified guess
   is that the start drop knocks every driver out. Bots do not steer around the
   course, so a full three-minute race was not possible either way. Look at the
   collect-entry path in `apps/api/src/questions/kart/kart.ts` and the alarm in
   `apps/api/src/room/party-room.ts`. Earlier Cloudflare load tests measured ticks
   after the start, not the start itself.
2. **Every accepted answer costs more as the game goes on (blocker).** After each
   accepted command the room sends the guest a snapshot and broadcasts to the
   stage and control (`apps/api/src/room/party-room.ts:3796-3812`). Both rebuild
   room-wide data, including `readStatsSource`
   (`apps/api/src/stats/source.ts:14`). That function reads every `choice_answer`,
   every `vote_ballot` joined to `vote_candidate`, and every `score_ledger` row in
   the game. Statistics also feed the admin highlights preview and each guest's
   recap (`party-room.ts` around line 4313). Answer acks went from 87 ms in a fresh
   room, to 8–15 s after the first knockout, to over 20 s during the second. The
   diagnostics endpoint waited up to 8.3 s for a first byte, while the bot tab's
   main thread was idle (no long tasks, timer lag p95 7 ms). Suggested direction:
   build statistics only in the end phases, or cache them and refresh at most every
   few seconds, and skip the extra room-wide rebuild per command.
3. **Knockout rounds are very long with 80 entries (needs Humza's decision).**
   Each knockout runs n − 1 matches: 79 here. At the real 15 s `voteMs` that is
   about 20 minutes for each of `apology-video-auction` and
   `heathrow-search-query`, even in a healthy room. Each also adds about 6,000
   ballot rows, which feed issue 2. Options: shortlist or cap entries, or hide
   most lines before voting.
4. **Under load, phones and Live controls drop.** Phones close a socket after
   15 s without a pong (`apps/web/src/live/room-socket.ts:357`), and each reconnect
   costs the room a full snapshot. The room hit Cloudflare's overload limit at
   21:06 and dropped every connection. The control socket also dropped ("Host
   connection lost" at 21:14). Live controls were disabled from 21:10 to 21:12, and
   a Pause clicked then had no effect. The pong already uses a runtime
   auto-response (`party-room.ts:441`), so pongs are late too when the object is
   busy.
5. **Kart-only lobbies refused bots: fixed in this PR.** A kart lobby freezes its
   one-race script at creation (`apps/api/src/room/kart/kart-lobby.ts:74`).
   `liveBirthdayGame` (`apps/api/src/developer/bots.ts:27`) therefore treated every
   kart lobby as the live birthday game. Developer tools could never fill one, and
   it replied "Bots cannot join the live birthday game". Kart lobbies now take bots
   while still in the lobby phase, as an ordinary room does before Start birthday
   game, and refuse more once the race starts. Humza should confirm he wants this
   on the night's real kart lobby; reverting is one condition.
6. **Every knockout said "Pick the worse search": fixed in this PR.** The ballot
   instruction was hard-coded for the Heathrow round
   (`apps/api/src/questions/vote.ts:956`), so the apology bracket showed it on the
   projector and phones. It now reads "Pick the winner of this match. No self-votes.
   Ties use the frozen random draw." The round's own prompt carries the criterion.
7. **Rehearsal results copy is misleading (small, not fixed).** Results says "The
   archive export is preparing" for rehearsal rooms. They never archive
   (`apps/api/src/archive/schedule.ts:24`; label in
   `apps/web/src/admin/results-page.tsx:149`).
8. **Admin sign-in rate limiting shares one bucket (low).** Better Auth cannot see
   the client IP on staging, so all sign-in attempts share a bucket per path. Check
   whether production behaves the same.
9. **Coverage gaps in the bot fleet.** Bots do not send trolls, play chess, drive a
   course to the finish or count towards trends. The birthday rehearsal runner also
   closes `kart-sprint` after its answering window. These need real phones or
   other tools.

## Suggested next steps before Saturday

- Fix issues 1 and 2, then repeat this run. Use a fresh rehearsal with 80 bots,
  and a kart-only lobby with 80 bots now that issue 5 is fixed.
- Decide on issue 3 (cap or shortlist knockout entries) for the real order.
- On the night, avoid back-to-back heavy rounds. If the room stalls, keep the same
  room: phones reconnect on their own once it recovers.

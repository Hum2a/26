# Event runbook

[Home](../README.md) · [Documentation](README.md) · [Event runbook](event-runbook.md)

Baseer presents. Humza operates the administrator screen. Guests play on their own phones. This runbook matches the controls in the current build. The question pack is still the illustrative demo `demo-2026-09-22`. The venue rehearsal, a physical phone, and a projector have not been checked from this environment.

<details>
<summary>On this page</summary>

- [Before the room opens](#before-the-room-opens)
- [Joining](#joining)
- [Controls](#controls)
- [A missing phone](#a-missing-phone)
- [Wi-Fi disruption](#wi-fi-disruption)
- [Archive, email, and the score summary](#archive-email-and-the-score-summary)
- [Shutdown](#shutdown)
- [Same-room recovery drill](#same-room-recovery-drill)
- [Load and reconnect rehearsal](#load-and-reconnect-rehearsal)
- [Still needed before the party](#still-needed-before-the-party)

</details>

## Before the room opens

1. Run the local checks in [docs/deployment.md](deployment.md), or open https://26-staging.humza.website only after that environment has actually been deployed.
2. Sign in at `/admin` with the administrator magic link. Confirm with the Sign in button. Opening the link page does not sign in.
3. Create the lobby. Leave that admin tab open. It holds the control connection.
4. Open `/host` on the projector browser and connect it to the same room. The stage cookie is separate from the admin cookie.
5. On the stage, press Start show once. A refresh asks again. M mutes the stage, and the icon shows that state. Personal diagnostics stay on the admin screen. D shows a small operator count on the stage, and ? lists the stage shortcuts.
6. Print or save [docs/content/illustrative-answer-key.md](content/illustrative-answer-key.md) and [docs/content/illustrative-running-order.md](content/illustrative-running-order.md) before the night. Those files are the offline question, answer, and presenter script. Refresh them with `npm run content:export` after the real questions replace the demo.
7. Press Refresh room health. Expect phase `lobby`, a control connection, and no failed scheduler jobs.

## Joining

Guests open the site, enter the join code and a nickname, and keep that tab. The game id is not the join code. A second tab on the same phone is told the game is open in a newer tab. A shared Wi-Fi address can still be two players when the nicknames differ.

Humza reads the nickname cloud. Press Reveal names, or press `N` while the phase is lobby and the cursor is not in a field, when Baseer is ready for the names to be public.

In the room’s **Players** page, use **Close joining** to stop new registrations or
**Open joining** to admit late arrivals. Entry is open by default, including during
the game. Closing entry does not stop existing guests reconnecting, answering, or
redeeming a private phone-transfer/recovery code. The page records the latest 20
entry changes privately. A refused join needs a fresh attempt after reopening.

Late arrivals start at zero; there are no automatic catch-up points. They can
answer an ordinary question while its answer window is open. Votes, duels and
kart races that have frozen their participants keep that set; late arrivals wait
for their next eligible round. Pause the game if someone needs time to settle in.

Removal revokes that player’s session and all unused transfer codes. A new transfer
code replaces older unused codes. Recovery preserves the player ID, answers and
score and requires its new private code. If another active player has taken the
nickname, rename that active player first. While joining is open, a removed person
can register a fresh identity; close joining to prevent fresh registrations.
The game deliberately has no account or device-fingerprint ban.

Rehearse in an isolated room: join in a private browser during an open question,
close entry, check a fresh browser cannot join, refresh the existing player, then
reopen entry. Try removal and recovery, and confirm an older transfer code fails.

## Controls

Buttons on `/admin` are the source of truth. Shortcuts work in that tab when focus is not in a text field, and they ignore Ctrl, Alt, and Meta.

| Key           | When                                     | Action                 |
| ------------- | ---------------------------------------- | ---------------------- |
| `N`           | Lobby                                    | Reveal names           |
| `P`           | After the lobby, before the podium       | Pause or resume        |
| `Right arrow` | After the lobby, before the podium       | Advance                |
| `S`           | After the lobby, before final and podium | Skip the round         |
| `F`           | After the lobby, before the podium       | Finish early           |
| `H`           | Reveal, scores, final, podium            | Hide or show the stage |
| `R`           | Reveal, scores, final, podium            | Show the reveal again  |

Pause holds the clock. Resume continues it. Skip and finish are host decisions. They do not invent points.

Hide covers the stage. Cancel effect and Hide media remove a cue or a photo from later reads. A file a browser already has is not recalled.

## A missing phone

Use Recover on that player. Read the one-time transfer code to them. They enter it on the new phone. The old cookie stops working. Do not create a second room for one guest. Do not put the transfer code on the projector.

For an active guest changing devices, use **Phones → Transfer**. Use **Recover**
for a removed player. On the replacement phone, open the room’s join link and
choose **Changed phones?**, then enter the private code. They do not need to join
with a new nickname first, and this still works while joining is closed. The same
phone can use its recovery code too; its connection is replaced with the restored
session. If a response is lost, retry the same code before requesting another one.

If the phone only lost Wi-Fi, ask them to reload the same tab. The guest cookie is the seat. The answer already stored stays stored.

## Wi-Fi disruption

Keep the same room. Phones and the stage reconnect on their own: they retry with spread-out waits, retry at once when the phone wakes or its signal returns, and replace a socket that stops answering. A short drop costs only what changed, not the whole room.

What guests see: nothing for 1.5 seconds, then "Reconnecting…", then a Wi-Fi or signal hint at 10 seconds, then a Try again now button at 30 seconds. The stage hides the question straight away and adds "Check this screen’s network" after 15 seconds.

Ask a guest to reload only if Try again now does not bring them back. Humza reloads `/admin` and signs in again if the control cookie has expired. Baseer reloads `/host` if the stage stays on "Reconnecting to the room." A dropped socket does not delete scores. Do not start a spare room and ask people to rejoin unless the original room cannot be opened at all.

### The projector lost its connection

1. Look at Room health. If Stage shows 0, the projector browser is offline.
2. Press `P` to pause if a question is collecting. The room does not pause by itself when the stage drops, so a flicker does not stop the game.
3. Check the projector laptop's network. The stage reconnects without a reload once the network is back.
4. Resume with `P`.

### One phone sending too much

The room limits each phone to short bursts of taps. A phone over the limit is told "Too many taps at once. Wait a moment and try again." and recovers within seconds. There is no lifetime cap, so a guest cannot be locked out for the rest of the game. Nothing is needed from Humza.

### Room health during play

- **Socket traffic** shows updates per second over the last 10 seconds. During a kart race, "Kart frames sent" should be about 5 per screen per second and "Full room updates sent" should be near zero.
- **Phone errors** lists phones that reported a script error, with a short message and the build id. A rising count on one phone usually means that phone should reload.
- The build id is printed under Phone errors. A `+` means the build had uncommitted changes.

## Archive, email, and the score summary

The podium does not wait for the archive. If Room health or the Archive panel says the export failed, press Retry archive export. That retries a failed export. It does not wipe Neon.

Refresh room health shows pending, failed, and uncertain email jobs as counts. Press Retry email jobs to send those again. On staging, only the configured test recipient can receive results mail. Guest addresses are refused. Do not use a guest's real address for a test.

Download score summary saves a markdown file of nicknames and points. It is the readable operator copy. It is not the public results page.

Public results are `/r/` plus the game id, after the archive has a publication. Until then the page says the archive is not built yet.

## Shutdown

1. Reach the podium, or finish if the room must stop.
2. Refresh room health. Note archive status and any failed media or email counts.
3. Download the score summary.
4. Retry a failed archive once, then open `/r/{gameId}` and confirm the standings load.
5. Leave the admin tab until that check is done. Then sign out.
6. Close the projector browser.

## Same-room recovery drill

Run this against a local or staging room before guests arrive. Use one nickname and one answer.

1. Create a lobby, start the game, and join one phone.
2. Answer the shape question while it is collecting.
3. Restart the local Worker, or reload after a staging disconnect. Use the same guest cookie. Do not join again as a new nickname.
4. Confirm the phone still shows that answer and a second different choice is rejected.
5. Download the score summary and confirm the nickname is listed once.

`apps/api/test/operations.spec.ts` runs that drill in the local Durable Object harness: one answer, an eviction, the same cookie, and the answer count stays at one.

## Load and reconnect rehearsal

1. Run `npm run load:realtime`. It joins 8, 30 and 80 simulated phones, sends an answer burst, then drives a live kart race at 10 controls a second per phone. Each size prints a `LOAD-REALTIME` line. `LOAD_SIZES`, `LOAD_KART_MS` and `LOAD_INPUT_HZ` change the run. The figures are from local workerd, which shares one process with the simulated phones, so treat them as a floor.
2. In development, run `window.__26.dropSockets()` in a phone or stage tab's console. The tab should reconnect without a reload and keep its answer. The helper does not exist in a production build.
3. On the venue Wi-Fi, join ten real phones, switch the access point off for 20 seconds and back on. Every phone should return without a reload. Note anything else here.

## Still needed before the party

From Humza, before the demo pack is replaced:

- The real question list, running order, and the answer or scoring rule for each.
- How long each answer and vote stays open.
- Which rounds allow double or nothing, and which stay unscored.
- Whether long vote rounds show every answer or a shortlist.
- The party sting, and any face or caption art. The file in the repo is a short illustrative tone.
- Photos or voice the questions themselves need.
- Which comparison cards Baseer should read.

Until those exist, present the illustrative pack and the printed exports.

These checks cannot be completed from the development machine:

- A physical phone joining over the venue Wi-Fi.
- The projector or an HDMI output, including type size from the back of the room.
- Start show on the venue browser after a full refresh.
- A photo and a voice note from a guest phone into the deployed bucket.
- Staging admin login, a full mixed game, recovery, export, and results on the deployed URL.
- A results email to the configured test recipient. No test recipient is configured, and no message has been sent.
- A 75-guest pass on staging. The existing figure is from the local emulator only.
- `npm run load:realtime` against staging conditions, and the venue Wi-Fi drill above.

## Run just the kart race

1. Open **Admin → Kart → Create kart lobby**. Rooms also links to this page.
2. Share the normal guest join link/code from Live controls and connect the stage.
   Use a private second browser tab as your phone to rehearse without guests.
3. When the racers are in, choose **Start kart race**, then advance the get-ready
   and prompt beats. It uses the real Mario circuit, one lap and three minutes.
4. Use the existing Pause/Resume, course switches and Players tools as needed.
   The grid freezes on start: late arrivals can watch but cannot enter that race.
5. Advance through race results to the podium. Kart-only rooms skip birthday
   phone facts. Create a fresh kart lobby for another race; its scores start fresh.

This does not edit the birthday running order or release a question pack. Creating
or opening a room selects it for this browser, as usual. A failed creation can be
retried with the same request; avoid creating another room just because a reply
was lost. The feature has not been deployed merely by completing local checks.

# Event runbook

[Home](../README.md) · [Documentation](README.md) · [Event runbook](event-runbook.md)

Baseer presents. Humza operates the administrator screen. Guests play on their own phones. This runbook matches the controls in the current build (updated 5 November 2026). The party plays the birthday running order: **Start birthday game** freezes the saved order into the room. The illustrative demo is for rehearsals only. The venue rehearsal, a physical phone, and a projector have not been checked from this environment; see [Physical-device and venue sign-off](#physical-device-and-venue-sign-off).

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
- [Readiness and remaining content](#readiness-and-remaining-content)
- [Physical-device and venue sign-off](#physical-device-and-venue-sign-off)
- [Run just the kart race](#run-just-the-kart-race)

</details>

## Before the room opens

**The day before (20 November):** production is frozen — `npm run release` refuses production deploys from 20 November until midday 22 November. In the Neon console, switch off autosuspend (scale to zero) on the production branch for the night so host commands never wait for a cold database. Print [docs/content/birthday-answer-key.md](content/birthday-answer-key.md) and [docs/content/birthday-running-order.md](content/birthday-running-order.md); refresh them first with `npm run content:export` if the order changed.

1. Open https://26.humza.website/admin on the control laptop and sign in with the magic link. Confirm with the Sign in button. Opening the link page does not sign in.
2. **Question packs → Running order:** check the order and the estimated show length. _Suggest a mixed order_ spreads out same-series rounds; review, then save or discard. A started game never changes.
3. Create the lobby. Leave that admin tab open. It holds the control connection and stays authorised for twelve hours.
4. **Live controls → Driving feel** (kart round): defaults are prediction on, other karts glide, sideways steering strip, auto frame rate, 3-2-1-GO countdown. If karts rubber-band on the venue Wi-Fi, choose _Conservative_ or _Off_; changes reach phones at once.
5. Open `/host` on the projector browser and connect it to the same room. The stage cookie is separate from the admin cookie and lasts fourteen hours. Press **Present on this screen**, then F for full screen.
6. On the stage, press Start show once for sound. M mutes the stage. F requests full screen. Escape returns to projector setup. If full screen drops by accident the show stays up with a short hint; press F. A reload of the projector tab reconnects and keeps presenting. The stage deliberately has no operator readout: diagnostics stay on the admin screen.
7. Press Refresh room health. Expect phase `lobby`, a control connection, and no failed scheduler jobs.
8. When everyone is in, press **Start birthday game** and confirm. The confirmation says how many players are in; the running order freezes at that moment. The illustrative demo start is labelled as a rehearsal alternative and also asks first. Developer bots are refused in a room running the birthday game.

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

## Readiness and remaining content

The birthday catalogue has a 56-round default running order, frozen separately for
each room when **Start birthday game** is used. The illustrative demo remains a
separate rehearsal. Review the saved running order in **Admin → Question packs**;
do not assume a change there alters a game that has already started.

Four rounds remain drafts by the host's decision on 3 November 2026:

| Round                   | Material needed                                                        |
| ----------------------- | ---------------------------------------------------------------------- |
| Reddit tribunal         | Original thread, exact title, outcome, top comment and answer          |
| Ferrier estate          | Verified estate name and confirmed category                            |
| Nextdoor paranoia       | Genuine post or screenshot and confirmed explanation                   |
| Property price roulette | Dated listing, authorised image, rent, agent wording and numeric scale |

Figurine and Cursed Search History are ready in the catalogue and can be rehearsed
from their question pages. Add them explicitly to the saved order when wanted.
The spoken debate round has been dropped. Steal, Robin Hood and Shared score are
permitted on scored birthday choice questions; polls and other mechanics retain
their existing restrictions. Each guest gets one troll, from question two.

## Physical-device and venue sign-off

Use a fresh rehearsal room, with Baseer presenting and Humza on Live controls.
Record date, device/browser, room, result and any issue for each check. An unchecked
item is unverified; desktop browser automation does not establish a physical pass.

- [ ] iPhone Safari and Android Chrome: join by QR, answer, select another tab,
      return to Play as answering opens, and see a server-accepted answer.
- [ ] Lock each phone during collection, unlock, reconnect and confirm its saved
      answer and score. Repeat with Wi-Fi off/on and a switch to mobile data.
- [ ] Recover onto a second device using the host's transfer flow. Confirm one
      player and one score, with the old phone no longer able to answer.
- [ ] Deny camera and microphone permission; questions remain usable. Then allow
      them and send a photo and a short voice clip. Check moderation and hiding.
- [ ] Check large text, short landscape screens, safe areas, reduced motion and
      optional audio on both devices. Keep the answer and send action reachable.
- [ ] Complete quiz → kart → final scores → phone facts → podium. Check controller
      responsiveness on both phones and stage readability from the back of the room.
- [ ] Check the actual projector, HDMI, fullscreen, sound output and fallback Wi-Fi.
- [ ] Open archived results and private recaps; download the score summary. Verify
      results email only to an explicitly chosen test address, then check delivery.
- [ ] Run the venue reconnect drill and intended guest-count load rehearsal. Local
      emulator load figures do not establish venue or deployed capacity.

No physical-device, venue, deployed email or deployed load pass is implied by this
checklist. Use local rehearsals first; deployments and remote test sends require
separate instructions.

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

## Expanded kart items — locally verified

Before a race, open **Admin → room → Live controls → Kart items**. Choose the allowed expanded items and save. Empty selection gives no box pickups. **Use original items** restores the existing turbo/shield/oil pool. The current race freezes its choice when collection starts, including during pauses; after racing, changes apply to the next start. Older tabs are explicitly asked to refresh before expanded gameplay.

Treats give the holder a 600ms turbo and drop nothing. Tennis balls bounce, bombs drop behind with a 1.5-second fuse, and homing bolts select an eligible racer ahead. With nobody ahead, homing gives the same small personal boost. Shields absorb one item hit; item use changes driving, never directly steals quiz points.

Live controls show held items by player, active counts and recent accepted item history. **Stop item spawning** stops boxes and new oil/projectile use while retaining held inventory; held boosts/shields still work. **Clear track items** removes current projectiles/oil. **Resume item spawning** reopens pickups and hazards. Use the normal Pause/Resume for the entire race clock. Rehearse without guests in **Admin → Kart → Items sandbox**, including personal Treats, shields, fuses, height, full pools and restore/clear/stop. No room or score is changed by that sandbox. Mandatory hazards stay visible when decorative effects are off or graphics are Low.

No deployment or physical-device certification is implied by this local implementation note.

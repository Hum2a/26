# Event runbook

Baseer presents. Humza operates the administrator screen. Guests play on their own phones. This runbook matches the controls in the current build. The question pack is still the illustrative demo `demo-2026-09-22`. The venue rehearsal, a physical phone, and a projector have not been checked from this environment.

## Before the room opens

1. Run the local checks in `docs/deployment.md`, or open https://26-staging.humza.website only after that environment has actually been deployed.
2. Sign in at `/admin` with the administrator magic link. Confirm with the Sign in button. Opening the link page does not sign in.
3. Create the lobby. Leave that admin tab open. It holds the control connection.
4. Open `/host` on the projector browser and connect it to the same room. The stage cookie is separate from the admin cookie.
5. On the stage, press Start show once. A refresh asks again. M mutes the stage, and the icon shows that state. Personal diagnostics stay on the admin screen. D shows a small operator count on the stage, and ? lists the stage shortcuts.
6. Print or save `docs/content/illustrative-answer-key.md` and `docs/content/illustrative-running-order.md` before the night. Those files are the offline question, answer, and presenter script. Refresh them with `npm run content:export` after the real questions replace the demo.
7. Press Refresh room health. Expect phase `lobby`, a control connection, and no failed scheduler jobs.

## Joining

Guests open the site, enter the join code and a nickname, and keep that tab. The game id is not the join code. A second tab on the same phone is told the game is open in a newer tab. A shared Wi-Fi address can still be two players when the nicknames differ.

Humza reads the nickname cloud. Press Reveal names, or press `N` while the phase is lobby and the cursor is not in a field, when Baseer is ready for the names to be public.

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

If the phone only lost Wi-Fi, ask them to reload the same tab. The guest cookie is the seat. The answer already stored stays stored.

## Wi-Fi disruption

Keep the same room. Guests reload. Humza reloads `/admin` and signs in again if the control cookie has expired. Baseer reloads `/host` if the stage socket drops. A dropped socket does not delete scores. Do not start a spare room and ask people to rejoin unless the original room cannot be opened at all.

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

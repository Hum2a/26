# Rehearsal kit

[Home](../README.md) · [Documentation](README.md) · [Event runbook](event-runbook.md) · [Decisions for Humza](decisions-for-humza.md)

One evening on staging, ideally with the projector laptop and at least one iPhone and one Android phone. Every step says what to look for. Record each result in the table at the end and paste it into [verification-report.md](verification-report.md).

Nothing here touches production. Staging email only reaches `EMAIL_TEST_RECIPIENT`.

## 0. Prepare (15 minutes)

1. Merge `kart-mobile-multiplayer` into `master` once you are happy with it (see [decisions-for-humza.md](decisions-for-humza.md)).
2. Deploy staging: `npm run release` (staging is the default). It runs typecheck, content, unit, lint and script checks first. Add `--full-checks` to include the API suite.
3. Open https://26-staging.humza.website/api/health and confirm the new version.

## 1. Room and projector (10 minutes)

| Step                                                             | Look for                                                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Sign in at `/admin`, create a lobby.                             | Live controls says _Connected to the room_.                                                |
| On the projector laptop open `/host`, connect, Present, press F. | Lobby with join code fills the screen.                                                     |
| Press Escape once while full screen.                             | Show stays up with _Full screen closed · F to return_; no join code or admin links appear. |
| Press F, then reload the projector tab.                          | It reconnects and presents again without the setup page.                                   |
| Leave the mouse still for a few seconds.                         | The _Projector setup_ button fades away.                                                   |
| Press Escape (not full screen).                                  | Projector setup appears. Present again.                                                    |

## 2. Phones join (10 minutes)

| Step                                              | Look for                                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------------------- |
| Join with a real iPhone and Android in portrait.  | _Connecting…_ briefly, then _In the lobby_.                                      |
| Try joining with an offensive nickname.           | _Choose a different nickname_. Ordinary names, Scunthorpe and the like are fine. |
| Rotate a phone sideways in the quiz lobby.        | _Rotate your phone_ appears (quiz is portrait).                                  |
| Add bots: room → Developer tools → _Set 10 bots_. | Bots join (allowed until the birthday game starts).                              |

## 3. Quiz rounds (20 minutes)

Use **Start the illustrative demo instead** for a rehearsal room (it asks first), or **Start birthday game** to rehearse the real order.

| Step                                                                      | Look for                                                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Start.                                                                    | Confirmation names the player count; nothing starts until you confirm.                      |
| Live desk during a question.                                              | _N of M connected players answered_, _Round X of Y · Next: …_.                              |
| On a phone, send a troll while the answer screen is open, then answer.    | The answer sends; the status says _Sending your troll._ first, then the answer is accepted. |
| A poll round (mock election or a trolley question in the birthday order). | Phones say _Just for fun_, not _No points this time_.                                       |
| Reload a phone mid-question, open Ranks.                                  | Last standings still there.                                                                 |
| Photo wall: send a photo, approve it, hide it.                            | Appears, then disappears from the stage.                                                    |
| Pause with P, wait 20 minutes, then press Resume.                         | Resume works; the live desk stays authorised.                                               |

## 4. Kart race (15 minutes)

Create a kart lobby (Admin → Kart → Create kart lobby) or reach `kart-sprint` in the birthday order.

| Step                                                               | Look for                                                          |
| ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Phones in the kart lobby, held sideways.                           | No rotate prompt; no nickname vote cloud.                         |
| Start kart race.                                                   | Confirmation first.                                               |
| Intro and prompt, phone sideways.                                  | Grid slot shown over the paused view.                             |
| End of prompt.                                                     | 3, 2, 1 on phones and projector, then GO; phones buzz on Android. |
| Drive with the steering strip and A.                               | Kart responds at once; no rubber-banding. Note any snapping.      |
| Live controls → Driving feel → Prediction _Off_, drive, then _On_. | Off feels delayed; On feels immediate. Both stay on the track.    |
| Pause during the race on a sideways phone.                         | _Paused — controls released_ over the driving view.               |
| Finish or time out.                                                | Finish card fits the screen; _+N points_ later.                   |
| Podium.                                                            | Phones show _See the full results_ in Ranks.                      |

## 5. Network and load (15 minutes)

| Step                                                                                       | Look for                                                  |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Turn the Wi-Fi access point off for 20 seconds mid-question, then on.                      | Phones reconnect without a reload and keep their answers. |
| From your laptop, `LOAD_SIZES=80 npm run load:realtime -w @26/api` (local) for comparison. | Around 4.7 race updates per second at 80 racers locally.  |
| Room → Health.                                                                             | No failed scheduler jobs; no overdue alarms.              |

## 6. Wrap up

| Step                                         | Look for                        |
| -------------------------------------------- | ------------------------------- |
| Finish the game, wait for the archive.       | Health shows the archive ready. |
| Results email to the staging test recipient. | Arrives once.                   |
| Public results link from a phone.            | Opens and shows the podium.     |

## Results table

| Section              | Device / browser | Pass? | Notes |
| -------------------- | ---------------- | ----- | ----- |
| 1 Room and projector |                  |       |       |
| 2 Phones join        |                  |       |       |
| 3 Quiz rounds        |                  |       |       |
| 4 Kart race          |                  |       |       |
| 5 Network and load   |                  |       |       |
| 6 Wrap up            |                  |       |       |

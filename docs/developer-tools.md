# Developer tools and live rehearsal

Start locally with `npm run dev`, sign in at `/admin` and use **Fresh rehearsal**
on Home or Rooms. Choose the demo or saved birthday running order, bot count,
answer pace, participation and runner settings. **Start fresh rehearsal** creates
an isolated room, opens the stage and starts the runner when its bots are connected.
The birthday order must already be playable; no draft or answer key is invented.
If creation times out, retry reuses the exact request and setup. Browsers that block
the stage popup can use **Open stage** after the room opens.

Save up to ten named setups in this browser, or load the 10/25/50/75/100 presets.
Deleting a setup removes only the browser preference. A fresh room has its own
frozen pack and never queues a post-game archive or email export. Guests joining
it are classified as test players.

You can also create an ordinary lobby and open **Developer tools** in that room
for bot-only tools. The direct address is
`/admin/rooms/<gameId>/developer`. The page uses the normal administrator and room
control credentials in every environment; it is available for an authorised live
rehearsal after deployment too.

1. Choose **Set 10 bots**. Wait for the connected count to reach ten.
2. Open the stage in another tab. **Start illustrative demo** and use **Advance
   beat** to reach collection, or let the ordinary room timers run.
3. Enable automatic answers, or press **Send answer burst**. Only a server
   acknowledgement counts as accepted. The normal room scoring applies.
4. Try 25, 50, 75 and then 100 bots. Presets set a total rather than adding that
   many again. Custom totals work too. The limit is **100 active players including
   real guests**, so reserve one place when testing with your own phone.
5. Pause answers independently of the game, lower participation, change response
   pace, disconnect/reconnect all bots, pause/resume the game and skip questions.
   Reconnect while collecting to exercise snapshot recovery and accepted-answer
   restoration. It starts a new measurement run.
6. Download the rehearsal report to compare runs. It contains room id, question
   id, population, settings and acknowledgement metrics, never credentials or an
   answer key. Measurements are in this tab's memory and are cleared on leaving.
7. Use **Remove all bots** when finished. Accepted answers, votes and scores are
   retained as rehearsal history; use a new room for a clean slate.

## Dedicated rehearsal controls

- **Run or continue show** uses the existing durable scheduler. Presentation beats
  and answering windows can be shortened. **Pause automatic show** pauses the game
  too. Enable **Pause at each reveal** for inspection, and continue when ready.
  Leaving the controller pauses an unattended runner; the planned host-loss
  scenario gets a short recovery window. Normal gameplay timers still apply; a rehearsal window is an advance target,
  not an extension beyond a question’s own deadline.
- **Jump and reset selected question** or **Repeat this question** starts a fresh
  attempt, clears only that question’s answers, votes and points and stops the
  runner. Other questions and the bounded diagnostic history remain. These
  commands refuse ordinary rooms; changing packs needs a fresh rehearsal.
- Failure scenarios disconnect 25% of bots, add one late bot, lose the host for
  five seconds, or arm unanswered bots to send 250 ms before the server deadline.
  Connections retry normally after the five-second outage. Disable automatic
  answers before collection when testing a deadline burst. Browser scheduling
  can make a near-deadline answer late; the server still decides acceptance.
- **Open test phone** creates a real generated guest using the actual phone
  renderer, in 320/390/430px or landscape sizes. **Show stage preview** puts the
  real stage alongside it. Close the previews to disconnect; adding another phone
  leaves the old test player’s history in the room. Keep a free player place.
  The launcher keeps the ordinary guest cookie separate; cookie-based upload and
  account recovery tools still require an ordinary second-browser guest session.
- The live timeline filters the latest 200 phase, host, connection, answer,
  scenario and check events. It contains outcomes and question ids, never answer
  bodies, keys or credentials. Reports include this history, settings and checks.
- Automatic checks flag duplicate score entries, overdue phases, missing eligible
  bot answers, failed reconnections and refused actions. **Stop on failed checks**
  pauses the runner. Count checks explicitly stay waiting for mechanics without a
  comparable submission count. They are diagnostic checks, not proof of gameplay
  correctness. Continuing starts a new refusal-check window.

Keep the Developer tools tab open. Navigating away stops its connections; the bot
records remain and are reconnectable on reopening. Background-tab throttling and
machine load affect generated traffic and measured reply times. A second active
developer tab takes over the same bot identities, following the ordinary newest
controller rule. Selecting another room changes this browser's room access.

Bots use individual random, game-scoped credentials through the existing guest
WebSocket client. Bootstrap is an authenticated, same-origin, non-cacheable POST;
only hashes persist. Secrets travel in the WebSocket protocol header, never URLs,
public snapshots, downloads or browser storage. Removing a bot revokes its
credentials and closes its connections. Population commands use the existing
host receipt/digest/transaction path. Count history is bounded to 20 entries and
is host-only. No new socket client, scoring engine, scheduler or service exists.

The planner reads only public guest fields. It covers single/multiple choices,
slider estimates, complete/partial rankings, sample text, Wordle guesses,
eligible votes and duel/finale answers/predictions. It obeys pause, host holds,
server eligibility and accepted answers; it does not know correct answers.
Wordle uses ordinary guesses rather than a solver. Bots are explicitly
`synthetic`: they participate in live gameplay but are excluded from personal
guest statistics, fun facts and the final guest archive. Their votes can still
affect real guests, so use a dedicated rehearsal room.

Optional kart traffic sends ordinary controls at 10 Hz and receives authoritative
race updates for up to 100 racers. Bots accelerate and steer; they do not navigate
the circuit intelligently. No 3D phone renderer runs for each bot. Graphics,
physical devices and venue Wi-Fi need a separate rehearsal.

For a repeatable local workerd fan-out measurement, use `npm run load:realtime`.
It now runs 10/25/50/75/100 guests, measures accepted answer bursts and kart
updates, and prints `LOAD-REALTIME` JSON. To choose a stage in PowerShell:

```powershell
$env:LOAD_SIZES = "25"
npm run load:realtime
Remove-Item Env:LOAD_SIZES
```

`LOAD_KART_MS` controls race measurement duration and `LOAD_INPUT_HZ` controls
input frequency (0–20). The harness uses explicit local adapters with external
database/email bindings cleared. Local results are not production capacity or
venue-network guarantees. No deployment is implied.

Browser checks use `playwright.dev.config.ts` with `LOCAL_DATABASE_ID=browser-checks`:
this explicitly uses temporary local auth and room storage. Normal `npm run dev`
keeps existing persistent rooms. Run builds before starting the browser-check
server; rebuilding generated kart assets while Vite watches them can hit Windows
file locks. No staging or production storage is changed by this test adapter.

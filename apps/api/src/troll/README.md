# Trolls

One token per guest for the whole game. It unlocks on the second question. Spending the token and accepting the effect are one stored action. The same request returns that result. A different request cannot spend a second token.

Each target has one transient slot and one persistent slot. A second effect for a full slot waits. A third is rejected and does not spend the token. A waiting effect that cannot start before its phase ends expires, and its token is refunded once. An effect that already started is not refunded. Pause freezes the effect timer with the other gameplay timers. Skip and advance settle effects whose phase has ended. The host can cancel a running troll. Reconnecting reads the stored effect and does not start it again.

Stage announcements wait in one short queue of three. A further announcement is dropped. The host can dismiss the announcement that is showing. Demo cues carry a label and, when they have sound, a short file or an accepted voice clip.

Presentation effects do not change the player id or the score ledger. A nickname swap changes the name on screen only. Hidden score hides that phone's own points. The answers keep their ids. A dodging button can be stopped with Answer anyway, and it settles after at most three seconds. While it is active, a question that sets `suppressSpeedBonus` awards no speed points.

`double` is the only score modifier. It runs after the question's own points, only when that question lists `modifiers: ["double"]`, and only for an accepted double that is still active. A positive award is doubled. A zero award stays zero. Host adjustments are separate and are not doubled.

## Stage sound

The stage has Enable sound, Mute stage, and Stop cue. Browsers will not play audio until Enable sound runs from a click on that screen. A refresh asks again. Mute is remembered for the tab. Stop cue silences the current cue.

Entertainment audio is not exactly-once if the browser crashes. A cue that is already on screen when the stage loads, already played, muted, or left over from an earlier question is dropped. A cue that arrives while sound is locked waits for Enable sound, then plays once. The played cue id is stored in the tab. Score changes and the troll token stay exactly-once in the room.

Live typing keeps only the latest draft, in memory, and only the stage snapshot includes it. Closing the phone, hiding it, changing phase, or restarting the room clears that draft. The sent answer is still the normal stored answer. The effect is offered only when the question's attribution is `live`.

A voice troll records on the phone, plays a preview, and can be recorded again. The clip is checked through the media pipeline, then held until that question's reveal. Skipping the question drops it. A missing microphone does not spend the token and does not block the question.

A theme song uses the persistent slot and keeps going across questions until the podium, or until four score cues have been queued. Each scores phase queues one sting. The cue id is stored, so a reconnect does not treat an old reveal as a new one. Pause and resume keep the same cue id.

Replace the sting by putting a short PCM WAV at `apps/web/public/assets/demo-sting.wav`. Keep it under about three seconds. The label in the catalogue is `Demo sting`.

## Implemented

| Effect            | Slot       | What the guest sees                                                    |
| ----------------- | ---------- | ---------------------------------------------------------------------- |
| Screen invasion   | Transient  | A labelled demo face the target can dismiss                            |
| Call from Mum     | Transient  | A labelled incoming call the target can decline                        |
| Cracked screen    | Transient  | A labelled crack the target can dismiss                                |
| Dodging button    | Transient  | The send button moves for at most three seconds, with Answer anyway    |
| Nickname swap     | Transient  | The two names trade places on screen                                   |
| Hidden score      | Transient  | The target's own points are hidden, with Show my score                 |
| Double or nothing | Persistent | The target's award for that question is doubled, or stays zero         |
| Live typing       | Transient  | One stage draft at a time, only on a live-attribution question         |
| Voice clip        | Persistent | A checked clip of at most 3 seconds, played on the stage at the reveal |
| Theme song        | Persistent | A short sting on that player's later score reveals                     |
| Sponsor break     | Transient  | A caption card on the stage                                            |

Captioned photos use the same cue card. An accepted photo can show there with the caption `Photo from` the nickname. The illustrative colour question allows double or nothing. The illustrative candles question suppresses speed points while the button is dodging, and its attribution is `live`, so live typing is offered there.

## Candidates

These stay in the catalogue and are rejected if a phone asks for them. They are not implemented.

| Group              | Not built                                                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fake system chrome | Screen-recording banner, 1% battery, update prompt, recurring AirDrop, overheating warning, fake answer viewers, endless typing indicator                                        |
| Input sabotage     | Inverted or drifting slider, reshuffled options, reverse typing, comic autocorrect, short character limit, Comic Sans, mirrored or upside-down text, translated options, haptics |
| Stage theatre      | Replay of a bad answer, speech, fake departure, zoomed photo                                                                                                                     |
| Identity           | Temporary nickname, Guest 14, fake last place                                                                                                                                    |
| Scoring            | Misattributed answer, public vote, shared round score, steal points, redirect points                                                                                             |

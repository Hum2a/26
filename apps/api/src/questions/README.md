# Questions

[Home](../../../../README.md) · [Documentation](../../../../docs/README.md) · [Event runbook](../../../../docs/event-runbook.md)

Questions are versioned TypeScript. There is no CMS and no client-side pack. The authoring workflow is [docs/question-authoring.md](../../../../docs/question-authoring.md).

| Path                                                               | What it holds                                                             |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `definition.ts`                                                    | Question types, missing requirements, and the answer wrapper              |
| `defaults.ts`                                                      | Ordinary defaults used when a setting is omitted                          |
| `authoring.ts`                                                     | Helpers for the seven existing mechanics                                  |
| `registry.ts`                                                      | Resolves a room's stored version to one pack                              |
| `validate.ts`                                                      | Content checks. `preflight.ts` re-exports them                            |
| `project.ts`                                                       | Public fields, and the split between guest, stage, and control            |
| `presentation.ts`                                                  | Presentation ids the server will accept. `standard` is the only one       |
| `packs/demo/`                                                      | One file per illustrative question, plus `manifest.ts`                    |
| `packs/birthday/manifest.ts`                                       | Humza's catalogue. Empty, and not pinned to a room                        |
| `demo-set.ts`                                                      | Re-exports the demo pack and the shared types                             |
| `kart/` `chess/` `wordle/`                                         | Heavy-round Worker runtime (Wordle dictionary under `wordle/dictionary/`) |
| `multiple-choice.ts`, `slider.ts`, `rank.ts`, `vote.ts`, `duel.ts` | Scoring and phases. They do not own the question text                     |

A room plays the pack named by its stored `question_set_version`. `demo-2026-09-22` is the illustrative pack. `unreleased` is the lobby. `birthday-draft` is not playable. An unknown version is unavailable and is not replaced with the demo pack.

Correct answers stay in the question file. A public snapshot adds `reveal.correctOptionId` only in reveal, scores, final, and podium. Presenter notes are control-only. A reveal explanation is sent only after scoring. The private marker `demo-answer-key-v1` must not appear in guest JavaScript or in any snapshot. `standard` presentation uses the existing phone and stage components.

`multiple-choice.ts` is the first round contract: public question shape, submission check, phases, and server-only scoring. Phone and stage components render the public snapshot. They do not score.

Collection windows are 15 to 45 seconds, set per question. Points are per question. There is no universal floor and no automatic round multiplier.

Speed bonus, when a question sets one, uses the server receipt:

`bonus = floor(maxPoints * max(0, deadlineAt - receivedAt) / collectMs)`

`receivedAt` is the Durable Object clock when the answer row is inserted. `deadlineAt` is the collect job's due time read in that same transaction. The phone does not send a timestamp.

`choice_answer` stores one accepted option per player per question. `score_ledger` has one row per player per question. Entering reveal inserts those rows. A later reveal uses `INSERT OR IGNORE`, so it cannot score again.

Each demo question carries an attribution mode: `after` names choices at the reveal, `never` leaves the public reveal unnamed, and `live` shows a count plus a short rolling sample of names while answers arrive. The mode can be public. Another player's option is omitted from guest and stage snapshots until that mode allows the name. The host snapshot can still list who chose what. Hiding the stage removes the question, the reveal, and those names from the stage payload.

Later voting, effects, and device context add records beside these. They do not replace the ledger or the socket client.

<details>
<summary>On this page</summary>

- [Slider questions](#slider-questions)
- [Ranking questions](#ranking-questions)
- [Answer-and-vote](#answer-and-vote)
- [Guess-the-guest](#guess-the-guest)
- [Duels](#duels)
- [Spectated finale](#spectated-finale)

</details>

## Slider questions

A slider question sets `minimum`, `maximum`, `step`, `unit`, `initial`, `truth`, and `bands`. Bounds, step, initial value, and truth are finite. The range is wider than zero. The step is greater than zero and lands on both ends. Initial value and truth sit on that scale.

`truth` and `bands` stay in this module. A public snapshot sends the scale and the initial value. It sends the truth only at the reveal.

The phone starts at `initial` and does not store it. A guest sends the current number with an estimate command. Sending the untouched initial value is an answer. Reconnecting does not send it again.

An accepted value is a finite number inside the range and on the step. Anything else is rejected, including a string, `null`, a non-finite number, or a value off the step.

Scoring uses the question's own bands. The narrowest band whose `within` is greater than or equal to the absolute distance wins, and a distance equal to `within` is included. No matching band scores 0 with detail `miss`. A missing submission scores 0 with detail `missing`. An exact band uses detail `exact`; any other match uses `within-<distance>`. Band points are integers from 0 to that question's `points`. The award cannot be negative and is not scaled onto a global 0–1000 range. The 1000 limit is only the existing per-question transport cap.

`round_response` stores one slider payload per player per question. The score ledger is still written once, on entering reveal, with `INSERT OR IGNORE`.

The illustrative slider is `letters`: 0 to 20 letters, step 1, initial 10, truth 8, 100 points for an exact answer and 40 points within 2.

## Ranking questions

A ranking question sets stable item ids, position ids, `mode` (`complete` or `partial`), `ties` (`forbidden` or `shared`), and `truth`. Item ids and position ids are unique. Truth lists every item once. When ties are forbidden, each truth group holds one item and the question needs a position per item for a complete response.

List `tiers` from best to worst. Truth groups use that same direction: the first group is best. The public item list is a display order and is not the answer. Truth stays server-side until the reveal.

The phone selects an item, then a position. It does not use drag-and-drop. Complete mode requires every item once. Partial mode requires at least one placement. Forbidden ties reject a repeated position. Shared ties allow one. Duplicate items, unknown items, unknown positions, and a non-array payload are rejected.

Scoring is pairwise and stays inside 0 and that question's `points`:

`points = floor(question.points * concordant strict pairs / strict truth pairs)`

A strict truth pair is two items whose truth groups differ. A guest pair is concordant when those items have the same order. A guest tie scores 0 for that pair and does not subtract anything else. A truth tie is not a pair, so it is left out of the denominator. An unplaced item is not concordant, and partial mode still counts every strict truth pair, so placing only some items cannot earn full marks. If the truth has no strict pair, any accepted submission scores that question's own points with detail `unordered`. A missing submission scores 0. An identical complete ranking scores full points. A fully reversed ranking scores 0. One adjacent swap of four items is `floor(points * 5/6)`.

`round_response` stores the placements. Reveal writes the ledger once and a later reveal does not change it.

The illustrative ranking is `lineup`: complete, ties forbidden, display order Cake, Candles, Song, Friends, truth Friends, Cake, Song, Candles, 80 points.

## Answer-and-vote

There are no pods and no voting groups. Every eligible guest votes in one room-wide tally.

An answer-and-vote question sets `candidateMode` (`all` or `shortlist`), `selfVote` (`forbidden` or `allowed`), `votes` (1), `tie` (`shared`), `award` (`authors` or `voters`), and `lateJoin` (`ineligible`). The defaults are no self-voting, one accepted vote, and shared tie awards. A question that says otherwise must say so in those fields. `votes` other than 1, or a tie rule other than `shared`, is rejected when the set loads.

`all` puts every submitted line on the ballot. `shortlist` puts on only the authors the host includes during collection, before the ballot freezes. An empty shortlist stays empty. Lines are not dropped and a shortlist is not invented. The host still sees every line. Including or removing a line after the freeze is rejected.

Phases are intro, prompt, collect, vote, reveal, and scores. Text is accepted only during collect. A ballot is accepted only during vote. One text row and one ballot row are stored per player. A repeated ballot is rejected. The receipt is written before the acknowledgement.

At the start of vote the eligible set freezes. Each active player becomes an elector and receives one shuffled card order, stored for that player. Reconnecting reads that order and does not shuffle again. A player who joins after the freeze is not an elector and cannot vote. A kicked or withdrawn author stays on the stored order so cards do not jump, becomes unselectable, and new ballots for that candidate are rejected. Ballots already stored for that candidate stay in the table and do not count toward the winning tally. A candidate id that was not frozen is rejected. Written answers use a random candidate id. They are not player ids.

Each tied winner receives that question's full points. The award is not split and is not given to only one of the tied candidates. `authors` pays the writer of a winning line. `voters` pays a player whose ballot names a winner. No winning line, or a voter with no ballot, scores 0 with detail `missing`. A player who took part and did not win scores 0 with detail `miss`. `award` is never `none` on a vote question.

Attribution `never` leaves authors and voter names off public cards and the reveal. `after` shows them only once the question is scored. `live` shows them during collect and vote, and again once scored. The host snapshot keeps the association in every mode. The private answer key must not appear in a public payload.

The projector shows at most eight cards. A longer ballot keeps the full count and leaves the names on the phones. A host can feature up to eight included candidates during vote, reveal, or scores. That selection changes the stage list only. Scores use every counting vote.

The illustrative questions are `toast` (every line, attribution after, 60 points) and `picks` (host shortlist, attribution never, 40 points).

## Guess-the-guest

A guess question has no vote phase. The ballot is the pick, and it is accepted during collect. `roster` is `room` or `shortlist`. A room roster is the whole active room at the freeze, stored as candidate ids equal to the real player ids, with the nicknames frozen as labels. A shortlist is the question's own names. A missing player stays on the list with a stable id and cannot be voted for. Search filters the phone list and does not reorder it.

`scoring` is `named`, `majority`, or `none`. Majority is optional and is not assumed. `named` needs a server-only `truthNickname`, resolved to a player id at the freeze and omitted from every public payload until the reveal's `truthLabel`. A correct minority guess scores and a larger wrong vote does not. `majority` pays the voters on the highest tied count. `none` pays nobody. The award goes to voters, except for `none`. The subject does not receive points unless that player also voted for a winner. Self-voting, late join, ties, and withdrawn candidates use the same rules as answer-and-vote.

The illustrative guess is `who`: the whole room, named scoring, attribution after, 80 points. The server-only subject is Bilal.

## Duels

A duel is one shuffled set of 1v1 pairs for the players who are active when the question opens. The pairs are stored. A reconnect, a rename, or an eviction does not shuffle them again. There are no pods.

`odd` is `solo`. The last player after the seeded shuffle faces the question's numeric target alone. That player is named on the phone and on the stage. They are not dropped. Any other odd-player rule is rejected when the set loads.

`absence` is `forfeit`. When the collect deadline ends, or the host advances, a missing answer loses to any submitted answer. Two missing answers score 0 with detail `missing`. The pair resolves at the phase boundary. The room does not wait for a disconnected opponent. A player who is kicked before scoring is treated as missing for that duel. The stored number stays available to the host.

`tie` is `shared`. Equal distance to the target pays the question's full points to both players, detail `tie`. Receipt time does not break that tie. The other player scores 0 with detail `miss`. Points are never negative, and there is no universal winner or loser award.

`lateJoin` is `ineligible`. A player who joins after the pairs freeze is not added to a pair and cannot submit. If they are still active at the reveal they receive a ledger row of 0.

A solo player scores the question's full points when their number is within `within` of `target`, inclusive. Otherwise they score 0. `within` is public. The target is public because both players are aiming at it.

The stage reveal is one phase. It shows at most eight pair results and keeps the full pair count. Scores include every pair.

## Spectated finale

A finale names two contestants. Those nicknames are resolved, case-insensitively, when the question opens. A contestant who is absent is not replaced. Two present contestants form one pair. One present contestant faces the target alone. None present means there is no pair. Every other active player at the freeze is a spectator.

Spectators back one present contestant during `predict`, which sits between prompt and collect. Predictions close before contestants submit, so the outcome is not knowable yet. A contestant cannot predict. One prediction is stored. A repeated prediction is rejected. A candidate who is not a present contestant is rejected.

Contestants are scored by the duel rules and receive the question's `points`. A spectator who backed a contestant with points above 0 receives that question's `predictionPoints`. If the duel ties, a prediction for either contestant scores. If nobody scores, spectators score 0 with detail `missing`. A wrong pick scores 0 with detail `miss`. No prediction scores 0 with detail `missing`. Each player has one ledger row. Revealing again does not insert another.

`tieBreak` is `off` or `tied`. `off` always plays. `tied` plays only when at least two active players share the highest score, including host adjustments. A unique leader skips the question. Finish-after-the-current-round still ends the game on the question in progress and does not open a later tie-break.

Attribution `after` shows prediction backers only once the question is scored. `live` can show them during predict and collect as well. `never` leaves them off the public reveal. The host snapshot keeps each number and each backing in every mode. The stage list stays capped at eight.

The illustrative duel is `clash`: target 26, within 2, scale 0 to 50, 50 points, odd solo, tie shared, absence forfeit, late join ineligible, tie-break off. The illustrative finale is `finale`: the same scale and target, 70 points for the contestants, 30 prediction points, a 20 second prediction window, contestants Amina and Bilal, and tie-break `tied`. Both prompts are illustrative.

A question lists `modifiers` when it allows a score-changing troll. The only implemented modifier is `double`. It is applied after the question's own points. `suppressSpeedBonus` removes speed points while a dodging-button troll is active for that player. Questions that omit these fields are unchanged. The implemented and candidate trolls are listed in [apps/api/src/troll/README.md](../troll/README.md).

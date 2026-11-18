# Factual statistics

[Home](../../../../README.md) · [Documentation](../../../../docs/README.md) · [Event runbook](../../../../docs/event-runbook.md)

Facts are calculated before any sentence. A card may only repeat numbers that already sit on its fact: the numerator, the denominator, the unknown count, or a named part.

`client_class` decides who counts. `guest` counts. `host`, `test`, and `synthetic` do not. Demo-cloud names are synthetic. A transferred player stays one guest.

Game-wide device counts use the first participating context. Question comparisons use the context stored on the accepted response. A missing context is unknown. Screen groups use `screenGroupVersion` 1 and a short edge of 700 CSS pixels. That cutoff is not chosen from the results, and it is not a size in inches.

Percentage comparisons need at least 5 players or accepted responses in each group being compared. Smaller groups keep the counts and are marked suppressed. The stage shows eligible cards at the podium. The admin screen previews eligible and suppressed highlights. A personal recap is only on that guest's snapshot.

"Most people who chose an answer had joined on an iPhone" is a composition of that answer. "iPhone players were more likely to choose it" is a within-group rate against the other classified players. Each sentence is emitted only when its own sum supports it.

There is no model call. `factsForWording` is the only record a future wording pass may see. The deterministic cards are already complete.

The end-of-night facts beat is a separate catalogue in `fun-facts.ts`. It uses each guest's latest device report, and it does not change the highlight rules or the group of 5. A sentence may only repeat a numerator, denominator, percent or part count stored on its fact. The room shows one card at a time. The archive freezes those sentences, so they remain after detailed device rows are removed.

## Answer trends

After each reveal the projector rotates cards on how groups answered that question, and each phone gets a few lines on how its guest compared. The pure engine is `packages/shared/src/trends/trend-engine.ts`; `trend-source.ts` reads one question into its input (every mechanic: choice, multiple, push, typed, slider, rank, vote, guess, wordle, chess, kart, duel, finale), `trend-room.ts` caches the analysis in memory per question and builds the stage, guest and host fields, and `trend-settings.ts` holds the host's switches and hidden cards. Facets cover devices (platform, browser, dark mode, iOS version, screen size and sharpness, language, time zone, connection, dropouts, memory, reduced motion, orientation, data saver) and behaviour (speed, last-second answers, table position, arrival order, trolls sent and received, photo-sharing, profile photos, last-question streak, name length). A comparison needs three guests on each side (`trendMinimumGroup`), lower than the podium's five because these are playful asides. Device and behaviour cards never name anyone.

Illustrative demo rooms label their cards `Illustrative`. An empty room does not borrow sample numbers.

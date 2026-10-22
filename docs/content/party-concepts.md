# Party mini-game concepts — completed 20 October 2026

[Home](../../README.md) · [Documentation](../README.md) · [Event runbook](../event-runbook.md)

All fifteen entries from the supplied mini-game concepts are now ready, alongside the ten sourced Who Said It replacements. They remain in the unreleased `birthday-draft` catalogue, outside the running order.

| Id                                 | Implemented mechanic                           | Status / reference                                                                                                                                         |
| ---------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `guess-tab-oyster`                 | Numeric price, closest without going over      | Ready: adult peak TfL default route, Sutton → Oxford Circus, October 2026.                                                                                 |
| `guess-tab-car-insurance`          | Numeric price, closest without going over      | Ready: explicitly defined Go.Compare June 2026 median for newly qualified drivers aged 25+. This clarifies the unavailable exact-age/first-policy average. |
| `guess-tab-soho-pint`              | Numeric price, closest without going over      | Ready: standard Camden Hells pint at The Roxy, menu checked October 2026.                                                                                  |
| `guess-tab-ev-charge`              | Numeric price, closest without going over      | Ready: 62 kWh at the explicit Jan–Mar 2026 Ofgem rate; energy only, losses excluded.                                                                       |
| `ai-turing-test`                   | Three-choice real take versus generated decoys | Ready: a genuine earlier user message from this game's planning conversation. No invented personal belief or 2 AM argument.                                |
| `heathrow-search-query`            | Blind writing, then a staged 1v1 knockout      | Ready: persistent seeded bracket, byes, tie rule, no self-votes and final author award.                                                                    |
| `rank-driving-sins`                | Accessible drag order, room-consensus scoring  | Ready: pointer handles plus explicit move buttons. Mean positions produce the target; ties remain ties.                                                    |
| `subculture-cheese-rollers`        | Choice: Real/Made up                           | Ready: real activity, not a claim that “The Rollers” is a formal club name.                                                                                |
| `subculture-gurners`               | Choice: Real/Made up                           | Ready: real Cumbria activity.                                                                                                                              |
| `subculture-puddle-stompers`       | Choice: Real/Made up                           | Ready: user-supplied fiction.                                                                                                                              |
| `subculture-ranters-muggletonians` | Choice: Real/Made up                           | Ready: historical names, without claiming one coherent organised Ranter sect.                                                                              |
| `dating-exit-excuse`               | One writing phase, three award ballots         | Ready: Most Smooth, Most Brutal and Instantly Causes a Scene; independent category winners.                                                                |
| `dial-pop-culture`                 | Slider, room-median precision                  | Ready: supplied endpoints, no invented Humza position.                                                                                                     |
| `dial-london-geography`            | Slider, room-median precision                  | Ready: supplied endpoints, no invented Humza position.                                                                                                     |
| `dial-british-politics`            | Slider, room-median precision                  | Ready: supplied endpoints, no invented Humza position.                                                                                                     |

[Completion sources, scoring and material wording decisions](party-polish-sources.md) explain the price references, genuine Humza source, scoring schedules and persistent ballot flow. [Who Said It source audit](who-said-it-sources.md) records all ten verified replacements. The introductory “True equality…” example was not added as an eleventh round.

## Subculture references

- Cheese rolling: [the event's media page](https://www.cheese-rolling.co.uk/media_press.html).
- Gurning: [Egremont Crab Fair organiser history](https://egremontcrabfair.com/history.html).
- Muggletonians: [British Library manuscript catalogue](https://searcharchives.bl.uk/?q=036-001998704&sort=relevance). Ranters: [Ariel Hessayon's historical research](https://arielhessayon.substack.com/p/the-ranters-part-two), including the difficulty of treating them as one coherent sect.
- Puddle-Stompers was explicitly supplied as fiction, not a claim to have disproved every similarly named activity worldwide.

## Rehearsal and release

Admin → Question packs → Birthday shows each entry individually, with the real guest renderer. Price fields, multiple selections, ordering, passwords and dials are interactive. Choose **Voting (vote rounds)** for the writing/voting questions; **Next rehearsal ballot** advances clearly labelled stand-in matches/categories without grading, live sockets, scores or persistence. Actual answers and future reveals stay out of preview payloads.

The catalogue can exceed forty entries. Unordered isolated rehearsals show `1 / 1`; an ordered question retains its running-order position. The live-order limit remains forty. Completion does not release a pack, change the demo, mutate a live room or deploy an update.

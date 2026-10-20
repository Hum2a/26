# Draft completion reference notes — 20 October 2026

The current pass implements the real missing interactions, with explicit deterministic scoring and frozen room results. Ready means the question can use those interactions; it does not release the birthday pack or add anything to its running order.

## Guess the Tab

- **`guess-tab-oyster`: £8.80.** [TfL's live FareTo response](https://api.tfl.gov.uk/StopPoint/910GSUTTON/FareTo/940GZZLUOXC), retrieved 20 October 2026, lists the adult peak PAYG **default route** Sutton (London) Rail Station → Oxford Circus Underground Station at £8.80. Effective date fields span July 2026 to July 2027. The alternative interchange route is £7.70 and is excluded by the prompt. Sutton is not itself a Tube station. This is a frozen reference question, not a live fare quotation service.
- **`guess-tab-soho-pint`: £7.30.** [The Roxy's own food/drink menu](https://www.theroxy.co.uk/food-and-drink), checked 20 October 2026: Camden Hells standard pint £7.30. Half-pint and happy-hour offers are different products/prices. The prompt names this Soho bar so there is one checkable answer instead of a fictitious London-wide price.
- **`guess-tab-ev-charge`: £17.17.** [Ofgem's Jan–Mar 2026 cap announcement](https://www.ofgem.gov.uk/news/changes-energy-price-cap-between-1-january-and-31-march-2026) gives the GB average direct-debit electricity unit rate, including VAT, of 27.69p/kWh. The question explicitly freezes that quarter. Calculation: 62 × 0.2769 = £17.1678, rounded to £17.17. Ideal charging efficiency is assumed; standing charges and losses are excluded in reveal/notes. This is a defined energy-only calculation, not an individual tariff quote.
- **`guess-tab-car-insurance`: £1,002.** [Go.Compare's age/experience table and footnote 7](https://www.gocompare.com/car-insurance/), indexed June 2026 sales data checked 20 October: the median annual premium for newly qualified drivers aged 25+, full UK licence held less than a year, all cover types, paid annually. **Editorial clarification:** the supplied exact-age-25/first-policy average was not available; the question now explicitly asks about this measured 25+ cohort. It does not mislabel a general driver average as an exact first-policy quote. The direct page sometimes serves a bot-interruption screen; the provider's indexed original page includes the table and methodology.

All four use decimal pound entry, not a slider pretending to be a blind numerical bid. Bounds are UI limits, not answer clues or estimates. The highest accepted eligible guess at or below the target wins 100 points; exact ties share the win; if every guess is too high, no one scores. No speed bonus. Targets stay server-side until reveal.

## Crowd rounds

- Passwords match after Unicode NFKC normalisation, lowercasing, trimming and collapsing runs of whitespace. Group frequency determines dense rank. Unique entries get zero; matched entries score `round(100 × (groupSize − 1) / (largestGroup − 1))`. All unique means zero for everyone. This fulfils the user's matching-other-guests decision; no real-password dataset is involved.
- The Christianity question uses the user's confirmed three-answer set with exact-set scoring, not partial credit for choosing everything.
- Driving severity uses room consensus, interpreted as mean submitted item positions. Equal means stay tied in the target; the existing pair-agreement scoring ignores tied target pairs. Maximum 80 points. This avoids inventing a personal Humza order.
- Dial-In uses the median of accepted eligible positions. Maximum 100 points, reduced by absolute distance as a fraction of the 0–100 scale. No personal opinion is attributed to Humza. The initial 50 is only a control starting position.
- Dating: one 30-second submission, then three independent 20-second award ballots over the same entries. 60 points per winning category, up to 180 per writer. Ties share each category win; no self-votes; no ballots means no award.
- Heathrow: one 30-second submission, then one blind 1v1 on stage/phones per 15-second knockout ballot. Random seeding and byes are frozen before voting; a tied match follows that frozen draw. The winning author receives 60 points. No votes throughout the bracket means no prize. No self-votes. Large rooms produce more matches; the host can advance each beat. This is fictional comedy, not a claim about actual border-screening rules.

Room settlements and ballot progress persist in the existing room SQLite store. Repeated score execution does not duplicate ledger awards. Ballot epochs distinguish subsequent matches/categories and reject stale retries. The existing scheduler remains the only alarm owner.

## AI Turing Test

`ai-turing-test` uses a real instruction already supplied by Humza in this conversation: “We dont need completely matching fields, everything can have its own identity”. The answer is its exact closing clause, capitalised and punctuated for an option. The same-layout and stage-only options are newly generated decoys. The displayed prompt asks what he wrote while planning this game; it does not invent a 2 AM/45-minute argument. None of the earlier car/anime/scooter examples is claimed as a genuine personal opinion. This finishes the concept from a real supplied message without waiting for a new personal anecdote.

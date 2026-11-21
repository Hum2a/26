# Ed or Humza?

One round: guests assign every quote to Ed, Humza or Neither on their phones,
then send the complete list. Picks can be changed before submission. Correct
assignments earn a proportional share of 80 points, rounded down. The window is
two minutes, with no speed bonus.

The 18 supplied quotes live in
`apps/api/src/questions/packs/birthday/ed-or-humza.ts`. Speakers were confirmed
on 19 November 2026. The round is **ready** and is in the birthday running order
(`ed-or-humza`). Humza can still move it in Admin → Running order.

The phone uses the `ed-or-humza` presentation: one quote at a time (card stack),
Ed / Humza / Neither tap targets, optional swipe for Ed and Humza, undo, and a
compact pile to move quotes back. Admin → Question packs → Ed or Humza? → Phone
preview runs that layout with the real quote list. `/design?q=ed-or-humza` uses
invented stand-in lines, never the party quotes or speakers. Rehearsal never
awards points.

## Speakers

In `edOrHumzaQuotes`, each entry has `speaker: "ed"`, `speaker: "humza"` or
`speaker: "neither"`. The server derives its private answer key from that list.
No supplied quote is marked Neither yet; the third bucket is there so Humza can
mark one later. Existing rooms keep their frozen question script.

This follows the existing versioned TypeScript content workflow; there is no new
CMS or browser answer-key editor.

## Add more quotes

Append an entry with a new stable id, its exact `quote` text, and `speaker:
"ed"`, `"humza"` or `"neither"` (or `null` while unconfirmed — any null returns
the question to draft). Do not renumber existing ids. Controls, progress,
completeness checks and proportional scoring use the list length automatically.
The supported bound is 40 quotes, each at most 300 characters; increase the
answer window if needed, up to three minutes. The card stack only shows the next
unsorted quote, so a longer list does not pile up on a small phone. The primary
send action stays in the existing dock.

Only quote text and the Ed / Humza / Neither labels reach phones before reveal. Speaker
assignments stay server-side until the normal reveal. Guests restore their own
accepted list on reconnect; they do not receive other guests' full lists. The
stage shows progress while answering and groups quotes by speaker at reveal.
Live controls retain the existing pause/advance/end actions and show bounded
per-guest assignment counts.

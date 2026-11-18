# Ed or Humza?

One round: guests assign every quote to Ed or Humza on their phones, then send the complete list. Picks can be changed before submission. Correct assignments earn a proportional share of 80 points, rounded down. The default window is two minutes, with no speed bonus.

The 18 supplied quotes are preserved in `apps/api/src/questions/packs/birthday/ed-or-humza.ts`. No speaker has been assumed. It is registered as `ed-or-humza` in the birthday catalogue, remains a draft, and is absent from the running order. The phone uses the `ed-or-humza` presentation: one quote at a time (card stack), Ed/Humza tap targets, optional swipe, undo, and a compact pile to move quotes back. Admin → Question packs → Ed or Humza? → Phone preview runs that layout with the real quote list even while the answer key is incomplete. `/design?q=ed-or-humza` uses invented stand-in lines, never the party quotes or speakers. Rehearsal never awards points or makes up speakers.

## Assign speakers later

In `edOrHumzaQuotes`, change each entry's `speaker: null` to `speaker: "ed"` or `speaker: "humza"` after confirmation. The server derives its private answer key from that list. Any null keeps the question a draft. Once all entries are assigned and content validates, it becomes ready; adding it to the running order is a separate explicit action. Existing rooms keep their frozen question script.

This follows the existing versioned TypeScript content workflow; there is no new CMS or browser answer-key editor.

## Add more quotes

Append an entry with a new stable id, its exact `quote` text, and `speaker: null` (or its confirmed speaker). Do not renumber existing ids. Controls, progress, completeness checks and proportional scoring use the list length automatically. The supported bound is 40 quotes, each at most 300 characters; increase the answer window if needed, up to three minutes. The card stack only shows the next unsorted quote, so a longer list does not pile up on a small phone. The primary send action stays in the existing dock.

Only quote text and the Ed/Humza labels reach phones before reveal. Speaker assignments stay server-side until the normal reveal. Guests restore their own accepted list on reconnect; they do not receive other guests' full lists. The stage shows progress while answering and groups quotes by speaker at reveal. Live controls retain the existing pause/advance/end actions and show bounded per-guest assignment counts.

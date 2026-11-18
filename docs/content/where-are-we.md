# Where are we?

Map-guess round: guests study a clue photo, drop one pin, and send it. Scoring is still the shared map-guess curve (100 at the spot, half at about 693 km). The birthday file `apps/api/src/questions/packs/birthday/where-are-we.ts` stays a **draft** until the owner supplies:

1. A credited clue photo as required `question` media (neutral filename, GPS stripped, credit that does not name the place).
2. `target.known` with the real `{ lat, lng, label }`.
3. Optional reveal explanation for Baseer.

Do not invent the location. The design bench at `/design?q=where-are-we` uses the demo night-sky photo and a labelled stand-in harbour. Admin → Question packs → Where are we? → Phone preview uses the live guest layout; the photo is missing until the owner adds it.

The custom presentation `where-are-we` is phone + projector chrome only. It does not change scoring, timers, or snapshots.

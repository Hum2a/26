---
description: Full-screen party questions, clear phone actions and presentation flow
trigger: glob
globs:
  - apps/web/**/*.tsx
  - apps/web/**/*.css
  - apps/api/src/questions/**/*.ts
  - docs/question-authoring.md
---

# Question experience

- This is a hosted Kahoot/Jackbox-style party game: Baseer presents, Humza advances the show, guests act on their phones. Design each round as a short presentation with get-ready, answer, sending, locked-in, reveal and score beats. The server owns when each beat occurs.
- Phone questions occupy the usable screen, with one unmistakable instruction, the question and generous answer controls. Keep the primary send action in the existing phone dock. Use the shared `QuestionExperience` frame and real `GuestPlay` renderer; bespoke designs keep their own identity inside that frame.
- Make the next action explicit: “Pick one, then send”, “Slide to your estimate”, or “Locked in — watch the stage”. Clearly distinguish selected, sending and server-accepted answers. Do not label an optimistic selection accepted in a live game.
- Use deliberate space and large type. Ordinary two-to-six-option questions should fit a phone screen; long ballots, long wording, keyboard entry and enlarged text may scroll vertically. Never clip an answer or shrink essential text just to fit. Check 320, 390 and 430px widths, a short landscape viewport, safe areas and zoom.
- Keep photo, sound, recovery and troll-selection tools secondary. Incoming troll notices and escape controls remain visible. Do not make these tools compete with the question or send button.
- Each question can have its own composition, motif and interaction treatment. Do not force every design into the same card grid. Reuse shared controls, theme variables, presentation registry and mechanics; never fork the socket, score engine or scheduler for a visual.
- Animate every meaningful change: question/phase entry, option selection, input feedback, submission, waiting, reveal, score and list/layout changes. Use Motion and the existing motion kit with eased timing, springs and short staggered entrances. Keep options stable and usable while the clock runs; decorative animation must not delay an action, cover text or leave an outgoing phase interactive.
- Respect reduced motion with short opacity/colour fades, no loops, parallax or travel. Never gate meaning on animation, sound or colour alone. Keep audio optional and stage wording readable across a room.
- Admin Question packs and individual question pages must offer a phone rehearsal using the actual guest renderer and server-projected public question fields. A rehearsal is isolated: no live room, socket, score, persistence or fabricated answer key. Label stand-in players, incomplete drafts and unsupported mechanics. Do not invent slider bounds or pretend a placeholder is the finished mechanic.
- When customising a question, verify its get-ready, answering, selected, pending, accepted, paused and reveal states in the admin preview/design bench and meaningful tests. Keep answer keys, notes and future reveals out of preview payloads. Add private admin details only to their existing authenticated inspection route.

# Stage

Projector shell for `/host`.

| File             | Purpose                                                                            |
| ---------------- | ---------------------------------------------------------------------------------- |
| `stage-page.tsx` | Join code, name cloud, QR, the question, the countdown, the reveal, and the podium |

The question text comes from the public snapshot. The lobby shows the join code at stage size, the name cloud, the QR code, and the short join address. During a quiz it keeps a compact code and the player count. Prompts, options, reveals, and the scoreboard use the stage type scale, and that scale is larger than the shell title. Scoreboard, final, and podium phases lead with the standings. The sample countdown is only shown before a room is connected. A missing photo or cue file leaves a sentence on screen and the round continues. This screen does not show credential secrets, adjustment reasons, or admin controls. When the host hides the stage, the question payload is absent and the screen says it is hidden.

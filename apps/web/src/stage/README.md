# Stage

Projector shell for `/host`.

| File             | Purpose                                                                            |
| ---------------- | ---------------------------------------------------------------------------------- |
| `stage-page.tsx` | Join code, name cloud, QR, the question, the countdown, the reveal, and the podium |

The question text comes from the public snapshot. The lobby shows the join code at stage size, the name cloud, the QR code, and the short join address. During a quiz it keeps a compact code and the player count. Prompts, options, reveals, and the scoreboard use the stage type scale, and that scale is larger than the shell title. Body text is at least 40px, the question at least 72px, and the timer at least 120px. All of that sits inside a 5% overscan inset. O outlines the inset in development, and Full screen (or F) fills the display. The cursor hides after two seconds still. The last five seconds of a countdown pulse in the accent colour. While answers are open, “Waiting on N” and a bar come from the submission count and the player count. Start show unlocks sound on this screen only. M mutes it. Space, P, and H send the same advance, pause, and hide actions as the admin buttons. ? lists those shortcuts. D shows a small corner count of connected players, the phase, and this screen’s socket. Scoreboard, final, and podium phases lead with the standings. The sample countdown is only shown before a room is connected. A missing photo or cue file leaves a sentence on screen and the round continues. This screen does not show credential secrets, adjustment reasons, or admin controls. When the host hides the stage, the question payload is absent and the screen says it is hidden.

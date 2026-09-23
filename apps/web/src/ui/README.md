# UI primitives

Shared controls for the party surfaces. Use these instead of one-off buttons and dialogs.

| File                | Purpose                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| `primitives.tsx`    | Button, text field, panel, status message, countdown layout, and dialog |
| `surface-frame.tsx` | Page frame, skip link, and links between the four shells                |

The countdown layout is presentational. The stage fills it from the server deadline and animates that value on the projector.

Phone and stage quiz rendering lives in `apps/web/src/play`. `media` and `stats` presentation folders are intentionally absent until those prompts.

# UI primitives

Shared controls for the party surfaces. Use these instead of one-off buttons and dialogs.

`entry-frame.tsx` and `entry.css` provide the public/home/login composition, theme-aware chrome, a home link, focused form widths and eased status feedback. `LinkButton` uses the same styling as `Button`, with normal link semantics. The guest controller retains `PhoneShell` after joining; the projector retains its existing frame until the presentation stage of the redesign.

`admin-shell.tsx` and `admin.css` compose the wide operator workspace from these primitives, with contextual room navigation, compact phone navigation, independent theme selection and reduced-motion fades. The shell retains the nested room provider while switching room sections.

| File                | Purpose                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| `primitives.tsx`    | Button, text field, panel, status message, countdown layout, and dialog |
| `surface-frame.tsx` | Page frame, skip link, and links between the four shells                |

The countdown layout is presentational. The stage fills it from the server deadline and animates that value on the projector.

Phone and stage quiz rendering lives in `apps/web/src/play`. `media` and `stats` presentation folders are intentionally absent until those prompts.

`ConfirmDialog` uses the existing native dialog system with explicit controlled state, focus restoration and a safe Cancel focus. Callers check their authoritative context before confirming. `Disclosure` uses Motion presence/height easing with reduced-motion fades. Admin page compositions reuse these shared controls; player task changes also use short Motion presence transitions.

`media-preview.tsx`/`media-preview.css` share labelled photo/audio rendering across admin moderation and public gallery. A hidden item does not create a media element; audio requires native controls and never autoplays; failed loads offer a retry. Paths come from the owning surface's authorised endpoint, never an R2 object key.

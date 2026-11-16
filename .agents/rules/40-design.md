---
description: Party UI libraries, fluid motion, and reduced-motion fallbacks
trigger: glob
globs:
  - apps/web/**/*.ts
  - apps/web/**/*.tsx
  - apps/web/**/*.css
---

# Design and motion

Maximise the libraries below. Reach for their current components, primitives, and effects first. Install and pin a missing package when a screen needs it. Do not invent a parallel primitive kit or one-off visual language beside `apps/web/src/ui`.

Before using or copying anything, open the live site (and the specific component or API page). Do not reconstruct APIs, class names, or install commands from memory. If the page and training data disagree, the page wins.

Compose those libraries into the existing surfaces (phone, stage, host, admin, results). Do not copy LifeSmart branding. Keep British English, large tappable phone controls, and stage type readable from across a room.

Screen colours come from `apps/web/src/theme/themes.ts`. A theme also has a skin, so the chrome fits the idea. Follow the theme rule when adding or changing one. Category and brand icons come from the packs listed in that rule: Lucide, Simple Icons, Game Icons, and Material Design Icons, rendered with `@iconify/react/dist/offline`.

## Libraries to check

Primitives and motion engine:

- [shadcn/ui](https://ui.shadcn.com)
- [Motion](https://motion.dev) (`motion/react`)
- [Base UI](https://base-ui.com)

Animated registries and kits (use freely, mix as needed):

- [Animate UI](https://animate-ui.com)
- [Magic UI](https://magicui.design)
- [React Bits](https://reactbits.dev)
- [Aceternity UI](https://ui.aceternity.com)
- [Origin UI](https://originui.com)
- [Kokonut UI](https://kokonutui.com)
- [Fancy Components](https://www.fancycomponents.dev)
- [Motion Primitives](https://motion-primitives.com)
- [Cult UI](https://www.cult-ui.com)
- [Animata](https://animata.design)
- [21st.dev](https://21st.dev)

Targeted motion utilities:

- [Number Flow](https://number-flow.barvian.me)
- [AutoAnimate](https://auto-animate.formkit.com)

## Fluid motion

Every visible change is eased. Nothing snaps: hover, press, focus, disabled, open/close, mount/unmount, list insert/remove/reorder, page or phase change, loading, success, and error. Subtle motion is required; instant `display`, un-eased colour cuts, and zero-duration transitions are not.

Use Motion springs or shared duration/easing tokens. Prefer enter/exit and layout animation over CSS that only styles the resting state. Decorative loops belong on the stage or idle screens, not on controls a guest must hit quickly.

```tsx
// ❌ BAD — appears and vanishes instantly
{
  open ? <Panel /> : null;
}

// ✅ GOOD — eased presence, still uses the shared panel
<AnimatePresence>
  {open ? (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
    >
      <Panel />
    </motion.div>
  ) : null}
</AnimatePresence>;
```

## Reduced motion and stage safety

Honour `prefers-reduced-motion`. Turn off loops, parallax, blur storms, and layout thrash. Keep a short opacity or colour fade for state changes so the UI still does not pop. Motion must never hide a question, option, score, or answer on the projector, and must never put secrets or personal diagnostics on stage.

## Admin workspace (Humza's control room)

The party phone and projector stay loud: large type, generous tap targets, theme skins. **`/admin` is a different product surface.** It is a dense operator console for one person, often on a phone, and must stay understandable under pressure.

Do not copy guest/stage chrome into admin. Specifically:

- Group navigation from `adminFeatures[].group` (`apps/web/src/admin/features.ts`). Do not dump every page as a flat list of huge buttons.
- Use compact primary / secondary / danger controls inside `.admin-workspace`. Guest `Button` size (`min-h-12`, `text-lg`) is for phones answering questions, not for the host desk.
- Page titles are sentence-sized, with a one-line description of what the screen does. Status uses badges and short live lines, not essays on overview cards.
- Confirm destructive actions. Show command results with the existing `CommandFeedback` / notices. Include empty and loading copy.
- Keep rehearsal, but fold long how-to text away from the first glance. Overview cards show `summary` and live `status`; full `rehearsal` lives on the feature page.
- Admin must work at phone width: a menu drawer, not a wrapped sidebar of oversized links. Do not send answer keys or personal diagnostics to `/screen`.

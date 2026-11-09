# Web app

[Home](../../../README.md) · [Documentation](../../../docs/README.md) · [Event runbook](../../../docs/event-runbook.md)

React screens for the party. Vite builds them, and the API Worker serves the build.

| Folder | Route / role | Purpose |
| --- | --- | --- |
| `guest` | `/` | Phone controller shell |
| `stage` | `/host` | Projector shell |
| `admin` | `/admin` | Operator shell |
| `results` | `/r/:gameId` | Results shell |
| `play` | Question UI | Phone and stage renderers, `designs/`, widgets in `play/controls/` |
| `kart` `chess` `troll` | Round engines | Lazy-loaded; do not import each other |
| `live` | Socket | `openRoomSocket` and reconnect chrome |
| `ui` `theme` `anim` | Shared | Controls, palettes, motion |

A new top-level folder must be owned in `admin/features.ts` (or `adminExempt`) and listed in `.agents/rules/05-structure.md`. Do not add `rounds` or `net`; those merged into `play/controls` and `live`.

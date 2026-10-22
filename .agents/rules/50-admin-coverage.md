---
description: Every feature is visible, manageable and rehearsable from the admin workspace
trigger: always_on
---

# Admin coverage

Every feature ships with its admin view in the same change. A feature is not done until the host can **see** it, **manage** it and **rehearse** it from `/admin`, without asking guests to help.

## The registry is the source of truth

`apps/web/src/admin/features.ts` lists every feature (`adminFeatures`). The sidebar, the page titles and the room overview cards are built from it. Each entry has:

- `id`, `label`, `scope` (`global` under `/admin`, `room` under `/admin/rooms/:gameId`) and `path`.
- `summary`: what the page shows, in one sentence.
- `rehearsal`: what the host can try with no guests (a preview, sample, demo or dry run). Be concrete. "None" is not acceptable. If something truly needs live guests, say how to do it with a second browser tab.
- `owns`: the top-level source folders the feature lives in (`apps/api/src/<domain>`, `apps/web/src/<domain>`). Each folder belongs to exactly one feature.
- `status` (room features): a short live line for the overview card, read from the host snapshot.

Shared plumbing that is not a feature goes in `adminExempt` with a reason. Do not exempt something to avoid building its view.

`apps/web/src/admin/features.test.ts` enforces this. It fails when a source folder has no owner, a folder is owned twice, an owned folder no longer exists, a feature has no summary or rehearsal, or an `/admin` route and a registry entry do not match. Never weaken the test to get a pass; add the view.

## What a feature's admin view must have

1. **See.** The current state, live from the host snapshot (`useAdminRoom`) for room features, or from a validated section read (`readSection`) for global ones. Show counts, who did what and when, and anything waiting on the host. Include history, not just what is happening now.
2. **Manage.** Every host action for the feature, as a host command (`execute(...)` → `/api/rooms/play` → `readHostDetails` → `applyHostAction`). Commands are receipted, validated again inside the room, and roll back on error. Give each one a notice in `command-notices.ts` and a `CommandScope` for its feedback.
3. **Rehearse.** A way to try it without guests: render the real phone and stage component with sample data (frame previews, troll previews, question rehearsal), or a demo or dry-run command. Use real components, never a mock-up that can drift.
4. **Safe defaults.** Anything that reaches the projector or guests can be switched off or undone from the page.

## Server side

- Host-only data goes in the snapshot only for `audience === "control"`, as an optional field on `lobbySnapshotSchema` with exact Zod limits. Never send it to the stage or guests.
- Add host actions to the `commands` list in `routes.ts`, to `readHostDetails` (validate every field), to `PartyRoom.hostAction` and to `applyHostAction`. Validate again in the domain function; the room does not trust its caller.

## Tests for each feature's admin view

- A room spec for each host command: success, refusal and replay.
- A component test for the admin page using `controls.test-support.tsx` (`setupControls`, `mountControls`): each control sends the right command.
- A snapshot test proving host-only fields are absent for stage and guest audiences.

## Checklist for a new feature

1. Build the feature.
2. Add or extend its entry in `adminFeatures`, with `owns` covering its folders.
3. Add the route in `apps/web/src/routes.tsx`, and the path to `admin-return.ts`.
4. Build the see, manage and rehearse view.
5. Add the tests above, and run `features.test.ts`.
6. Update `docs/data-inventory.md` if it stores anything new, and `docs/build-progress.md`.

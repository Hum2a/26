## What changed

## Performance

How this keeps ~80 phones and the projector feeling instant. Say what you measured, or why the change cannot affect runtime (docs/rules only).

- Render / main thread:
- Socket / Durable Object hot path:
- Bundle / lazy load (`npm run budget:web` if `apps/web` assets or imports changed):
- Known leftover cost (do not have to fix in this PR):

## Checks run

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] Targeted unit tests (not Playwright / E2E)
- [ ] `npm run build` when the client graph or public assets changed
- [ ] `npm run agents:sync` after editing `.agents`

## Guardrails

- [ ] Not targeting `master` for a direct push; no force-push
- [ ] No deploy, no Playwright specs, no unrelated rewrite or folder move

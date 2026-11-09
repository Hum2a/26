# @26/shared

[Home](../../README.md) · [Documentation](../../docs/README.md) · [Event runbook](../../docs/event-runbook.md)

Validation schemas used by the Worker and the web app.

| Path | Purpose |
| --- | --- |
| `src/index.ts` | Public `@26/shared` barrel (environment, lobby, credentials, and re-exports) |
| `src/kart/` | Race reducer, physics, tracks, items |
| `src/chess/` | Board schemas and capture scoring |
| `src/wordle/` | Guess-board reducer |
| `src/*.ts` | Cross-cutting schemas (wall, stats, rate limit, archive, …) |

`gameIdSchema` checks the shape of an id. It does not resolve a room. The room-credential schemas name the control and presentation roles. They do not verify a secret.

This package stays pure: Zod and TypeScript only. Round UI lives in `apps/web`. Durable Object code lives in `apps/api`. See `.agents/rules/05-structure.md`.

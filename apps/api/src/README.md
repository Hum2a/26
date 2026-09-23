# API Worker

One Hono Worker serves HTTP routes. The Vite build hands it the static assets.

| File       | Purpose                                                                     |
| ---------- | --------------------------------------------------------------------------- |
| `index.ts` | Health, administrator auth, the lobby API, and JSON 404s for unknown routes |

`GET /api/health` reads `c.env.APP_ENV`. Missing `/api` and `/ws` routes return JSON and do not call `ASSETS.fetch`.

Administrator auth lives in `src/auth`. Room credential verification lives in `src/credentials`. The lobby Durable Objects live in `src/room`. Page routes are served as static assets, with the SPA shell for unknown pages. Rounds are a later prompt. `game`, `media`, and `stats` folders are intentionally absent.

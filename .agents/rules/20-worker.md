---
description: Worker, room, and shared validation
trigger: glob
globs:
  - apps/api/**/*.ts
  - packages/shared/**/*.ts
---

# Worker and room

- One Worker serves the application and API. One SQLite-backed Durable Object owns each room. One durable scheduler owns all room alarms.
- Persist an accepted action before its success acknowledgement. Retries use the same idempotency key.
- Neon, email, and image or audio processing stay outside the live guest-action path.
- Read configuration from Worker bindings. Do not read `process.env` in `apps/api/src` or `packages/shared/src`.
- Staging and production `vars` hold `APP_ENV` and `MEDIA_BUCKET_NAME` only. Required secret names are not stored as empty vars.
- A local fake must refuse to succeed when `APP_ENV` is `staging` or `production`.

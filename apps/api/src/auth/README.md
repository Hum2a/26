# Administrator auth

[Home](../../../../README.md) · [Documentation](../../../../docs/README.md) · [Event runbook](../../../../docs/event-runbook.md)

One Better Auth instance for Humza. There are no guest accounts. Public email sign-up is disabled, and both magic-link/email-OTP plugins have `disableSignUp: true`. A user row is created only by `npm run auth:seed`, and `databaseHooks.user.create.before` rejects every other address.

<details>
<summary>On this page</summary>

- [Factories](#factories)
- [Magic links and email scanners](#magic-links-and-email-scanners)
- [Migrations](#migrations)
- [Email codes and the shared email design](#email-codes-and-the-shared-email-design)

</details>

## Factories

| File                 | Role                                                           |
| -------------------- | -------------------------------------------------------------- |
| `create-auth.ts`     | Builds Better Auth from the request bindings                   |
| `create-database.ts` | Neon when `DATABASE_URL` is set, otherwise local PGlite        |
| `create-email.ts`    | Resend when `RESEND_API_KEY` is set, otherwise the local inbox |

Staging and production without `DATABASE_URL` return 503. They never open PGlite. The local inbox route exists only when `APP_ENV` is `local`.

`BETTER_AUTH_SECRET` is required outside local development. Local development uses a fixed development secret when the binding is blank. That secret is not accepted for staging or production.

## Magic links and email scanners

Better Auth's own verify route is `GET /api/auth/magic-link/verify`. The current plugin consumes the token on the first call, including a GET from an email scanner. `allowedAttempts` no longer changes that.

`sendMagicLink` therefore ignores Better Auth's verify URL. The message links to `/admin/confirm?token=...`. Opening that page does not call verify. The confirm button POSTs the token, and only that POST calls `magicLinkVerify`.

The generated verify GET remains mounted and is never placed in an email. A repeated POST of the same token fails.

## Migrations

Better Auth tables come from `getMigrations` in `better-auth/db/migration`. `apps/api/src/auth/migrations/better-auth.sql` is the SQL that `compileMigrations` produced for this version. Do not hand-write those tables.

`room-credential.sql` and `dev-inbox.sql` are ours. The inbox table is applied for `--env local` only.

```bash
npm run auth:migrate -- --env local
npm run auth:seed -- --env local
```

npm currently treats `--env` as its own flag and forwards the environment name. The script accepts that name and refuses to run with none. `--env local` reads only `apps/api/.dev.vars`. Staging reads only `.dev.vars.staging`. Production reads only `.dev.vars.production`. The command prints the database host or the local PGlite path, not the connection string.

Local development without `DATABASE_URL` also applies this schema when the PGlite database is first opened, so the admin page works before a manual migrate. Neon is not migrated on request. Completed-game tables are a separate migration: `npm run archive:migrate -- --env local`. That script is not run from a guest request.

Node commands store that database in `apps/api/.data/local-auth`. PGlite cannot run initdb inside the Worker runtime, so `vite dev` and `vite preview` answer `/api/auth`, `/api/admin`, `/api/dev`, and `/api/stage` from the Node process, using that same local database. Those routes are not a production bypass: staging and production still require `DATABASE_URL`, and a Worker without this development server returns 503 for local auth when it cannot open the file database.

## Email codes and the shared email design

The existing `/api/admin/magic-link` request now sends one email with a six-digit code and the scanner-safe confirmation link. Both expire after five minutes. Codes use Better Auth 1.7.5's email-OTP plugin and server-only `createVerificationOTP` API, hashed storage, a five-attempt limit and disabled sign-up. `POST /api/admin/email-code/verify` checks same-origin and the configured administrator, then delegates verification/session cookies to the same Better Auth handler. The latest emailed code replaces earlier values. Each method consumes its own credential; using a code does not consume the separate magic-link token. No new identity store, secret or database table is required.

After requesting an email, `/admin/login` reveals a keyboard/autofill-friendly code field. It preserves the requested admin destination, reports rejected codes without locking the form, and retains the magic-link journey. Only the explicit local inbox exposes a development code/link; production has no inbox endpoint.

`packages/emails` contains the shared React Email design for administrator sign-in, result-address verification and personal results. The Resend adapter renders HTML alongside the original plain text at delivery time, including stored retries, preserving the existing outbox/idempotency model. Personal recap links remain private. The presentation uses the final canonical URL so a guest nickname containing a URL cannot replace the email's action.

Run `npm run email:preview` to render three invented previews under `.codex/previews/emails/`. These use stand-in identities, codes and tokens and send no email. Browser tests check 320/390/430px sign-in layouts, 320/390/900px emails, actual code sign-in/session restoration, and the original magic-link flow. Real Gmail/Outlook/Apple Mail delivery remains a provider-side check.

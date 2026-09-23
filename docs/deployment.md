# Deployment

This file is the deployable configuration for 26.humza.website. One Worker serves the React assets and the API. A staging or production deploy publishes both in one `wrangler deploy`.

| Environment | Public origin                    | Worker name                |
| ----------- | -------------------------------- | -------------------------- |
| Staging     | https://26-staging.humza.website | `26-humza-website-staging` |
| Production  | https://26.humza.website         | `26-humza-website`         |

Those hostnames are Worker custom domains. Remote environments set `workers_dev` to false. `apps/api/wrangler.jsonc` pins `account_id` to Humza's personal Cloudflare account so commands do not touch LifeSmart or other accounts. The `humza.website` zone must already be on that account.

Pinned content for the current build:

| Item                   | Value                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| Compatibility date     | `2026-09-22`                                                                                      |
| Wrangler migration tag | `v1`, classes `PartyRoom` and `RoomCodeRegistry`                                                  |
| Room SQLite schema     | `schema_meta` version 13, applied inside the room                                                 |
| Archive schema         | version 2                                                                                         |
| Question set           | `demo-2026-09-22`                                                                                 |
| Scoring version        | `unreleased`                                                                                      |
| Worker names           | local `26-humza-website-local`, staging `26-humza-website-staging`, production `26-humza-website` |
| Public hosts           | staging `26-staging.humza.website`, production `26.humza.website`                                 |
| Media buckets          | `26-humza-media-local`, `26-humza-media-staging`, `26-humza-media`                                |

`vars`, Durable Object bindings, R2 bindings, `secrets`, and `images` are repeated on each Wrangler environment. The `v1` migration is inherited. A later migration tag may add a class. It must not delete or recreate `PartyRoom` or `RoomCodeRegistry`. Room table changes stay additive inside `ensurePartySchema`. An unknown schema version throws. Do not delete the Durable Object database to recover.

## Local

```powershell
npm install
npm run auth:migrate -- --env local
npm run auth:seed -- --env local
npm run archive:migrate -- --env local
npm run content:check
npm run content:export
npm run dev
```

`npm run dev` serves http://localhost:5173. `npm run build` then `npm run preview` serves http://localhost:4173. With `DATABASE_URL` in `apps/api/.dev.vars`, local auth uses the Neon development branch. Without that URL, local auth uses PGlite. The local inbox is used only when `RESEND_API_KEY` is blank.

## Staging and production releases

The Vite plugin selects the Wrangler environment at build time. The release scripts set `CLOUDFLARE_ENV`, check the generated Worker name, and deploy that file. Passing `--env` only at deploy time does not retarget a build that was flattened as local.

```powershell
npm run secrets-sync:staging
npm run db:migrate:staging
npm run deploy:staging
```

Or one command that migrates, then builds and deploys with the required secrets attached:

```powershell
npm run deploy:staging:full
```

The Vite environment directory stays `apps/web/dist/26_humza_website_local` because that name comes from the top-level Worker. The script opens `apps/web/dist/26_humza_website_local/wrangler.json` and refuses to continue unless `"name"` is `26-humza-website-staging` and `"targetEnvironment"` is `staging`. A build that still has `"name": "26-humza-website-local"` is the local build. Do not deploy it as staging.

Wrangler warns that the secret names are missing from `env.staging.vars`. That warning is expected. Those names are `secrets.required`, not vars. The build also warns that the secrets are not in the local environment. That does not mean they were created.

`npm run secrets-sync:staging` uploads the required names from `apps/api/.dev.vars.staging` with `wrangler secret bulk`. Empty values are rejected. Extra keys in that file are not uploaded. `npm run deploy:staging` does not upload secrets. `npm run deploy:staging:full` attaches them with `--secrets-file` on the same deploy as the new code.

`npm run deploy:both` and `npm run deploy:both:full` run staging and then production. Add `-- --dry-run` to a secrets-sync or deploy command to check names or packaging without uploading.

## Production build

Do not run this until a production deploy is explicitly requested.

```powershell
npm run secrets-sync:prod
npm run db:migrate:prod
npm run deploy:prod
```

Or `npm run deploy:prod:full`. The generated worker name must be `26-humza-website` and the custom domain must be `26.humza.website`. This repository has no `account_id`. Cloudflare creates the DNS record for the custom domain on deploy when `humza.website` is in that account.

## Rollback

After a real deploy, and only for that environment. `--env staging` reads `apps/api/wrangler.jsonc` and targets the Worker named `26-humza-website-staging`.

```powershell
npx wrangler rollback --env staging
npx wrangler versions list --env staging
```

Use `--env production` only when production has been deployed on purpose. Rollback restores the previous Worker version. It does not undo Durable Object storage, R2 objects, or Neon rows. It cannot cross a Durable Object class create or delete. Keep migration tags additive so a rollback stays possible.

## Neon migrations

These scripts read `apps/api/.dev.vars.staging` or `apps/api/.dev.vars.production`. They refuse to run when that file or `DATABASE_URL` is missing. They print the database host, not the connection string.

```powershell
npm run db:migrate:dev
npm run db:migrate:staging
npm run db:migrate:prod
```

Those commands run `auth:migrate` and `archive:migrate` for one environment. Seed remains separate: `npm run auth:seed -- --env staging`. Replace `staging` with `production` only for the production database. Archive migration is additive: version 1 gains the delivery tables and becomes version 2. A frozen publication is not rewritten. Do not run `archive:retain` during the event. That command deletes old archive rows and is not a recovery tool.

Neon project `26` in `aws-eu-west-2` has a `development`, `staging`, and `production` branch. Better Auth tables, `room_credential`, and the verified administrator are applied on all three. The development branch also has the local inbox table. Each gitignored vars file holds that branch's pooled `DATABASE_URL`. `BETTER_AUTH_URL` is still blank, so staging and production auth stays unavailable until it matches the public origin.

## R2

`26-humza-media-staging` and `26-humza-media` exist on Humza's personal Cloudflare account, with location hint `weur`. Local development still simulates `26-humza-media-local` and does not use a remote bucket.

```powershell
npx wrangler r2 bucket lifecycle set 26-humza-media-staging --file apps/api/r2-lifecycle.json -y
npx wrangler r2 bucket cors set 26-humza-media-staging --file apps/api/r2-cors.json -y
```

`r2-lifecycle.json` expires the `tmp/` prefix after one day. Accepted objects are not deleted by that rule. `r2-cors.json` allows `http://localhost:5173`, `http://localhost:4173`, `https://26-staging.humza.website`, and `https://26.humza.website`. The same policies are already applied to `26-humza-media`. Browser uploads still need an R2 S3 API token in `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY`. Those tokens are created in the R2 dashboard and are not stored in this repository.

The `IMAGES` binding is declared on the staging and production environments. It is not declared on the local config. It has not been attached to an account, and Cloudflare Images has not been called.

## Secret manifest

Names only. Prefer `npm run secrets-sync:staging` after filling `apps/api/.dev.vars.staging`. To set one name by hand, use `npx wrangler secret put NAME --env staging` and paste the value on stdin. Do not put the value on the command line or in `wrangler.jsonc`.

- `ADMIN_EMAIL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `DATABASE_URL`
- `RESEND_API_KEY`
- `RESEND_FROM`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `EMAIL_TEST_RECIPIENT`
- `CLIENT_API_KEY`

`CLIENT_API_KEY` must match `VITE_CLIENT_API_KEY` in the matching `.env.{env}` file used at build time. Rotate both together with `npm run client-api-key:rotate -- --env staging`, rebuild, then sync secrets. The SPA embeds the Vite value in the client bundle. This blocks casual direct API access; it is not a hidden server secret.

`EMAIL_TEST_RECIPIENT` is required on staging. Results mail is sent only to that address. Admin sign-in is not limited by it. If the name is unset on staging, results mail throws and does not send. Production sends to the guest address only when this secret is absent. If it is set in production, results mail is limited to it as well.

An empty string in `vars` would replace a secret on the next deploy. Staging and production `vars` therefore contain only `APP_ENV` and `MEDIA_BUCKET_NAME`. Local `vars` still include empty placeholders so local development and type generation stay explicit.

`BETTER_AUTH_URL` must be the public origin for that environment: `https://26-staging.humza.website` or `https://26.humza.website`. The release scripts refuse any other value. `npm run env:sync` writes those defaults only when the key is missing.

## Missing external setup

- A Cloudflare account that belongs to this birthday project, `wrangler login` against that account, and the `humza.website` zone on that account so the custom domains can attach.
- The staging Worker and both SQLite Durable Objects. The staging and production R2 buckets exist, with lifecycle and CORS applied.
- An R2 S3 API token written into the gitignored vars files for presigned browser uploads.
- Images enabled for the account so the `IMAGES` binding can run.
- Worker secrets are not on Cloudflare yet. `ADMIN_EMAIL`, `BETTER_AUTH_SECRET`, and `DATABASE_URL` are in the gitignored vars files. `npm run secrets-sync:staging` rejects empty required values, so set `BETTER_AUTH_URL` and `RESEND_FROM` before uploading. Run that only after `wrangler login` is the birthday account.
- `BETTER_AUTH_URL` is blank. Staging must be `https://26-staging.humza.website` and production `https://26.humza.website`. Until then those environments return 503 for auth.
- `RESEND_FROM` is blank. Set a verified from-address before a magic link can be emailed. Local lists the link on `/admin` only when `RESEND_API_KEY` is blank.
- One explicit `EMAIL_TEST_RECIPIENT` on staging.
- The first staging deploy creates https://26-staging.humza.website. Do not reuse another project's hostname.

## Diagnostics and recovery

Authenticated host routes, same origin, control cookie:

- `GET /api/rooms/:gameId/diagnostics` returns phase, connection counts, scheduler jobs without payloads, media counts, archive status, and delivery counts. Failures are redacted. The test recipient address is not returned.
- `GET /api/rooms/:gameId/summary` returns a score-summary markdown file.
- Host actions `release-stuck-media` and `retry-delivery` are on `POST /api/rooms/play`.

`release-stuck-media` returns an expired upload lease to open. A lease that is still inside its 30 seconds stays leased. Accepted objects are not deleted. The guest sends the file again.

`retry-delivery` retries failed and uncertain jobs, up to 20, while attempts are under 8. It reuses the stored idempotency key. The same host request does not send a second time. A crash after the provider accepts and before the receipt can send again with that same key.

There is no routine command that wipes a room or a database.

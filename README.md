# 26.humza.website

> **One birthday. One big screen. Everyone plays.**
>
> A hosted party quiz for Humza’s 26th — Baseer presents, Humza runs the show, and guests play individually on their phones.

[Get started](#local-app) · [Browse the docs](docs/README.md) · [Run the event](docs/event-runbook.md) · [Build progress](docs/build-progress.md)

| Play                        | Present                        | Control                                      |
| :-------------------------- | :----------------------------- | :------------------------------------------- |
| Guests join on their phones | The projector follows the room | The host manages and rehearses from `/admin` |

Humza's birthday party game. One Cloudflare Worker serves the React app and the API. Locally, an administrator can open a lobby, guests can play the illustrative pack, and the stage can follow the room. After deploy, staging is https://26-staging.humza.website and production is https://26.humza.website. Deployment and the event runbook are in [docs/deployment.md](docs/deployment.md) and [docs/event-runbook.md](docs/event-runbook.md).

The product requirements are in [docs/party-game-plan.md](docs/party-game-plan.md). The build sequence is in [docs/build-prompts.md](docs/build-prompts.md). Progress is in [docs/build-progress.md](docs/build-progress.md).

<details>
<summary>On this page</summary>

- [Requirements](#requirements)
- [Local app](#local-app)
- [Checks](#checks)
- [Administrator sign-in](#administrator-sign-in)
- [Configuration](#configuration)
- [Release commands](#release-commands)
- [Agent instructions](#agent-instructions)
- [Secrets](#secrets)

</details>

## Requirements

- Node.js 22.12 or newer
- npm 11

## Local app

```bash
npm install
npm run setup
npm run dev
```

`npm run setup` prepares this machine. It installs dependencies, creates the gitignored environment files, generates a local client API key when one is missing, copies agent instructions, generates Worker types, installs Playwright Chromium, then migrates and seeds the local database. An existing local key is left unchanged. Staging and production files only gain missing keys. The command does not deploy or upload secrets.

Open http://localhost:5173

| Route         | What you should see                                                 |
| ------------- | ------------------------------------------------------------------- |
| `/`           | Guest phone. Enter a join code and a nickname to join a lobby.      |
| `/host`       | Projector shell with a countdown preview.                           |
| `/admin`      | Administrator magic-link sign-in. Local mail stays on this machine. |
| `/r/ABCDEFGH` | A results shell for an example id. No archive is loaded.            |

`npm run dev` uses the Cloudflare Vite plugin, so the page and `/api/health` come from the same local Worker. The health line is a development check. It does not mean a player has joined.

## Checks

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npx playwright install chromium
npm run smoke
```

`npm run build` creates the production assets and then checks that the output does not contain secret files. `npm run smoke` opens the preview at http://localhost:4173 and needs that build first.

`npm run preview` serves the production build locally.

## Administrator sign-in

Local development uses the administrator address in `apps/api/.dev.vars`. When that file has `DATABASE_URL`, `npm run dev` uses the Neon development branch. With no `DATABASE_URL`, local auth uses PGlite. With no Resend key, the sign-in link is listed on `/admin` after you request it. A Resend key also needs `RESEND_FROM`, or the send fails and the inbox is not used. Open the confirmation page and press Sign in. Opening the page does not consume the link. During `npm run dev` and `npm run preview`, the administrator and room-credential API routes run in Node. The Worker still serves the pages and the other API routes.

```bash
npm run auth:migrate -- --env local
npm run auth:seed -- --env local
```

Each command names one environment and reads only that environment's vars file. Local reads `apps/api/.dev.vars` and uses the Neon development branch when `DATABASE_URL` is set. Staging and production read their own files and their own Neon branches. They do not use the local inbox.

## Configuration

Runtime configuration is a Worker binding. The app reads `c.env.APP_ENV`. It does not keep a `process.env` singleton.

| Environment | How it is selected                                                         | `APP_ENV`    |
| ----------- | -------------------------------------------------------------------------- | ------------ |
| Local       | Top level of `apps/api/wrangler.jsonc`, used by `npm run dev`              | `local`      |
| Staging     | `CLOUDFLARE_ENV=staging` at build time, then deploy the generated config   | `staging`    |
| Production  | `CLOUDFLARE_ENV=production` at build time, only when a deploy is requested | `production` |

One Worker serves the React app and the API. `npm run deploy:staging` and `npm run deploy:prod` each publish both in a single `wrangler deploy`. Staging is https://26-staging.humza.website. Production is https://26.humza.website. Those hostnames are Worker custom domains. `workers.dev` is off for the remote environments.

`wrangler.jsonc` pins Humza's personal Cloudflare `account_id`. It binds two SQLite Durable Object classes, `PartyRoom` and `RoomCodeRegistry`. Staging and production repeat those bindings, bind the remote R2 buckets, require the secret list in [docs/deployment.md](docs/deployment.md), and declare an `IMAGES` binding. The `humza.website` zone must be on that account before a deploy can attach the custom domains. Do not deploy the local build to staging.

Passing `--env` only on `wrangler deploy` does not retarget a Vite build. The deploy scripts set `CLOUDFLARE_ENV`, confirm the generated worker name, then deploy that file. Commands, rollback, migrations, and the missing account setup are in [docs/deployment.md](docs/deployment.md). The presenter and operator steps are in [docs/event-runbook.md](docs/event-runbook.md).

## Release commands

**Recommended:** Use `bash release.sh` for production releases. It enforces clean working tree, version bumping, and runs all checks.

These commands read `apps/api/.dev.vars.staging` or `apps/api/.dev.vars.production`. They do not print secret values. `--env both` runs staging and then production.

| Command                        | What it does                                                                                       | Notes                                            |
| ------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `npm run secrets-sync:staging` | Upload the required Worker secrets for staging                                                     |                                                  |
| `npm run secrets-sync:prod`    | Upload the required Worker secrets for production                                                  | Not covered by deploy/full production guards     |
| `npm run secrets-sync:both`    | Staging secrets, then production secrets                                                           | Not covered by deploy/full production guards     |
| `npm run db:migrate:dev`       | Auth and archive migrations on the Neon development branch, or PGlite when `DATABASE_URL` is blank |                                                  |
| `npm run db:migrate:staging`   | Auth and archive migrations against the staging database                                           |                                                  |
| `npm run db:migrate:prod`      | Auth and archive migrations against the production database                                        | Not covered by deploy/full production guards     |
| `npm run deploy:staging`       | Build with `CLOUDFLARE_ENV=staging` and deploy that generated config                               |                                                  |
| `npm run deploy:prod`          | Build with `CLOUDFLARE_ENV=production` and deploy that generated config                            | **Requires clean master, outside freeze period** |
| `npm run deploy:both`          | Staging deploy, then production deploy                                                             | **Requires clean master, outside freeze period** |
| `npm run deploy:staging:full`  | Staging migrate, then build and deploy with the required secrets attached                          |                                                  |
| `npm run deploy:prod:full`     | Production migrate, then build and deploy with the required secrets attached                       | **Requires clean master, outside freeze period** |
| `npm run deploy:both:full`     | Full staging release, then full production release                                                 | **Requires clean master, outside freeze period** |

Add `-- --dry-run` to a secrets-sync or deploy command to check the package or secret names without uploading. A dry-run full release skips migrations.

**Production deploy/full safeguards:** `deploy:prod`, `deploy:both`, `deploy:prod:full`, `deploy:both:full` enforce:

- Clean working tree (no uncommitted changes)
- Master branch (no feature branches)
- Freeze period check (20 Nov 00:00 to 22 Nov 12:00 UTC) unless `--override-freeze`

**Note:** `secrets-sync` and standalone `migrate` (`db:migrate:*`) do not call `assertDeployAllowed`. They have no freeze or git checks, so run their production forms deliberately. Raw vendor commands such as `npx wrangler deploy` or `npx wrangler secret put` bypass every safeguard here.

Example production deploy: `npm run deploy:prod`

`bash release.sh --deploy=production` is the recommended wrapper: it requires master and a clean tree before bumping the version, then sets `SKIP_GIT_CHECK=true` on the deploy invocation so generated check artefacts do not fail the later git check. Freeze still applies. Direct `npm run deploy:*` routes keep the git check for a real production deploy; staging deploys and `--dry-run` do not read git. There is no `release.sh --skip-git-check` flag. Set `SKIP_GIT_CHECK=true` only from a trusted wrapper that has already enforced clean master.

Do not deploy the local build to staging. The script refuses a generated name of `26-humza-website-local`.

## Agent instructions

`.agents` is the source of truth for coding-agent rules, skills, and the shared exclusion list. Edit those files, then run `npm run agents:sync`. The command copies them into the files Cursor, Antigravity, Claude, ChatGPT, and Copilot read. Those generated directories are gitignored; run the command after a clone. Destinations are listed in [.agents/README.md](.agents/README.md).

Performance and workflow rules (`55-agent-workflow`, `60-perf-*`) tell agents how to keep ~80 guest phones and the projector feeling instant. After a web build, `npm run budget:web` checks Vite gzip budgets in `scripts/web-bundle-budget.json`.

## Secrets

`apps/api/.dev.vars.example` and `.env.example` list names that later stages may need. They contain no secrets.

- Run `npm run env:sync` to create or update the per-environment files: `apps/api/.dev.vars`, `apps/api/.dev.vars.staging`, `apps/api/.dev.vars.production`, `.env.local`, `.env.staging`, and `.env.production`. Existing values are preserved; only missing keys are added.
- Run `npm run client-api-key:rotate -- --env local` to generate the paired `CLIENT_API_KEY` and `VITE_CLIENT_API_KEY` values. Restart dev or rebuild after rotation. The same command works for staging and production; then run `npm run secrets-sync:staging` or upload `CLIENT_API_KEY` with Wrangler.
- Do not commit `.dev.vars`, `.env`, or credential files. They are gitignored.
- Fill in secrets only on your machine or in the deployed Worker environment.
- Deployed secrets are set with `npm run secrets-sync:staging` or `npx wrangler secret put NAME --env staging` for this project only. The names are listed in [docs/deployment.md](docs/deployment.md). Do not put values in the bundle or in git. Staging and production `vars` do not contain empty secret placeholders, because an empty var would replace a secret on the next deploy.

Regenerate Worker types after changing bindings:

```bash
npm run cf-typegen
```

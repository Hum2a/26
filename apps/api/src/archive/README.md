# Game archive

[Home](../../../../README.md) · [Documentation](../../../../docs/README.md) · [Event runbook](../../../../docs/event-runbook.md)

The podium is rendered from the room's SQLite. Neon is not on the path that accepts an answer, writes a score, or builds that snapshot.

When the room enters the podium, the same storage transaction records `room_archive` and a pending `archive-export` job. The scheduler owns the alarm. After gameplay commits, the alarm exports. A database failure reschedules that job. It does not roll the podium back.

The idempotency key is `game_id` plus `revision`. A retry that finds the row already stored returns without inserting another copy. That covers a write that committed and then lost its acknowledgement.

A later hide of accepted media, or a score adjustment, inserts a new correction revision. The earlier revision is left as it was.

`archive_player_detail` and `archive_device_detail` are not read by the public projection. Device detail rows carry `retain_until`, taken from the room's telemetry retention clock. `archive:retain` deletes those rows. Standings, highlights, facts, and media references stay.

## Schema

Version 2 lives in `schema.ts`. A database already on version 1 receives the delivery tables and is marked version 2. A frozen publication is not rewritten. Tables:

| Table                   | Who can read it                                            |
| ----------------------- | ---------------------------------------------------------- |
| `archive_publication`   | One immutable revision. Primary key `(game_id, revision)`  |
| `archive_standing`      | Public positions                                           |
| `archive_highlight`     | Public comparison cards                                    |
| `archive_media_ref`     | Public media id, kind, nickname, and hidden flag           |
| `archive_player_detail` | Personal recap, score lines, and troll counts              |
| `archive_stat_fact`     | Retained aggregates                                        |
| `archive_device_detail` | Raw device reports, removed when `retain_until` has passed |
| `archive_email_grant`   | Hashed verification and personal-link tokens               |
| `archive_delivery_job`  | Email jobs, including uncertain and failed attempts        |

## Migrate and retry

The script reads one environment file and refuses to run without it. `--env local` uses `apps/api/.dev.vars`. Staging uses `.dev.vars.staging`. Production uses `.dev.vars.production`. It prints the database host, or the local PGlite path, and never the connection string.

```bash
npm run archive:migrate -- --env local
npm run archive:migrate -- --env staging
npm run archive:migrate -- --env production
npm run archive:retain -- --env local
```

npm may swallow `--env` and forward only the name. `npm run archive:migrate -- --env local` and `npm run archive:migrate -- local` both work.

Local development without `DATABASE_URL` keeps a mirror inside the room (`dev_archive_*`). That mirror is not used when `APP_ENV` is staging or production. Those environments need `DATABASE_URL`; if it is missing, the export fails and the podium stays up.

The admin screen shows pending, failed, or completed. **Retry archive export** re-queues a failed job through the same scheduler. The public results route says "Preparing results." while the export is pending or failed, and it does not include standings or device rows. A ready game adds the public projection described in `src/results/README.md`.

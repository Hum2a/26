# Performance pass — 24 October 2026

This pass preserves the existing screens, question content, animations, scoring,
server authority and update cadence. It changes delivery and repeated work.
Nothing has been deployed.

## Changes

- Routes load their own code and styles. Home, joining, projector, results,
  sign-in and individual admin pages no longer share one eagerly loaded bundle.
  React Router loads matched parent/child routes together; existing navigation,
  deep links and access checks remain in place. The admin coverage test also
  checks lazy routes.
- Kart preloading loads the renderer that the screen actually uses: phones warm
  the 3D view and the projector warms its map/scoreboard. The projector no longer
  downloads the unused 3D renderer when the kart round is announced.
- A room broadcast reads statistics once, aggregates facts once and selects fun
  facts once, sharing that work across sockets and audiences within that
  synchronous broadcast. Each audience still gets its own validated projection.
  A later broadcast reads fresh data; nothing is cached across accepted actions.
  `build:statistics` appears in the existing host realtime diagnostics.
- Question lookups while assembling statistical answers use a map. SQLite
  indexes cover question answer counts, player score totals/adjustments and
  reactions to a player. Query-plan tests check the indexes actually apply.
- Validated socket patches retain the references of unchanged fields, avoiding
  needless work in downstream consumers. Accepted outgoing commands are removed
  from the retry map; uncertain commands keep their original request IDs.
  Legacy sockets avoid field-by-field serialisation they do not use.
- Static theme decoration and the theme picker skip unrelated parent renders.
  Their own state, theme selection and motion still work. The phase countdown
  retains one interval across clock updates and does no periodic work while
  paused or waiting for the host.
- Authorised media uses one atomic R2 read and streams the body to the browser,
  replacing a metadata read followed by a buffered download. Permission checks,
  hidden-media behaviour and private/public cache policies are unchanged.
- Email rendering/Resend and development JPEG processing load when called rather
  than with every room startup. Existing production services and local adapter
  checks remain in place.
- `_headers` gives fingerprinted build scripts, styles and fonts an immutable
  browser cache. HTML, private media, unversioned demo audio, circuit models and
  question images retain their existing freshness rules. A test prevents plain
  public scripts/styles/fonts being added under the cached paths.
- Room tests explicitly clear external database/email bindings so local secret
  settings cannot redirect their local fixtures to external services. The load
  rehearsal does the same and pauses each measured race before the next size,
  then waits for sockets to close so earlier rooms cannot skew later samples.

## Repeatable checks

After `npm run build`:

```sh
npm run perf:serve
```

This explicitly serves the production **front end only** at
`http://127.0.0.1:4174`. Use the normal development/preview server for real rooms,
authentication and media. This audit server has no simulated API.

In another terminal, set `PERF_URL` to that URL and run:

```sh
npm run perf:audit -- current
npx playwright test --config playwright.performance.config.ts
```

The audit browser uses explicit signed-out session fixtures, a fresh context per
page, disabled caching, a 390 × 844 viewport, reduced motion, fourfold CPU
throttling, 150 ms network latency and 200,000 bytes/second downloads. It records
decoded resource sizes, paint/shift/long-task observations, screenshots, overflow
and script errors under ignored `artifacts/browser-checks/performance/`.

Browser tests enforce total initial script budgets, check that unrelated admin
and 3D pages stay unloaded, exercise navigation and check 320, 390 and 430 px
widths plus short landscape. These are lab checks, not real-user INP or a
production Lighthouse score. The local preview does not reproduce Cloudflare
compression, geographical latency or venue Wi-Fi.

## Verification and measurements

The baseline fetched 1,024,373 bytes of JavaScript and a 220,486-byte stylesheet
on every public entry route. The final browser audit counted every script
resource, including dependencies whose resource initiator is `other`:

| Page            | Initial JavaScript before | Initial JavaScript after | Reduction |
| --------------- | ------------------------: | -----------------------: | --------: |
| Home            |               1,024,373 B |                647,691 B |     36.8% |
| Join            |               1,024,373 B |                881,369 B |     14.0% |
| Projector setup |               1,024,373 B |                795,078 B |     22.4% |
| Admin sign-in   |               1,024,373 B |                652,560 B |     36.3% |

These are decoded sizes: compressed transfer size and parse time are different
measurements. The entry script alone is now 232.78 kB (72.29 kB gzip), but that
is not the whole page's JavaScript. Total styles are 108,105 B for home/sign-in,
186,910 B for joining and 163,077 B for projector setup, versus 220,486 B before.
The Worker entry falls from 6,173.19 kB to 5,675.66 kB (build-reported sizes).

All four final signed-out screenshots match the baseline pixel for pixel at
390 × 844, including the full scrolled document. All four report no script errors
or horizontal overflow. No design CSS was edited.

The baseline used the normal Worker preview; the final audit used the isolated
frontend preview after the normal local Worker transport timed out. The previews
also differed in compression, and other local workloads were running. Paint and
long-task observations are retained in the JSON for diagnosis; they are not a
controlled before/after speed comparison or production Core Web Vitals.

Verification: web unit suite **89 files / 362 tests**, focused Worker room suites
**6 files / 39 tests**, pure statistics/fun-fact/media/email suites **4 files / 28
tests**, and the performance browser suite **9 tests** passed. Typecheck,
production build (including artifact/content checks) and targeted ESLint passed.
The realtime harness also passed with 8, 30 and 80 guests at its default control
rate and six-second measured race windows; no production latency is inferred.
The build continues to report existing large-chunk/PGlite warnings and incomplete
birthday drafts. Commands and load-harness results are recorded in
`build-progress.md`.

## Boundaries and possible later passes

The source audit covered routing/bundling, shared validation, fonts/styles,
question media preloading, gallery loading, WebSocket snapshots/retries,
countdowns, broadcast statistics, SQLite lookups, media delivery, startup imports,
the existing WebGL resource limits and hidden-tab handling, and the archive/auth
boundary. Existing useful optimisations (lazy images, explicit audio preload,
hashed outputs, instanced kart geometry, limited phone pixel ratio, socket
patches, coalesced broadcasts and server-owned deadlines) were retained.

No claim is made that every future workload has been profiled. Physical phones,
projector GPU performance, production cache headers/compression, deployed cold
starts, venue Wi-Fi and real-user interaction latency still need measurement.
The normal local Worker transport also has an existing intermittent timeout;
isolating the frontend allows the loading/layout checks to run independently.

These changes would need a separate decision because they can affect appearance
or behaviour:

- Reducing render resolution, geometry, textures or effects in the kart views.
- Lossy image recompression, smaller photos or different font/theme treatments.
- Reducing animation, scene decoration, theme variety or retained history.
- Sending fewer/slower live updates, adding client prediction or changing race
  tick/input frequency.

Further profiling may identify additional equivalent optimisations; these items
are candidates, not requirements to change the product.

## References checked

- [React Router 7.18.4 route objects](https://reactrouter.com/7.18.4/start/data/route-object)
- [Vite asynchronous chunk loading](https://vite.dev/guide/features#async-chunk-loading-optimization)
- [React memo](https://react.dev/reference/react/memo)
- [Cloudflare R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
- [Workers asset headers](https://developers.cloudflare.com/workers/static-assets/headers/)
- [Durable Object storage](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/)
- [Web Vitals and lab/field interpretation](https://web.dev/articles/vitals)

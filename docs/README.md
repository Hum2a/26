# Documentation

> **26.humza.website** · Humza’s birthday party game
>
> Start here to build the game, prepare the questions or run the night.

[Home](../README.md) · [Local setup](../README.md#local-app) · [Build progress](build-progress.md)

## Choose your starting point

| I want to…                          | Read this                                                                             |
| :---------------------------------- | :------------------------------------------------------------------------------------ |
| Run the app locally                 | [Setup and commands](../README.md#local-app)                                          |
| Decide what Humza must choose or do | [Decisions for Humza](decisions-for-humza.md)                                         |
| Rehearse the whole night on staging | [Rehearsal kit](rehearsal-kit.md)                                                     |
| Present or operate the party        | [Event runbook](event-runbook.md)                                                     |
| Add or refine a question            | [Question authoring](question-authoring.md)                                           |
| Prepare content and media           | [Content guide](content-guide.md)                                                     |
| Release or recover a deployment     | [Deployment guide](deployment.md)                                                     |
| See what has been built and checked | [Build progress](build-progress.md) and [verification report](verification-report.md) |

## Product and implementation

| Document                                     | What it covers                                             |
| :------------------------------------------- | :--------------------------------------------------------- |
| [Party game plan](party-game-plan.md)        | Product requirements, agreed decisions and architecture    |
| [Build prompts](build-prompts.md)            | The implementation sequence and acceptance criteria        |
| [Admin experience](admin-experience-plan.md) | Host workflows and the control-panel design                |
| [Realtime plan](jackbox-realtime-plan.md)    | Live presentation, connections and room updates            |
| [Photo wall](photo-wall-plan.md)             | Uploads, moderation, queues and projector presentation     |
| [Kart evolution](kart-evolution-plan.md)     | Complete upstream comparison and staged incorporation plan |
| [Kart mini-game](kart-minigame.md)           | Driving, multiplayer rehearsal and engine provenance       |
| [Quality-of-life map](qol-map.md)            | Improvements across the party experience                   |
| [Developer tools](developer-tools.md)        | Connected bots, staged loads, reconnects and reports       |
| [Performance pass](performance.md)           | Loading, live-room optimisations and repeatable checks     |
| [Performance & plan audit](performance-audit.md) | Long-session memory, hot-path bottlenecks & Cloudflare plans |
| [Data inventory](data-inventory.md)          | Stored data, access and retention                          |
| [Lines-of-code report](loc-report.md)        | Generated repository size report                           |

## Questions and presenter material

> [!IMPORTANT]
> Answer keys contain spoilers. Keep them away from the projector and guest-facing screens. Generated running orders and answer keys are refreshed with `npm run content:export`.

| Pack               | Presenter running order                                | Private answer key                               |
| :----------------- | :----------------------------------------------------- | :----------------------------------------------- |
| Birthday catalogue | [Running order](content/birthday-running-order.md)     | [Answer key](content/birthday-answer-key.md)     |
| Illustrative demo  | [Running order](content/illustrative-running-order.md) | [Answer key](content/illustrative-answer-key.md) |

Content research and ideas:

- [Party mini-game concepts](content/party-concepts.md)
- [Tribunal and chaos](content/tribunal-and-chaos.md)
- [Inflation price sources](content/inflation-price-sources.md)
- [Original-name sources](content/original-name-sources.md)
- [Who said it sources](content/who-said-it-sources.md)
- [Party polish sources](content/party-polish-sources.md)

## Codebase guides

| Area                     | Entry points                                                                                                                                                                                                                                              |
| :----------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API and room             | [Worker](../apps/api/src/README.md), [room](../apps/api/src/room/README.md), [credentials](../apps/api/src/credentials/README.md), [auth](../apps/api/src/auth/README.md)                                                                                 |
| Content and interactions | [Questions](../apps/api/src/questions/README.md), [trolls](../apps/api/src/troll/README.md), [media](../apps/api/src/media/README.md)                                                                                                                     |
| Data and results         | [Device context](../apps/api/src/device/README.md), [statistics](../apps/api/src/stats/README.md), [results](../apps/api/src/results/README.md), [archive](../apps/api/src/archive/README.md)                                                             |
| Web application          | [Overview](../apps/web/src/README.md), [admin](../apps/web/src/admin/README.md), [guest](../apps/web/src/guest/README.md), [play](../apps/web/src/play/README.md), [stage](../apps/web/src/stage/README.md), [results](../apps/web/src/results/README.md) |
| Shared foundations       | [UI primitives](../apps/web/src/ui/README.md), [validation](../packages/shared/README.md)                                                                                                                                                                 |
| Kart provenance          | [Upstream engine](../apps/kart-solo/UPSTREAM.md)                                                                                                                                                                                                          |

## Repository reference

- [Agent instruction sources](../.agents/README.md)
- [Third-party notices](../THIRD_PARTY_NOTICES.md)
- [Encore Glyph adaptation](licenses/encore-glyph.md)
- Original planning snapshots: [party plan](../26-birthday-party-game-plan.md) and [build prompts](../26-birthday-build-prompts.md). Use the versions in `docs/` for ongoing work.

The plans describe intended behaviour; individual codebase guides may reflect earlier stages. Check the [build history](build-progress.md) and [verification report](verification-report.md) for dated implementation evidence and outstanding checks.

Kart evolution verification: [baseline report](kart-evolution-baseline.md), [raw measurements](kart-evolution-baseline-data.json), [continuation checkpoint](kart-evolution-checkpoint.md).

Kart rendering foundations: [asset/readiness/event contracts and admin rehearsal](kart-render-contracts.md).

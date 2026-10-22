# 26.humza.website - build prompts

[Home](README.md) · [Documentation](docs/README.md) · [Event runbook](docs/event-runbook.md)

Prepared: 22 September 2026  
Source: `26-birthday-party-game-plan.md`  
Purpose: A sequential set of implementation prompts for building the birthday game in its own repository.

<details>
<summary>On this page</summary>

- [How to use this file](#how-to-use-this-file)
- [Sequence](#sequence)
- [Rules that apply to every prompt](#rules-that-apply-to-every-prompt)
- [Prompt 01 - Establish the separate project](#prompt-01---establish-the-separate-project)
- [Prompt 02 - Admin authentication and control credentials](#prompt-02---admin-authentication-and-control-credentials)
- [Prompt 03 - Durable rooms, guest identity and live connections](#prompt-03---durable-rooms-guest-identity-and-live-connections)
- [Prompt 04 - Durable scheduling and the phase lifecycle](#prompt-04---durable-scheduling-and-the-phase-lifecycle)
- [Prompt 05 - The first complete playable quiz](#prompt-05---the-first-complete-playable-quiz)
- [Prompt 06 - Name cloud and the full host control deck](#prompt-06---name-cloud-and-the-full-host-control-deck)
- [Prompt 07 - Slider and tap-based ranking](#prompt-07---slider-and-tap-based-ranking)
- [Prompt 08 - Whole-room voting and guess-the-guest](#prompt-08---whole-room-voting-and-guess-the-guest)
- [Prompt 09 - Simultaneous duels and the finale](#prompt-09---simultaneous-duels-and-the-finale)
- [Prompt 10 - Troll engine and reusable visual effects](#prompt-10---troll-engine-and-reusable-visual-effects)
- [Prompt 11 - R2 uploads, finalisation and media serving](#prompt-11---r2-uploads-finalisation-and-media-serving)
- [Prompt 12 - The public and recurring party effects](#prompt-12---the-public-and-recurring-party-effects)
- [Prompt 13 - Browser/device context and connection measurements](#prompt-13---browserdevice-context-and-connection-measurements)
- [Prompt 14 - Factual statistics and comparison cards](#prompt-14---factual-statistics-and-comparison-cards)
- [Prompt 15 - Reliable game archive in Neon](#prompt-15---reliable-game-archive-in-neon)
- [Prompt 16 - Results, gallery and optional email](#prompt-16---results-gallery-and-optional-email)
- [Prompt 17 - Party presentation and content workflow](#prompt-17---party-presentation-and-content-workflow)
- [Prompt 18 - Failure, security and load verification](#prompt-18---failure-security-and-load-verification)
- [Prompt 19 - Staging, operations and the event runbook](#prompt-19---staging-operations-and-the-event-runbook)
- [Optional continuation prompt when a stage was interrupted](#optional-continuation-prompt-when-a-stage-was-interrupted)
- [Final handoff expected from the completed sequence](#final-handoff-expected-from-the-completed-sequence)

</details>

## How to use this file

1. Open a new, separate birthday-project folder in your coding agent. Do not run these prompts in the LifeSmart repository.
2. Attach `26-birthday-party-game-plan.md` and this file, then run Prompt 01. It establishes the repository and saves both documents into `docs/`.
3. Run the remaining prompts in order, one prompt per task or conversation. Each prompt refers to the repository's persisted instructions and progress record, so it can run without the previous conversation history.
4. Let each stage finish implementation and its relevant checks before starting the next. If an earlier stage is incomplete, resolve that dependency instead of asking a later stage to reinvent it.
5. Humza's actual questions and media can be supplied later. Initial content must be clearly marked as demo content.

The prompts ask for working code, not additional plans. They deliberately keep the full product in view while giving each task a bounded finish line. Completing Prompt 05 produces the first playable multiple-choice game; Prompt 12 adds the main party effects; Prompts 13-16 deliver device statistics and post-game results.

## Sequence

| Prompt | Deliverable | Prerequisite |
| --- | --- | --- |
| 01 | Repository, project rules, UI foundations and local tooling | Empty/separate project folder and the plan |
| 02 | Admin authentication and scoped control credentials | 01 |
| 03 | Durable rooms, guest sessions and reconnecting transport | 02 |
| 04 | Persistent scheduler and phase lifecycle | 03 |
| 05 | Complete multiple-choice game on phones and projector | 04 |
| 06 | Name-cloud lobby and live host controls | 05 |
| 07 | Slider and tap-based ranking rounds | 06 |
| 08 | Whole-room voting and guess-the-guest | 07 |
| 09 | Simultaneous duels and finale | 08 |
| 10 | Troll engine and first visual effects | 09 |
| 11 | Reliable R2 photo and voice media pipeline | 10 |
| 12 | Live typing, voice playback and recurring theme songs | 11 |
| 13 | Browser/device contexts and connection summaries | 12 |
| 14 | Evidence-backed end-game statistics | 13 |
| 15 | Retryable Neon game archive | 14 |
| 16 | Results, gallery, personal recaps and optional email | 15 |
| 17 | Finished party presentation and content-authoring workflow | 16 |
| 18 | Failure testing, security checks and 75-player load testing | 17 |
| 19 | Staging deployment, operational tools and event runbook | 18 |

## Rules that apply to every prompt

Prompt 01 writes these into the new repository's `AGENTS.md`. Every later prompt starts by reading that file.

- This is a separate birthday project. Never change LifeSmart, use its production resources or copy its pupil-specific rules into this project.
- The plan's agreed decisions take precedence over its suggested defaults. Later explicit user decisions take precedence over both. Record material implementation choices.
- Baseer presents and Humza controls. Guests play individually. No pods, guest accounts, CMS, compulsory scoring floor or automatic score multipliers.
- Keep questions in versioned server-side TypeScript. Public question data is a deliberate projection that excludes correct answers, scoring secrets and future reveals.
- One Worker serves the application and API; one SQLite-backed Durable Object owns each room. Neon and email stay outside the live guest-action path. Image/audio processing also stays outside it.
- Persist accepted actions before success acknowledgements. Make retries idempotent. Memory is a cache. Use one durable scheduler to own all room alarms.
- Identity uses random game-scoped credentials. Device information is separately associated context, never an identity fingerprint or authority for scoring.
- Use React, TypeScript, Vite, Hono, Cloudflare Workers/Durable Objects/R2, Neon, Better Auth and Resend as specified in the plan. Use a small shared validation package and consistent styling primitives. Verify current official documentation when implementing version-sensitive APIs; pin compatible dependencies and retain the lockfile.
- Use domain folders, British English, accessible controls and clear phone states. Include reduced-motion support and optional audio. Keep secrets and personal diagnostics off the projector.
- Work in the existing implementation. Do not create competing state stores, socket clients, auth factories, schedulers, schemas or score engines for each new feature.
- Keep production paths real. Deterministic local fakes are allowed only behind explicit test/development adapters; they must not silently succeed in deployed environments.
- Implement, run relevant checks, fix failures and update documentation. Do not rewrite unrelated work or weaken checks to obtain a pass.
- No deployments, paid resource creation or changes to unrelated remote resources are implied by Prompts 01-18. Missing external credentials should not prevent completing locally testable work; report precisely what remains unverified.
- At the end of every stage update [docs/build-progress.md](docs/build-progress.md): status, files/interfaces added, decisions/defaults, commands and results, manual verification, unresolved issues and the exact next stage. Never label an unrun check as passed.
- Final response for each stage: what now works, how to run/try it, what was verified and any concrete remaining limitation. Do not automatically begin the next prompt.

---

## Prompt 01 - Establish the separate project

```text
Build the foundation of 26.humza.website, my birthday party game, in this separate project folder.

Read the attached 26-birthday-party-game-plan.md and 26-birthday-build-prompts.md. Save them unchanged as docs/party-game-plan.md and docs/build-prompts.md. Treat the plan's agreed decisions as the product requirements.

First inspect the working directory. If it is the LifeSmart repository or another unrelated project, stop before changing files and explain that this needs its own project folder. Otherwise preserve any existing relevant work and proceed.

Implement the foundation, rather than only proposing a structure:
- A small npm workspace with apps/web, apps/api and packages/shared. Use React, TypeScript and Vite for web, Hono on a Cloudflare Worker for API, and shared validation schemas. Use Tailwind with semantic design tokens for consistent styling.
- One Worker serves built static assets and API routes. Configure route fallback without returning the SPA HTML for missing API or WebSocket routes.
- Domain folders for guest, stage, admin, results, game, media and stats as they become necessary. Create directory README maps and avoid empty speculative subsystems.
- Routes /, /host, /admin and /r/:gameId with purposeful initial shells and clear development-only placeholder states. Do not imply authentication or gameplay already works.
- Reusable controls, fields, panels, status messages, countdown layout and accessible dialog primitives. Set a party-game visual direction: large readable stage text, bold colour, fast phone input and controlled motion. Do not copy LifeSmart branding.
- Explicit local, staging and production configuration templates. Use Worker bindings at runtime, not process.env singletons. Include secret-safe setup documentation and ignore real secrets.
- Type checking, linting, formatting, a production build, a Cloudflare-compatible test setup and a minimal browser smoke test. Pin compatible dependencies and commit-ready lockfile content; verify current official tooling documentation as needed.
- Write the 'Rules that apply to every prompt' from the prompts document into this project's AGENTS.md, adapted only for actual paths. Add README setup instructions and docs/build-progress.md with the 19 stages.

Do not implement the later game features yet. Do not create or deploy cloud resources.

Completion: a fresh install can run the documented local app and build successfully; each route has a usable shell; production artifacts exclude secret files; relevant initial checks pass. Record commands actually run and any tool/environment limitation in the progress file, then stop after this stage.
```

## Prompt 02 - Admin authentication and control credentials

```text
Implement Prompt 02 for the birthday project. Read AGENTS.md, docs/party-game-plan.md and docs/build-progress.md first. Confirm Prompt 01 exists and extend it in place.

Implement one administrator account for Humza using Better Auth backed by Neon. There are no guest accounts. Recommended login method: email magic link, with public registration disabled and the permitted administrator configured explicitly. Use current official Better Auth documentation rather than guessing APIs or hand-writing generated auth tables.

Keep one auth factory, one database factory and one email-sending adapter. Worker services receive request bindings. Put auth persistence/migrations in the appropriate domain/package and make migration commands explicit about their target environment.

Build /admin with signed-out, requesting-link, confirmation, signed-in and sign-out states. Use a local email inbox/capture adapter for development if real delivery credentials are absent. Never expose a production authentication bypass. Do not consume a magic-link login merely because an email scanner fetched a GET URL; verify the supported approach and document it.

Design and implement reusable room-scoped credentials for later live control and presentation:
- An authenticated admin can receive a short-lived control credential for an authorised room.
- The stage receives a separate, read-only presentation role.
- Normal live command verification will not query Neon on every action.
- Keep credentials out of URLs, public bundles and logs. Use secure cookie delivery, request-origin checks and CSRF protection where appropriate.
- Support expiry and revocation, with a clean path for the room implementation in Prompt 03 to enforce them. Record the interface; do not invent fake room state to claim an end-to-end flow exists yet.

Test administrator allowlisting, failed/expired login, unauthenticated access, role separation and accidental client import of server auth code. Test the local adapter explicitly and clearly identify any external integration not run.

Completion: the local admin flow is demonstrable, protected endpoints reject guests, and the credential verifier is ready for actual room integration. Update build-progress.md and stop here.
```

## Prompt 03 - Durable rooms, guest identity and live connections

```text
Implement Prompt 03. Read AGENTS.md, the party plan and build progress; use the existing auth and shared schemas.

Build the actual room foundation with one SQLite-backed Durable Object per room. Use current official Cloudflare storage and WebSocket Hibernation documentation.

Implement:
- Authorised room creation, an unambiguous short code and collision-safe code resolution. Explain the small code-registry mechanism chosen; do not rely on a process-global map. Each game gets a unique ID and a pinned question-set/scoring version.
- SQLite schema/migrations for room metadata, players, session credential verifiers, accepted request receipts and compact audit records. Add nullable/versioned device-context references now, but leave collection to Prompt 13.
- Guest join using a nickname, a server-generated random player ID and an unguessable recovery credential delivered in a Secure, HttpOnly, same-origin cookie. Document and test how local development exercises secure-cookie behaviour.
- Resume, nickname collision handling and explicit admin-assisted session transfer with short-lived one-use codes. A transfer revokes previous credentials and existing connections, not just future logins.
- A single authenticated WebSocket client implementation with reconnect backoff/jitter, snapshot replacement, pending/sent/accepted states and clean listener cleanup.
- Server origin/role validation, WebSocket attachments, newest-controller-wins duplicate-tab behaviour and a limited stage connection. Bind all actions to the authenticated socket identity.
- Role-specific snapshots, state versions and per-connection delivery sequence handling. Do not treat a global version gap as a lost private message.
- Per-player and per-room limits that survive reconnect, bounded payloads and safe rendering of free text.
- Idempotent command receipts keyed by principal and request ID, with a payload digest so reused IDs cannot silently change meaning. Acknowledge only after durable persistence.

The UI should now allow the admin to create a room, a stage to display it and multiple guests to join/rejoin with the same identity. Gameplay can remain unavailable until Prompt 05.

Test concurrent joins, code collisions, request replay, spoofed player IDs, cross-room access, two tabs, credential transfer, process restart/hibernation and shared-IP guests. Ensure stage snapshots contain neither credential verifiers nor private admin data.

Completion: a working durable lobby and reconnecting transport. Update progress and document the interfaces later stages must reuse.
```

## Prompt 04 - Durable scheduling and the phase lifecycle

```text
Implement Prompt 04. Read the project rules, plan and progress. Reuse the room's SQLite transaction and idempotency infrastructure.

Build the single persistent scheduler for all room deadlines. Only this module may arm or delete the Durable Object alarm. Verify the current Cloudflare transaction/alarm APIs before implementation; do not assume SQL transactionSync can contain asynchronous alarm operations.

Persist job IDs, types, due times, scope/phase generations, status, remaining duration when paused and retry metadata. Arm the earliest outstanding job. Establish and test the ordering/transaction design that prevents a committed job from being left without a wakeup if execution fails between saving the job and setting the alarm. The idle-room case must recover without a guest sending another message.

Implement the phase lifecycle: lobby, intro, prompt, collect, optional vote, reveal, scores, final and podium. Keep the lifecycle reusable for typed round plugins introduced in Prompt 05. Validate transitions rather than letting arbitrary host commands set arbitrary phases.

Required behaviour:
- Pause freezes gameplay deadlines and effect time, while background jobs can continue.
- Resume uses saved remaining durations.
- Skip/advance invalidates old phase jobs.
- Repeated or obsolete alarms cannot score or advance twice.
- Late alarms close one expired phase; later phases receive their full time rather than being skipped in a catch-up loop.
- The stored deadline gates actions even before the alarm handler runs.
- On loss of the controlling host, collection can close but the next reveal/question waits for reconnection. Distinguish controller presence from stage presence.
- Centralise phase teardown; it releases round resources on normal, manual and error paths.
- Cosmetic countdown animation uses the server deadline locally, with no per-tick durable jobs.

Use a deterministic clock/job harness for race tests, alongside real Cloudflare-runtime integration tests for persistence/alarm behaviour. Cover pause/restart/resume, manual advance racing the deadline, duplicate alarm delivery, scheduling failures and an otherwise idle room.

Completion: the lifecycle and alarm mechanism work with a small test round fixture. No production host bypass or untested pseudo-scheduler. Update progress and stop.
```

## Prompt 05 - The first complete playable quiz

```text
Implement Prompt 05: a complete multiple-choice game from lobby to podium. Read the rules, plan and progress; use the existing identity, transport, scheduler and auth.

Build a real round-type contract with shared validated public configuration, validated submissions, supported phases, server-only scoring/reveal logic, and separate phone/stage renderers. Correct answers and future private content must never enter guest JavaScript or pre-reveal payloads. Build the contract and the first round together rather than designing a large abstract plugin framework.

Add a versioned demo question set clearly marked illustrative. Questions are TypeScript, not a CMS. Use 15-45-second configurable collection windows and per-question scores, with no universal floor or automatic round multipliers. Support an optional speed bonus with documented server-receipt timing.

Implement the complete flow:
- Humza creates/selects the demo game and starts it; guests join individually.
- Stage displays prompt, options, countdown and submission count.
- Guest taps, submits and sees pending versus accepted confirmation.
- Server validates phase, deadline and eligibility; persists the answer and any related durable records before acknowledgement.
- Reveal/scoring records a unique score-ledger entry once. Re-revealing never scores again.
- Stage shows the reveal, standings and final podium. Players see their own standing.
- Basic /admin controls provide pause/resume, advance, skip and finish, separated from the projected stage.
- Every waiting, reconnecting, rejected and ended state has clear phone copy.

Add the initial answer lifecycle integration points that later voting, effects and device-context stages will extend. Do not duplicate the game engine inside UI components.

Verify a complete browser-driven run with admin, stage and several guest contexts; duplicate submissions, reconnect during collect/reveal, pause and server restart immediately after an acknowledgement. Inspect guest assets and messages for answer-key leakage.

Completion: I can play an entire small quiz locally on a laptop and phones using the documented setup. Provide exact run instructions, update progress and stop.
```

## Prompt 06 - Name cloud and the full host control deck

```text
Implement Prompt 06. Read project instructions and current progress. Extend the working quiz without changing its storage/transport architecture.

Build the name-cloud lobby with a persistent QR code and short URL. Names appear as guests join and respond to like/dislike votes. Keep the most-liked and most-disliked nickname reveal as a non-scoring opening beat. Use a configurable reaction allowance around ten per guest, and define idempotent replacement/removal behaviour so reconnect/repeated taps cannot manufacture votes.

Use a layout that remains readable with at least 75 demo names. Guests also see a clear joined confirmation. Keep nickname changes separate from stable player IDs.

Implement per-question attribution: never, after and live. Public live mode uses a count plus a rolling sample. Never leak other players' unrevealed submissions through snapshots or payloads just because the UI hides them.

Complete the host control deck for existing capabilities: pause/resume, skip, advance, re-reveal, score adjustment with a reason, rename/kick/recover player, connection counts and finish after the current round. Add extension points for later media/effect controls, but do not show enabled buttons that do nothing. A kicked session must lose existing socket authority too.

Keep controls and private diagnostics off the stage. Add sensible keyboard controls with safeguards against repeat keydown and typing in a field. Add a hide-stage-content action usable during a reveal. Support late joins at zero points without resetting the room.

Test reaction limits, duplicate commands, nickname collisions/swaps, re-reveal without rescoring, immediate credential revocation and late joins. Visually inspect dense lobby and control layouts at phone and projector sizes.

Completion: an energetic lobby and practical control deck on top of the playable quiz. Update docs/progress with actual shortcuts and operating instructions.
```

## Prompt 07 - Slider and tap-based ranking

```text
Implement Prompt 07. Read the rules, plan, progress and existing round contract. Add two round types without changing existing multiple-choice behaviour.

Slider/estimate rounds:
- Configurable bounds, step, units, initial state and server-only truth/scoring rule.
- Explicit submission rather than treating an untouched default as an answer.
- Phone controls usable with touch and keyboard; stage reveal shows truth, relevant guesses and awarded points clearly.
- Validate finite numbers, range, permitted precision and malformed client payloads.

Rank/tierlist rounds:
- Tap an item, then a tier or position. Do not require drag-and-drop.
- Configurable complete or partial responses, stable item IDs and explicit tie rules.
- Server validation rejects duplicate, missing or unknown items according to the chosen mode.
- Implement the plan's configurable scoring approach. If using rank correlation, define its mapping and treatment of ties; do not silently create negative points or a global 0-1000 rule.

Add illustrative content for each type and real phone/stage renderers. Use the existing snapshot, deadline, score-ledger and idempotency paths. Ensure restoring a phase displays accepted responses and never changes their score.

Test scoring boundaries, malformed inputs, identical/worst rankings, zero-width/invalid ranges, duplicate submit, skip/pause and reconnect. Run one mixed game containing multiple choice, slider and ranking.

Completion: both types work end to end, are documented for content authors and pass relevant checks. Update progress and stop.
```

## Prompt 08 - Whole-room voting and guess-the-guest

```text
Implement Prompt 08 using the existing round contract and server authority. Read the plan and progress carefully: there are no pods or voting groups. Each eligible guest votes individually in the same round-wide tally.

Add answer-and-vote: collect text, freeze the eligible candidate set, open voting, accept one ballot by default, reveal and score according to that question's configuration. Support a declared all-submissions mode and an optional host-shortlist mode; do not silently discard answers or invent shortlists.

Persist stable candidate IDs and eligibility. Randomise each guest's initial display order once and keep it stable for that voting phase, including reconnect. Use bounded readable cards for large sets, with selected/accepted states. Never reorder options beneath a pending tap.

Add guess-the-guest with a searchable whole-room player list or a question-configured shortlist. Keep real player IDs separate from display nicknames. Majority-match scoring is an optional round rule, not a global assumption.

Make explicit: self-voting policy, late join eligibility, no-submission/no-vote handling, ties, withdrawn/kicked candidates and ballots targeting invalid IDs. The default is no self-voting, one accepted vote and shared tie awards, unless the question states otherwise.

Respect never/after/live attribution in all public payloads and stage reveals. Handle 75 candidates without rendering names as an unreadable projector list. A host-curated reveal is separate from the underlying room-wide vote tally.

Test collect-to-vote races, duplicate ballots, guessed candidate IDs, stable ordering after reconnect, tally/scoring correctness and recovery immediately after an acknowledged vote. Play a mixed game containing the previous round types and both new ones.

Completion: room-wide voting works end to end, with candidate/scoring policy documented. Update progress and stop.
```

## Prompt 09 - Simultaneous duels and the finale

```text
Implement Prompt 09. Reuse the existing round coordinator, question schemas, voting and score ledger.

Add simultaneous random 1v1 pairings for eligible players. Persist the pairings so restart/reconnect cannot reshuffle opponents. Define and document a deterministic odd-player rule; recommended default is an explicit solo challenge against a configured target, rather than secretly dropping someone. Define how absence, late join and tied results work.

Each pair resolves independently without waiting indefinitely for a disconnected opponent. Use per-question scoring; do not reinstate the original universal winner/loser points. The stage can show a bounded rapid reveal of results without requiring one sequential match per pair.

Add one spectated finale configuration where eligible non-contestants can back a winner and receive the question's configured prediction points. Freeze predictions before the outcome can be known. Persist contestants, predictions, result and score awards idempotently. Ensure the remaining guests have a clear phone state during the duel.

Integrate final tie-break configuration and preserve the existing finish-after-current-round behaviour. Mark demo finale content illustrative.

Test odd/even counts, disconnected opponents, equal answers/times, changed nicknames, duplicate scoring, prediction timing, pause and restart after pair creation or result acceptance.

Completion: a mixed game can finish with a supported duel/finale and a correct podium. Document the content contract and update progress.
```

## Prompt 10 - Troll engine and reusable visual effects

```text
Implement Prompt 10. Read the plan and all current game interfaces. Build a small troll engine rather than modifying each round independently.

Guests have one token for the whole game, unlocked from round two. Atomically validate and persist token spending, target eligibility, effect compatibility and the accepted effect. Retries return the same result. Use one transient slot per target and one persistent slot where needed.

Implement the plan's short queue/expiry/refund defaults: an effect that cannot begin in its valid phase expires and its token is refunded once. Persist effect lifecycle and reuse the room scheduler for expiry. A short serial stage announcement/audio queue prevents overlapping announcements. Pause, skip, cancellation and reconnect have explicit behaviour.

Build a reusable asset-based screen invasion plus these initial effects: fake incoming call from Mum, cracked-screen overlay, a submit button that yields after at most three seconds, temporary nickname swap and hidden personal score. Keep the real player identity and score unchanged for presentation effects. All input-disrupting effects have an escape hatch and respect stable answer IDs.

Add host cancel-effect and stage announcement controls. Integrate reduced-motion behaviour and touch accessibility. Use labelled demo assets until actual media is supplied.

Add the score-modifier mechanism only for questions that explicitly enable it. Ship one demonstrable modifier such as double-or-nothing with fixed ordering and a clear per-round rule; leave unselected catalogue effects disabled rather than pretending they are implemented.

Test double-spend/replay, two targets racing for one token, occupied target slots, one-time refunds, pause/restart/skip expiry, nickname ownership and the no-speed-bonus rule for submission-disrupting effects where configured.

Completion: a small set of working trolls, durable accounting and a documented implemented-versus-candidate catalogue. Update progress and stop.
```

## Prompt 11 - R2 uploads, finalisation and media serving

```text
Implement Prompt 11 using the party plan's media design. Keep binary upload and media processing outside the room's latency-sensitive action handler. Verify current Cloudflare R2, CORS and supported media-processing documentation.

Create private temporary and accepted media key spaces. Implement authenticated upload-slot creation with server-generated IDs/keys, per-player and room quotas, a short-lived presigned PUT URL and direct browser-to-R2 upload.

Photo UI should resize to roughly 1280px, target a compact JPEG, show upload progress, allow retry and handle unsupported HEIC gracefully. Use the planned 1MB accepted-image cap as a configurable default, recognising direct temporary uploads may exceed it before validation.

Finalisation must:
- Accept an upload ID and resolve ownership server-side, never trust an arbitrary client object key.
- Be a persisted recoverable job with lease/retry state.
- Read a specific object using an ETag precondition and bounded bytes.
- Validate actual media content/dimensions, decode/re-encode with a supported implementation and strip unnecessary metadata.
- Write the validated bytes to a fresh final key the guest cannot overwrite.
- Recheck round eligibility/cancellation, then commit single acceptance in the room. Repeated finalisation returns the existing accepted result.
- Handle crash-orphaned final files and temporary cleanup without claiming an atomic transaction across R2 and SQLite.

Implement short voice uploads through the same ownership/finalisation framework with separate format, byte and actual duration validation. Choose a real Workers-compatible validation strategy after checking supported formats; do not trust a client-supplied duration or use a stub decoder. Document any additional service/binding actually required.

Serve accepted media through authorised, revocable routes. Hide must affect future stage and gallery access, including cache policy. Add host hide and phone failed/retry states. Use object lifecycle configuration for abandoned temporary files.

Test invalid types, oversized bodies, cross-player finalisation, ETag changes, duplicate finalisation, phase closure during processing, crash at each handoff and reuse of a PUT URL after acceptance. Verify the accepted media cannot change. Keep real-bucket verification distinct from local emulation; report missing credentials precisely.

Completion: working photo and short-audio upload/serve paths with robust finalisation and clear operational configuration. Update progress and stop.
```

## Prompt 12 - The public and recurring party effects

```text
Implement Prompt 12. Reuse the troll engine, stage cue queue and validated media pipeline. Build the three priority effects from the plan end to end.

1. Live typing broadcast: one active stage target at a time; coalesce updates to around five per second; route drafts only to the authorised stage; expire them on phase changes/disconnect. Do not persist a history of every deleted draft. The accepted answer follows the usual durable path. Enforce the round's declared attribution compatibility.
2. Three-second voice clip: explicit guest recording action and browser permission, supported-format detection, preview/retry, validated upload, then a persisted later playback cue. Missing permission or unsupported recording must not block normal play.
3. Recurring theme song: assign a configured short sting to a player, then enqueue it for relevant score reveals. Use a persistent effect slot, bounded cue length and clear expiry. Persist cue IDs so reconnect does not restart an old reveal's audio.

Add optional captioned-photo/sponsor-break rendering using the existing media and effect types if it fits the same small abstraction; do not broaden into the entire unused catalogue.

Complete stage audio unlock, master mute, stop-current-cue and controlled serial playback. Demonstrate browser autoplay restrictions honestly. Do not promise exactly-once audible output across a browser crash: favour dropping an uncertain/expired entertainment cue over playing it repeatedly, and document the policy. Score/token state still has exactly-once application semantics.

Use short labelled demo assets and document how Humza replaces them. Verify no private admin information appears on the stage, and the controller remains usable during effects.

Test cue overlap, persistent/transient slot interaction, pause/skip, stage refresh, target disconnect, recording denial and return from a backgrounded phone. Update the implemented-effects catalogue and build progress.
```

## Prompt 13 - Browser/device context and connection measurements

```text
Implement Prompt 13 using section 12 of the party plan. The purpose is fun end-of-game statistics associated with each player's game actions, not fingerprint-based identity.

Build a versioned allowlisted collector for supported browser data: normalised device/OS/browser family, screen and viewport CSS dimensions, pixel ratio, orientation, input capabilities, approximate hardware hints, language/time zone, relevant media capabilities, supported network estimates and data-saver preference. Verify current MDN/official API documentation. Use feature detection and explicit unknown values.

Keep a random deviceContextId separate from playerId and credentials. Record an initial context after join without blocking play. Update material changes at controlled intervals/phase boundaries. Link accepted answers to the context at submission; ensure a context can belong only to its authenticated player/game.

The browser may not have sent its context before the first answer. Accept that answer normally with an unknown context rather than rejecting it or inventing device facts. Transferring to a new phone creates a new context under the same player; it never creates another vote or participant.

Measure game WebSocket round-trip samples, reconnections and upload/submission retry summaries with bounded buffers/aggregates. Reuse the existing heartbeat mechanisms and preserve hibernation where practical. Do not create per-keystroke or per-frame telemetry histories.

Normalise and validate server-side. Browser reports are untrusted and must never control scoring, authentication or eligibility. Do not store raw cross-site fingerprints or identify players by IP. Do not probe location, contacts, other sites' sessions or permissions unrelated to gameplay.

Explain the device-statistics feature briefly in the join interface. Treat physical phone size/model as unknown unless genuinely supported or explicitly self-reported: CSS screen size is not inches, and effectiveType=4g is not proof of mobile 4G service. Keep unknown/ambiguous iPhone/iPad classifications visible in the data model.

Implement the recommended configurable 30-day detailed-telemetry retention mechanism without deleting game results/media under the same policy. Ensure archived copies can follow that policy when Prompt 15 is implemented.

Test absent APIs, spoofed/extreme values, API exceptions, shared IPs, duplicate reports, resize storms, context ownership, cookie transfer and multiple reconnects. All existing game flows must still work with telemetry completely unavailable.

Completion: documented, bounded device and connection context attached to actual gameplay records. Update progress and stop.
```

## Prompt 14 - Factual statistics and comparison cards

```text
Implement Prompt 14. Use the existing accepted actions, score ledger, media/effect records and device contexts. Read the plan's statistical definitions carefully.

Build deterministic aggregation functions that generate structured fact records before any prose. Each fact includes an ID, scope, source revision, metric/grouping definition, numerator, denominator, unknown count and display eligibility. Counts use unique players or accepted responses explicitly, never sockets or retries.

Implement:
- Device-family counts, including unknown/unclassifiable guests.
- Per-question answer distribution and within-device-group answer rates.
- Reported screen-size-group comparisons using a documented, versioned cutoff defined before analysis, not selected to maximise a difference.
- Fastest correct accepted answers, most divisive questions, troll popularity/given/received and reconnect survival facts.
- Personal recap inputs and game-wide comparison cards.

Use the first participating context for game-wide device counts and context-at-submission for question comparisons. Exclude host/test/synthetic clients. Retain late-join and missing-answer semantics. Suppress percentage comparisons for groups smaller than five by default and include the supporting counts in the presentation.

Use templates to turn facts into friendly British English. 'Most B voters had iPhones' is not the same claim as 'iPhone users were more likely to choose B'; implement both only when their respective calculations support them. Do not infer physical phone size, nationality, internet provider or causal effects from browser data.

Create stage-ready and results-ready cards, with explicit illustrative labels for fixtures. Actual stats must not be replaced by demo numbers when data is missing. Provide a host preview of eligible highlights.

Do not add a paid AI dependency. If preparing an optional future AI wording interface, it receives only permitted fact records and cannot invent numbers; leave the deterministic path complete.

Test aggregates against hand-calculated fixtures with unequal device group sizes, unknown values, duplicate reconnects, transferred devices, small cohorts, ties and zero denominators. Verify attribution rules for public cards and private personal recaps.

Completion: accurate, explainable stats from real game records with meaningful fixture tests. Update progress and stop.
```

## Prompt 15 - Reliable game archive in Neon

```text
Implement Prompt 15. Use the existing database/auth factory and durable room scheduler; do not introduce Neon into live guest-action processing.

Create versioned archive schemas/migrations for completed games, public standings/highlights, accepted content required for recaps, score/effect summaries, media references, device/statistical records and export status. Keep personal detail and public result projections separate. Add indexes and uniqueness constraints for the actual access patterns.

When the game completes, persist its final revision and pending export job atomically in room storage. The podium renders immediately from the room's durable state. Export asynchronously with bounded retries/backoff using stable keys based on gameId and final revision; a duplicate or uncertain write cannot append duplicate results.

Record verified export completion before considering the durable source disposable. Expose export pending/failed/completed status in authenticated admin diagnostics and a safe 'preparing results' state for the results route. Neon unavailability must not interrupt answering, scoring or podium display.

Reconcile authoritatively hidden media and later administrative corrections with the archive. Define explicit versioned correction exports rather than mutating frozen results ambiguously. Ensure the device-retention policy covers archived raw/detail records, while retaining permitted aggregates.

Use explicit local/staging/production migration scripts and a local test database or explicit development adapter. Do not silently target a DATABASE_URL from an unrelated environment. Keep database credentials out of the browser.

Test export failure, process restart, retry after a successful-but-unacknowledged database write, correction versions, media hiding and retention. Exercise the real database integration if credentials are configured; otherwise run the complete local contract tests and mark remote verification pending.

Completion: completed games reliably become an archive without affecting the live game. Document schema and operational retry tools; update progress and stop.
```

## Prompt 16 - Results, gallery and optional email

```text
Implement Prompt 16 on the real archive and media-serving interfaces. Read project rules, the plan and progress.

Complete /r/:gameId with final standings, selected highlights, factual comparison cards, a shared gallery and accessible phone layouts. Separate its intentionally shareable public projection from the authenticated personal recap. Never expose credential hashes, detailed device contexts, private drafts or arbitrary per-player records through public JSON endpoints.

Connect a recovered guest session to their own final position, best answers, earned points, trolls given/received and stat line. A gallery may show shared photos; do not claim the uploader is everyone pictured. If explicit tags are not implemented, describe the gallery honestly as shared.

Handle archive preparation, missing/expired games, hidden media and empty highlight sets cleanly. Respect public attribution rules. Implement the selected sharing/retention configuration and document the defaults without assuming every detailed record is permanent.

Add optional email collection after play only. Verify the supplied email address before sending personal results. Use the existing Resend adapter, durable delivery-job records and provider-supported idempotency where available. Define retry handling for uncertain provider outcomes instead of claiming network delivery can be universally exactly once.

Email links for personal results must be scoped, expiring and recoverable without guest accounts. Do not put reusable session secrets into a public results URL. A claimed playerId is never sufficient to fetch another person's recap.

Provide previewable local email templates with no live sending in tests. Keep transactional delivery in one module and support failure/pending/retry states.

Test public-versus-personal access, guessed IDs, expired links, media hide/cache behaviour, optional email verification, repeated requests and duplicate delivery jobs. Verify the complete podium-to-results journey locally and any configured remote integrations.

Completion: a usable post-game experience and optional delivery flow. Update progress and stop.
```

## Prompt 17 - Party presentation and content workflow

```text
Implement Prompt 17. Review the finished surfaces against the party plan, preserving the verified architecture. Focus on the quality of the actual guest/presenter experience.

Polish phone input, lobby, stage questions, attribution reveals, scoreboard, duel finale, podium and results so they feel like one game. Improve typography, spacing, feedback, motion and contrast using the existing design tokens and primitives. Honour reduced motion. The stage must remain readable from across a room; private controls stay on Humza's screen.

Audit every implemented round/effect for useful waiting, pending, accepted, rejected, disconnected, resumed and completed states. Resolve double taps, accidental navigation, keyboard focus, screen-reader labels and phone orientation issues. Preserve brief effects and fast answering rather than adding long compulsory animations.

Create a practical content-authoring guide and versioned demo pack demonstrating all implemented round types and selected trolls. Real questions/media supplied by Humza should be integrated if present; otherwise label fixtures illustrative and leave a precise asset/question checklist. Do not invent personal facts about guests or pass generated sample questions off as Humza's content.

Add a build-time content validator for IDs, durations, answer/scoring validity, phase compatibility, attribution/troll compatibility and required assets. Keep questions as TypeScript; do not build a CMS. Create a readable offline question/answer export for fallback and a presenter running-order export.

Separate build-time preflight checks from runtime controls. Detect broken asset references and unsupported selected effects before the event. Ensure runtime load failures still degrade cleanly.

Inspect the actual UI in a browser at representative phone sizes and projector resolutions. Use real interactions and screenshots where tooling permits; do not claim a visual review from a successful compile alone.

Completion: coherent, usable party presentation and a documented content workflow with validators and fallback exports. Update progress with visual checks, unresolved real-device checks and remaining real content needed.
```

## Prompt 18 - Failure, security and load verification

```text
Implement Prompt 18 as an active hardening task. Read the plan, progress and existing test suite. Run meaningful tests, fix actual defects and document the evidence; do not merely produce a review checklist.

Extend the existing Cloudflare-runtime integration tests and browser harness for:
- Crash/restart immediately after acknowledging an answer, ballot, token spend, score adjustment or finalisation. State survives once.
- Lost acknowledgements, duplicated/reordered commands, reused request IDs with altered payloads and stale phase messages.
- Alarm persistence boundaries, duplicate/late alarms, host advance/deadline races, pause/restart/resume and an idle room with scheduled work.
- Guest transfer, immediate revocation, duplicate tabs, spoofed IDs, cross-room commands, role escalation and WebSocket-origin/CSRF checks.
- Guest bundle and pre-reveal payload inspection for answer keys and credentials.
- Oversized/invalid media, concurrent finalisation, rewritten temporary objects, crashed promotion, orphan cleanup and hidden-media cache behaviour.
- Missing browser APIs, malformed telemetry, reconnect double-counting and device-context ownership.
- Neon outage/export recovery and uncertain email-provider outcomes using controlled test adapters.

Build a configurable 75-guest load scenario, isolated in a synthetic room, with burst answers/votes, concurrent uploads, one typing broadcast, repeated reconnects and a full multi-round soak. For protocol scale use lightweight clients if running 75 full browsers is impractical; supplement with browser sessions for real UI behaviour and explain the distinction.

Measure acknowledgement latency percentiles, errors, reconnect completion, timer lateness, retained collection sizes and stage responsiveness. Record the environment, sample counts and observed limits. Do not label a local emulator test as proof of production performance, and do not load-test production or send real email.

Add CI checks that protect the meaningful invariants without brittle timing assertions or tests that simply mirror implementation. Fix reproducible defects and rerun affected checks. Keep external credentials optional for local checks and report unrun remote tests accurately.

Completion: reproducible test commands, a concise docs/verification-report.md with results and remaining venue/real-phone checks, and no known unresolved blocker for the next stage. Update build progress; if a blocker remains, state it specifically rather than marking this stage passed.
```

## Prompt 19 - Staging, operations and the event runbook

```text
Implement Prompt 19. Read the plan, progress and verification report. Prepare the complete application for the event, using the birthday project's own resources only.

First finish and verify all local deployment configuration: explicit staging/production Worker environments, Durable Object migrations, correct R2 buckets/CORS/lifecycle policies, static assets, secret manifests, Neon migrations, email adapter configuration and any actual media-processing bindings. No invented account IDs, domains, credentials or resource success messages.

If the intended birthday staging account/resources and credentials are already configured, deploy to staging and run a real smoke game there. Otherwise finish the deployable artifacts and list the exact missing external setup; do not substitute LifeSmart or personal resources from another project. Do not deploy production or alter live DNS unless I explicitly request that in this task.

Provide:
- Explicit deployment, migration and rollback commands per environment, with version/content pinning and additive migration discipline.
- Authenticated diagnostics for phase, connections, scheduler health, failed media jobs and archive state. Redact credentials and unnecessary personal data.
- Safe retry/recovery actions for pending media/export/delivery jobs; no broad database wipe as a routine recovery tool.
- A reproducible same-room recovery drill, a readable score-summary export and offline question/answer/presenter exports.
- An event runbook for Baseer presenting and Humza operating: preflight, joining, controls/shortcuts, audio unlock, pause, missing player recovery, hide/cancel, Wi-Fi disruption, archive verification and shutdown.
- A final checklist of actual questions/media still needed and real-phone/projector/venue checks that cannot be completed from this environment.

On staging, if available, verify admin login, guest join, stage role, at least one full mixed game, a real photo/voice upload, recovery, final export and results access. Send an email only to an explicitly configured test recipient using the test-delivery mode. Record what ran and what did not.

Do not assert that the venue rehearsal or real-device checks happened unless they did. Update README, deployment/runbook docs and build-progress.md with verified readiness, outstanding external steps and the deployed staging URL if there is one. Stop after reporting the concrete result.
```

## Optional continuation prompt when a stage was interrupted

```text
Continue the current birthday-game build stage. Read AGENTS.md, docs/party-game-plan.md, docs/build-prompts.md and docs/build-progress.md, then inspect the actual working tree and test results.

Identify the last incomplete stage from evidence, not just a checked box. Preserve existing working code and finish its remaining implementation and verification. Do not start a parallel replacement architecture, assume missing credentials exist or mark blocked remote checks passed. Update the progress record and stop at that stage's completion boundary.
```

## Final handoff expected from the completed sequence

- A working individual multiplayer party quiz with the agreed round types and selected trolls.
- Durable acknowledged actions, reliable same-room recovery and one coordinated scheduler.
- Validated private media uploads and controllable stage playback.
- Browser/device-linked facts and correctly qualified comparison statistics.
- A retryable archive, shareable results, private recaps and optional verified email.
- Real checks, reproducible local/staging instructions and an honest list of remaining event preparation.

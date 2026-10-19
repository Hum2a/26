# Admin experience and page redesign

Prepared: 18 October 2026. Updated: 19 October 2026. Status: Stages A and B implemented and locally verified. Stages C–E remain planned. Not deployed.

## Outcome

Give 26 a proper front door and make it straightforward for Humza to prepare, run and recover the party. The home page offers **Join the party** and **Admin sign in**. Once signed in, Humza lands in a spacious workspace with a visible route back to the current room. Baseer's projector stays a separate presentation surface.

The goal is deliberate use of space, not making every element fill it. Small forms should stay comfortable to read; complex operator tasks should use desktop width. Pages share accessible controls and themes, but have compositions suited to their purpose. Retain the existing question-specific designs.

## Evidence and limits

Reviewed the live home and signed-out admin pages in Chrome at 1920px wide, plus LifeSmart's public home page. Reviewed the local router, shared frame, admin login and confirmation, full admin lobby component, room API client, room routes/registry, auth configuration, guest recovery, stage setup and results entry states.

Findings:

- `/` immediately opens the guest form. Its header provides no obvious admin entry. On desktop, inputs, status strips and buttons span nearly the whole screen.
- `/admin` uses the shared phone-width frame (36rem maximum), even though its signed-in content is an operator console. It still says “Development shell”.
- The shared navigation mixes Guest, Stage, Admin and an illustrative results URL. It does not express a preparation or event workflow.
- `AdminLobby` combines creation, room information, live commands, player selection, moderation, scoring, media, effects, diagnostics, archive status and highlights in one panel. Important controls compete with occasional recovery tasks.
- Room restoration depends on `sessionStorage['26-lobby']`. The reviewed API exposes creation and operations, but no admin room-list endpoint. A dashboard with reliable room recovery therefore requires server work.
- The deployed admin page initially displayed a local-looking email value, whereas the current source has a different prefill. This is evidence of a deployed/source discrepancy, not proof of an authentication configuration fault. Remove the public prefill and check build provenance during implementation.
- After the session check settled, the live page enabled the form while still saying “Checking the administrator session”. Signed-out, failed and loading states need distinct copy.
- LifeSmart visibly separates its brand/home link and sign-in entry from the joining task. Borrow that clarity. The requested dedicated home with two options is a new 26 design, not a claim that LifeSmart currently has that exact page.

No sign-in email was requested, no room was created, and no live game state was changed. Signed-in live layouts, actual session expiry and phone behaviour were not exercised. Findings about those are from source review. This is a plan, so proposed endpoints, layouts and tests below do not yet exist.

## Journeys and navigation

### Guest

Home → Join the party → code and nickname → existing lobby/game → results.

A QR link still goes directly to `/j/:code`, bypassing home. Existing `/?room=CODE` links must continue prefilling the join screen. Returning guests get **Return to your game** after the existing session has been verified; an explicit new-room QR link must not silently move them out of their current game.

### Admin

Home → Admin sign in → existing email-link confirmation → dashboard → create or resume a room → live console.

An already signed-in admin visiting the login route goes straight to the dashboard. A protected deep link returns to its original destination after authentication. Validate that return path against same-origin admin routes; never accept an arbitrary redirect URL. Preserve the explicit confirmation button on email links so an email scanner cannot consume a link just by opening it.

### Projector

Room console → Open projector → connect the selected room → start presentation/audio when the browser requires a gesture.

Opening a tab is not proof of a connected stage. Show connection status in admin. Use the current restricted presentation credential; never put control credentials into the URL or projector output. Make this same-browser flow work first. A separate projector device needs a deliberate restricted pairing flow, not a public join code treated as authority.

## Proposed routes

- `/`: public home, with the two clear entry actions.
- `/join`: dedicated joining form.
- `/play`: guest controller, including existing recovery and waiting states. An unjoined visitor gets the joining flow.
- `/j/:code`: supported direct-join route using the same guest flow.
- `/admin/login`: compact dedicated login page.
- `/admin/confirm`: existing explicit confirmation flow, with a useful expired-link state.
- `/admin`: signed-in overview; signed-out visitors go to login.
- `/admin/rooms`: rooms and their recovery/status information.
- `/admin/rooms/:gameId/live`: primary operator console.
- `/admin/rooms/:gameId/players`: searchable player list and individual tools.
- `/admin/rooms/:gameId/media`: accepted media and moderation.
- `/admin/rooms/:gameId/results`: score summary, archive, highlights and delivery status.
- `/admin/rooms/:gameId/health`: connection and recovery tools.
- `/admin/content`: read-only pack readiness and running order.
- `/admin/settings`: account/session information and interface preferences.
- `/screen`: projector setup and presentation.
- `/host`: compatibility route to `/screen`, preserving supported query parameters. Do not repurpose it as admin and break existing stage links.
- `/r/:gameId`: existing public/personal results flow, with a redesigned layout.
- `/design`: retain the development-only question design bench.

Use nested admin layouts and a room-level navigation bar. Keep the room provider mounted while changing room sections so navigation does not open multiple sockets or lose pending action feedback. Page title, breadcrumb and current-room label must make the destination obvious. Unknown rooms and unauthorised rooms get a useful error with a route back to Rooms.

## Page compositions

### Home: an invitation with two destinations

A generous editorial composition: 26 wordmark, a short party headline, one sentence explaining the quiz, then two clearly labelled actions. Desktop can use an asymmetrical text/graphic split; mobile stacks it. Join is the primary action and Admin sign in is prominent enough to find immediately. A verified admin sees **Open admin** instead.

Use the existing theme palette and brand typography. Any supporting artwork should feel personal to the event without inventing dates, venue details or facts. Keep results links contextual to a real game rather than offering the example game globally. The wordmark becomes a home link on non-game screens.

### Join: a focused form

At desktop sizes, centre a roughly 28–32rem form with space around it; do not stretch it to 1900px. On phones use the available width with safe margins. Give the code a clear grouped treatment and nickname its own ordinary input. They need not look identical.

Place Join beside the form on desktop and within thumb reach on phones. No warning banner for the normal condition of not yet joining. Put the detailed device-statistics explanation behind a clearly labelled disclosure while retaining a short, visible explanation of collection before joining. Recovery gets a secondary “Changed phones?” route. Remove “About this build” from the primary task; keep useful version/support information in a quiet disclosure/footer.

Show invalid code, closed room, nickname rejection, request failure and reconnecting states precisely. Keep entered values after a rejected request. Account for the onscreen keyboard, 200% zoom and landscape phones.

### Login: quiet and reliable

A narrow form within an intentional page, with a home link, clear purpose and no development navigation. Start with an empty email field and browser autocomplete. State that access is restricted without publishing the configured address.

States: checking session, signed out, sending, check your email, confirming, signed in, expired/used link, unavailable and retry. A successful session check must clear its loading message. Catch network and validation failures, offer Retry, and never leave the page indefinitely disabled. Resending honours server limits and uses accurate feedback. Do not claim that an email was delivered when only a request was accepted.

Reuse Better Auth and current cookies. Initially preserve the existing session policy, verify that a normal return visit reuses it, and show expiry recovery when needed. Changing auth methods or extending privileged sessions is separate work, not a layout shortcut.

### Admin overview: the next useful action

Desktop: persistent sidebar around 15rem, a compact top bar, and a flexible content area capped near 90rem. Main content uses the width for a current-room feature and a narrower preparation/attention column. Typical content padding: 24–40px. Avoid both an endless stretched row and a phone-width central stack.

Sidebar: Overview, Rooms, Question packs, Settings. Account/sign out sits at the bottom or in a labelled account menu. Within a room add Live, Players, Media, Results and Health as contextual navigation rather than another global wall of links.

Overview priorities:

1. Current/recent active room, its join code and status, with **Resume room**.
2. **Create a room** when appropriate; keep the distinction from resuming explicit.
3. Preparation readiness: released pack availability, projector connection for the selected room and concrete unresolved items.
4. Recent completed rooms and links to their results.

Show real information only. Missing credentials, unavailable delivery counts or an unreleased birthday pack are labelled accurately. Do not present a guessed “all ready” indicator. No empty charts or decorative metrics.

### Room setup: clear decisions before a game exists

Show the available released pack, its version and round count, then create with the existing idempotent flow. The current creation/start flow uses the illustrative demo; do not add a functioning pack selector until the server actually supports the selection and stores the version. An unreleased birthday pack is visible as preparation information, not a startable choice.

After creation, show the join code, copyable guest link, QR, Open projector and Go to live controls. A create retry reuses the original request id after an uncertain response. Never create another room merely because the dashboard was reopened.

### Live console: a control desk

Use three zones on a wide desktop:

- Main workspace: current question/phase, server deadline, response progress and phase-relevant response or moderation detail.
- Secondary column: join code, connected phones/stage, relevant alerts and compact stage status. Any preview uses the public presentation projection; it must not accidentally render host answers onto the real projector.
- Persistent action area: one primary next action with an accurate label, Pause/Resume, stage visibility, and a secondary More menu.

Examples: in the lobby, Start quiz and Reveal nickname votes; during collection, Pause and Advance; during reveal, Advance and Show reveal again. Keep phase-specific controls out of the way when unavailable, while explaining temporary disabled actions. Put Skip and Finish behind deliberate confirmation describing the effect; preserve “finish after this question” semantics. Stage audio controls are optional and their actual cross-tab behaviour must be verified before promising central remote control.

The control area remains visible without covering content. At 1280px collapse the secondary column into compact sections. At tablet width use two columns only when they remain readable. At narrow widths stack content and keep just the main controls nearby; no squashed desktop table. No full-screen form of equally weighted buttons.

Expose failed/pending/success actions close to the control concerned. Retain the same request id when retrying an uncertain command. Show connection loss and prevent misleading success while disconnected. A server snapshot remains authoritative after reconnect or a command race.

### Players: a list with an individual workspace

Desktop: searchable table/list with nickname, connected state, score and the available answer state. Selecting a player opens an adjacent detail area. Mobile: readable rows and a full-width detail sheet/page. Search must tolerate duplicate nicknames and keep stable player IDs internally.

Put rename, transfer/recover, kick, nickname swap and score adjustment in that player's context. Score changes show signed points, the required reason and recorded history. Distinguish a phone transfer from recovering a kicked player. Recovery codes are visible only to the operator and only while needed. Confirm consequential actions with the nickname and result; do not put kick beside a routine click without separation.

### Media and effects: visual, contextual moderation

Use a media grid for accepted photos and an audio list with labelled playback controls for voice clips, provided an authorised preview endpoint actually exists. Missing preview capability must be implemented; object keys are not browser-ready URLs. No autoplay. Show owner, kind, status and Hide action. Keep rejected/stuck processing information in Health with a contextual link.

Active effects and announcement controls remain contextual to Live; offer a compact list with target and Cancel. Do not move urgent dismissal actions several pages away.

### Results: an event report

Admin results uses a broad standings list, highlights and a smaller export/delivery column. Separate a completed live game from an archive still preparing. Offer the existing score-summary download, real results link and scoped retry actions. Individual delivery information stays private. A public gallery uses only the media the existing results policy permits.

Public results gets a podium-led composition, followed by standings and shared moments. Personal results and optional email remain clearly distinct from the public report. Preparing, unavailable and failed states explain what can be done next without fabricated scores.

### Content: visibility without a CMS

A read-only catalogue of packs, version, draft/released state, ordered questions, mechanic, presentation and missing content. Default to readiness and running order; keep answer keys out of public responses. An admin-only preview may be added later with explicit private projection tests.

Questions remain versioned server-side TypeScript. No in-browser answer editor, drag-to-save running order, publish button or demo replacement is implied. Provide a short link to the authoring workflow. The development design bench stays development-only.

### Health and settings: occasional tasks have a home

Health groups connections, scheduler status, media processing, archive and email work. Show timestamps and unavailable/stale information honestly. Existing release/retry operations are contextual to their failure; do not make them primary dashboard buttons. Explain when retry cannot safely guarantee provider delivery.

Settings contains account/session state, sign out, interface preferences and build identification. Phone and projector theme choices stay independent. Do not invent editable event settings for values which are currently versioned content or Worker configuration.

### Projector: presentation first

Before presenting, provide a tidy setup view for connecting, sound and fullscreen. After entering presentation mode, remove site navigation, development labels, forms and private diagnostics from the projected composition. Keep a deliberate escape back to setup. Use the full safe area for the question, visuals, countdown and results; retain projector minimum type sizes and existing custom designs.

Keep operator connection details on admin. The stage should display a safe public reconnect state, not internal failures. Verify restricted presentation access and ensure stage shortcut wiring cannot grant operator authority. No answer, option or score may be hidden by a decorative transition.

## Existing foundations and required server work

Reuse `ui/primitives.tsx`, theme installation/skins, `room-api.ts`, `room-socket.ts`, the existing reducer and durable scheduler. Split the current `SurfaceFrame` by layout purpose while keeping shared chrome and controls in `src/ui`. Extract `AdminLobby` incrementally; do not implement a second room store or socket client.

Add a single room-scoped provider/hook under admin that owns the snapshot, socket lifecycle and command feedback across nested pages. Keep it backed by existing transport and validation. Derived UI state may select/filter snapshot data; it must not calculate scores or phase transitions. Audit the current many individual snapshot states during this extraction rather than duplicating them.

Proposed new interfaces, to finalise against current schemas during implementation:

- Authenticated paginated `GET /api/admin/rooms`: discover room IDs, join codes, creation time and safe summaries. Extend the existing room registry; do not create a competing directory or poll every room DO for every dashboard render.
- Authenticated room detail/resume operation: verify the room exists, obtain an authorised current summary, and explicitly issue/renew the existing scoped control and presentation cookies as required. Reuse the existing credential-issuance service/routes. A browser storage record is a convenience hint, never authority.
- Read-only authenticated pack-readiness endpoint with an explicit projection excluding answer keys and scoring secrets. Read versioned server definitions; no client import of the server catalogue.
- Reuse the existing authenticated diagnostics and results/outbox endpoints. Add only missing preview/list interfaces identified while implementing Media and Results.

The current room cookies may constrain simultaneous control of different rooms. Verify their scope before implementing switching. Default to one selected control room per browser, with an explicit switch; do not promise independent concurrent room tabs. Tests must cover a stale tab after switching and credential replacement. Existing active games need no destructive migration. Registry summaries should identify stale/unavailable phase data; refresh detail from the authoritative DO on opening a room. Live guest actions must not acquire a Neon dependency.

## Design and interaction rules

- Retain 26 basic as the default. Use palette variables and existing skins; no colours scattered through new page CSS.
- Distinct layouts: editorial home, focused join/login forms, wide admin workspace, immersive projector, report-style results. Consistency comes from typography, navigation and behaviour rather than identical fields or cards.
- Prefer open sections, separators, lists and contextual detail over nested panels. Use cards only to group a meaningful task.
- Buttons have a visible hierarchy. Primary actions do not compete with sign out, diagnostics or developer information.
- Large phone targets, labelled fields, keyboard support, visible focus, appropriate live regions and dialog focus restoration. Never rely on colour alone.
- Use existing Motion/shared easing for presence, navigation and feedback. Reduced motion keeps brief fades and removes spatial/decorative motion. No looping controls.
- Open current official component documentation before implementation. Likely candidates are shadcn Sidebar, Base UI Dialog/Tabs/Menu and Motion layout/presence; select only what fits the installed primitives. No new parallel component kit.

## Implementation sequence and acceptance gates

### Stage A — Front door and access

Add home, `/join`, `/play`, login separation and route compatibility. Improve auth state handling, empty email input and safe return destinations. Replace development-shell navigation on these surfaces.

Tests first/alongside: `apps/web/src/home/home-page.test.tsx`, `apps/web/src/admin/admin-auth.test.tsx`, `apps/web/src/router.test.tsx`; add `e2e/admin-entry.spec.ts` following existing e2e conventions. Cover both home actions, existing session, signed-out/error states, expired confirmation, old join links and redirect validation. Check guest recovery after moving away from `/`.

Done when guests join directly from QR links, admin is reachable from home, and returning authenticated admins skip the login form. Run `npm run test:unit` and `npm run typecheck`, plus the relevant browser flow.

### Stage B — Recoverable admin workspace

Implement the wide admin shell, nested routes, authoritative room discovery/resume and explicit room switching. Introduce the one room-level provider backed by the existing transport. Use a real current-room overview; do not build placeholder metric cards.

Tests: `apps/web/src/admin/admin-shell.test.tsx`, `apps/web/src/admin/rooms.test.tsx`, `apps/api/test/admin-rooms.spec.ts`, `e2e/admin-room-recovery.spec.ts`. Cover unauthorised listing, missing room, pagination, empty registry, refresh/new-tab recovery, cookie expiry, revoked credentials, stale tab after switching and one socket per mounted room. Use worker tests for registry/DO behaviour and the existing auth test project for authentication boundaries.

Done when closing and reopening admin can recover a real existing room without creating another one. Required unit/type checks and targeted Worker/e2e checks pass.

### Stage C — Live desk and player tools

Move existing commands into the live layout and player section without changing game semantics. Add deliberate confirmation and scoped pending/error feedback. Preserve keyboard shortcuts, suppressing them while a field or dialog is active.

Tests: `apps/web/src/admin/live-console.test.tsx`, `apps/web/src/admin/players-page.test.tsx`, `e2e/admin-live-controls.spec.ts`. Cover phase-sensitive actions, pause/resume, finish-after-round, duplicate retry IDs, reconnect, rename/transfer/score changes and projector exclusion of private fields. Re-run existing host-action Worker tests.

Done when the current round and main action remain visible at laptop size, player actions need no hunt through a long page, and reconnects preserve authoritative state. Required checks pass.

### Stage D — Media, results, content and health

Implement the remaining admin sections with their real backing interfaces, then redesign public results. Keep urgent media/effect controls linked from Live.

Tests: `apps/web/src/admin/media-page.test.tsx`, `apps/web/src/admin/health-page.test.tsx`, `apps/web/src/admin/content-page.test.tsx`, `apps/web/src/results/results-page.test.tsx`; API projection tests for any new endpoint. Cover unavailable counts, failed previews, hidden media, no autoplay, draft-pack restrictions, archive pending/failure and public/private separation.

Done when existing capabilities are discoverable in their own sections and every visible action has a real supported outcome. Required checks pass.

### Stage E — Projector and whole-site polish

Separate setup from presentation, maintain `/host` compatibility, and verify each page's responsive composition with actual screenshots. Rehearse Humza controlling while Baseer presents.

Tests: `apps/web/src/stage/stage-page.test.tsx`, `e2e/admin-stage-flow.spec.ts`, and targeted existing stage/phone tests. Check 390×844, 768px, 1280×800, 1440×900 and 1920×1080; also 320px, 200% zoom, keyboard navigation and reduced motion. Verify all question designs retain readable prompts/options/reveals.

Done when no key control is covered, no page scrolls sideways, the projector shows no admin chrome/private details, and the complete create → join → play → recover → finish → results flow passes. Required checks pass. Report any real-device or venue verification still outstanding.

Each stage updates `docs/build-progress.md` with exact commands/results and stops for review. Do not automatically start the next stage. No deployment or paid resource creation is part of this plan.

## Success criteria

- From home, both joining and admin access are obvious without knowing a URL.
- A valid existing admin session returns to the workspace without another email.
- An active room can be found and resumed after tab storage is lost.
- Desktop admin uses useful workspace width; short forms retain comfortable widths.
- The main live action is visible without scrolling through player tools and diagnostics.
- Players, media, results and failures each have a predictable destination.
- Every advertised action is backed by production-capable behaviour.
- Existing QR links, room versions, identities, scores, recovery and question designs continue working.

## Decisions to revisit only if needed

The plan assumes keeping email-link authentication, one current control room per browser, a read-only content area and the existing default theme. These are implementation defaults, not reasons to block Stage A. Alternative login methods, remote projector pairing and browser-based question editing are separate scope decisions. No decision is required from Humza before the first access/layout stage can be implemented.

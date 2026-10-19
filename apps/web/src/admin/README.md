# Admin

Administrator entry at `/admin/login`, explicit email confirmation at `/admin/confirm`, and the protected control page at `/admin`.

The public home links to login; an existing administrator session goes straight to controls. `use-admin-session.ts` shares the session-check behaviour across entry pages. Requests in `admin-api.ts` return validated data or recoverable errors and time out after twelve seconds. A failed sign out is never reported as success.

`admin-return.ts` accepts only known admin paths without queries, fragments or escapes. The requested destination is remembered as a non-sensitive browser preference so an email opened in a new tab can return there; it is never an authority for access. With browser storage unavailable, confirmation falls back to `/admin`. Expired links offer a fresh request. Authentication policy and credentials are unchanged.

The protected workspace has an overview at `/admin`, paginated saved rooms at `/admin/rooms`, room overview at `/admin/rooms/:gameId`, live desk at `/admin/rooms/:gameId/live`, player workspace at `/admin/rooms/:gameId/players`, and account/appearance information at `/admin/settings`. Room Media, Results and Health are contextual pages; Question packs is global at `/admin/content`.

`rooms-api.ts` validates server discovery/recovery responses and bounds requests at twelve seconds. The registry list has identities and creation dates only: live phase/counts are checked against the selected room. No browser storage record grants access or supplies room facts.

`room-provider.tsx` owns one snapshot, socket lifecycle, pending-command state and feedback across nested room pages. `LiveConsole` and `PlayersPage` consume it rather than creating their own connections or copying snapshot fields into individual states. `AdminLobby` is a compatibility re-export. Navigation between all room sections retains that provider. Switching rooms is deliberate: the server renews scoped credentials and revokes the previous credentials presented by this browser. Old sockets are closed; tab notifications improve feedback but are not authority. Other operators and guests retain their access. The browser controls one selected room, including presentation cookies.

Expired/revoked access offers an explicit Open room action; a failed or uncertain resume retains its request id for retry. A new tab can recover the selection through an HttpOnly location-hint cookie checked against real control credentials. Older rooms remain discoverable from the existing registry, including when tab storage has been cleared.

| File                     | Purpose                                                                |
| ------------------------ | ---------------------------------------------------------------------- |
| `admin-page.tsx`         | Protected nested workspace and sign out                                |
| `admin-login-page.tsx`   | Session check, email request and local inbox                           |
| `admin-lobby.tsx`        | Compatibility re-export of the live desk                               |
| `admin-confirm-page.tsx` | Confirmation screen. It does not verify the link until Sign in is used |
| `admin-api.ts`           | Browser calls for the administrator session. No server auth imports    |

When the local inbox is in use, login lists the captured confirmation link. A signed-in administrator can create a lobby. The host deck appears only after a lobby exists.

## Live desk and player tools

The live desk shows the current server question, phase, countdown and submissions with a sticky action area. Controls follow the phase. Skip and finish require a review; finishing preserves the server's finish-after-question semantics. Shortcuts pause in fields, open dialogs, during pending/uncertain actions and while disconnected. Stale confirmations are disabled when their question/player context changes.

Players are selected by stable ID. Search supports duplicate nicknames and IDs; removed records remain available for recovery. The adjacent workspace groups Nickname (rename/swap), Phones (transfer), Score (signed adjustments/reason/history), and Remove. Recovery is distinct from active-phone transfer. One-use codes appear only in the selected player's private details and can be hidden.

`room-provider.tsx` submits existing commands with one in-flight intent. Network failures, server failures and invalid successful responses retain that intent and request ID; Retry sends the same request and blocks replacement commands until resolved. Twelve-second timeouts bound play/transfer calls. A receipt supplies feedback, never optimistic phase/score updates: socket snapshots remain authoritative. Pending/uncertain feedback remains visible across room navigation. Read-only health/summary tools and archive/email/media recovery now live in Health and Results. Live keeps urgent moderation and contextual links.

The optional `adminPlayers` snapshot projection is control-only, with stored nickname, current score, connected/removed state and answer state when available. Older snapshots fall back to active public identities with unavailable details labelled. No new score engine, scheduler, socket client or database schema is introduced.

## Media, results, content and health

`media-page.tsx` reads a private 50-item keyset page of accepted media, newest first, with photo/voice/hidden filters. Operator previews use the authenticated admin route and scoped control credential; hidden items never load a preview. Audio is opt-in with `preload="none"` and no autoplay. Failed previews offer Retry. New guest uploads within the live snapshot and media command receipts refresh the list; Refresh media checks all newer uploads, including those outside the 20-item live projection. Filters apply to the displayed page.

`health-page.tsx` labels its checked time and retains the last successful report as stale on failure. Live connections come from the existing socket; processing, scheduler, archive and email data use bounded diagnostics reads. Unavailable email counts never appear as zero. Recovery actions are scoped, confirmed, and disabled for failed/disconnected checks. Recipient addresses remain private to the existing delivery implementation; no fabricated delivery list is shown.

`results-page.tsx` is the admin event report: accepted live score totals or server-supplied standings, highlights, archive state/retry, public result link, score-summary download and Health link. A finished quiz is distinct from an export still preparing. Public results uses the existing public archive projection and personal recap endpoint separately.

`content-page.tsx` shows authenticated read-only pack versions, release state, running order, mechanic/presentation and recorded missing authoring requirements. This is authoring visibility, not a deployment asset check or a CMS. No start/publish/reorder action is added. A short on-page workflow links the existing project authoring guide by filename.

`sections-api.ts` validates the two new shared schemas. `api/read-data.ts` and `api/use-resource.ts` bound read/decoding lifetime and ignore outdated responses across refresh/navigation. They hold read-only section results; they do not duplicate the authoritative room state or socket. All mutation feedback remains in `room-provider.tsx`, now with Media/Results/Health scopes.

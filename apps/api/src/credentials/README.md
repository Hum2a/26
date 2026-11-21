# Room credentials

[Home](../../../../README.md) · [Documentation](../../../../docs/README.md) · [Event runbook](../../../../docs/event-runbook.md)

An authenticated administrator can issue a short-lived credential for a room id. The id is only an authorisation label. This stage does not create a room, a guest, or a live command.

| Role           | Cookie                 | Path | Lifetime |
| -------------- | ---------------------- | ---- | -------- |
| `control`      | `26_room_control`      | `/`  | 12 hours |
| `presentation` | `26_room_presentation` | `/`  | 14 hours |
| `presenter`    | `26_room_presenter`    | `/`  | 12 hours |

The cookie is `HttpOnly` and `SameSite=Strict`. It is `Secure` in staging and production. A local guest cookie omits `Secure` so a phone on the same Wi-Fi can join over HTTP. The administrator session stays `Secure`, so Humza signs in on the laptop at `localhost`. The secret is not returned in JSON, placed in a URL, or written to logs. Mutating routes require the request `Origin` to match the request URL.

## Prompt 03 interface

`verifyRoomCredential` checks a secret against a `RoomCredentialRecord`: hash, revocation, expiry, role, and room id. It does not open Neon.

`RoomCredentialDirectory` is `save`, `get`, and `revoke`. The live lobby keeps those rows in the room Durable Object and calls `verifyRoomCredential` there. Guest recovery uses `verifyGuestSecret` beside it. The SQL directory remains so the earlier issue and revoke routes can be tested. The HTTP command route is still a stub: it returns `{ accepted: true, effect: "none" }` and changes nothing.

A presentation credential is rejected for the command stub. A control credential is rejected for `GET /api/stage/presentation`.

## Projector pairing

`pairing.ts` and `pairing-routes.ts` let a projector laptop with no admin session receive a room's presentation credential.

- `POST /api/admin/rooms/:gameId/projector-pairing` needs the administrator session and that room's control cookie. The room stores the SHA-256 hash of a random eight-character code (no I, O, 0 or 1), voids any code still open, and returns the code and its expiry ten minutes later.
- `POST /api/stage/pair` takes `{ joinCode, code, requestId }` from the same origin. The room consumes the code and inserts an ordinary presentation credential in the same transaction, then the route sets `26_room_presentation`. The credential is verified by `verifyRoomCredential` like any other and works for that room only.
- Redeem attempts are limited per room in memory (burst five, then one every twelve seconds). Wrong guesses are also counted durably against the open code, which is voided after ten. Issuing is limited to a burst of five per room.
- A retry with the same `requestId` replays the stored result, so a lost response does not burn the code, and a refused guess is not counted twice. The issue receipt keeps the plain code only while the code is open; once it is used, voided or expired, the receipt is replaced with a refusal.
- There is no revoke control for a paired projector. Its credential lasts fourteen hours, like the admin-issued one.

## Presenter pairing

Live controls issues a separate code through `POST /api/admin/rooms/:gameId/presenter-pairing`. Baseer redeems it at `POST /api/presenter/pair`. The code, receipt and rate limits are separate from projector pairing. A successful pairing replaces the room’s previous presenter credential.

The presenter socket receives the public room view without a guest identity, plus the current phase generation. The phone sends that generation and a request id to `POST /api/presenter/:gameId/advance`. The room checks the credential again and applies the cue once. Humza can revoke the session and any unused code from Live controls.

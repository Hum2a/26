# Room credentials

An authenticated administrator can issue a short-lived credential for a room id. The id is only an authorisation label. This stage does not create a room, a guest, or a live command.

| Role           | Cookie                 | Path | Lifetime   |
| -------------- | ---------------------- | ---- | ---------- |
| `control`      | `26_room_control`      | `/`  | 15 minutes |
| `presentation` | `26_room_presentation` | `/`  | 8 hours    |

The cookie is `HttpOnly` and `SameSite=Strict`. It is `Secure` in staging and production. A local guest cookie omits `Secure` so a phone on the same Wi-Fi can join over HTTP. The administrator session stays `Secure`, so Humza signs in on the laptop at `localhost`. The secret is not returned in JSON, placed in a URL, or written to logs. Mutating routes require the request `Origin` to match the request URL.

## Prompt 03 interface

`verifyRoomCredential` checks a secret against a `RoomCredentialRecord`: hash, revocation, expiry, role, and room id. It does not open Neon.

`RoomCredentialDirectory` is `save`, `get`, and `revoke`. The live lobby keeps those rows in the room Durable Object and calls `verifyRoomCredential` there. Guest recovery uses `verifyGuestSecret` beside it. The SQL directory remains so the earlier issue and revoke routes can be tested. The HTTP command route is still a stub: it returns `{ accepted: true, effect: "none" }` and changes nothing.

A presentation credential is rejected for the command stub. A control credential is rejected for `GET /api/stage/presentation`.

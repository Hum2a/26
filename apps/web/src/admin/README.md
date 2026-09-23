# Admin

Operator shell for `/admin` and `/admin/confirm`.

| File                     | Purpose                                                                |
| ------------------------ | ---------------------------------------------------------------------- |
| `admin-page.tsx`         | Sign-in states, plus creating a lobby once signed in                   |
| `admin-lobby.tsx`        | Join code, host deck, player tools, and one-use transfer codes         |
| `admin-confirm-page.tsx` | Confirmation screen. It does not verify the link until Sign in is used |
| `admin-api.ts`           | Browser calls for the administrator session. No server auth imports    |

When the local inbox is in use, the signed-out page lists the captured confirmation link. A signed-in administrator can create a lobby. The host deck is on that screen only after a lobby exists. Media and effect buttons stay disabled.

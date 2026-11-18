# Agent access to 26

Codex, Claude and other approved agents can use separate admin accounts on the local app and staging. Once signed in, an agent can use the same app controls as a host, including room creation, rehearsals, question inspection and results. Use a dedicated rehearsal room and a separate browser profile when switching between identities.

## Provision an account

Run these commands from an authorised 26 checkout with dependencies installed. Use a unique name with up to 32 lowercase letters, digits and hyphens, beginning with a letter. The environment is part of the account address, so `codex.local@agents.26.humza.invalid` and `codex.staging@agents.26.humza.invalid` are separate identities.

```bash
npm run auth:agent -- local provision codex
npm run auth:agent -- staging provision claude
```

You can substitute your own name or provision the same name in both environments. Repeating `provision` preserves an existing account. Local commands use the persistent PGlite database used by `npm run dev`; stop the dev server while issuing commands against that database and start it again afterwards. Use the standard local server with no `LOCAL_DATABASE_ID` override. Staging commands use the existing staging auth configuration and database from the trusted operator checkout. Run local only if your checkout lacks authorised staging database access. An operator can provision a staging account and issue its code through a private channel without giving the agent database credentials. Account creation is an operator command, not a public or browser action.

## Sign in

Open the agent sign-in page on [local](http://localhost:5173/admin/login?agent=1) or [staging](https://26-staging.humza.website/admin/login?agent=1). Issue a code in a private terminal immediately before signing in.

```bash
npm run auth:agent -- local code codex
npm run auth:agent -- staging code claude
```

Enter the printed address and six-digit code. Better Auth accepts the code once, expires it after five minutes and limits guesses. Issuing another code replaces the old one. The `.invalid` address identifies the account and never receives email. Treat the code and resulting session cookie as credentials. Keep them out of chats, PRs, URLs, screenshots and saved logs. Use the normal Sign out button after a shared-browser rehearsal.

For a staging smoke test with no credential output, run the command below. It signs in using a fresh code, verifies the named session and protected catalogue, then signs out.

```bash
npm run auth:agent -- staging check codex
```

For scripted work, use the same sign-in flow as `check` in [the operator script](../scripts/auth-agent.ts). Request a code through a private subprocess and capture the output in memory. POST the identity and code to `/api/admin/email-code/verify` with the target origin and the existing client API header, then keep the returned cookies in memory for subsequent requests. Verify the identity at `/api/admin/session` and sign out when the run ends. App access uses the usual room credentials after selecting or creating a room.

## Revoke access

```bash
npm run auth:agent -- staging revoke claude
```

Revocation replaces any outstanding code and removes the account and its stored sessions. A previously cached admin session may last up to two minutes under the existing cache policy. Close the agent's browser sessions and use normal room controls to manage any active rehearsal. The command accepts only local and staging targets. Production uses the configured human administrator sign-in.

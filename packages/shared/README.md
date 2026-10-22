# @26/shared

[Home](../../README.md) · [Documentation](../../docs/README.md) · [Event runbook](../../docs/event-runbook.md)

Validation schemas used by the Worker and the web app.

| File           | Purpose                                                                            |
| -------------- | ---------------------------------------------------------------------------------- |
| `src/index.ts` | Environment, health, API error, administrator session, and room-credential schemas |

`gameIdSchema` checks the shape of an id. It does not resolve a room. The room-credential schemas name the control and presentation roles. They do not verify a secret.

Question, scoring, and device schemas belong to later prompts. Do not add them here until that stage needs them.

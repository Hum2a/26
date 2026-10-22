# Results

[Home](../../../../README.md) · [Documentation](../../../../docs/README.md) · [Event runbook](../../../../docs/event-runbook.md)

`/r/:gameId` is a public event report with server-supplied podium/standings, eligible highlights and shared media, followed by a separately labelled private result and optional email request.

`results-report.tsx` renders only the validated public projection. Positions/points are never calculated here; tied positions retain equal podium treatment. Media uses the existing published gallery route. Hidden/unavailable media cannot bypass that route; failed previews can be retried and voice never autoplays.

`results-page.tsx` distinguishes loading, unknown, preparing, failed reads and ready reports. Retry reads the archive again. Personal data requires the existing guest session or private recap token, and is reset when the game or recap token changes. The email form is offered only to a recognised guest without a recap grant. Verification and delivery messages preserve existing server semantics without claiming inbox delivery.

All reads and email operations are bounded at twelve seconds. Successful verification removes only the verification parameter, preserving an independent recap link. Authentication, archive retention, recipient verification and delivery deduplication remain server-owned.

`results.css` composes the report through shared theme variables and the existing entry frame. Unit tests cover public/private composition, preparing/failure/retry, invalid IDs, private recap access, failed email requests and identity changes. Browser checks complete a real local game and validate the report and phone layouts.

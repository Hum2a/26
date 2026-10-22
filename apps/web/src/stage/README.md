# Projector

[Home](../../../../README.md) · [Documentation](../../../../docs/README.md) · [Event runbook](../../../../docs/event-runbook.md)

`/screen` and the compatible `/host` open projector setup. Connect with the room code in the browser where admin opened that room: lookup and the single stage socket still require the existing presentation credential. A join code, guest identity or URL alone grants no access. Remote presenter pairing is outside this stage.

Setup separates connection, optional local sound and presentation. Present is enabled after the stage socket connects. Full screen is a separate optional setup action; refusal does not stop presentation. F requests full screen while presenting; M toggles optional sound. Escape, leaving browser full screen, or the accessible Projector setup button returns to setup and restores keyboard focus. Space, P, H, D and O have no host-command/diagnostic wiring on this page. Admin owns the quiz.

`stage-presentation.tsx` renders the public snapshot inside the shared theme/skin and overscan inset (5vh vertically, 5vw horizontally, at least 1rem). Lobby invitation and names occupy distinct areas; live questions use a compact timer, readable prompts/options, public media and standings. The setup return control has reserved space. Standard text is at least 40px, standard prompts 72px and the timer 120px; custom designs keep their existing readable type hierarchy. Default palette contrast is tested. Theme colours come from the central palette.

Presentation has no site navigation, form, internal connection details or operator HUD. Disconnection/replacement hides stale question content behind a public reconnect state. Host hiding omits the question and media. Setup retains operator recovery guidance and can reconnect the same room after renewed credentials. Lookup stops after twelve seconds and remains retryable. Stage transitions keep question content visible with short fades; reduced motion removes spatial movement. The countdown display follows server deadlines and never changes game state.

Sound is unlocked only by the local Start show action and never starts the quiz. Leaving presentation or losing the connection mutes/stops local audio; past cues do not catch up. Diagnostic sound notices stay in setup. Accepted voice clips require an explicit play action. Missing photos/cues leave a public fallback. Real projector overscan, browser audio policy and venue audibility still need rehearsal.

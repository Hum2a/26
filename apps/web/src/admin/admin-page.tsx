import { useEffect, useState, type FormEvent } from "react";
import type { AdminSession } from "@26/shared";
import { Button, Panel, StatusMessage, TextField } from "../ui/primitives";
import { SurfaceFrame } from "../ui/surface-frame";
import { AdminLobby } from "./admin-lobby";
import {
  confirmPath,
  fetchAdminSession,
  fetchLocalInbox,
  requestMagicLink,
  signOutAdmin,
} from "./admin-api";

type Phase = "loading" | "signed-out" | "requesting" | "link-sent" | "signed-in";

export function AdminPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [email, setEmail] = useState("humzab1711@hotmail.com");
  const [sessionEmail, setSessionEmail] = useState<string>();
  const [notice, setNotice] = useState("Checking the administrator session.");
  const [links, setLinks] = useState<string[]>([]);

  function applySession(
    session: AdminSession | { error: string },
    signedOutPhase: Phase,
  ) {
    if ("error" in session) {
      setNotice(session.error);
      setPhase("signed-out");
      return;
    }
    if (session.signedIn && session.email) {
      setSessionEmail(session.email);
      setNotice(`You are signed in as ${session.email}.`);
      setPhase("signed-in");
      return;
    }
    setSessionEmail(undefined);
    setPhase(signedOutPhase);
  }

  useEffect(() => {
    document.title = "Admin · 26";
    void fetchAdminSession().then((session) => {
      applySession(session, "signed-out");
    });
  }, []);

  async function onRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPhase("requesting");
    setNotice("Sending a sign-in link.");
    setLinks([]);
    const result = await requestMagicLink(email);
    if ("error" in result) {
      setNotice(result.error);
      setPhase("signed-out");
      return;
    }
    setNotice("If this address is the administrator, a sign-in link is ready.");
    if (result.delivery === "local-inbox") {
      const messages = await fetchLocalInbox();
      setLinks(
        messages.flatMap((message) => {
          const href = confirmPath(message.text);
          return href ? [href] : [];
        }),
      );
    }
    setPhase("link-sent");
  }

  async function onSignOut() {
    await signOutAdmin();
    setNotice("You are signed out.");
    setSessionEmail(undefined);
    setLinks([]);
    setPhase("signed-out");
  }

  const lede =
    phase === "signed-in"
      ? "The administrator session is active."
      : "Sign in with the administrator email.";

  return (
    <SurfaceFrame current="admin" title="Admin" lede={lede}>
      <StatusMessage>{notice}</StatusMessage>
      {phase === "signed-in" ? (
        <Panel title="Session">
          <p>You are signed in as {sessionEmail}.</p>
          <p>Create a lobby, then start the demo quiz.</p>
          <div className="mt-4">
            <AdminLobby />
          </div>
          <Button className="mt-4" onClick={() => void onSignOut()}>
            Sign out
          </Button>
        </Panel>
      ) : (
        <form className="grid gap-4" onSubmit={(event) => void onRequest(event)}>
          <TextField
            label="Administrator email"
            hint="A link is sent only for the configured administrator."
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={phase === "loading" || phase === "requesting"}
            required
          />
          <Button
            type="submit"
            disabled={phase === "loading" || phase === "requesting"}
          >
            Email me a sign-in link
          </Button>
        </form>
      )}
      {phase === "link-sent" && links.length > 0 ? (
        <Panel title="Local inbox">
          <ul className="grid gap-3">
            {links.map((href) => (
              <li key={href}>
                <a className="font-bold underline" href={href}>
                  Open the sign-in confirmation
                </a>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </SurfaceFrame>
  );
}

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { Button, Panel, TextField } from "../ui/primitives";
import { EntryFrame, EntryHeading, EntryNotice } from "../ui/entry-frame";
import { confirmPath, fetchLocalInbox, requestMagicLink } from "./admin-api";
import {
  clearAdminReturn,
  rememberAdminReturn,
  safeAdminReturnTo,
} from "./admin-return";
import { useAdminSession } from "./use-admin-session";

export function AdminLoginPage() {
  const auth = useAdminSession();
  const [params] = useSearchParams();
  const returnTo = safeAdminReturnTo(params.get("returnTo"));
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const [sent, setSent] = useState(false);
  const [links, setLinks] = useState<string[]>([]);
  const signedIn = auth.state === "ready" && auth.session.signedIn;

  useEffect(() => {
    document.title = "Admin sign in · 26";
  }, []);
  useEffect(() => {
    if (signedIn) clearAdminReturn();
  }, [signedIn]);

  async function onRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setSent(false);
    setLinks([]);
    setNotice("Requesting a sign-in link.");
    rememberAdminReturn(returnTo);
    const result = await requestMagicLink(email.trim());
    if ("error" in result) {
      setNotice(result.error);
    } else {
      setSent(true);
      setNotice(
        "If this is the administrator address, a sign-in email has been requested. Check your inbox and junk folder.",
      );
      if (result.delivery === "local-inbox") {
        const messages = await fetchLocalInbox();
        setLinks(
          messages.flatMap((message) => {
            const path = confirmPath(message.text);
            return path ? [path] : [];
          }),
        );
      }
    }
    inFlight.current = false;
    setPending(false);
  }

  if (auth.state === "ready" && auth.session.signedIn)
    return <Navigate replace to={returnTo} />;
  const feedback =
    notice ||
    (auth.state === "loading"
      ? "Checking the administrator session."
      : auth.state === "error"
        ? auth.message
        : "");

  return (
    <EntryFrame
      navigation={
        <Link to="/join" className="entry-text-link">
          Join the party
        </Link>
      }
    >
      <EntryHeading eyebrow="Behind the scenes" title="Admin sign in">
        Everything you need to run the night. Sign in with your administrator email.
      </EntryHeading>
      <EntryNotice message={feedback} />
      {auth.state === "error" ? (
        <Button
          className="mb-5"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setNotice("");
            auth.retry();
          }}
        >
          Try again
        </Button>
      ) : null}
      <form className="entry-form" onSubmit={(event) => void onRequest(event)}>
        <TextField
          label="Administrator email"
          hint="Access is restricted to the configured administrator."
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setSent(false);
            setLinks([]);
            setNotice("");
          }}
          disabled={pending}
          required
        />
        <Button type="submit" disabled={pending}>
          {pending
            ? "Requesting link…"
            : sent
              ? "Request another link"
              : "Email me a sign-in link"}
        </Button>
        <p className="entry-note">
          No password to remember. Open the email, then confirm sign-in. Links expire
          after five minutes.
        </p>
      </form>
      {links.length > 0 ? (
        <div className="mt-6">
          <Panel title="Local inbox">
            <ul className="grid gap-3">
              {links.map((href) => (
                <li key={href}>
                  <Link className="entry-text-link" to={href}>
                    Open the sign-in confirmation
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      ) : null}
      <Link className="entry-text-link mt-6" to="/">
        ← Back to the party
      </Link>
    </EntryFrame>
  );
}

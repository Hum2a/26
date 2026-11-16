import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button, Panel, TextField } from "../ui/primitives";
import { EntryFrame, EntryHeading, EntryNotice } from "../ui/entry-frame";
import {
  confirmEmailCode,
  confirmPath,
  fetchLocalInbox,
  requestMagicLink,
} from "./admin-api";
import {
  clearAdminReturn,
  rememberAdminReturn,
  safeAdminReturnTo,
} from "./admin-return";
import { useAdminSession } from "./use-admin-session";

export function AdminLoginPage() {
  const auth = useAdminSession();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [code, setCode] = useState("");
  const codeField = useRef<HTMLInputElement>(null);
  const [params] = useSearchParams();
  const returnTo = safeAdminReturnTo(params.get("returnTo"));
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const [sent, setSent] = useState(false);
  const [localCode, setLocalCode] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const signedIn = auth.state === "ready" && auth.session.signedIn;

  useEffect(() => {
    if (sent && !pending) codeField.current?.focus();
  }, [sent, pending]);
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
    setLocalCode("");
    setCode("");
    setNotice("Requesting a sign-in code and link.");
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
        setLocalCode(messages[0]?.text.match(/Your sign-in code: (\d{6})/)?.[1] ?? "");
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

  async function onCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !/^\d{6}$/.test(code)) return;
    inFlight.current = true;
    setPending(true);
    setNotice("Checking your sign-in code.");
    const session = await confirmEmailCode(email.trim(), code);
    if ("error" in session || !session.signedIn) {
      setNotice(
        "error" in session ? session.error : "That code was not accepted. Try again.",
      );
      inFlight.current = false;
      setPending(false);
      return;
    }
    clearAdminReturn();
    await navigate(returnTo, { replace: true });
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
          hint="Access is restricted to the configured administrators."
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setSent(false);
            setCode("");
            setLocalCode("");
            setLinks([]);
            setNotice("");
          }}
          disabled={pending}
          required
        />
        <Button type="submit" disabled={pending}>
          {pending
            ? "Sending email…"
            : sent
              ? "Send a new code and link"
              : "Email me a code and link"}
        </Button>
        <p className="entry-note">
          One email, two ways in. Enter the six-digit code here or open the magic link
          in your email. Both expire after five minutes.
        </p>
      </form>
      <AnimatePresence initial={false}>
        {sent ? (
          <motion.section
            key="email-code"
            className="admin-code-panel"
            aria-labelledby="admin-code-title"
            initial={{ opacity: 0, y: reduced ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <h2 id="admin-code-title">Check your inbox</h2>
            <p>Enter the code from your latest email, or use its magic link.</p>
            <form className="entry-form" onSubmit={(event) => void onCode(event)}>
              <TextField
                label="Six-digit sign-in code"
                hint="Use the latest code. You can paste all six digits."
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                className="skin-field admin-code-input"
                ref={codeField}
                required
                disabled={pending}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
              <Button type="submit" disabled={pending || code.length !== 6}>
                {pending ? "Checking code…" : "Sign in with code"}
              </Button>
            </form>
          </motion.section>
        ) : null}
      </AnimatePresence>
      {links.length > 0 ? (
        <div className="mt-6">
          <Panel title="Local inbox">
            {localCode ? (
              <p className="mb-4">
                Local sign-in code: <strong>{localCode}</strong>
              </p>
            ) : null}
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

import { useState } from "react";

import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router";

import { Button, StatusMessage } from "../ui/primitives";

import { EntryFrame, EntryHeading } from "../ui/entry-frame";

import { AdminShell } from "../ui/admin-shell";

import { signOutAdmin } from "./admin-api";

import { safeAdminReturnTo } from "./admin-return";

import { useAdminSession } from "./use-admin-session";

export function AdminPage() {
  const auth = useAdminSession();

  const location = useLocation();

  const navigate = useNavigate();

  const [notice, setNotice] = useState("");

  const [pending, setPending] = useState(false);

  async function onSignOut() {
    setPending(true);

    const result = await signOutAdmin();

    setPending(false);

    if (result?.error) {
      setNotice(result.error);

      return;
    }

    await navigate("/admin/login", { replace: true });
  }

  if (auth.state === "ready" && !auth.session.signedIn) {
    return (
      <Navigate
        replace

        to={`/admin/login?returnTo=${encodeURIComponent(safeAdminReturnTo(location.pathname))}`}
      />
    );
  }

  if (auth.state === "ready" && auth.session.signedIn) {
    return (
      <AdminShell
        account={
          <>
            <p role="status">You are signed in as {auth.session.email}.</p>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => void onSignOut()}
            >
              {pending ? "Signing out…" : "Sign out"}
            </Button>
          </>
        }
      >
        {notice ? <StatusMessage>{notice}</StatusMessage> : null}

        <Outlet />
      </AdminShell>
    );
  }

  return (
    <EntryFrame wide>
      <EntryHeading eyebrow="Running the night" title="Admin">
        Your rooms and controls.
      </EntryHeading>

      {auth.state === "loading" ? (
        <StatusMessage>Checking the administrator session.</StatusMessage>
      ) : null}

      {auth.state === "error" ? (
        <div className="grid gap-4">
          <StatusMessage>{auth.message}</StatusMessage>
          <Button onClick={auth.retry}>Try again</Button>
          <Link to="/admin/login">Admin sign in</Link>
        </div>
      ) : null}
    </EntryFrame>
  );
}

export function AdminSettingsPage() {
  return (
    <section className="admin-section">
      <p className="entry-eyebrow">Your workspace</p>
      <h1>Account & appearance</h1>
      <p>
        Your administrator session is shown in the sidebar. Use Theme in the header to
        choose how this browser looks.
      </p>
      <p>
        Phones and the projector choose their themes independently. Changing this
        browser does not change anyone else’s screen.
      </p>
      <Link className="entry-text-link" to="/admin/rooms">
        Back to rooms
      </Link>
    </section>
  );
}

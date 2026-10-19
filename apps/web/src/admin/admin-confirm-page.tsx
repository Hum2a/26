import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Button } from "../ui/primitives";
import { EntryFrame, EntryHeading, EntryNotice } from "../ui/entry-frame";
import { confirmMagicLink } from "./admin-api";
import { clearAdminReturn, recalledAdminReturn } from "./admin-return";

export function AdminConfirmPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token")?.trim() ?? "";
  const [notice, setNotice] = useState(
    token
      ? "This page does not sign you in until you confirm."
      : "This sign-in link is incomplete.",
  );
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    document.title = "Confirm sign-in · 26";
  }, []);

  async function onConfirm() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setNotice("Checking the sign-in link.");
    const session = await confirmMagicLink(token);
    if ("error" in session || !session.signedIn) {
      setNotice(
        "error" in session
          ? session.error
          : "This sign-in link is invalid or has expired.",
      );
      setPending(false);
      setFailed(true);
      inFlight.current = false;
      return;
    }
    const returnTo = recalledAdminReturn();
    clearAdminReturn();
    await navigate(returnTo, { replace: true });
  }

  return (
    <EntryFrame>
      <EntryHeading eyebrow="One last step" title="Confirm sign-in">
        Open your admin controls on this browser.
      </EntryHeading>
      <EntryNotice message={notice} />
      <Button
        className="w-full"
        disabled={!token || pending}
        onClick={() => void onConfirm()}
      >
        {pending ? "Confirming…" : "Sign in"}
      </Button>
      {failed || !token ? (
        <Link
          className="entry-text-link mt-5"
          to={`/admin/login?returnTo=${encodeURIComponent(recalledAdminReturn())}`}
        >
          Request a new link
        </Link>
      ) : null}
    </EntryFrame>
  );
}

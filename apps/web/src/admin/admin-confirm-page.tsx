import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button, StatusMessage } from "../ui/primitives";
import { SurfaceFrame } from "../ui/surface-frame";
import { confirmMagicLink } from "./admin-api";

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

  useEffect(() => {
    document.title = "Confirm sign-in · 26";
  }, []);

  async function onConfirm() {
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
      return;
    }
    await navigate("/admin");
  }

  return (
    <SurfaceFrame
      current="admin"
      title="Confirm sign-in"
      lede="The link in the email only opens this page."
    >
      <StatusMessage>{notice}</StatusMessage>
      <Button disabled={!token || pending} onClick={() => void onConfirm()}>
        Sign in
      </Button>
    </SurfaceFrame>
  );
}

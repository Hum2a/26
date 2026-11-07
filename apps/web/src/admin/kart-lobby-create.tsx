import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { createLobby } from "../live/room-api";
import { Button } from "../ui/primitives";
import { EntryNotice } from "../ui/entry-frame";

export function KartLobbyCreate() {
  const requestId = useRef<string | undefined>(undefined);
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  async function create() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    requestId.current ??= crypto.randomUUID();
    try {
      const result = await createLobby(requestId.current, undefined, "kart");
      if ("error" in result) {
        setError(result.error);
        return;
      }
      requestId.current = undefined;
      try {
        localStorage.setItem("26-admin-room-change", crypto.randomUUID());
      } catch {
        /* Optional hint to other operator tabs. */
      }
      await navigate(`/admin/rooms/${result.gameId}/live`);
    } catch {
      setError(
        "Creation was not confirmed. Retry to reuse the same kart lobby request.",
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="admin-current" aria-label="Kart-only lobby">
      <h2>Just the race</h2>
      <p>
        Create a fresh join-code lobby for one lap and up to 80 racers. Mario circuit is
        the default; choose a course and its time limit in Live controls before Start
        kart race. Guests join before the start. The birthday running order stays as it
        is.
      </p>
      <Button disabled={busy} onClick={() => void create()}>
        {busy
          ? "Creating kart lobby…"
          : error
            ? "Retry kart lobby"
            : "Create kart lobby"}
      </Button>
      <EntryNotice message={error} />
    </section>
  );
}

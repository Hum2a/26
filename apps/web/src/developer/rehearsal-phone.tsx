import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import {
  gameIdSchema,
  guestSessionSchema,
  type GuestSession,
  type BotSession,
} from "@26/shared";
import { GuestPage } from "../guest/guest-page";
import { clientApiHeaders } from "../api/client-key";
import { Button } from "../ui/primitives";

/** An authenticated real guest, isolated from the browser's ordinary guest cookie. */
export function RehearsalPhone() {
  const { gameId = "" } = useParams();
  const [search] = useSearchParams();
  const [requestId] = useState(() => search.get("take") ?? crypto.randomUUID());
  const [attempt, setAttempt] = useState(0),
    [error, setError] = useState("");
  const [data, setData] = useState<{ session: GuestSession; credential: BotSession }>();
  useEffect(() => {
    if (!gameIdSchema.safeParse(gameId).success) return;
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 12000);
    let active = true;
    void fetch(`/api/rooms/${gameId}/rehearsal-phone`, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
      headers: clientApiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ requestId }),
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            "Open a dedicated rehearsal room with a free player place, and check administrator access.",
          );
        const raw = (await response.json()) as Record<string, unknown>;
        const { secret, ...fields } = raw;
        if (typeof secret !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(secret))
          throw new Error("The phone session could not be read.");
        const session = guestSessionSchema.parse(fields);
        if (active)
          setData({ session, credential: { playerId: session.playerId, secret } });
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error ? reason.message : "The phone could not connect.",
          );
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [gameId, requestId, attempt]);
  if (data)
    return (
      <GuestPage
        rehearsalSession={data.session}
        rehearsalCredential={data.credential}
      />
    );
  return (
    <main className="p-4 space-y-3">
      <h1>Rehearsal phone</h1>
      <p role="status">{error || "Opening a real guest connection…"}</p>
      {error ? (
        <>
          <Button
            onClick={() => {
              setError("");
              setAttempt((n) => n + 1);
            }}
          >
            Retry phone connection
          </Button>
          <Link
            to={`/admin/login?returnTo=${encodeURIComponent(`/admin/phone-preview/room/${gameId}`)}`}
            target="_top"
          >
            Check administrator sign-in
          </Link>
        </>
      ) : null}
    </main>
  );
}

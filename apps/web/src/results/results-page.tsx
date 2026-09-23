import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import {
  gameIdSchema,
  personalResultsSchema,
  publicResultsSchema,
  resultsEmailSchema,
  type PersonalResults,
  type PublicResults,
} from "@26/shared";
import { clientApiHeaders, withClientApiKey } from "../api/client-key.ts";
import { Button, Panel, StatusMessage, TextField } from "../ui/primitives";
import { SurfaceFrame } from "../ui/surface-frame";

export function ResultsPage() {
  const params = useParams();
  const [search] = useSearchParams();
  const gameId = params.gameId ?? "";
  const valid = gameIdSchema.safeParse(gameId).success;
  const verifyToken = search.get("verify") ?? "";
  const recapToken = search.get("recap") ?? "";
  const [published, setPublished] = useState<PublicResults>({ state: "unknown" });
  const [personal, setPersonal] = useState<PersonalResults | null>(null);
  const [email, setEmail] = useState("");
  const [emailNotice, setEmailNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Results · 26";
  }, []);

  useEffect(() => {
    if (!valid) {
      return;
    }
    let cancelled = false;
    void fetch(`/api/rooms/${gameId}/results`, { headers: clientApiHeaders() })
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const parsed = publicResultsSchema.safeParse(await response.json());
        if (!cancelled && parsed.success) {
          setPublished(parsed.data);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [gameId, valid]);

  useEffect(() => {
    if (!valid || published.state !== "ready") {
      return;
    }
    let cancelled = false;
    const url = recapToken
      ? `/api/rooms/${gameId}/results/mine?token=${encodeURIComponent(recapToken)}`
      : `/api/rooms/${gameId}/results/mine`;
    void fetch(url, { credentials: "same-origin", headers: clientApiHeaders() })
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const parsed = personalResultsSchema.safeParse(await response.json());
        if (!cancelled && parsed.success) {
          setPersonal(parsed.data);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [gameId, published.state, recapToken, valid]);

  useEffect(() => {
    if (!valid || !verifyToken) {
      return;
    }
    let cancelled = false;
    void fetch(`/api/rooms/${gameId}/results/verify`, {
      method: "POST",
      credentials: "same-origin",
      headers: clientApiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ token: verifyToken }),
    })
      .then(async (response) => {
        const parsed = resultsEmailSchema.safeParse(await response.json());
        if (cancelled || !parsed.success) {
          return;
        }
        setEmailNotice(emailCopy(parsed.data.status));
        const next = new URL(window.location.href);
        next.searchParams.delete("verify");
        window.history.replaceState(null, "", next.pathname);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [gameId, valid, verifyToken]);

  async function sendEmail() {
    setBusy(true);
    setEmailNotice("");
    try {
      const response = await fetch(`/api/rooms/${gameId}/results/email`, {
        method: "POST",
        credentials: "same-origin",
        headers: clientApiHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ email }),
      });
      const parsed = resultsEmailSchema.safeParse(await response.json());
      setEmailNotice(
        parsed.success ? emailCopy(parsed.data.status) : "That email was not accepted.",
      );
    } catch {
      setEmailNotice("That email was not accepted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SurfaceFrame
      current="results"
      title="Results"
      lede="Final standings, shared photos, and your own result."
    >
      {valid ? (
        <>
          <StatusMessage>
            {published.state === "preparing"
              ? "Preparing results."
              : published.state === "ready"
                ? `Results for ${gameId}.`
                : `Results for ${gameId} are not available.`}
          </StatusMessage>
          {published.state === "ready" ? (
            <ReadyResults
              gameId={gameId}
              published={published}
              personal={personal}
              email={email}
              emailNotice={emailNotice}
              busy={busy}
              showEmailForm={!recapToken && personal !== null}
              onEmail={setEmail}
              onSend={() => void sendEmail()}
            />
          ) : (
            <WaitingResults state={published.state} />
          )}
        </>
      ) : (
        <>
          <StatusMessage>This address is not a game id.</StatusMessage>
          <Panel title="Archive">
            <p>
              <span className="font-bold">{gameId}</span> is not an 8 to 32 character id
              from the unambiguous alphabet. Results lookup is not built yet.
            </p>
          </Panel>
        </>
      )}
    </SurfaceFrame>
  );
}

function WaitingResults({ state }: { state: PublicResults["state"] }) {
  return (
    <>
      <Panel title="Archive">
        {state === "preparing" ? (
          <p>
            This game has finished. The shareable archive is still being stored. This
            page does not invent standings while that export is unfinished.
          </p>
        ) : (
          <p>
            The id matches the display shape. The results archive is not built yet, so
            this page cannot load a game.
          </p>
        )}
      </Panel>
      <Panel title="Statistics">
        <p>
          Comparison cards are built from accepted answers in the game. This page still
          waits for the archive, so it does not fill the gap with sample numbers.
        </p>
      </Panel>
    </>
  );
}

function ReadyResults(input: {
  gameId: string;
  published: PublicResults;
  personal: PersonalResults | null;
  email: string;
  emailNotice: string;
  busy: boolean;
  showEmailForm: boolean;
  onEmail: (value: string) => void;
  onSend: () => void;
}) {
  const standings = input.published.standings ?? [];
  const highlights = input.published.highlights ?? [];
  const gallery = input.published.gallery ?? [];
  return (
    <>
      <Panel title="Standings">
        {standings.length === 0 ? (
          <p>No guest standings were stored for this game.</p>
        ) : (
          <ol className="grid gap-2">
            {standings.map((standing) => (
              <li
                key={`${standing.position}-${standing.nickname}`}
                className="break-words font-display text-3xl leading-tight"
              >
                {standing.position}. {standing.nickname}, {standing.points} points
              </li>
            ))}
          </ol>
        )}
      </Panel>
      <Panel title="Highlights">
        {highlights.length === 0 ? (
          <p>This room has no comparison cards.</p>
        ) : (
          <ul className="grid gap-3">
            {highlights.map((card) => (
              <li key={card.id} className="break-words">
                {card.results}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Shared gallery">
        <p className="break-words">{input.published.galleryNote}</p>
        {gallery.length === 0 ? (
          <p className="mt-3">No shared photos were kept.</p>
        ) : (
          <ul className="mt-3 grid gap-4">
            {gallery.map((item) => (
              <li key={item.mediaId}>
                {item.kind === "photo" ? (
                  <img
                    src={withClientApiKey(
                      `/api/rooms/${input.gameId}/gallery/${item.mediaId}`,
                    )}
                    alt={`Photo shared by ${item.nickname}`}
                    className="max-w-full rounded-2xl"
                  />
                ) : (
                  <audio
                    controls
                    src={withClientApiKey(
                      `/api/rooms/${input.gameId}/gallery/${item.mediaId}`,
                    )}
                  >
                    Voice note shared by {item.nickname}
                  </audio>
                )}
                <p className="mt-2 break-words">{item.attribution}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {input.personal ? (
        <Panel title="Your result">
          <p className="break-words">
            {input.personal.nickname}, you finished in position{" "}
            {input.personal.position} with {input.personal.points} points.
          </p>
          <p>
            Trolls given: {input.personal.given}. Trolls received:{" "}
            {input.personal.received}.
          </p>
          {input.personal.best.length === 0 ? (
            <p>No scored answers were kept.</p>
          ) : (
            <ul className="mt-3 grid gap-2">
              {input.personal.best.map((answer) => (
                <li key={answer.questionId} className="break-words">
                  {answer.questionId}: {answer.points} points. {answer.detail}
                </li>
              ))}
            </ul>
          )}
          {input.personal.recap.length > 0 ? (
            <ul className="mt-3 grid gap-2">
              {input.personal.recap.map((card) => (
                <li key={card.id} className="break-words">
                  {card.results}
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
      ) : null}
      {input.showEmailForm ? (
        <Panel title="Email my result">
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              input.onSend();
            }}
          >
            <TextField
              label="Email address"
              hint="Optional. We confirm the address before sending your own result."
              type="email"
              autoComplete="email"
              value={input.email}
              onChange={(event) => input.onEmail(event.target.value)}
              required
            />
            <Button type="submit" disabled={input.busy}>
              Email my result
            </Button>
          </form>
        </Panel>
      ) : null}
      {input.emailNotice ? <StatusMessage>{input.emailNotice}</StatusMessage> : null}
      {input.published.retentionNote ? (
        <p className="break-words text-base leading-relaxed">
          {input.published.retentionNote}
        </p>
      ) : null}
    </>
  );
}

function emailCopy(status: string): string {
  if (status === "sent") {
    return "The message is with the mail service. Check that inbox.";
  }
  if (status === "uncertain") {
    return "The mail service did not confirm delivery. Ask again and the same message is retried.";
  }
  if (status === "expired") {
    return "This link has expired. Ask for a new one from your result.";
  }
  if (status === "failed") {
    return "The message could not be sent. You can ask again.";
  }
  return "That email was not accepted.";
}

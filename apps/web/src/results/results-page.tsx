import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Link, useParams, useSearchParams } from "react-router";
import {
  gameIdSchema,
  personalResultsSchema,
  publicResultsSchema,
  resultsEmailSchema,
  type PersonalResults,
} from "@26/shared";
import { clientApiHeaders } from "../api/client-key";
import { EntryFrame, EntryNotice } from "../ui/entry-frame";
import { Button, TextField } from "../ui/primitives";
import { readSection } from "../api/read-data";
import { useSection } from "../api/use-resource";
import { ResultsReport } from "./results-report";
import { FunFactReport } from "../play/fun-fact";
import "./results.css";

export function ResultsPage() {
  const { gameId = "" } = useParams();
  const [search] = useSearchParams();
  return (
    <ResultsDetail key={`${gameId}:${search.get("recap") ?? ""}`} gameId={gameId} />
  );
}
function ResultsDetail({ gameId }: { gameId: string }) {
  const [search, setSearch] = useSearchParams();
  const valid = gameIdSchema.safeParse(gameId).success;
  const recap = search.get("recap") ?? "";
  const verify = search.get("verify") ?? "";
  const [personal, setPersonal] = useState<PersonalResults | null>(null);
  const [personalMessage, setPersonalMessage] = useState("");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const read = useCallback(
    () =>
      valid
        ? readSection(`/api/rooms/${gameId}/results`, publicResultsSchema)
        : Promise.resolve({ error: "This address is not a game id." }),
    [gameId, valid],
  );
  const result = useSection(read);
  useEffect(() => {
    document.title = "Results · 26";
  }, []);
  useEffect(() => {
    if (result.data?.state !== "ready") return;
    let live = true;
    void readSection(
      `/api/rooms/${gameId}/results/mine${recap ? `?token=${encodeURIComponent(recap)}` : ""}`,
      personalResultsSchema,
    ).then((value) => {
      if (!live) return;
      if ("error" in value)
        setPersonalMessage(
          "Your result is available on the phone you used to play, or from your private recap link.",
        );
      else {
        setPersonal(value);
        setPersonalMessage("");
      }
    });
    return () => {
      live = false;
    };
  }, [gameId, result.data?.state, recap]);
  useEffect(() => {
    if (!valid || !verify) return;
    let live = true;
    void emailRequest(gameId, "verify", { token: verify }).then((message) => {
      if (!live) return;
      setNotice(message);
      if (!message.startsWith("We couldn’t"))
        setSearch(
          (previous) => {
            const next = new URLSearchParams(previous);
            next.delete("verify");
            return next;
          },
          { replace: true },
        );
    });
    return () => {
      live = false;
    };
  }, [gameId, valid, verify, setSearch]);
  async function send() {
    if (busy) return;
    setBusy(true);
    try {
      setNotice(await emailRequest(gameId, "email", { email }));
    } finally {
      setBusy(false);
    }
  }
  return (
    <EntryFrame
      wide
      navigation={
        <Link className="entry-text-link" to="/join">
          Join the party
        </Link>
      }
    >
      <section className="results-page">
        <header className="results-intro">
          <p className="entry-eyebrow">26 · the night in numbers</p>
          <h1>{result.data?.state === "ready" ? "What a night." : "The results."}</h1>
          <p>Final standings, shared moments, and your own result.</p>
        </header>
        <EntryNotice message={notice || result.error} />
        <motion.div
          className="results-body"
          aria-busy={result.loading}
          key={result.data?.state ?? "checking"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.16 }}
        >
          {result.data?.state === "ready" ? (
            <>
              <ResultsReport gameId={gameId} published={result.data} />
              <section className="results-personal" aria-label="Your private result">
                <div>
                  <p className="entry-eyebrow">Only for you</p>
                  <h2>Your result</h2>
                  {personal ? (
                    <>
                      <p>
                        {personal.nickname}, you finished in position{" "}
                        {personal.position} with {personal.points} points.
                      </p>
                      <p>
                        Trolls given: {personal.given}. Trolls received:{" "}
                        {personal.received}.
                      </p>
                      <ul>
                        {personal.best.map((answer) => (
                          <li key={answer.questionId}>
                            {answer.points} points. {answer.detail}
                          </li>
                        ))}
                      </ul>
                      {!personal.best.length ? (
                        <p>No scored answers were kept.</p>
                      ) : null}
                      <ul>
                        {personal.recap.map((card) => (
                          <li key={card.id}>{card.results}</li>
                        ))}
                      </ul>
                      <FunFactReport cards={personal.funFacts} />
                    </>
                  ) : (
                    <p>{personalMessage || "Checking for your personal result…"}</p>
                  )}
                </div>
                {personal && !recap ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void send();
                    }}
                  >
                    <h3>Email my result</h3>
                    <TextField
                      label="Email address"
                      hint="Optional. We confirm the address before sending your own result."
                      type="email"
                      autoComplete="email"
                      value={email}
                      required
                      onChange={(event) => setEmail(event.target.value)}
                    />
                    <Button disabled={busy} type="submit">
                      {busy ? "Requesting…" : "Email my result"}
                    </Button>
                  </form>
                ) : null}
              </section>
            </>
          ) : (
            <section
              className="results-intro results-empty skin-panel"
              aria-live="polite"
            >
              <h2>
                {!valid
                  ? "Check this address"
                  : result.loading
                    ? "Checking the archive…"
                    : result.data?.state === "preparing"
                      ? "Preparing results."
                      : "Results are unavailable."}
              </h2>

              <p>
                {!valid
                  ? "Open the results link shared for your game."
                  : result.loading
                    ? "Finding the shared results for this game."
                    : result.data?.state === "preparing"
                      ? "This game has finished. Its shareable archive is not available yet. It may still be preparing; check again shortly."
                      : "This game may still be running, or the archive could not be loaded. Check the game link and try again."}
              </p>
              {valid ? (
                <Button
                  variant="secondary"
                  disabled={result.loading}
                  onClick={() => void result.refresh()}
                >
                  Check again
                </Button>
              ) : null}
            </section>
          )}
        </motion.div>
        {verify && notice.startsWith("We couldn’t") ? (
          <Button
            variant="secondary"
            onClick={() =>
              void emailRequest(gameId, "verify", { token: verify }).then((message) => {
                setNotice(message);
                if (!message.startsWith("We couldn’t"))
                  setSearch(
                    (previous) => {
                      const next = new URLSearchParams(previous);
                      next.delete("verify");
                      return next;
                    },
                    { replace: true },
                  );
              })
            }
          >
            Retry email confirmation
          </Button>
        ) : null}
      </section>
    </EntryFrame>
  );
}
async function emailRequest(
  gameId: string,
  operation: "email" | "verify",
  body: unknown,
) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`/api/rooms/${gameId}/results/${operation}`, {
      method: "POST",
      credentials: "same-origin",
      headers: clientApiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const parsed = resultsEmailSchema.safeParse(await response.json());
    if (!parsed.success || (!response.ok && parsed.data.status === "sent"))
      return "We couldn’t confirm that email request. Try again.";
    if (parsed.data.status === "sent")
      return "The message is with the mail service. Check that inbox.";
    if (parsed.data.status === "uncertain")
      return "The mail service did not confirm delivery. Ask again and the same message is retried.";
    if (parsed.data.status === "expired")
      return "This link has expired. Ask for a new one from your result.";
    if (parsed.data.status === "failed")
      return "The message could not be sent. You can ask again.";
    return "That email was not accepted.";
  } catch {
    return "We couldn’t confirm that email request. Try again.";
  } finally {
    window.clearTimeout(timer);
  }
}

import { useEffect, useRef, useState, type FormEvent } from "react";
import { gameIdSchema, joinCodeSchema, type LobbySnapshot } from "@26/shared";
import { Link, useSearchParams } from "react-router";
import { EntryFrame, EntryHeading, EntryNotice } from "../ui/entry-frame";
import { Button, TextField } from "../ui/primitives";
import { advancePresenter, pairProjector } from "../live/room-api";
import { openRoomSocket } from "../live/room-socket";
import { nextPhaseLabel } from "../live/phase-controls";
import { usePhaseCountdown } from "../live/use-phase-countdown";
import { cleanPairingCode, pairingCodePattern } from "./pairing-code";

export function PresenterPage() {
  const [search, setSearch] = useSearchParams();
  const room = gameIdSchema.safeParse(search.get("room"));
  const [joinCode, setJoinCode] = useState(search.get("code") ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef<{ key: string; requestId: string } | undefined>(undefined);

  async function pair(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const join = joinCodeSchema.safeParse(joinCode.trim().toUpperCase());
    const pairing = cleanPairingCode(code);
    if (!join.success || !pairingCodePattern.test(pairing)) {
      setMessage(
        "Enter the six-character join code and eight-character presenter code.",
      );
      return;
    }
    const key = `${join.data}:${pairing}`;
    const requestId =
      pending.current?.key === key ? pending.current.requestId : crypto.randomUUID();
    pending.current = { key, requestId };
    setBusy(true);
    setMessage("");
    try {
      const result = await pairProjector(
        { joinCode: join.data, code: pairing, requestId },
        "presenter",
      );
      if ("error" in result) {
        setMessage(result.error);
        return;
      }
      pending.current = undefined;
      setCode("");
      setSearch({ room: result.gameId, code: result.joinCode }, { replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <EntryFrame
      navigation={
        <Link to="/join" className="entry-text-link">
          Guest join
        </Link>
      }
    >
      {room.success ? (
        <PresenterControls
          key={room.data}
          gameId={room.data}
          onPairAgain={() =>
            setSearch({ code: search.get("code") ?? "" }, { replace: true })
          }
        />
      ) : (
        <>
          <EntryHeading eyebrow="Presenter" title="Pair your phone">
            Ask Humza for the presenter code in Live controls.
          </EntryHeading>
          <EntryNotice message={message} />
          <form className="entry-form" onSubmit={(event) => void pair(event)}>
            <TextField
              label="Join code"
              hint="Six characters shown in the lobby."
              value={joinCode}
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              onChange={(event) => setJoinCode(event.target.value)}
            />
            <TextField
              label="Presenter code"
              hint="Eight characters from Live controls."
              value={code}
              maxLength={12}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setCode(event.target.value)}
            />
            <Button type="submit" disabled={busy}>
              {busy ? "Pairing…" : "Pair presenter phone"}
            </Button>
          </form>
        </>
      )}
    </EntryFrame>
  );
}

function PresenterControls({
  gameId,
  onPairAgain,
}: {
  gameId: string;
  onPairAgain: () => void;
}) {
  const [live, setLive] = useState<{ snapshot: LobbySnapshot; observedAt: number }>();
  const [connection, setConnection] = useState<"connecting" | "open" | "closed">(
    "connecting",
  );
  const [message, setMessage] = useState("");
  const [replaced, setReplaced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [waitingFor, setWaitingFor] = useState<number>();
  const [retry, setRetry] = useState<{
    gameId: string;
    requestId: string;
    expectedPhaseGeneration: number;
  }>();
  const socket = useRef<ReturnType<typeof openRoomSocket> | undefined>(undefined);

  useEffect(() => {
    const current = openRoomSocket({
      gameId,
      role: "presenter",
      onSnapshot: (snapshot) => {
        setLive({ snapshot, observedAt: Date.now() });
        setConnection("open");
      },
      onAck: () => {},
      onConnection: (state) => {
        if (state !== "open") setConnection(state);
      },
      onReplaced: (notice) => {
        setReplaced(true);
        setMessage(notice);
      },
    });
    socket.current = current;
    return () => current.close();
  }, [gameId]);

  const snapshot = live?.snapshot;
  const countdown = usePhaseCountdown(snapshot, live?.observedAt ?? 0);
  const generation = snapshot?.phaseGeneration;
  const actionable =
    snapshot && snapshot.phase !== "lobby" && snapshot.phase !== "podium";
  const next = snapshot ? nextPhaseLabel(snapshot) : "";
  const waiting = waitingFor !== undefined && waitingFor === generation;

  async function advance() {
    if (busy || generation === undefined || connection !== "open" || replaced) return;
    const intent = retry ?? {
      gameId,
      expectedPhaseGeneration: generation,
      requestId: crypto.randomUUID(),
    };
    setBusy(true);
    setMessage("");
    const result = await advancePresenter(intent);
    setBusy(false);
    if ("error" in result) {
      setMessage(result.error);
      setRetry(result.uncertain ? intent : undefined);
    } else {
      setRetry(undefined);
      setWaitingFor(intent.expectedPhaseGeneration);
    }
    socket.current?.requestSnapshot();
  }

  return (
    <>
      <EntryHeading
        eyebrow={snapshot ? `Presenter · ${snapshot.joinCode}` : "Presenter"}
        title="Baseer’s controls"
      >
        {snapshot?.phase === "lobby"
          ? `${snapshot.players.length} joined. You’ll get the first cue when Humza starts the show.`
          : snapshot?.phase === "podium"
            ? "The podium is up."
            : snapshot?.paused
              ? "Humza has paused the room."
              : snapshot?.play
                ? `Question ${snapshot.play.question.index} of ${snapshot.play.question.total}`
                : "Connecting to the room…"}
      </EntryHeading>
      <EntryNotice
        message={message || (connection !== "open" ? "Connecting to the room…" : "")}
      />
      {actionable ? (
        <div className="entry-form">
          {snapshot.play ? (
            <p className="text-xl font-bold">{snapshot.play.question.prompt}</p>
          ) : null}
          {countdown ? (
            <p role="timer" aria-label={countdown.label}>
              {countdown.value}
            </p>
          ) : null}
          <Button
            disabled={
              busy ||
              waiting ||
              generation === undefined ||
              connection !== "open" ||
              replaced ||
              (snapshot.paused && !retry)
            }
            onClick={() => void advance()}
          >
            {busy || waiting
              ? "Updating room…"
              : retry
                ? "Retry the same action"
                : next}
          </Button>
        </div>
      ) : null}
      {replaced || connection !== "open" ? (
        <Button className="mt-4" variant="secondary" onClick={onPairAgain}>
          Pair again
        </Button>
      ) : null}
    </>
  );
}

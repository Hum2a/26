import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams } from "react-router";
import type { GuestSession, LobbySnapshot } from "@26/shared";
import { Button, Dialog, Panel, StatusMessage, TextField } from "../ui/primitives";
import { SurfaceFrame } from "../ui/surface-frame";
import { JoinMark } from "../lobby/join-mark";
import { NameCloud, NameReveal } from "../lobby/name-cloud";
import { joinLobby, redeemTransfer, resumeGuest } from "../live/room-api";
import { openRoomSocket } from "../live/room-socket";
import { guestRoundCopy } from "../play/copy";
import { GuestPlay } from "../play/guest-play";
import { GuestMedia } from "../media/guest-media";
import { GuestTrolls } from "../troll/guest-troll";

export function GuestPage() {
  const params = useParams();
  const [session, setSession] = useState<GuestSession>();
  const [snapshot, setSnapshot] = useState<LobbySnapshot>();
  const [code, setCode] = useState(params.code ?? "");
  const [nickname, setNickname] = useState("");
  const [transferCode, setTransferCode] = useState("");
  const [notice, setNotice] = useState("You have not joined a room.");
  const [connection, setConnection] = useState<
    "connecting" | "open" | "closed" | "idle"
  >("idle");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [pending, setPending] = useState(false);
  const [rejection, setRejection] = useState<string>();
  const [sound, setSound] = useState(readSound);
  const socketRef = useRef<ReturnType<typeof openRoomSocket> | null>(null);
  const pendingRequest = useRef<string | null>(null);
  const inFlight = useRef(false);
  const reactionRequest = useRef<string | null>(null);

  useEffect(() => {
    function onHide() {
      if (document.visibilityState === "hidden") {
        socketRef.current?.submitDraft("");
      }
    }
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  useEffect(() => {
    const watching = snapshot?.trolls.active.some(
      (effect) =>
        effect.kind === "typing" &&
        effect.role === "target" &&
        effect.status === "active",
    );
    if (!watching || snapshot?.play?.question.kind !== "choice" || !selectedId) {
      return;
    }
    const label = snapshot.play.question.options.find(
      (option) => option.id === selectedId,
    )?.label;
    if (label) {
      socketRef.current?.submitDraft(label);
    }
  }, [selectedId, snapshot]);

  useEffect(() => {
    document.title = "Guest · 26";
    void resumeGuest().then((resumed) => {
      if (resumed) {
        setSession(resumed);
        setNotice(`You are in. This phone is ${resumed.nickname}.`);
      }
    });
  }, []);

  const gameId = session?.gameId;
  const playerId = session?.playerId;

  useEffect(() => {
    if (!gameId || !playerId) {
      return;
    }
    const socket = openRoomSocket({
      gameId,
      role: "guest",
      onSnapshot(next) {
        if (next.phase === "intro" || next.phase === "prompt") {
          setSelectedId(undefined);
          setPending(false);
        }
        setSnapshot(next);
        if (next.play?.selfAnswer || next.play?.selfBallot) {
          setPending(false);
          setRejection(undefined);
        }
        setSession((current) =>
          current
            ? {
                ...current,
                stateVersion: next.stateVersion,
                joinCode: next.joinCode,
              }
            : current,
        );
      },
      onAck(ack) {
        if (ack.requestId === reactionRequest.current) {
          reactionRequest.current = null;
          if (!ack.accepted) {
            setNotice(ack.error ?? "That name vote was not accepted.");
          }
          return;
        }
        if (ack.requestId !== pendingRequest.current) {
          return;
        }
        pendingRequest.current = null;
        inFlight.current = false;
        setPending(false);
        if (!ack.accepted) {
          setRejection(ack.error ?? "That answer was not accepted.");
          return;
        }
        setRejection(undefined);
        if (readSound()) {
          playAcceptedTone();
        }
      },
      onReplaced(message) {
        setSnapshot(undefined);
        setNotice(message);
      },
      onConnection(state) {
        setConnection(state);
      },
    });
    socketRef.current = socket;
    return () => {
      socketRef.current = null;
      socket.close();
    };
  }, [gameId, playerId]);

  useEffect(() => {
    function onLeave(event: BeforeUnloadEvent) {
      if (
        !session ||
        !snapshot ||
        snapshot.phase === "lobby" ||
        snapshot.phase === "podium"
      ) {
        return;
      }
      event.preventDefault();
    }
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [session, snapshot]);

  async function onJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) {
      return;
    }
    setBusy(true);
    const joined = await joinLobby({
      code,
      nickname,
      requestId: crypto.randomUUID(),
    });
    setBusy(false);
    if ("error" in joined) {
      setNotice(joined.error);
      return;
    }
    setSession(joined);
    setNotice(`You are in. This phone is ${joined.nickname}.`);
  }

  async function onRedeem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) {
      return;
    }
    setBusy(true);
    const redeemed = await redeemTransfer({
      joinCode: session.joinCode,
      code: transferCode,
      requestId: crypto.randomUUID(),
    });
    setBusy(false);
    if ("error" in redeemed) {
      setNotice(redeemed.error);
      return;
    }
    setSession(redeemed);
    setNotice(`You are ${redeemed.nickname} on this phone.`);
  }

  function onReact(targetId: string, reaction: "like" | "dislike") {
    reactionRequest.current =
      socketRef.current?.submitReaction(targetId, reaction) ?? null;
  }

  function beginSend(): boolean {
    if (pending || inFlight.current) {
      return false;
    }
    inFlight.current = true;
    setPending(true);
    setRejection(undefined);
    return true;
  }

  function onSubmit() {
    if (!selectedId || !beginSend()) {
      return;
    }
    pendingRequest.current = socketRef.current?.submitAnswer(selectedId) ?? null;
  }

  function onEstimate(value: number) {
    if (!beginSend()) {
      return;
    }
    pendingRequest.current = socketRef.current?.submitEstimate(value) ?? null;
  }

  function onRank(placements: { itemId: string; tierId: string }[]) {
    if (!beginSend()) {
      return;
    }
    pendingRequest.current = socketRef.current?.submitRank(placements) ?? null;
  }

  function onText(body: string) {
    if (!beginSend()) {
      return;
    }
    pendingRequest.current = socketRef.current?.submitText(body) ?? null;
  }

  function onTroll(kind: string, targetId: string, mediaId?: string) {
    if (!beginSend()) {
      return;
    }
    pendingRequest.current =
      socketRef.current?.submitTroll(kind, targetId, mediaId) ?? null;
  }

  function onTrollEscape(effectId: string) {
    if (!beginSend()) {
      return;
    }
    pendingRequest.current = socketRef.current?.submitTrollEscape(effectId) ?? null;
  }

  function onDuel(value: number) {
    if (!beginSend()) {
      return;
    }
    pendingRequest.current = socketRef.current?.submitDuel(value) ?? null;
  }

  function onBallot(candidateId: string) {
    if (!beginSend()) {
      return;
    }
    pendingRequest.current = socketRef.current?.submitBallot(candidateId) ?? null;
  }

  const playing = snapshot !== undefined && snapshot.phase !== "lobby";
  const status = session
    ? phoneStatus({
        notice,
        connection,
        playing,
        pending,
        rejection,
        snapshot,
      })
    : notice;
  const connectionCopy = session
    ? connection === "open"
      ? playing
        ? "Connected to the game."
        : "Connected to the lobby."
      : connection === "connecting"
        ? playing
          ? "Reconnecting to the game."
          : "Reconnecting to the lobby."
        : connection === "closed"
          ? playing
            ? "The game connection is closed. This page will try again."
            : "The lobby connection is closed."
          : "The lobby connects after you join."
    : "The lobby connects after you join.";

  return (
    <SurfaceFrame
      current="guest"
      title="Guest"
      lede="Enter the join code and a nickname. This phone plays on its own."
    >
      <StatusMessage>{status}</StatusMessage>
      <p>{connectionCopy}</p>
      {session ? (
        <Panel title={playing ? "This question" : "In the lobby"}>
          <p>You are in. This phone is {liveNickname(snapshot, session)}.</p>
          {snapshot?.phase === "lobby" ? (
            <div className="mt-4 grid gap-4">
              <JoinMark code={snapshot.joinCode} />
              {snapshot.namesReveal ? (
                <NameReveal reveal={snapshot.namesReveal} />
              ) : null}
              <NameCloud
                names={snapshot.cloud}
                selfId={session.playerId}
                reactions={snapshot.selfReactions}
                onReact={onReact}
                minRem={0.875}
              />
            </div>
          ) : null}
          {snapshot ? (
            <GuestPlay
              snapshot={snapshot}
              selectedId={selectedId}
              pending={pending}
              onSelect={setSelectedId}
              onSubmit={onSubmit}
              onEstimate={onEstimate}
              onRank={onRank}
              onText={onText}
              onDraft={(body) => socketRef.current?.submitDraft(body)}
              onBallot={onBallot}
              onDuel={onDuel}
            />
          ) : (
            <p>Waiting for the quiz to start.</p>
          )}
          {snapshot && session && snapshot.phase !== "lobby" ? (
            <>
              <GuestTrolls
                snapshot={snapshot}
                gameId={session.gameId}
                selfId={session.playerId}
                pending={pending}
                onSend={onTroll}
                onEscape={onTrollEscape}
              />
              <GuestMedia gameId={session.gameId} />
            </>
          ) : null}
          <form className="mt-4 grid gap-4" onSubmit={(event) => void onRedeem(event)}>
            <TextField
              label="Transfer code"
              hint="Humza can read you a one-use code if you change phones."
              value={transferCode}
              onChange={(event) => setTransferCode(event.target.value)}
              autoComplete="off"
            />
            <Button type="submit" disabled={busy}>
              Use this phone
            </Button>
          </form>
        </Panel>
      ) : (
        <form className="grid gap-4" onSubmit={(event) => void onJoin(event)}>
          <TextField
            label="Join code"
            hint="Six characters from the stage or the admin screen."
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            required
          />
          <TextField
            label="Nickname"
            hint="1 to 24 characters. Someone else in the room cannot use the same name."
            name="nickname"
            autoComplete="nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            required
          />
          <Button type="submit" disabled={busy}>
            Join
          </Button>
        </form>
      )}
      {snapshot?.recap && snapshot.recap.length > 0 ? (
        <Panel title="Your recap">
          <ul className="grid gap-3">
            {snapshot.recap.map((card) => (
              <li key={card.id}>
                {card.illustrative ? <p className="font-bold">Illustrative</p> : null}
                <p className="break-words">{card.results}</p>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      <Panel title="On this phone">
        <p>
          Join the lobby and answer on this phone. The stage shows the question to the
          room.
        </p>
        <p className="mt-4">
          This phone can send browser and screen details for end-of-game statistics.
          They do not decide who you are or what you score, and you can play if that
          report never arrives. The screen size is CSS pixels, not inches, and a network
          quality of 4g is not proof of a mobile 4G service.
        </p>
        <Button
          className="mt-4"
          variant="secondary"
          aria-pressed={sound}
          onClick={() => {
            const next = !sound;
            setSound(next);
            sessionStorage.setItem("26-sound", next ? "on" : "off");
          }}
        >
          {sound ? "Sound on" : "Sound off"}
        </Button>
        <div className="mt-4">
          <Dialog title="About this build" triggerLabel="About this build">
            <p>
              This phone keeps your nickname for this game. The illustrative questions
              are a demo, not the party script. Sound is optional and starts off. Device
              details are for statistics after the game. An unclear iPhone or iPad stays
              marked that way.
            </p>
          </Dialog>
        </div>
      </Panel>
    </SurfaceFrame>
  );
}

function phoneStatus(input: {
  notice: string;
  connection: "connecting" | "open" | "closed" | "idle";
  playing: boolean;
  pending: boolean;
  rejection: string | undefined;
  snapshot: LobbySnapshot | undefined;
}): string {
  if (input.connection === "connecting") {
    return input.playing ? "Reconnecting to the game." : "Reconnecting to the lobby.";
  }
  if (input.connection === "closed") {
    return input.playing
      ? "The game connection is closed. This page will try again."
      : "The lobby connection is closed.";
  }
  if (input.rejection) {
    return input.rejection;
  }
  if (input.pending) {
    return "Sending your answer.";
  }
  if (input.snapshot && input.playing) {
    return guestRoundCopy(input.snapshot);
  }
  return input.notice;
}

function liveNickname(
  snapshot: LobbySnapshot | undefined,
  session: GuestSession,
): string {
  return (
    snapshot?.players.find((player) => player.playerId === session.playerId)
      ?.nickname ?? session.nickname
  );
}

function readSound(): boolean {
  try {
    return sessionStorage.getItem("26-sound") === "on";
  } catch {
    return false;
  }
}

function playAcceptedTone(): void {
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = 660;
  gain.gain.value = 0.04;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.12);
  oscillator.onended = () => {
    void context.close();
  };
}

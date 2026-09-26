import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams, useSearchParams } from "react-router";
import type { GuestSession, LobbySnapshot } from "@26/shared";
import { Button, Dialog, Panel, StatusMessage, TextField } from "../ui/primitives";
import { SurfaceFrame } from "../ui/surface-frame";
import { JoinMark } from "../lobby/join-mark";
import { NameCloud, NameReveal } from "../lobby/name-cloud";
import { joinLobby, redeemTransfer, resumeGuest } from "../live/room-api";
import { openRoomSocket } from "../live/room-socket";
import { PhaseTransition } from "../anim/PhaseTransition";
import { guestRoundCopy } from "../play/copy";
import { GuestPlay } from "../play/guest-play";
import { WaitingNext } from "../play/WaitingNext";
import { GuestMedia } from "../media/guest-media";
import { GuestTrolls } from "../troll/guest-troll";
import { ControllerRoot } from "../controller/ControllerRoot";
import {
  hapticCues,
  triggerHaptic,
  type HapticView,
} from "../controller/haptic-triggers";
import { useWakeLock } from "../device/wakeLock";
import { JoinRoomCode } from "../join/JoinRoomCode";
import { NicknameField } from "../join/Nickname";
import { rememberNickname } from "../join/nickname-storage";
import { roomCodeFromQuery } from "../join/room-code";
import { ConnectionDot } from "../net/ConnectionDot";
import { ReconnectBanner } from "../net/ReconnectBanner";

export function GuestPage() {
  const params = useParams();
  const [search] = useSearchParams();
  const linked =
    roomCodeFromQuery(search.get("room")) ?? roomCodeFromQuery(params.code ?? null);
  const [session, setSession] = useState<GuestSession>();
  const [snapshot, setSnapshot] = useState<LobbySnapshot>();
  const [code, setCode] = useState(linked ?? "");
  const [nicknameError, setNicknameError] = useState("");
  const [transferCode, setTransferCode] = useState("");
  const [notice, setNotice] = useState("You have not joined a room.");
  const [connection, setConnection] = useState<
    "connecting" | "open" | "closed" | "idle"
  >("idle");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [pending, setPending] = useState(false);
  const [rejection, setRejection] = useState<string>();
  const [snapshotPulse, setSnapshotPulse] = useState(0);
  const [seenOpen, setSeenOpen] = useState(false);
  const socketRef = useRef<ReturnType<typeof openRoomSocket> | null>(null);
  const pendingRequest = useRef<string | null>(null);
  const inFlight = useRef(false);
  const reactionRequest = useRef<string | null>(null);
  const hapticBaseline = useRef<HapticView | null>(null);
  useWakeLock(session !== undefined);

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
      return () => {};
    }
    hapticBaseline.current = null;
    const socket = openRoomSocket({
      gameId,
      role: "guest",
      onSnapshot(next) {
        const view: HapticView = {
          phase: next.phase,
          effects: next.trolls.active.map((effect) => ({
            effectId: effect.effectId,
            role: effect.role,
            status: effect.status,
          })),
        };
        for (const cue of hapticCues(hapticBaseline.current, view)) {
          triggerHaptic(cue);
        }
        hapticBaseline.current = view;
        setSnapshotPulse((count) => count + 1);
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
      },
      onReplaced(message) {
        hapticBaseline.current = null;
        setSnapshot(undefined);
        setNotice(message);
      },
      onConnection(state) {
        if (state === "open") {
          setSeenOpen(true);
        }
        setConnection(state);
      },
    });
    socketRef.current = socket;
    return () => {
      hapticBaseline.current = null;
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
    const form = new FormData(event.currentTarget);
    const enteredName = String(form.get("nickname") ?? "");
    setBusy(true);
    const joined = await joinLobby({
      code: linked ?? code,
      nickname: enteredName,
      requestId: crypto.randomUUID(),
    });
    setBusy(false);
    if ("error" in joined) {
      if (joined.error.toLowerCase().includes("nickname")) {
        setNicknameError(joined.error);
      } else {
        setNicknameError("");
        setNotice(joined.error);
      }
      return;
    }
    setNicknameError("");
    rememberNickname(enteredName);
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
  const reconnecting = seenOpen && connection !== "open";

  return (
    <ControllerRoot>
      <SurfaceFrame
        current="guest"
        title="Guest"
        lede="Enter the join code and a nickname. This phone plays on its own."
      >
        <StatusMessage>{status}</StatusMessage>
        <div className="flex items-center gap-2">
          <ConnectionDot connection={connection} />
          <p>{connectionCopy}</p>
        </div>
        <ReconnectBanner disconnected={reconnecting} snapshotId={snapshotPulse}>
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
              <PhaseTransition phase={snapshot?.phase ?? "lobby"}>
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
                {snapshot &&
                guestRoundCopy(snapshot) === "Waiting for the next question." ? (
                  <WaitingNext />
                ) : null}
              </PhaseTransition>
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
              <form
                className="mt-4 grid gap-4"
                onSubmit={(event) => void onRedeem(event)}
              >
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
              <JoinRoomCode
                roomQuery={search.get("room")}
                pathCode={params.code}
                value={code}
                onChange={setCode}
              />
              <NicknameField
                error={nicknameError}
                onEdit={() => setNicknameError("")}
              />
              <Button type="submit" disabled={busy}>
                Join
              </Button>
            </form>
          )}
        </ReconnectBanner>
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
            report never arrives. The screen size is CSS pixels, not inches, and a
            network quality of 4g is not proof of a mobile 4G service.
          </p>
          <div className="mt-4">
            <Dialog title="About this build" triggerLabel="About this build">
              <p>
                This phone keeps your nickname for this game. The illustrative questions
                are a demo, not the party script. Sound plays on the stage. Device
                details are for statistics after the game. An unclear iPhone or iPad
                stays marked that way.
              </p>
            </Dialog>
          </div>
        </Panel>
      </SurfaceFrame>
    </ControllerRoot>
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

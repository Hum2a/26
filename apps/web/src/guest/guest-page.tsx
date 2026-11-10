import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link, useParams, useSearchParams } from "react-router";
import type { GuestSession, LobbySnapshot } from "@26/shared";
import {
  Button,
  Dialog,
  Disclosure,
  Panel,
  StatusMessage,
  TextField,
} from "../ui/primitives";
import { JoinMark } from "../lobby/join-mark";
import { NameCloud, NameReveal } from "../lobby/name-cloud";
import { joinLobby, redeemTransfer, resumeGuest } from "../live/room-api";
import { openRoomSocket } from "../live/room-socket";
import { PhaseTransition } from "../anim/PhaseTransition";
import { kartRaceScene } from "../kart/race-scene";
import { guestRoundCopy } from "../play/copy";
import { GuestPlay } from "../play/guest-play";
import { FunFactPhone } from "../play/fun-fact";
import { WaitingNext } from "../play/WaitingNext";
import { GuestMedia } from "../media/guest-media";
import { GuestTrolls } from "../troll/guest-troll";
import { GuestWall } from "../wall/guest-wall";
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
import { ReconnectBanner } from "../live/ReconnectBanner";
import { deadlinePassed } from "../live/server-clock";
import { usePreloadQuestion } from "../play/preload";
import { DriverPicker } from "../kart/DriverPicker";
import type { DriverStyle } from "@26/shared";
import { PhoneShell, type PhoneTab } from "./phone-shell";
import { PhoneTimer } from "./phone-timer";
import { RanksTab } from "./ranks-tab";
import { YouMenu } from "./you-menu";
import { AvatarPicker } from "./avatar-picker";
import { avatarPromptSkipped, skipAvatarPrompt } from "./avatar-prompt";
import { avatarUrl } from "../ui/roster-context";
import { RosterProvider } from "../ui/roster";
import { TrollTab } from "../troll/troll-tab";
import { ThemePicker } from "../theme/theme-picker";
import { EntryFrame, EntryHeading, EntryNotice } from "../ui/entry-frame";

export function GuestPage({
  rehearsalSession,
  rehearsalCredential,
}: {
  rehearsalSession?: GuestSession;
  rehearsalCredential?: { playerId: string; secret: string };
} = {}) {
  const params = useParams();
  const [search] = useSearchParams();
  const linked =
    roomCodeFromQuery(search.get("room")) ?? roomCodeFromQuery(params.code ?? null);
  const [session, setSession] = useState<GuestSession | undefined>(rehearsalSession);
  const [snapshot, setSnapshot] = useState<LobbySnapshot>();
  const [code, setCode] = useState(linked ?? "");
  const [nicknameError, setNicknameError] = useState("");
  const [transferCode, setTransferCode] = useState("");
  const [notice, setNotice] = useState("You have not joined a room.");
  const [connection, setConnection] = useState<
    "connecting" | "open" | "closed" | "idle"
  >("idle");
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(!rehearsalSession);
  const joinRequest = useRef<{ payload: string; requestId: string } | null>(null);
  const transferRequest = useRef<{ payload: string; requestId: string } | null>(null);
  const [sessionGeneration, setSessionGeneration] = useState(0);
  const [selectedId, setSelectedId] = useState<string>();
  const [pending, setPending] = useState(false);
  const [rejection, setRejection] = useState<string>();
  const [snapshotPulse, setSnapshotPulse] = useState(0);
  const [seenOpen, setSeenOpen] = useState(false);
  const [tab, setTab] = useState<PhoneTab>("play");
  const [ranksFresh, setRanksFresh] = useState(false);
  // Snap stays mounted once opened, so an upload in progress keeps its state.
  const [snapVisited, setSnapVisited] = useState(false);
  if (tab === "snap" && !snapVisited) setSnapVisited(true);
  const [replacedNotice, setReplacedNotice] = useState<string>();
  const [observedAt, setObservedAt] = useState(() => Date.now());
  const lastBeat = useRef<string | null>(null);
  const socketRef = useRef<ReturnType<typeof openRoomSocket> | null>(null);
  const pendingRequest = useRef<string | null>(null);
  const inFlight = useRef(false);
  // Trolls travel separately so a troll in flight never blocks an answer.
  const trollRequest = useRef<string | null>(null);
  const [trollPending, setTrollPending] = useState(false);
  const reactionRequest = useRef<string | null>(null);
  const driverRequest = useRef<string | null>(null);
  const [driverPending, setDriverPending] = useState(false);
  const avatarRequest = useRef<string | null>(null);
  const [avatarPending, setAvatarPending] = useState(false);
  // Bumped when the guest puts off the photo card, so the stored choice is read again.
  const [, setAvatarSkips] = useState(0);
  const kartRecoveryRequest = useRef<string | null>(null);
  const [kartRecoveryPending, setKartRecoveryPending] = useState(false);
  const [kartRecoveryNotice, setKartRecoveryNotice] = useState("");
  const kartItemRequest = useRef<string | null>(null);
  const [kartItemPending, setKartItemPending] = useState(false);
  const [kartItemNotice, setKartItemNotice] = useState("");
  const recoveryRace = useRef<string | undefined>(undefined);
  const hapticBaseline = useRef<HapticView | null>(null);
  useWakeLock(session !== undefined);
  usePreloadQuestion(snapshot);

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
    if (rehearsalSession) return;
    let active = true;
    void resumeGuest()
      .then((resumed) => {
        if (!active) return;
        if (resumed) {
          setSession(resumed);
          setNotice(`You are in. This phone is ${resumed.nickname}.`);
        }
      })
      .catch(() => {
        if (active)
          setNotice(
            "We couldn’t check for an existing game. You can try joining with your code.",
          );
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, [rehearsalSession]);

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
      ...(rehearsalCredential ? { botSession: rehearsalCredential } : {}),
      onSnapshot(next) {
        if (recoveryRace.current !== next.play?.kart?.raceId) {
          recoveryRace.current = next.play?.kart?.raceId;
          kartRecoveryRequest.current = null;
          kartItemRequest.current = null;
          setKartItemPending(false);
          setKartItemNotice("");
          setKartRecoveryPending(false);
          setKartRecoveryNotice("");
        }
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
        setObservedAt(Date.now());
        // A new beat that needs this phone brings it back to Play.
        const beat = `${next.play?.question.id ?? "lobby"}/${next.phase}`;
        if (lastBeat.current !== null && lastBeat.current !== beat) {
          // Only when answers open, so a guest mid-upload is not pulled away
          // by the get-ready beat.
          if (["collect", "vote", "predict"].includes(next.phase)) {
            setTab("play");
          }
          if (next.phase === "scores") setRanksFresh(true);
          // The final standings are the point of the podium.
          if (next.phase === "podium") setTab("ranks");
        }
        lastBeat.current = beat;
        if (next.phase === "intro" || next.phase === "prompt") {
          setSelectedId(undefined);
          setPending(false);
        }
        setSnapshot(next);
        if (
          (next.play?.selfAnswer && next.play.selfAnswer.kind !== "wordle") ||
          next.play?.selfBallot
        ) {
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
        if (ack.requestId === kartItemRequest.current) {
          kartItemRequest.current = null;
          setKartItemPending(false);
          setKartItemNotice(
            ack.accepted ? "Power-up used" : (ack.error ?? "Item was not accepted."),
          );
          return;
        }
        if (ack.requestId === kartRecoveryRequest.current) {
          kartRecoveryRequest.current = null;
          setKartRecoveryPending(false);
          setKartRecoveryNotice(
            ack.accepted
              ? "Back on track — controls released"
              : (ack.error ?? "Recovery was not accepted."),
          );
          return;
        }
        if (ack.requestId === reactionRequest.current) {
          reactionRequest.current = null;
          if (!ack.accepted) {
            setNotice(ack.error ?? "That name vote was not accepted.");
          }
          return;
        }
        if (ack.requestId === avatarRequest.current) {
          avatarRequest.current = null;
          setAvatarPending(false);
          if (!ack.accepted) {
            setNotice(ack.error ?? "That photo was not saved.");
          }
          return;
        }
        if (ack.requestId === driverRequest.current) {
          driverRequest.current = null;
          setDriverPending(false);
          if (!ack.accepted) {
            setNotice(ack.error ?? "That driver was not saved.");
          }
          return;
        }
        if (ack.requestId === trollRequest.current) {
          trollRequest.current = null;
          setTrollPending(false);
          if (!ack.accepted) {
            setRejection(ack.error ?? "That troll was not accepted.");
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
        avatarRequest.current = null;
        setAvatarPending(false);
        trollRequest.current = null;
        setTrollPending(false);
        kartItemRequest.current = null;
        setKartItemPending(false);
        setKartRecoveryPending(false);
        hapticBaseline.current = null;
        setSnapshot(undefined);
        setNotice(message);
        setReplacedNotice(message);
        setTab("play");
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
  }, [gameId, playerId, rehearsalCredential, sessionGeneration]);

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
    if (busy || checkingSession) {
      return;
    }
    const form = new FormData(event.currentTarget);
    const enteredName = String(form.get("nickname") ?? "");
    setBusy(true);
    const payload = JSON.stringify([linked ?? code, enteredName]);
    if (joinRequest.current?.payload !== payload)
      joinRequest.current = { payload, requestId: crypto.randomUUID() };
    const joined = await joinLobby({
      code: linked ?? code,
      nickname: enteredName,
      requestId: joinRequest.current.requestId,
    }).catch(() => ({
      error: "We couldn’t join the room. Check your connection and try again.",
      uncertain: true,
    }));
    setBusy(false);
    if ("error" in joined) {
      // A refused attempt is finished. A later tap must be able to join after
      // the host reopens entry; uncertain network retries keep the same receipt.
      if (joined.uncertain === false) joinRequest.current = null;
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
    if (busy || checkingSession) return;
    const joinCode = session?.joinCode ?? roomCodeFromQuery(linked ?? code);
    if (!joinCode) {
      setNotice("Enter the room’s join code before using your private transfer code.");
      return;
    }
    const codeToRedeem = transferCode.trim().toUpperCase();
    const payload = JSON.stringify([joinCode, codeToRedeem]);
    if (transferRequest.current?.payload !== payload)
      transferRequest.current = { payload, requestId: crypto.randomUUID() };
    setBusy(true);
    const redeemed = await redeemTransfer({
      joinCode,
      code: codeToRedeem,
      requestId: transferRequest.current.requestId,
    }).catch(() => ({
      error:
        "We couldn’t confirm the phone transfer. Check your connection and try again.",
      uncertain: true,
    }));
    setBusy(false);
    if ("error" in redeemed) {
      if (redeemed.uncertain === false) transferRequest.current = null;
      setNotice(redeemed.error);
      return;
    }
    transferRequest.current = null;
    setTransferCode("");
    setSnapshot(undefined);
    setPending(false);
    pendingRequest.current = null;
    inFlight.current = false;
    trollRequest.current = null;
    setTrollPending(false);
    // The old socket's photo and driver saves will never be acknowledged on the new one.
    avatarRequest.current = null;
    setAvatarPending(false);
    driverRequest.current = null;
    setDriverPending(false);
    setSession(redeemed);
    setReplacedNotice(undefined);
    // Recovery may keep both IDs. Replace the existing socket after the cookie
    // changes, so the recovered phone authenticates with its new credential.
    setSessionGeneration((generation) => generation + 1);
    setNotice(`You are ${redeemed.nickname} on this phone.`);
  }

  function onReact(targetId: string, reaction: "like" | "dislike") {
    reactionRequest.current =
      socketRef.current?.submitReaction(targetId, reaction) ?? null;
  }

  function onAvatar(mediaId: string | null) {
    const requestId = socketRef.current?.submitAvatar(mediaId) ?? null;
    avatarRequest.current = requestId;
    setAvatarPending(requestId !== null);
  }

  function onDriver(style: DriverStyle, faceMediaId: string | null) {
    const requestId = socketRef.current?.submitDriver(style, faceMediaId) ?? null;
    driverRequest.current = requestId;
    setDriverPending(requestId !== null);
  }

  function beginSend(answer = false): boolean {
    if (pending || inFlight.current) {
      return false;
    }
    // The room still decides. This only saves a send the room would refuse.
    if (answer && deadlinePassed(snapshot)) {
      setRejection("Time’s up. That one did not make it in.");
      return false;
    }
    inFlight.current = true;
    setPending(true);
    setRejection(undefined);
    return true;
  }

  function onSubmit() {
    if (!selectedId || !beginSend(true)) {
      return;
    }
    pendingRequest.current = socketRef.current?.submitAnswer(selectedId) ?? null;
  }

  function onChoose(optionId: string) {
    if (!beginSend(true)) {
      return;
    }
    setSelectedId(optionId);
    pendingRequest.current = socketRef.current?.submitAnswer(optionId) ?? null;
  }

  function onEstimate(value: number) {
    if (!beginSend(true)) {
      return;
    }
    pendingRequest.current = socketRef.current?.submitEstimate(value) ?? null;
  }

  function onRank(placements: { itemId: string; tierId: string }[]) {
    if (!beginSend(true)) {
      return;
    }
    pendingRequest.current = socketRef.current?.submitRank(placements) ?? null;
  }

  function onText(body: string) {
    if (!beginSend(true)) {
      return;
    }
    pendingRequest.current = socketRef.current?.submitText(body) ?? null;
  }

  function beginTroll(): boolean {
    if (trollPending || trollRequest.current) {
      return false;
    }
    setRejection(undefined);
    return true;
  }

  function sendTroll(requestId: string | null) {
    trollRequest.current = requestId;
    setTrollPending(requestId !== null);
  }

  function onTroll(kind: string, targetId: string, mediaId?: string) {
    if (!beginTroll()) {
      return;
    }
    sendTroll(socketRef.current?.submitTroll(kind, targetId, mediaId) ?? null);
  }

  function onTrollEscape(effectId: string) {
    if (!beginTroll()) {
      return;
    }
    sendTroll(socketRef.current?.submitTrollEscape(effectId) ?? null);
  }

  function onDuel(value: number) {
    if (!beginSend(true)) {
      return;
    }
    pendingRequest.current = socketRef.current?.submitDuel(value) ?? null;
  }

  function onBallot(candidateId: string) {
    if (!beginSend(true)) {
      return;
    }
    pendingRequest.current =
      socketRef.current?.submitBallot(candidateId, snapshot?.play?.ballot?.epoch) ??
      null;
  }

  const playing = snapshot !== undefined && snapshot.phase !== "lobby";
  const status = session
    ? phoneStatus({
        replaced: replacedNotice,
        notice,
        connection,
        playing,
        pending,
        trollPending,
        rejection,
        snapshot,
      })
    : notice;
  const reconnecting = seenOpen && connection !== "open" && !replacedNotice;
  const nickname = session ? liveNickname(snapshot, session) : undefined;
  const questionVisible = playing && snapshot?.play;

  if (!session)
    return (
      <EntryFrame
        navigation={
          <Link to="/admin/login" className="entry-text-link">
            Admin sign in
          </Link>
        }
      >
        <EntryHeading eyebrow="You’re invited" title="Join the room">
          Enter the join code and a nickname. This phone plays on its own.
        </EntryHeading>
        <EntryNotice
          message={
            checkingSession
              ? "Checking for your game…"
              : notice === "You have not joined a room."
                ? ""
                : notice
          }
        />
        <form
          id="join-room"
          className="entry-form"
          onSubmit={(event) => void onJoin(event)}
        >
          <JoinRoomCode
            roomQuery={search.get("room")}
            pathCode={params.code}
            value={code}
            onChange={setCode}
          />
          <NicknameField error={nicknameError} onEdit={() => setNicknameError("")} />
          <p className="entry-note">
            This phone can send screen and browser details for game statistics. They do
            not decide who you are or what you score.
          </p>
          <Button type="submit" disabled={busy || checkingSession}>
            {busy ? "Joining…" : "Join"}
          </Button>
        </form>
        <div className="mt-5">
          <TransferPhone
            busy={busy || checkingSession}
            code={transferCode}
            onCode={setTransferCode}
            onSubmit={(event) => void onRedeem(event)}
          />
        </div>
        <div className="mt-5">
          <Dialog
            title="About this game"
            triggerLabel="About this game"
            triggerVariant="secondary"
          >
            <p>
              You play individually. This phone keeps your nickname for this game. Sound
              plays on the stage.
            </p>
            <p className="mt-3">
              Device details are used for later statistics. The end of the night can
              include room totals such as dark mode, browser and time zone, without
              naming who. Screen size is measured in CSS pixels, not inches. A network
              quality of 4g is not a mobile 4G service. An unclear iPhone or iPad stays
              marked that way.
            </p>
          </Dialog>
        </div>
        <Link className="entry-text-link mt-4" to="/">
          ← Back to the party
        </Link>
      </EntryFrame>
    );

  const selfPlayer = snapshot?.players.find(
    (player) => player.playerId === session.playerId,
  );
  const trollReady =
    snapshot?.trolls.token === "ready" &&
    (snapshot.play?.question.index ?? 0) >= 2 &&
    !["final", "facts", "podium"].includes(snapshot.phase);
  const badges: Partial<Record<PhoneTab, string>> = {};
  if (trollReady && tab !== "troll") badges.troll = "1";
  if (ranksFresh && tab !== "ranks") badges.ranks = "!";
  const selfAvatar = selfPlayer?.avatarMediaId;
  const avatarCard =
    !rehearsalCredential &&
    snapshot?.phase === "lobby" &&
    (Boolean(selfAvatar) || !avatarPromptSkipped(session.gameId));
  const avatarPicker = (variant: "welcome" | "menu") => (
    <AvatarPicker
      variant={variant}
      gameId={session.gameId}
      playerId={session.playerId}
      nickname={nickname ?? session.nickname}
      avatarMediaId={selfAvatar}
      pending={avatarPending}
      onChoose={onAvatar}
      onSkip={
        variant === "welcome"
          ? () => {
              skipAvatarPrompt(session.gameId);
              setAvatarSkips((count) => count + 1);
            }
          : undefined
      }
    />
  );

  return (
    <RosterProvider
      gameId={session.gameId}
      players={snapshot?.players ?? []}
      revision={snapshot?.mediaDisplayRevision}
    >
      <ControllerRoot
        allowLandscape={
          snapshot?.play?.question.kind === "kart" || snapshot?.mode === "kart"
        }
      >
        <PhoneShell
          nickname={nickname}
          connection={connection}
          held={reconnecting}
          immersive={Boolean(questionVisible)}
          scrollKey={`${snapshot?.play?.question.id ?? "join"}/${snapshot?.phase ?? "lobby"}`}
          timer={<PhoneTimer snapshot={snapshot} observedAt={observedAt} />}
          menu={
            <YouMenu
              playerId={session.playerId}
              nickname={nickname ?? session.nickname}
              faceSrc={selfAvatar ? avatarUrl(session.gameId, selfAvatar) : null}
            >
              {!rehearsalCredential ? (
                <Disclosure title={selfAvatar ? "Your photo" : "Add your photo"}>
                  {avatarPicker("menu")}
                </Disclosure>
              ) : null}
              <div className="you-menu-row">
                <span>Theme</span>
                <ThemePicker />
              </div>
              {!rehearsalCredential ? (
                <TransferPhone
                  busy={busy}
                  code={transferCode}
                  onCode={setTransferCode}
                  onSubmit={(event) => void onRedeem(event)}
                />
              ) : null}
            </YouMenu>
          }
          overlays={
            snapshot && snapshot.phase !== "lobby" ? (
              <GuestTrolls
                snapshot={snapshot}
                gameId={session.gameId}
                selfId={session.playerId}
                pending={trollPending}
                onEscape={onTrollEscape}
              />
            ) : null
          }
          tabs={{
            active: tab,
            onChange: (next) => {
              setTab(next);
              if (next === "ranks") setRanksFresh(false);
            },
            badges,
            pages: {
              ranks: (
                <>
                  <RanksTab
                    snapshot={snapshot}
                    nickname={nickname ?? session.nickname}
                  />
                  {snapshot?.recap && snapshot.recap.length > 0 ? (
                    <Panel title="Your recap">
                      <ul className="grid gap-3">
                        {snapshot.recap.map((card) => (
                          <li key={card.id}>
                            {card.illustrative ? (
                              <p className="font-bold">Illustrative</p>
                            ) : null}
                            <p className="break-words">{card.results}</p>
                          </li>
                        ))}
                      </ul>
                    </Panel>
                  ) : null}
                </>
              ),
              troll: snapshot ? (
                <TrollTab
                  snapshot={snapshot}
                  gameId={session.gameId}
                  selfId={session.playerId}
                  pending={trollPending}
                  onSend={onTroll}
                />
              ) : null,
              snap: (
                <div className="snap-tab">
                  <header className="phone-tab-head">
                    <p className="entry-eyebrow">Photos and sound</p>
                    <h1 className="phone-tab-title">Snap</h1>
                  </header>
                  {!snapVisited ? null : rehearsalCredential ? (
                    <p className="text-muted">
                      Live test phone. Use an ordinary second-browser guest for photos.
                    </p>
                  ) : (
                    <>
                      {snapshot?.wall ? (
                        <section
                          className="snap-card glass"
                          aria-label="Send to the big screen"
                        >
                          <h2>Send to the big screen</h2>
                          <GuestWall
                            wall={snapshot.wall}
                            gameId={session.gameId}
                            selfNickname={selfPlayer?.nickname ?? "You"}
                            onPost={(post) => socketRef.current?.submitWallPost(post)}
                            onWithdraw={(postId) =>
                              socketRef.current?.submitWallWithdraw(postId)
                            }
                            onReact={(postId, reaction) =>
                              socketRef.current?.submitWallReact(postId, reaction)
                            }
                          />
                        </section>
                      ) : null}
                      <section
                        className="snap-card glass"
                        aria-label="Photos and sound for the game"
                      >
                        <h2>Photos &amp; sound for the game</h2>
                        <GuestMedia gameId={session.gameId} active={tab === "snap"} />
                      </section>
                    </>
                  )}
                </div>
              ),
            },
          }}
        >
          {questionVisible ? null : (
            <h1 className="phone-prompt">
              {!snapshot
                ? "Connecting…"
                : snapshot.phase === "lobby"
                  ? "In the lobby"
                  : "This phone"}
            </h1>
          )}
          <StatusMessage>{status}</StatusMessage>
          {rehearsalCredential ? (
            <p className="text-sm text-muted">
              Live test phone. Use an ordinary second-browser guest for photos and phone
              transfer.
            </p>
          ) : null}
          {replacedNotice && !rehearsalSession ? (
            <Button
              onClick={() => {
                setReplacedNotice(undefined);
                setSession(undefined);
                setNotice("You have not joined a room.");
              }}
            >
              Join another room
            </Button>
          ) : null}
          <ReconnectBanner
            disconnected={reconnecting}
            snapshotId={snapshotPulse}
            onRetry={() => socketRef.current?.reconnectNow()}
          >
            <div className="grid gap-4">
              {snapshot?.phase === "lobby" ? (
                <div className="grid gap-4">
                  <AnimatePresence initial={false}>
                    {avatarCard ? (
                      <motion.div
                        key="avatar"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
                      >
                        {avatarPicker("welcome")}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                  <Disclosure title="Invite a friend">
                    <JoinMark code={snapshot.joinCode} allowCopy />
                  </Disclosure>
                  {snapshot.namesReveal ? (
                    <NameReveal reveal={snapshot.namesReveal} />
                  ) : null}
                  {/* A kart-only lobby never reveals the name votes, so it does not ask for them. */}
                  {snapshot.mode !== "kart" ? (
                    <NameCloud
                      names={snapshot.cloud}
                      selfId={session.playerId}
                      reactions={snapshot.selfReactions}
                      onReact={onReact}
                      minRem={0.875}
                    />
                  ) : null}
                  {!rehearsalCredential ? (
                    <DriverPicker
                      gameId={snapshot.gameId}
                      nickname={nickname ?? session.nickname}
                      driver={selfPlayer?.driver}
                      avatarMediaId={selfAvatar}
                      pending={driverPending}
                      onChoose={onDriver}
                    />
                  ) : null}
                </div>
              ) : null}
              <PhaseTransition
                phase={snapshot?.phase ?? "lobby"}
                scene={kartRaceScene(snapshot)}
              >
                {snapshot?.phase === "facts" && snapshot.funFact ? (
                  <FunFactPhone fact={snapshot.funFact} />
                ) : snapshot ? (
                  <GuestPlay
                    connected={connection === "open"}
                    onKartInput={(input) => socketRef.current?.submitKartInput(input)}
                    onKartRecover={(raceId) => {
                      const requestId = socketRef.current?.submitKartRecovery?.(raceId);
                      if (requestId) {
                        kartRecoveryRequest.current = requestId;
                        setKartRecoveryPending(true);
                        setKartRecoveryNotice("");
                      }
                    }}
                    onKartUseItem={(raceId) => {
                      const id = socketRef.current?.submitKartItem?.(raceId);
                      if (id) {
                        kartItemRequest.current = id;
                        setKartItemPending(true);
                        setKartItemNotice("");
                      }
                    }}
                    kartItemPending={kartItemPending}
                    kartItemNotice={kartItemNotice}
                    kartRecoveryPending={kartRecoveryPending}
                    kartRecoveryNotice={kartRecoveryNotice}
                    onChessMove={(params) => {
                      if (!beginSend(true)) return;
                      pendingRequest.current =
                        socketRef.current?.submitChessMove(params) ?? null;
                    }}
                    onChessResign={(params) => {
                      if (!beginSend(true)) return;
                      pendingRequest.current =
                        socketRef.current?.submitChessResign(params) ?? null;
                    }}
                    snapshot={snapshot}
                    selectedId={selectedId}
                    pending={pending}
                    onSelect={setSelectedId}
                    onSubmit={onSubmit}
                    onChoose={onChoose}
                    observedAt={observedAt}
                    onEstimate={onEstimate}
                    onRank={onRank}
                    onText={onText}
                    onDraft={(body) => socketRef.current?.submitDraft(body)}
                    onBallot={onBallot}
                    onDuel={onDuel}
                  />
                ) : (
                  <p>Connecting to the room…</p>
                )}
                {snapshot &&
                guestRoundCopy(snapshot) === "Waiting for the next question." ? (
                  <WaitingNext />
                ) : null}
              </PhaseTransition>
            </div>
          </ReconnectBanner>
        </PhoneShell>
      </ControllerRoot>
    </RosterProvider>
  );
}

function TransferPhone({
  busy,
  code,
  onCode,
  onSubmit,
}: {
  busy: boolean;
  code: string;
  onCode: (code: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [open, setOpen] = useState(false);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <div className="grid gap-3">
      <Button
        variant="secondary"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        Changed phones?
      </Button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.form
            className="grid gap-4"
            onSubmit={onSubmit}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: reduce ? 0.01 : 0.2, ease: [0.2, 0, 0, 1] }}
          >
            <TextField
              label="Transfer code"
              hint="Humza can read you a one-use code if you change phones."
              value={code}
              onChange={(event) => onCode(event.target.value)}
              autoComplete="off"
            />
            <Button type="submit" disabled={busy}>
              Use this phone
            </Button>
          </motion.form>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function phoneStatus(input: {
  /** The room ended this connection on purpose, such as a destroyed room. */
  replaced?: string;
  notice: string;
  connection: "connecting" | "open" | "closed" | "idle";
  playing: boolean;
  pending: boolean;
  trollPending?: boolean;
  rejection: string | undefined;
  snapshot: LobbySnapshot | undefined;
}): string {
  if (input.replaced) {
    return input.replaced;
  }
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
  if (input.trollPending) {
    return "Sending your troll.";
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

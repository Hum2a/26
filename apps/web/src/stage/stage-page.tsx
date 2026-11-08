import { phaseLabel } from "../live/phase-label";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import type { LobbySnapshot } from "@26/shared";
import { Button, TextField } from "../ui/primitives";
import { EntryFrame, EntryNotice } from "../ui/entry-frame";
import { lookupStage } from "../live/room-api";
import { openRoomSocket } from "../live/room-socket";
import { requestStageFullscreen, exitStageFullscreen } from "../device/fullscreen";
import { StageShowControls } from "./StageShow";
import { useStageShow } from "./use-stage-show";
import { StageSound } from "./stage-sound";
import { stageShow } from "./audio";
import { StagePresentation } from "./stage-presentation";
import { StageWall } from "./wall/stage-wall";
import { usePreloadQuestion } from "../play/preload";
import "./projector.css";

/** Remembers, for this tab only, that it was presenting a room. */
const presentingKey = "26-stage-presenting";
function readPresenting(): string | null {
  try {
    return sessionStorage.getItem(presentingKey);
  } catch {
    return null;
  }
}
function writePresenting(joinCode: string | null) {
  try {
    if (joinCode) sessionStorage.setItem(presentingKey, joinCode);
    else sessionStorage.removeItem(presentingKey);
  } catch {
    // Storage can be unavailable; a reload then returns to setup as before.
  }
}

export function StagePage() {
  const [params, setParams] = useSearchParams();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [snapshot, setSnapshot] = useState<LobbySnapshot>();
  const [observedAt, setObservedAt] = useState(Date.now);
  const [notice, setNotice] = useState("No room is connected.");
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState<
    "idle" | "connecting" | "open" | "closed"
  >("idle");
  const [accessLost, setAccessLost] = useState(false);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [presenting, setPresenting] = useState(false);
  // Full screen can drop by accident (a browser Escape, a display change).
  // The show stays on screen with a hint; setup needs a deliberate Escape.
  const [fullscreenLost, setFullscreenLost] = useState(false);
  const presentButton = useRef<HTMLButtonElement>(null);
  // After a reload mid-show, reconnect and present again without a setup visit.
  const resume = useRef(false);
  const wasPresenting = useRef(false);
  const roomSocket = useRef<ReturnType<typeof openRoomSocket> | null>(null);
  // The projector tells the room when the wall photo it was sent fails to load.
  const reportWallImageFailed = useCallback((postId: string) => {
    roomSocket.current?.reportWallImageFailed(postId);
  }, []);
  const show = useStageShow();
  usePreloadQuestion(snapshot, "stage");
  useEffect(() => {
    if (!presenting && wasPresenting.current) presentButton.current?.focus();
    wasPresenting.current = presenting;
  }, [presenting]);
  const gameId = snapshot?.gameId;
  const connected = connection === "open" && !accessLost;
  const displayEnabled = presenting && connected && !snapshot?.stageHidden;
  useEffect(() => {
    document.title = presenting ? "Projector · 26" : "Projector setup · 26";
  }, [presenting]);
  useEffect(() => {
    stageShow.setMuted(show.muted || !displayEnabled);
    return () => stageShow.setMuted(true);
  }, [show.muted, displayEnabled]);
  useEffect(() => {
    if (!gameId) return;
    const socket = openRoomSocket({
      gameId,
      role: "stage",
      onSnapshot(next) {
        setSnapshot(next);
        setObservedAt(Date.now());
      },
      onAck() {},
      onConnection: setConnection,
      onReplaced() {
        setAccessLost(true);
        setNotice(
          "This projector session changed. Open the room from admin in this browser, then reconnect here.",
        );
      },
    });
    roomSocket.current = socket;
    return () => {
      if (roomSocket.current === socket) roomSocket.current = null;
      socket.close();
    };
  }, [gameId, connectionAttempt]);
  const rehearsalCode = params.get("rehearsal") === "1" ? params.get("code") : null;
  useEffect(() => {
    if (!rehearsalCode) return;
    let active = true;
    void lookupStage(rehearsalCode)
      .then((found) => {
        if (!active) return;
        if ("error" in found) {
          setNotice(found.error);
          return;
        }
        // Automatic presentation is explicitly requested and restricted to test rooms.
        if (found.rehearsalRevision === undefined) {
          setNotice("Open this room using the normal projector setup.");
          return;
        }
        setSnapshot(found);
        setObservedAt(Date.now());
        setAccessLost(false);
        setPresenting(true);
      })
      .catch(() => {
        if (active)
          setNotice("The rehearsal stage could not connect. Retry from setup.");
      });
    return () => {
      active = false;
    };
  }, [rehearsalCode]);
  function setup() {
    setPresenting(false);
    setFullscreenLost(false);
    writePresenting(null);
    exitStageFullscreen();
  }
  useEffect(() => {
    if (presenting && snapshot?.joinCode) writePresenting(snapshot.joinCode);
  }, [presenting, snapshot?.joinCode]);
  useEffect(() => {
    if (resume.current && connected && snapshot) {
      resume.current = false;
      setPresenting(true);
    }
  }, [connected, snapshot]);
  useEffect(() => {
    if (!fullscreenLost) return;
    const timer = window.setTimeout(() => setFullscreenLost(false), 8_000);
    return () => window.clearTimeout(timer);
  }, [fullscreenLost]);
  useEffect(() => {
    if (!presenting) return;
    let wasFullscreen = Boolean(document.fullscreenElement);
    function changed() {
      if (document.fullscreenElement) {
        wasFullscreen = true;
        setFullscreenLost(false);
      } else if (wasFullscreen) setFullscreenLost(true);
    }
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, [presenting]);
  async function connectTo(joinCode: string) {
    if (busy) return;
    setBusy(true);
    try {
      const found = await lookupStage(joinCode.trim().toUpperCase());
      if ("error" in found) {
        setNotice(found.error);
        return;
      }
      setConnection("connecting");
      setConnectionAttempt((current) => current + 1);
      setSnapshot(found);
      setObservedAt(Date.now());
      setAccessLost(false);
      setNotice("Room connected. Check sound and display, then present when ready.");
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set("code", found.joinCode);
          return next;
        },
        { replace: true },
      );
    } catch {
      setNotice("The room could not be reached. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await connectTo(code);
  }
  useEffect(() => {
    const remembered = readPresenting();
    const linked = params.get("code")?.trim().toUpperCase();
    if (remembered && linked && remembered === linked && !params.get("rehearsal")) {
      resume.current = true;
      const timer = window.setTimeout(() => void connectTo(linked), 0);
      return () => window.clearTimeout(timer);
    }
    // Only on first load: a remembered presentation resumes once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className={presenting ? "projector-page is-presenting" : "projector-page"}>
      {presenting && snapshot ? (
        <>
          <StagePresentation
            snapshot={snapshot}
            observedAt={observedAt}
            connected={connected}
            onSetup={setup}
          />
          <AnimatePresence>
            {fullscreenLost ? (
              <motion.p
                key="fullscreen-hint"
                className="projector-fullscreen-hint"
                role="status"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                Full screen closed · F to return · Escape for setup
              </motion.p>
            ) : null}
          </AnimatePresence>
          {snapshot.wall && displayEnabled ? (
            <StageWall
              wall={snapshot.wall}
              gameId={snapshot.gameId}
              phase={snapshot.phase}
              onImageFailed={reportWallImageFailed}
            />
          ) : null}
        </>
      ) : (
        <EntryFrame
          wide
          navigation={
            <Link className="entry-text-link" to="/admin">
              Open admin
            </Link>
          }
        >
          <section className="projector-setup">
            <header>
              <p className="entry-eyebrow">Baseer’s screen</p>
              <h1>Projector setup</h1>
              <p>
                Connect the room, choose sound and get the display ready. Humza’s
                controls stay in admin.
              </p>
            </header>
            <EntryNotice message={notice} />
            <div className="projector-setup-grid">
              <form
                onSubmit={(event) => void connect(event)}
                className="projector-connect"
              >
                <h2>1. Connect a room</h2>
                <p>
                  Use a projector tab in the browser that opened this room from admin.
                </p>
                <TextField
                  label="Join code"
                  hint="The six-character code on the admin screen."
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  maxLength={6}
                  autoComplete="off"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <Button
                  type="submit"
                  variant={snapshot ? "secondary" : "primary"}
                  disabled={busy}
                >
                  {busy ? "Connecting…" : "Connect room"}
                </Button>
                {snapshot ? (
                  <p role="status">
                    {snapshot.joinCode} · {phaseLabel(snapshot.phase)} ·{" "}
                    {snapshot.players.length} players ·{" "}
                    {connected ? "Connected" : "Waiting for the room connection"}
                  </p>
                ) : (
                  <p>Preview only. No round is running.</p>
                )}
              </form>
              <section className="projector-preflight">
                <h2>2. Sound & display</h2>
                <p>
                  Sound is optional and controlled on this screen only. Starting show
                  audio does not start the quiz.
                </p>
                <StageShowControls
                  unlocked={show.unlocked}
                  muted={show.muted}
                  onStart={show.startShow}
                  onToggleMute={show.toggleMute}
                />
                <Button variant="secondary" onClick={() => requestStageFullscreen()}>
                  Full screen
                </Button>
                <p>
                  While presenting, F requests full screen and Escape returns to setup.
                  M toggles sound. Browser full screen is optional.
                </p>
                <h2>3. Present</h2>
                <p>
                  Presentation hides these settings, site navigation and private
                  connection details.
                </p>
                <Button
                  ref={presentButton}
                  disabled={!snapshot || !connected || busy}
                  onClick={() => setPresenting(true)}
                >
                  Present on this screen
                </Button>
              </section>
            </div>
          </section>
        </EntryFrame>
      )}
      <AnimatePresence initial={false}>
        <motion.div
          key={presenting ? "cue-on-stage" : "cue-setup"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className={presenting ? "projector-cue" : "projector-audio-notice"}
        >
          {snapshot ? (
            <StageSound
              gameId={snapshot.gameId}
              announcement={displayEnabled ? snapshot.trolls.announcement : null}
              unlocked={displayEnabled && show.unlocked}
              muted={show.muted || !displayEnabled}
              presentation={presenting}
            />
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

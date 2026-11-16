import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useLocation, useNavigate, useOutlet, useParams } from "react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { gameIdSchema, type LobbySnapshot } from "@26/shared";
import { openRoomSocket } from "../live/room-socket";
import { Button, LinkButton } from "../ui/primitives";
import { EntryNotice } from "../ui/entry-frame";
import { readAdminRoom, type RoomFailure } from "./rooms-api";
import { playRoom, issueTransfer, type PlayIntent } from "../live/room-api";
import { playNotice } from "./command-notices";

export type AdminCommand =
  Omit<PlayIntent, "gameId" | "requestId"> | { action: "transfer"; playerId: string };
export type CommandScope =
  | "live"
  | "players"
  | "room"
  | "media"
  | "voters"
  | "results"
  | "health"
  | "trolls"
  | "wall"
  | "kart"
  | "kart-handling"
  | "kart-items"
  | "kart-track"
  | "developer";
type CommandRequest = {
  command: AdminCommand;
  requestId: string;
  label: string;
  scope: CommandScope;
};

type RoomContextValue = {
  snapshot: LobbySnapshot;
  connection: "connecting" | "open" | "closed";
  blocked: boolean;
  notice: string;
  setNotice: Dispatch<SetStateAction<string>>;
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
  observedAt: number;
  command: {
    status: "idle" | "pending" | "success" | "error";
    message: string;
    scope: CommandScope;
    retryable: boolean;
  };
  execute: (
    command: AdminCommand,
    label: string,
    scope?: CommandScope,
  ) => Promise<void>;
  retry: () => Promise<void>;
  transfer: {
    code: string;
    playerId: string;
    kind: "transfer" | "recovery";
    expiresAt?: string;
  } | null;
  clearTransfer: () => void;
};
const RoomContext = createContext<RoomContextValue | null>(null);
export function useAdminRoom() {
  const room = useContext(RoomContext);
  if (!room) throw new Error("Room controls require the shared room provider.");
  return room;
}
export function AdminRoomRoute() {
  const { gameId = "" } = useParams();
  const { pathname } = useLocation();
  const reduced = useReducedMotion();
  // The element, not <Outlet />, so the outgoing page keeps its content
  // while it fades out.
  const page = useOutlet();
  return (
    <AdminRoomProvider key={gameId} gameId={gameId}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: reduced ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduced ? 0 : -6 }}
          transition={{ duration: reduced ? 0.12 : 0.22, ease: [0.2, 0, 0, 1] }}
        >
          {page}
        </motion.div>
      </AnimatePresence>
    </AdminRoomProvider>
  );
}
export function AdminRoomProvider({
  gameId,
  children,
}: {
  gameId: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const validGameId = gameIdSchema.safeParse(gameId).success;
  const [snapshot, setSnapshot] = useState<LobbySnapshot>();
  const [failure, setFailure] = useState<RoomFailure | undefined>(() =>
    validGameId ? undefined : { status: 404, error: "This room could not be found." },
  );
  const [loading, setLoading] = useState(validGameId);
  const [attempt, setAttempt] = useState(0);
  const [connection, setConnection] =
    useState<RoomContextValue["connection"]>("connecting");
  const [blocked, setBlocked] = useState(false);
  const resumeId = useRef<string | undefined>(undefined);
  const [opening, setOpening] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [observedAt, setObservedAt] = useState(Date.now);
  const [command, setCommand] = useState<RoomContextValue["command"]>({
    status: "idle",
    message: "",
    scope: "room",
    retryable: false,
  });
  const lastRequest = useRef<CommandRequest | null>(null);
  const sending = useRef(false);
  const [transfer, setTransfer] = useState<RoomContextValue["transfer"]>(null);
  async function send(request: CommandRequest) {
    if (sending.current || connection !== "open" || blocked) return;
    sending.current = true;
    setBusy(true);
    lastRequest.current = request;
    setCommand({
      status: "pending",
      message: `${request.label}…`,
      scope: request.scope,
      retryable: false,
    });
    try {
      const result =
        request.command.action === "transfer"
          ? await issueTransfer({
              gameId,
              playerId: request.command.playerId,
              requestId: request.requestId,
            })
          : await playRoom({
              ...request.command,
              gameId,
              requestId: request.requestId,
            });
      if ("error" in result) {
        setCommand({
          status: "error",
          message: result.error,
          scope: request.scope,
          retryable: result.uncertain === true,
        });
        if (!result.uncertain) lastRequest.current = null;
      } else {
        lastRequest.current = null;
        if ("destroyed" in result && result.destroyed) {
          void navigate("/admin/rooms", {
            replace: true,
            state: { notice: playNotice("destroy", "lobby") },
          });
          return;
        }
        const code = "code" in result ? result.code : result.transferCode;
        if (code && "playerId" in request.command && request.command.playerId)
          setTransfer({
            code,
            playerId: request.command.playerId,
            kind: request.command.action === "recover" ? "recovery" : "transfer",
            ...("expiresAt" in result ? { expiresAt: result.expiresAt } : {}),
          });
        const message =
          request.command.action === "transfer"
            ? "Transfer code ready. Read it privately to the guest; it works once for two minutes."
            : playNotice(
                request.command.action,
                "phase" in result ? result.phase : "lobby",
              );
        setCommand({
          status: "success",
          message,
          scope: request.scope,
          retryable: false,
        });
        setNotice(message);
      }
    } catch {
      setCommand({
        status: "error",
        message:
          "The result is uncertain. Retry this same request before sending another action.",
        scope: request.scope,
        retryable: true,
      });
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function execute(
    value: AdminCommand,
    label: string,
    scope: CommandRequest["scope"] = "live",
  ) {
    // Never replace an uncertain accepted intent with a fresh request id.
    if (lastRequest.current || sending.current) return;
    const guarded =
      value.action === "advance" && snapshot?.phaseGeneration !== undefined
        ? { ...value, expectedPhaseGeneration: snapshot.phaseGeneration }
        : value;
    await send({ command: guarded, requestId: crypto.randomUUID(), label, scope });
  }
  async function retry() {
    if (lastRequest.current) await send(lastRequest.current);
  }
  useEffect(() => {
    let live = true;
    if (!validGameId) return;
    void readAdminRoom(gameId).then((result) => {
      if (!live) return;
      if ("error" in result) setFailure(result);
      else {
        setSnapshot(result);
        setObservedAt(Date.now());
        setFailure(undefined);
        setBlocked(false);
      }
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [gameId, attempt, validGameId]);
  const authorised = Boolean(snapshot) && !blocked;
  useEffect(() => {
    if (!authorised || connection !== "closed") return;
    let live = true;
    void readAdminRoom(gameId).then((result) => {
      if (
        live &&
        "error" in result &&
        (result.status === 401 || result.status === 403)
      ) {
        setBlocked(true);
        setFailure(result);
      }
    });
    return () => {
      live = false;
    };
  }, [authorised, connection, gameId]);
  useEffect(() => {
    if (!authorised) return;
    const socket = openRoomSocket({
      gameId,
      role: "control",
      onSnapshot(next) {
        setSnapshot(next);
        setObservedAt(Date.now());
      },
      onAck() {},
      onConnection: setConnection,
      onReplaced(message) {
        setBlocked(true);
        setFailure({ status: 401, error: message });
      },
    });
    function changed(event: StorageEvent) {
      if (event.key === "26-admin-room-change") {
        socket.close();
        setBlocked(true);
        setFailure({
          status: 401,
          error: "Room access changed in another tab. Reopen this room to continue.",
        });
      }
    }
    window.addEventListener("storage", changed);
    return () => {
      socket.close();
      window.removeEventListener("storage", changed);
    };
  }, [gameId, authorised]);
  async function open() {
    setOpening(true);
    resumeId.current ??= crypto.randomUUID();
    const result = await readAdminRoom(gameId, resumeId.current);
    setOpening(false);
    if ("error" in result) {
      setFailure(result);
      if (result.status !== 0) resumeId.current = undefined;
      return;
    }
    resumeId.current = undefined;
    try {
      localStorage.setItem("26-admin-room-change", crypto.randomUUID());
    } catch {
      /* Server also revokes replaced sockets. */
    }
    setSnapshot(result);
    setObservedAt(Date.now());
    setFailure(undefined);
    setBlocked(false);
  }
  if (loading) return <EntryNotice message="Checking room access…" />;
  if (!snapshot || blocked)
    return (
      <section className="admin-section">
        <p className="entry-eyebrow">Room access</p>
        <h1>Open this room</h1>
        <EntryNotice message={failure?.error ?? "This room needs its own access."} />
        {failure?.status === 401 ? (
          <>
            <p>
              Opening selects this room for this browser. Other admin tabs and the stage
              in this browser may need to reconnect.
            </p>
            <Button disabled={opening} onClick={() => void open()}>
              {opening ? "Opening…" : "Open room in this browser"}
            </Button>
          </>
        ) : (
          <Button
            onClick={() => {
              setLoading(true);
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </Button>
        )}
        <LinkButton variant="secondary" to="/admin/rooms">
          Back to rooms
        </LinkButton>
        <LinkButton
          variant="secondary"
          to={`/admin/login?returnTo=${encodeURIComponent(`/admin/rooms/${gameId}`)}`}
        >
          Check administrator sign-in
        </LinkButton>
      </section>
    );
  return (
    <RoomContext
      value={{
        snapshot,
        connection,
        blocked,
        notice,
        setNotice,
        busy,
        setBusy,
        observedAt,
        command,
        execute,
        retry,
        transfer,
        clearTransfer: () => setTransfer(null),
      }}
    >
      {children}
    </RoomContext>
  );
}

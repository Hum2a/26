import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { adminFeatures, featurePath, roomFeatures } from "./features";
import type { AdminRoomList, LobbySnapshot } from "@26/shared";
import { Button, ConfirmDialog, Dialog, LinkButton } from "../ui/primitives";
import { JoinMark } from "../lobby/join-mark";
import { EntryNotice } from "../ui/entry-frame";
import { createLobby, seedSampleRoom } from "../live/room-api";
import { listRooms, readCurrentRoom } from "./rooms-api";
import { RehearsalSetup } from "../developer/rehearsal-setup";
import { useAdminRoom } from "./room-provider";

export function RoomsPage({ overview = false }: { overview?: boolean }) {
  const [rooms, setRooms] = useState<AdminRoomList["rooms"]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [current, setCurrent] = useState<LobbySnapshot | null>(null);
  const [reload, setReload] = useState(0);
  const createId = useRef<string | undefined>(undefined);
  const navigate = useNavigate();
  useEffect(() => {
    let live = true;
    void Promise.all([listRooms(), readCurrentRoom()]).then(([page, selected]) => {
      if (!live) return;
      if ("error" in page) setNotice(page.error);
      else {
        setRooms(page.rooms);
        setNext(page.nextCursor);
        setNotice("");
      }
      if (selected && "error" in selected) setNotice(selected.error);
      else setCurrent(selected);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [reload]);
  async function more() {
    if (!next) return;
    setBusy(true);
    const result = await listRooms(next);
    setBusy(false);
    if ("error" in result) {
      setNotice(result.error);
      return;
    }
    setRooms((previous) => [
      ...previous,
      ...result.rooms.filter(
        (room) => !previous.some((old) => old.gameId === room.gameId),
      ),
    ]);
    setNext(result.nextCursor);
  }
  async function create() {
    setBusy(true);
    createId.current ??= crypto.randomUUID();
    try {
      const result = await createLobby(createId.current);
      if ("error" in result) {
        setNotice(result.error);
        return;
      }
      createId.current = undefined;
      try {
        localStorage.setItem("26-admin-room-change", crypto.randomUUID());
      } catch {
        /* Optional tab hint. */
      }
      await navigate(`/admin/rooms/${result.gameId}`);
    } catch {
      setNotice(
        "We couldn’t confirm creation. Try again; the same request will be reused.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-section">
      <p className="entry-eyebrow">Your night, in one place</p>
      <h1>{overview ? "Your night." : "Rooms"}</h1>
      <p>
        Pick up where you left off, or open a fresh lobby for the guests. Creating or
        switching rooms selects one room for this browser, including its stage access.
      </p>
      <RehearsalSetup />
      <div className="admin-actions">
        <Button disabled={busy || loading} onClick={() => void create()}>
          {busy ? "Working…" : "Create a lobby"}
        </Button>
        <Button
          variant="secondary"
          disabled={loading || busy}
          onClick={() => {
            setLoading(true);
            setReload((value) => value + 1);
          }}
        >
          Refresh rooms
        </Button>
      </div>
      <EntryNotice message={loading ? "Finding your rooms…" : notice} />
      {notice ? (
        <LinkButton variant="secondary" to="/admin/login?returnTo=%2Fadmin%2Frooms">
          Check administrator sign-in
        </LinkButton>
      ) : null}
      {current ? (
        <div className="admin-current">
          <p className="entry-eyebrow">Selected in this browser</p>
          <h2>Room {current.joinCode}</h2>
          <p>
            Last checked: {current.phase}
            {current.paused ? ", paused" : ""} · {current.players.length} players
          </p>
          <LinkButton to={`/admin/rooms/${current.gameId}`}>Return to room</LinkButton>
        </div>
      ) : null}
      {!loading && rooms.length === 0 && !notice ? (
        <div className="admin-current">
          <h2>Your first room starts here.</h2>
          <p>
            Create a lobby to get a join code. Existing rooms will appear here whenever
            you return.
          </p>
        </div>
      ) : null}
      {rooms.length > 0 ? (
        <>
          <h2>{overview ? "Recent rooms" : "Saved rooms"}</h2>
          <p>
            Listed newest first. Open a room to check its current phase and connections.
          </p>
          <ul className="admin-room-list">
            {(overview ? rooms.slice(0, 3) : rooms).map((room) => (
              <li key={room.gameId}>
                <div>
                  <strong>{room.joinCode}</strong>
                  <time dateTime={room.createdAt}>
                    {new Date(room.createdAt).toLocaleString("en-GB")}
                  </time>
                  <small>{room.gameId}</small>
                </div>
                <LinkButton variant="secondary" to={`/admin/rooms/${room.gameId}`}>
                  View room {room.joinCode}
                </LinkButton>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {overview ? <EverythingGrid roomId={current?.gameId ?? null} /> : null}
      {overview ? (
        <LinkButton variant="secondary" to="/admin/rooms">
          Browse all rooms
        </LinkButton>
      ) : next ? (
        <Button variant="secondary" disabled={busy} onClick={() => void more()}>
          Load older rooms
        </Button>
      ) : null}
    </section>
  );
}

/**
 * Every admin feature from the registry, on the home page. Room features open
 * in this browser's selected room; without one, they say to open a room first.
 */
function EverythingGrid({ roomId }: { roomId: string | null }) {
  const listed = adminFeatures.filter(
    (feature) =>
      feature.id !== "home" && feature.id !== "rooms" && feature.id !== "overview",
  );
  return (
    <section aria-label="Everything you can manage" className="grid gap-3">
      <h2>Everything you can manage</h2>
      <p>
        {roomId
          ? "Room tools open in your selected room."
          : "Room tools need a room: create a lobby or open one above."}
      </p>
      <ul className="admin-feature-grid">
        {listed.map((feature) => {
          const available = feature.scope === "global" || roomId !== null;
          const body = (
            <>
              <strong>{feature.label}</strong>
              <span className="admin-feature-status">
                {feature.scope === "global"
                  ? "Any time"
                  : roomId
                    ? "This room"
                    : "Open a room to use this"}
              </span>
              <span>{feature.summary}</span>
              <span className="admin-feature-rehearse">
                Try it: {feature.rehearsal}
              </span>
            </>
          );
          return (
            <li key={feature.id}>
              {available ? (
                <Link
                  to={featurePath(feature, roomId ?? undefined)}
                  className="admin-feature-card"
                >
                  {body}
                </Link>
              ) : (
                <div
                  className="admin-feature-card"
                  aria-disabled="true"
                  data-disabled=""
                >
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Offered only while the room is empty: fills it with sample guests, photos,
 * trolls and scores, so every admin page can be seen with data in it.
 */
function SampleSeed({ gameId }: { gameId: string }) {
  const [state, setState] = useState<"idle" | "working" | "done">("idle");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  async function seed() {
    setState("working");
    const result = await seedSampleRoom(gameId);
    if ("error" in result) {
      setState("idle");
      setMessage(result.error);
      return;
    }
    setState("done");
    setMessage(`Added ${result.count} sample guests, with photos, trolls and scores.`);
  }
  return (
    <section className="admin-current" aria-label="Sample data">
      <h2>Preview with sample data</h2>
      <p>
        See what every page looks like during a party: 12 sample guests, scores, troll
        history, connection stats and photo wall posts waiting, queued and shown. Use a
        spare room: sample guests stay in this room.
      </p>
      <div className="admin-actions">
        <Button disabled={state !== "idle"} onClick={() => setConfirming(true)}>
          {state === "working" ? "Adding sample data…" : "Fill with sample data"}
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Fill this room with sample data?"
        confirmLabel="Fill this room"
        disabled={state !== "idle"}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void seed();
        }}
      >
        <p>
          This adds 12 sample guests to this room. They can't be removed one by one, so
          only do this in a room you are using to preview.
        </p>
      </ConfirmDialog>
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}

export function RoomOverview() {
  const { snapshot, connection, notice } = useAdminRoom();
  return (
    <section className="admin-section">
      <p className="entry-eyebrow">Room overview</p>
      <h1>
        {snapshot.phase === "lobby"
          ? "Ready for the room."
          : snapshot.phase === "podium"
            ? "The night, completed."
            : "Your room, live."}
      </h1>
      <p>
        {connection === "open"
          ? "Connected. Room details update live."
          : "Reconnecting. Room details may be out of date; live controls are unavailable until connected."}
      </p>
      <EntryNotice message={notice} />
      <div className="admin-current">
        <p>Guests join with this code</p>
        <p className="admin-room-code" aria-label={`Join code ${snapshot.joinCode}`}>
          {snapshot.joinCode}
        </p>
        <p>{snapshot.gameId}</p>
        <div className="admin-actions">
          <a
            className="entry-text-link"
            href={`/j/${snapshot.joinCode}`}
            target="_blank"
            rel="noreferrer"
          >
            Guest join link ↗
          </a>
          <Dialog
            title="Guest join link"
            triggerLabel="Show guest QR code"
            triggerVariant="secondary"
          >
            <p>Guests can scan this code or copy the link below.</p>
            <JoinMark code={snapshot.joinCode} />
          </Dialog>
        </div>
      </div>
      <dl className="admin-room-facts">
        <div>
          <dt>Current phase</dt>
          <dd>
            {snapshot.phase}
            {snapshot.paused ? " · paused" : ""}
          </dd>
        </div>
        <div>
          <dt>Players</dt>
          <dd>{snapshot.players.length}</dd>
        </div>
        <div>
          <dt>Connected now</dt>
          <dd>
            {snapshot.connections
              ? `${snapshot.connections.guests} phones · ${snapshot.connections.stage} stage · ${snapshot.connections.control} control`
              : "Connection counts unavailable"}
          </dd>
        </div>
        <div>
          <dt>Question pack</dt>
          <dd>{snapshot.questionSetVersion}</dd>
        </div>
      </dl>
      <div className="admin-actions">
        <LinkButton to="live">Open live controls</LinkButton>
        <a
          className="entry-text-link"
          href={`/host?code=${snapshot.joinCode}`}
          target="_blank"
          rel="noreferrer"
        >
          Open the stage ↗
        </a>
        <LinkButton to="/admin/rooms" variant="secondary">
          Choose another room
        </LinkButton>
      </div>
      {snapshot.players.length === 0 ? <SampleSeed gameId={snapshot.gameId} /> : null}
      <section aria-label="Everything in this room" className="grid gap-3">
        <h2>Everything in this room</h2>
        <ul className="admin-feature-grid">
          {roomFeatures
            .filter((feature) => feature.id !== "overview")
            .map((feature) => (
              <li key={feature.id}>
                <Link
                  to={featurePath(feature, snapshot.gameId)}
                  className="admin-feature-card"
                >
                  <strong>{feature.label}</strong>
                  {feature.status ? (
                    <span className="admin-feature-status">
                      {feature.status(snapshot)}
                    </span>
                  ) : null}
                  <span>{feature.summary}</span>
                  <span className="admin-feature-rehearse">
                    Try it: {feature.rehearsal}
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      </section>
    </section>
  );
}

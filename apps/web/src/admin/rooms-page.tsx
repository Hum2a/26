import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { adminFeatures, featurePath, roomFeatures } from "./features";
import { KartLobbyCreate } from "./kart-lobby-create";
import type { AdminRoomList, LobbySnapshot } from "@26/shared";
import {
  Button,
  ConfirmDialog,
  Dialog,
  Disclosure,
  LinkButton,
} from "../ui/primitives";
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
  const arrival = (useLocation().state as { notice?: unknown } | null)?.notice;
  const arrivalNotice = typeof arrival === "string" ? arrival : "";
  useEffect(() => {
    let live = true;
    void Promise.all([listRooms(), readCurrentRoom()]).then(([page, selected]) => {
      if (!live) return;
      if ("error" in page) setNotice(page.error);
      else {
        setRooms(page.rooms);
        setNext(page.nextCursor);
        setNotice(arrivalNotice);
      }
      if (selected && "error" in selected) setNotice(arrivalNotice || selected.error);
      else setCurrent(selected);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [reload, arrivalNotice]);
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
      <header className="admin-page-heading">
        <div>
          <p className="entry-eyebrow">Control room</p>
          <h1>{overview ? "Dashboard" : "Rooms"}</h1>
        </div>
        <div className="admin-actions">
          <Button disabled={busy || loading} onClick={() => void create()}>
            {busy ? "Working…" : "Create a lobby"}
          </Button>
          <LinkButton variant="secondary" to="/admin/kart?view=multiplayer">
            Kart-only lobby
          </LinkButton>
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
      </header>
      <p className="admin-lede">
        {overview
          ? "See the selected room, open a lobby, or jump into tonight’s controls. Creating or switching rooms selects one room for this browser, including its stage."
          : "Every saved lobby, newest first. Opening a room selects it for this browser, including its stage."}
      </p>
      <EntryNotice message={loading ? "Finding your rooms…" : notice} />
      {notice ? (
        <LinkButton variant="secondary" to="/admin/login?returnTo=%2Fadmin%2Frooms">
          Check administrator sign-in
        </LinkButton>
      ) : null}
      {current ? (
        <div className="admin-current">
          <div className="admin-page-heading">
            <div>
              <p className="entry-eyebrow">Selected in this browser</p>
              <h2>Room {current.joinCode}</h2>
            </div>
            <span className="admin-badge" data-tone={current.paused ? "warn" : "ok"}>
              {current.phase}
              {current.paused ? " · paused" : ""}
            </span>
          </div>
          <dl className="admin-stat-grid">
            <div className="admin-stat">
              <dt>Players</dt>
              <dd>{current.players.length}</dd>
            </div>
            <div className="admin-stat">
              <dt>Phones</dt>
              <dd>{current.connections?.guests ?? "—"}</dd>
            </div>
            <div className="admin-stat">
              <dt>Stage</dt>
              <dd>{current.connections?.stage ?? "—"}</dd>
            </div>
          </dl>
          <div className="admin-actions">
            <LinkButton to={`/admin/rooms/${current.gameId}`}>Return to room</LinkButton>
            <LinkButton variant="secondary" to={`/admin/rooms/${current.gameId}/live`}>
              Live controls
            </LinkButton>
            <a
              className="entry-text-link"
              href={`/host?code=${current.joinCode}`}
              target="_blank"
              rel="noreferrer"
            >
              Open the stage ↗
            </a>
          </div>
        </div>
      ) : null}
      {!loading && rooms.length === 0 && !notice ? (
        <div className="admin-empty">
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
      <Disclosure title="Rehearse without guests" keepMounted>
        <RehearsalSetup />
      </Disclosure>
      {overview ? (
        <div className="admin-kart-night">
          <KartLobbyCreate />
          <p>
            Or <Link to="/kart">practise the circuit solo</Link>, with no room or
            guests.
          </p>
        </div>
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
    <section aria-label="Shortcuts" className="grid gap-3">
      <h2>Shortcuts</h2>
      <p className="admin-lede">
        {roomId
          ? "Room tools open in your selected room. Each page can be rehearsed without guests."
          : "Catalogue tools work any time. Room tools need a lobby first."}
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
      <header className="admin-page-heading">
        <div>
          <p className="entry-eyebrow">This room</p>
          <h1>
            {snapshot.phase === "lobby"
              ? "Ready for the room."
              : snapshot.phase === "podium"
                ? "The night, completed."
                : "Your room, live."}
          </h1>
        </div>
        <span
          className="admin-badge"
          data-tone={connection === "open" ? "ok" : "warn"}
        >
          {connection === "open" ? "Live" : "Reconnecting"}
        </span>
      </header>
      <p className="admin-lede">
        {connection === "open"
          ? "Connected. Room details update as guests join and you advance the show."
          : "Reconnecting. Room details may be out of date; live controls wait until connected."}
      </p>
      <EntryNotice message={notice} />
      {snapshot.kartLobby ? (
        <section className="admin-current" aria-label="Kart lobby details">
          <h2>Kart-only lobby</h2>
          <p>Mario circuit · one lap · three-minute limit · up to 80 racers.</p>
          <p>
            Created {new Date(snapshot.kartLobby.createdAt).toLocaleString("en-GB")}.
            The race and results use this room’s frozen script.
          </p>
          <p>
            Open Live controls to start, pause or end the race. Join from a private
            second tab to rehearse. Late arrivals watch once the grid is frozen.
          </p>
        </section>
      ) : null}
      <div className="admin-current">
        <p className="entry-eyebrow">Guests join with this code</p>
        <p className="admin-room-code" aria-label={`Join code ${snapshot.joinCode}`}>
          {snapshot.joinCode}
        </p>
        <p className="admin-meta">{snapshot.gameId}</p>
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
            <JoinMark code={snapshot.joinCode} allowCopy />
          </Dialog>
        </div>
      </div>
      <dl className="admin-stat-grid">
        <div className="admin-stat">
          <dt>Phase</dt>
          <dd>
            {snapshot.phase}
            {snapshot.paused ? " · paused" : ""}
          </dd>
        </div>
        <div className="admin-stat">
          <dt>Players</dt>
          <dd>{snapshot.players.length}</dd>
        </div>
        <div className="admin-stat">
          <dt>Connected now</dt>
          <dd>
            {snapshot.connections
              ? `${snapshot.connections.guests} phones · ${snapshot.connections.stage} stage`
              : "Unavailable"}
          </dd>
        </div>
        <div className="admin-stat">
          <dt>Pack</dt>
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
        <h2>In this room</h2>
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
                </Link>
              </li>
            ))}
        </ul>
      </section>
    </section>
  );
}

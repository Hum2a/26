import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useMemo } from "react";
import { RehearsalControls } from "./rehearsal-controls";
import { PhoneLauncher } from "./phone-launcher";
import { AnimatePresence, motion } from "motion/react";
import { useAdminRoom } from "../admin/room-provider";
import { CommandFeedback } from "../admin/command-feedback";
import { Button, Disclosure, TextField } from "../ui/primitives";
import { EntryNotice } from "../ui/entry-frame";
import {
  createBotFleet,
  emptyFleetReport,
  readBotSessions,
  type FleetSettings,
} from "./bot-fleet";

export function DeveloperPage() {
  const { snapshot, execute, busy, blocked, connection, command } = useAdminRoom();
  const [target, setTarget] = useState(10);
  const [running, setRunning] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [localSettings, setLocalSettings] = useState<FleetSettings>({
    auto: false,
    delayMs: 1000,
    participation: 100,
    kart: false,
  });
  const rehearsal = snapshot.developerTools?.rehearsal;
  const dedicated = !!rehearsal;
  const auto = rehearsal?.config.autoAnswers ?? false;
  const delayMs = rehearsal?.config.delayMs ?? 1000;
  const participation = rehearsal?.config.participation ?? 100;
  const kart = rehearsal?.config.kart ?? false;
  const settings = useMemo<FleetSettings>(
    () => (dedicated ? { auto, delayMs, participation, kart } : localSettings),
    [dedicated, auto, delayMs, participation, kart, localSettings],
  );
  function setSettings(next: FleetSettings) {
    if (rehearsal)
      void execute(
        {
          action: "developer-configure",
          rehearsalConfig: {
            ...rehearsal.config,
            autoAnswers: next.auto,
            delayMs: next.delayMs,
            participation: next.participation,
            kart: next.kart,
          },
        },
        "Update bot behaviour",
        "developer",
      );
    else setLocalSettings(next);
  }
  const [search, setSearch] = useSearchParams();
  const autoStarted = useRef(false),
    lastScenario = useRef(0);
  const [report, setReport] = useState(emptyFleetReport);
  const [error, setError] = useState("");
  const fleet = useRef<ReturnType<typeof createBotFleet> | undefined>(undefined);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
    fleet.current?.configure(settings);
  }, [settings]);
  const tools = snapshot.developerTools;
  const ids = tools?.bots.map((bot) => bot.playerId).join(",") ?? "";
  const locked = busy || blocked || connection !== "open" || command.retryable;
  const canRun = running && !blocked;
  useEffect(() => {
    if (!canRun || !ids) return;
    const controller = new AbortController();
    let active = true;
    void readBotSessions(snapshot.gameId, controller.signal)
      .then((sessions) => {
        if (!active) return;
        fleet.current = createBotFleet(snapshot.gameId, sessions, setReport);
        fleet.current.configure(settingsRef.current);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Bot connections could not be opened.",
          );
      });
    return () => {
      active = false;
      controller.abort();
      fleet.current?.close();
      fleet.current = undefined;
    };
  }, [snapshot.gameId, canRun, ids, attempt]);
  const count = tools?.bots.length ?? 0;
  useEffect(() => {
    if (
      search.get("autostart") !== "1" ||
      !rehearsal ||
      autoStarted.current ||
      connection !== "open" ||
      busy ||
      blocked ||
      report.connected !== count
    )
      return;
    autoStarted.current = true;
    setSearch(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete("autostart");
        return next;
      },
      { replace: true },
    );
    void execute({ action: "developer-run" }, "Start fresh rehearsal", "developer");
  }, [
    search,
    rehearsal,
    connection,
    busy,
    blocked,
    report.connected,
    count,
    execute,
    setSearch,
  ]);
  useEffect(() => {
    const scenario = rehearsal?.scenario;
    if (
      scenario?.name !== "deadline-burst" ||
      scenario.at <= lastScenario.current ||
      snapshot.phase !== "collect" ||
      report.connected === 0
    )
      return;
    lastScenario.current = scenario.at;
    fleet.current?.deadlineBurst(scenario.leadMs);
  }, [rehearsal?.scenario, snapshot.phase, report.connected]);
  const players = new Map(
    snapshot.adminPlayers?.map((player) => [player.playerId, player]),
  );
  const ended = ["final", "facts", "podium"].includes(snapshot.phase);
  function setCount(botCount: number) {
    setError("");
    void execute(
      { action: "developer-bots", botCount },
      `Set ${botCount} bots`,
      "developer",
    );
  }
  function downloadReport() {
    const data = {
      at: new Date().toISOString(),
      gameId: snapshot.gameId,
      phase: snapshot.phase,
      questionId: snapshot.play?.question.id,
      players: snapshot.players.length,
      bots: count,
      connections: snapshot.connections,
      settings,
      metrics: report,
      rehearsal,
      note: "Real WebSocket clients in one browser; no phone rendering or venue Wi-Fi measurement. RTT includes browser scheduling. Bots are excluded from guest statistics and the final archive.",
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `rehearsal-${snapshot.gameId}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="admin-section space-y-5">
      <header className="admin-page-heading">
        <div>
          <p className="entry-eyebrow">Live rehearsal</p>
          <h1>Developer tools</h1>
        </div>
        <a
          href={`/host?code=${snapshot.joinCode}${rehearsal ? "&rehearsal=1" : ""}`}
          target="_blank"
          rel="noreferrer"
          className="entry-text-link"
        >
          Open stage ↗
        </a>
      </header>
      <p>
        Keep this tab open to run real guest connections. Bots appear as Bot 001, Bot
        002 and so on, send ordinary answers and receive real scores. Use a dedicated
        test room: their votes can affect the game. Bots are excluded from guest
        statistics and the final archive.
      </p>
      <CommandFeedback scope="developer" />
      <EntryNotice message={error} />
      <RehearsalControls />
      {rehearsal ? (
        <PhoneLauncher gameId={snapshot.gameId} joinCode={snapshot.joinCode} />
      ) : null}
      <section className="skin-panel p-4 space-y-3" aria-label="Bot population">
        <h2>Build up the room</h2>
        <p>
          {count} bots · {snapshot.players.length - count} other players · 100 total
          places
        </p>
        <p>
          Each preset sets the total bot count. Existing bots are kept when scaling up.
          Removing bots keeps their accepted actions and rehearsal history.
        </p>
        <div className="admin-actions">
          {[10, 25, 50, 75, 100].map((n) => (
            <Button
              key={n}
              variant="secondary"
              disabled={locked || ended || snapshot.players.length - count + n > 100}
              onClick={() => setCount(n)}
            >
              Set {n} bots
            </Button>
          ))}
        </div>
        <form
          className="admin-actions"
          onSubmit={(event) => {
            event.preventDefault();
            setCount(target);
          }}
        >
          <TextField
            label="Bot count"
            hint="A total from 0 to 100, leaving space for any real guests."
            type="number"
            min={0}
            max={100}
            step={1}
            value={Number.isNaN(target) ? "" : target}
            onChange={(event) => setTarget(event.target.valueAsNumber)}
          />
          <Button
            type="submit"
            disabled={
              locked ||
              ended ||
              !Number.isInteger(target) ||
              target < 0 ||
              target > 100 ||
              snapshot.players.length - count + target > 100
            }
          >
            Apply bot count
          </Button>
          <Button
            variant="secondary"
            disabled={locked || count === 0}
            onClick={() => setCount(0)}
          >
            Remove all bots
          </Button>
        </form>
      </section>
      <section className="skin-panel p-4 space-y-3" aria-label="Bot behaviour">
        <h2>Choose the traffic</h2>
        <p>
          Automatic play starts off. Bots use only the public question and make varied
          choices; typed answers are labelled samples and Wordle tries ordinary words.
          Late entrants obey the same ballot and race eligibility rules as guests.
        </p>
        <div className="admin-actions">
          <Button
            aria-pressed={settings.auto}
            onClick={() => setSettings({ ...settings, auto: !settings.auto })}
          >
            {settings.auto ? "Pause bot answers" : "Enable automatic answers"}
          </Button>
          <Button
            variant="secondary"
            disabled={
              !canRun || report.connected === 0 || snapshot.paused || snapshot.held
            }
            onClick={() => fleet.current?.burst()}
          >
            Send answer burst
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setError("");
              setRunning(!running);
            }}
          >
            {running ? "Disconnect bots" : "Connect bots"}
          </Button>
          <Button
            variant="secondary"
            disabled={!canRun || !count}
            onClick={() => {
              setError("");
              setAttempt((n) => n + 1);
            }}
          >
            Reconnect all bots
          </Button>
        </div>
        <div className="admin-actions">
          <label>
            Response pace{" "}
            <select
              value={settings.delayMs}
              onChange={(event) =>
                setSettings({ ...settings, delayMs: Number(event.target.value) })
              }
            >
              <option value={0}>Immediate burst</option>
              <option value={1000}>Varied: 1–2 seconds</option>
              <option value={4000}>Varied: 4–8 seconds</option>
            </select>
          </label>
          <label>
            Participation{" "}
            <select
              value={settings.participation}
              onChange={(event) =>
                setSettings({ ...settings, participation: Number(event.target.value) })
              }
            >
              {[25, 50, 75, 100].map((n) => (
                <option key={n} value={n}>
                  {n}% of bots
                </option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.kart}
              onChange={(event) =>
                setSettings({ ...settings, kart: event.target.checked })
              }
            />{" "}
            Send kart controls at 10 per second
          </label>
        </div>
        <p>
          Kart traffic tests control delivery and race updates. Bots accelerate and
          steer but do not navigate the course intelligently. This tab does not render
          100 phone screens; use real phones for graphics and venue Wi-Fi testing.
          Closing or leaving this page stops the bot connections.
        </p>
      </section>
      <section className="skin-panel p-4 space-y-3" aria-label="Rehearsal results">
        <h2>Connection and answer results</h2>
        <dl className="grid gap-3 sm:grid-cols-3">
          <div>
            <dt>Bot connections in this tab</dt>
            <dd>
              {canRun ? report.connected : 0} / {count}
            </dd>
          </div>
          <div>
            <dt>Server-accepted commands</dt>
            <dd>{report.accepted}</dd>
          </div>
          <div>
            <dt>Refused / awaiting reply</dt>
            <dd>
              {report.refused} / {report.pending}
            </dd>
          </div>
          <div>
            <dt>95th percentile reply time</dt>
            <dd>{report.p95Ms} ms</dd>
          </div>
          <div>
            <dt>Current room</dt>
            <dd>
              {snapshot.phase}
              {snapshot.paused ? " · paused" : ""}
              {snapshot.held ? " · waiting for host" : ""}
            </dd>
          </div>
          <div>
            <dt>Answers this round</dt>
            <dd>{snapshot.play?.submissionCount ?? 0}</dd>
          </div>
        </dl>
        <p>
          Metrics cover the current connection run. Reconnecting starts a fresh
          measurement. Reply time includes scheduling in this browser.
        </p>
        <EntryNotice message={report.lastError} />
        <div className="admin-actions">
          <Button variant="secondary" onClick={downloadReport}>
            Download rehearsal report
          </Button>
          <Button variant="secondary" onClick={() => fleet.current?.resetMetrics()}>
            Clear measurements
          </Button>
        </div>
      </section>
      <section className="skin-panel p-4 space-y-3" aria-label="Rehearsal shortcuts">
        <h2>Run the show from here</h2>
        <div className="admin-actions">
          <Button
            disabled={locked || !!rehearsal || snapshot.phase !== "lobby"}
            onClick={() =>
              void execute({ action: "start" }, "Start illustrative demo", "developer")
            }
          >
            Start illustrative demo
          </Button>
          <Button
            variant="secondary"
            disabled={locked || !!rehearsal || snapshot.phase !== "lobby"}
            onClick={() =>
              void execute(
                { action: "start-birthday" },
                "Start birthday game",
                "developer",
              )
            }
          >
            Start birthday game
          </Button>
          <Button
            variant="secondary"
            disabled={locked || snapshot.phase === "lobby" || ended}
            onClick={() =>
              void execute(
                { action: snapshot.paused ? "resume" : "pause" },
                snapshot.paused ? "Resume game" : "Pause game",
                "developer",
              )
            }
          >
            {snapshot.paused ? "Resume game" : "Pause game"}
          </Button>
          <Button
            variant="secondary"
            disabled={
              locked || snapshot.phase === "lobby" || snapshot.phase === "podium"
            }
            onClick={() =>
              void execute({ action: "advance" }, "Advance beat", "developer")
            }
          >
            Advance beat
          </Button>
          <Button
            variant="secondary"
            disabled={locked || snapshot.phase === "lobby" || ended}
            onClick={() =>
              void execute({ action: "skip" }, "Skip question", "developer")
            }
          >
            Skip question
          </Button>
        </div>
        <div className="admin-actions">
          <Link to="../health" className="entry-text-link">
            Room health and traffic
          </Link>
          <Link to="/admin/content" target="_blank" className="entry-text-link">
            Question rehearsals ↗
          </Link>
          <Link to="/admin" target="_blank" className="entry-text-link">
            Create a fresh test room ↗
          </Link>
        </div>
        <p>
          Opening another room in this browser changes its room access. Stop these bots
          before switching rooms.
        </p>
      </section>
      <Disclosure title="Bot roster and scores">
        <ul aria-label="Bot roster" className="space-y-2">
          {tools?.bots.map((bot) => {
            const player = players.get(bot.playerId);
            return (
              <li key={bot.playerId}>
                <strong>{bot.nickname}</strong> ·{" "}
                {player?.connected ? "connected" : "disconnected"} ·{" "}
                {player?.points ?? 0} points
                {player?.answered === true
                  ? " · answered"
                  : player?.answered === false
                    ? " · waiting for an answer"
                    : ""}
              </li>
            );
          })}
        </ul>
      </Disclosure>
      <section aria-label="Bot count history">
        <h2>Recent population changes</h2>
        <ol>
          <AnimatePresence initial={false}>
            {tools?.history.map((entry, index) => (
              <motion.li
                key={`${entry.atMs}:${index}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {entry.count} bots · {new Date(entry.atMs).toLocaleString("en-GB")}
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      </section>
    </section>
  );
}

import { useActivityToasts } from "./use-activity-toasts";
import { motion } from "motion/react";
import { useState } from "react";
import {
  rehearsalConfigSchema,
  type RehearsalScenario,
  type RehearsalConfig,
} from "@26/shared";
import { useAdminRoom } from "../admin/room-provider";
import { Button, Disclosure } from "../ui/primitives";
import { RehearsalFields, RehearsalSetup } from "./rehearsal-setup";

export function RehearsalControls() {
  const { snapshot, execute, busy, blocked, connection, command } = useAdminRoom();
  const rehearsal = snapshot.developerTools?.rehearsal;
  const [notifications, setNotifications] = useState(true);
  useActivityToasts(rehearsal?.events, notifications);
  const [index, setIndex] = useState(0),
    [filter, setFilter] = useState("all");
  const [config, setConfig] = useState<{ base: string; value: RehearsalConfig }>();
  const locked = busy || blocked || connection !== "open" || command.retryable;
  if (!rehearsal)
    return (
      <>
        <p>
          Question jumping, the show runner and failure scenarios require a dedicated
          rehearsal room.
        </p>
        <RehearsalSetup />
      </>
    );
  const base = JSON.stringify(rehearsal.config);
  const value = config?.base === base ? config.value : rehearsal.config;
  const run = (action: "developer-run" | "developer-stop" | "developer-repeat") =>
    void execute({ action }, action, "developer");
  return (
    <>
      <section
        className="admin-card min-w-0"
        aria-label="Rehearsal controls"
      >
        <div className="admin-card-header">
          <span
            className="admin-status-dot"
            data-tone={rehearsal.runner === "running" ? "ok" : "muted"}
            aria-hidden="true"
          />
          <span className="admin-mono-tag">RUNNER: {rehearsal.runner.toUpperCase()}</span>
          <h2 className="admin-card-title">Isolated rehearsal</h2>
        </div>
        <div className="admin-card-body space-y-3">
          <p>
            Runner: {rehearsal.runner}. {rehearsal.reason}
          </p>
          <div className="admin-actions">
            <Button
              disabled={
                locked ||
                (rehearsal.runner === "running" && !snapshot.paused) ||
                snapshot.phase === "podium"
              }
              onClick={() => run("developer-run")}
            >
              Run or continue show
            </Button>
            <Button
              variant="secondary"
              disabled={locked || rehearsal.runner !== "running"}
              onClick={() => run("developer-stop")}
            >
              Pause automatic show
            </Button>
            <Button
              variant="secondary"
              disabled={locked || snapshot.phase === "lobby"}
              onClick={() => run("developer-repeat")}
            >
              Repeat this question
            </Button>
          </div>
          <label className="block">
            Jump to question{" "}
            <select value={index} onChange={(e) => setIndex(Number(e.target.value))}>
              {rehearsal.questions.map((q, i) => (
                <option value={i} key={q.id}>
                  {i + 1}. {q.title}
                </option>
              ))}
            </select>
          </label>
          <Button
            disabled={locked || !rehearsal.questions[index]}
            onClick={() =>
              void execute(
                { action: "developer-jump", questionIndex: index },
                "Jump to question",
                "developer",
              )
            }
          >
            Jump and reset selected question
          </Button>
          <p>
            Jump and repeat stop the runner and clear that question’s rehearsal answers
            and points. Other questions keep their history. These controls are unavailable
            in ordinary rooms.
          </p>
          <RehearsalFields
            value={value}
            onChange={(next) => setConfig({ base, value: next })}
            frozenPack
            disabled={locked}
          />
          <Button
            disabled={
              locked ||
              !rehearsalConfigSchema.safeParse(value).success ||
              snapshot.phase === "podium"
            }
            onClick={() => {
              void execute(
                { action: "developer-configure", rehearsalConfig: value },
                "Save rehearsal settings",
                "developer",
              );
            }}
          >
            Apply rehearsal settings
          </Button>
        </div>
      </section>
      <section
        className="admin-card min-w-0"
        aria-label="Failure scenarios"
      >
        <div className="admin-card-header">
          <span className="admin-mono-tag">CHAOS TESTING</span>
          <h2 className="admin-card-title">Try a failure</h2>
        </div>
        <div className="admin-card-body space-y-3">
          <p>
            Connections recover automatically after five seconds. A deadline burst uses
            unanswered bots and the server’s remaining time; disable automatic answers
            before opening the question.
          </p>
          <div className="admin-actions">
            {(
              [
                ["disconnect", "Disconnect 25% of bots"],
                ["late-join", "Add late bot"],
                ["deadline-burst", "Answer near deadline"],
                ["host-loss", "Lose host for five seconds"],
              ] as const
            ).map(([scenario, label]) => (
              <Button
                key={scenario}
                variant="secondary"
                disabled={
                  locked ||
                  (scenario === "deadline-burst" &&
                    (snapshot.phase !== "collect" || snapshot.paused || !!snapshot.held))
                }
                onClick={() =>
                  void execute(
                    {
                      action: "developer-scenario",
                      scenario: scenario as RehearsalScenario,
                    },
                    label,
                    "developer",
                  )
                }
              >
                {label}
              </Button>
            ))}
          </div>
          <p>
            {rehearsal.scenario
              ? `Last scenario: ${rehearsal.scenario.name}, ${new Date(rehearsal.scenario.at).toLocaleTimeString("en-GB")}`
              : "No scenario has run yet."}
          </p>
        </div>
      </section>
      <section
        className="admin-card min-w-0"
        aria-label="Automatic rehearsal checks"
      >
        <div className="admin-card-header">
          <span className="admin-status-dot" data-tone="ok" aria-hidden="true" />
          <h2 className="admin-card-title">Automatic checks</h2>
        </div>
        <div className="admin-card-body space-y-3">
          <ul className="admin-data-list">
            {rehearsal.checks.map((check) => (
              <li key={check.id} className="admin-data-row">
                <span
                  className="admin-status-dot"
                  data-tone={check.status === "pass" ? "ok" : "warn"}
                  aria-hidden="true"
                />
                <span className="admin-mono-tag">{check.status.toUpperCase()}</span> · {check.detail}
              </li>
            ))}
          </ul>
          <p>
            Checks cover duplicate score rows, phase deadlines, eligible bot answer
            counts, connections and refused actions. Missing answers for mechanics without
            a countable submission remain waiting.
          </p>
        </div>
      </section>
      <section
        className="admin-card min-w-0"
        aria-label="Rehearsal timeline"
      >
        <div className="admin-card-header">
          <h2 className="admin-card-title">Live activity</h2>
        </div>
        <div className="admin-card-body space-y-3">
          <p>
            New activity appears as grouped notifications. The full history stays here.
          </p>
          <Button variant="secondary" onClick={() => setNotifications((value) => !value)}>
            {notifications ? "Pause live notifications" : "Resume live notifications"}
          </Button>
          <Disclosure title="Event history">
            <label>
              Show events{" "}
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                {[
                  "all",
                  "host",
                  "phase",
                  "connection",
                  "answer",
                  "scenario",
                  "check",
                  "refused",
                ].map((kind) => (
                  <option key={kind}>{kind}</option>
                ))}
              </select>
            </label>
            <p>
              Latest 200 events. Reports include this history and current checks. Answer
              bodies, credentials and answer keys are excluded.
            </p>
            <ol className="max-h-96 overflow-y-auto space-y-2 admin-data-list">
              {rehearsal.events
                .filter(
                  (event) =>
                    filter === "all" || event.kind === filter || event.status === filter,
                )
                .map((event) => (
                  <motion.li
                    key={event.id}
                    className="admin-data-row"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                  >
                    <time dateTime={new Date(event.at).toISOString()} className="admin-mono-tag">
                      {new Date(event.at).toLocaleTimeString("en-GB")}
                    </time>{" "}
                    · <strong>{event.actor}</strong> · {event.detail} · <span className="admin-mono-tag">{event.status}</span> · {event.phase}
                    {event.questionId ? ` / ${event.questionId}` : ""}
                  </motion.li>
                ))}
            </ol>
          </Disclosure>
        </div>
      </section>
    </>
  );
}

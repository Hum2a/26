import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import type { AdminTrolls } from "@26/shared";
import { Button, Disclosure } from "../ui/primitives";
import { TrollRehearsal } from "./troll-rehearsal";
import { EntryNotice } from "../ui/entry-frame";
import { isScreenTroll, ScreenTroll } from "../troll/screen-trolls";
import { useTrollSoundUnlock } from "../troll/troll-sound";
import { CommandFeedback } from "./command-feedback";
import { useAdminRoom } from "./room-provider";
import { readTrolls } from "./sections-api";
import { useSection } from "./use-section";

type Troll = AdminTrolls["trolls"][number];

/** Global catalogue. Switches live on each room's Trolls page. */
export function TrollsPage() {
  return (
    <TrollCatalogue
      eyebrow="Catalogue"
      intro={
        <>
          Every troll guests can send. Each guest gets one, unlocked from the second
          question. Open a room and choose <strong>Trolls</strong> to switch them on or
          off for that room.{" "}
          <Link className="entry-text-link" to="/admin/rooms">
            Choose a room
          </Link>
        </>
      }
    />
  );
}

/** Per-room switches. Every troll starts on. */
export function RoomTrollsPage() {
  const { snapshot, execute, busy, connection } = useAdminRoom();
  const disabled = snapshot.trolls.disabled ?? [];
  const locked = busy || connection !== "open";
  function flip(troll: Troll, on: boolean) {
    void execute(
      { action: on ? "troll-on" : "troll-off", trollKind: troll.kind },
      `${on ? "Switch on" : "Switch off"} ${troll.label}`,
      "trolls",
    );
  }
  return (
    <TrollCatalogue
      eyebrow="This room"
      intro="Switch trolls on or off for this room. Switched-off trolls disappear from guests' phones straight away. Trolls already running finish normally."
      feedback={
        <>
          <CommandFeedback scope="trolls" />
          <TrollHistory locked={locked} />
        </>
      }
      switches={{
        isOn: (kind) => !disabled.some((item) => item === kind),
        locked,
        flip,
      }}
    />
  );
}

const historyStatus = {
  queued: "Waiting",
  active: "Running",
  ended: "Finished",
  cancelled: "Cancelled",
  refunded: "Refunded",
} as const;

/** Every troll sent this game, newest first, with Cancel for unfinished ones. */
function TrollHistory({ locked }: { locked: boolean }) {
  const { snapshot, execute } = useAdminRoom();
  const history = snapshot.trollHistory ?? [];
  return (
    <section className="admin-task-section" aria-label="Sent this game">
      <h2>Sent this game ({history.length})</h2>
      {history.length === 0 ? (
        <p>No trolls sent yet.</p>
      ) : (
        <ul className="grid gap-2">
          {history.map((item) => (
            <li key={item.effectId} className="flex flex-wrap items-center gap-3">
              <span>
                <strong>{item.actorNickname}</strong> → {item.targetNickname}:{" "}
                {item.label}
              </span>
              <span className="text-sm">
                {historyStatus[item.status]} ·{" "}
                {new Date(item.createdAt).toLocaleTimeString("en-GB")}
              </span>
              {item.status === "queued" || item.status === "active" ? (
                <Button
                  variant="secondary"
                  disabled={locked}
                  onClick={() =>
                    void execute(
                      { action: "cancel-effect", effectId: item.effectId },
                      `Cancel ${item.label}`,
                      "trolls",
                    )
                  }
                >
                  Cancel
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TrollCatalogue({
  eyebrow,
  intro,
  feedback,
  switches,
}: {
  eyebrow: string;
  intro: React.ReactNode;
  feedback?: React.ReactNode;
  switches?: {
    isOn: (kind: string) => boolean;
    locked: boolean;
    flip: (troll: Troll, on: boolean) => void;
  };
}) {
  const report = useSection(readTrolls);
  // A preview click unlocks the same troll sound a guest phone uses.
  useTrollSoundUnlock();
  const [preview, setPreview] = useState<Troll | null>(null);
  const endPreview = useCallback(() => setPreview(null), []);
  const trolls = report.data?.trolls ?? [];
  const onCount = switches
    ? trolls.filter((troll) => switches.isOn(troll.kind)).length
    : 0;
  return (
    <section className="admin-section">
      <header className="admin-page-heading">
        <div>
          <p className="entry-eyebrow">{eyebrow}</p>
          <h1>Trolls</h1>
        </div>
        <Button
          variant="secondary"
          disabled={report.loading}
          onClick={() => void report.refresh()}
        >
          Refresh
        </Button>
      </header>
      <p>{intro}</p>
      {feedback}
      <EntryNotice message={report.error} />
      {report.loading && !report.data ? <p role="status">Loading trolls…</p> : null}
      {switches && trolls.length ? (
        <div className="flex flex-wrap items-center gap-3">
          <p role="status">
            {onCount} of {trolls.length} switched on.
          </p>
          <Button
            variant="secondary"
            disabled={switches.locked || onCount === trolls.length}
            onClick={() =>
              trolls
                .filter((troll) => !switches.isOn(troll.kind))
                .forEach((troll) => switches.flip(troll, true))
            }
          >
            Switch all on
          </Button>
        </div>
      ) : null}
      <div className="admin-card-grid-wide">
        {trolls.map((troll) => {
          const on = switches?.isOn(troll.kind);
          return (
            <article
              key={troll.kind}
              className="grid gap-2 rounded-3xl border border-line bg-surface p-4"
              data-off={on === false || undefined}
              style={on === false ? { opacity: 0.6 } : undefined}
            >
              <header className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-xl font-bold">{troll.label}</h2>
                  <code>{troll.kind}</code>
                </div>
                {switches ? (
                  <label className="flex items-center gap-2 font-bold">
                    <input
                      type="checkbox"
                      role="switch"
                      className="size-6"
                      checked={on}
                      disabled={switches.locked}
                      onChange={(event) => switches.flip(troll, event.target.checked)}
                    />
                    {on ? "On" : "Off"}
                  </label>
                ) : null}
              </header>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt>Shows</dt>
                <dd>{troll.assetLabel}</dd>
                <dt>Lasts</dt>
                <dd>
                  {troll.durationMs === null
                    ? "Until the question ends"
                    : `${troll.durationMs / 1_000} seconds`}
                </dd>
                <dt>Escape</dt>
                <dd>{troll.escape ?? "None"}</dd>
                <dt>Phases</dt>
                <dd>{troll.phases.join(", ")}</dd>
                <dt>Questions</dt>
                <dd>
                  {troll.questionKinds.length > 0
                    ? troll.questionKinds.join(", ")
                    : "Any"}
                  {troll.modifier ? " · only where the question allows it" : ""}
                </dd>
              </dl>
              {isScreenTroll(troll.kind) ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPreview(troll)}
                >
                  Preview on this screen
                </Button>
              ) : (
                <Disclosure title="Rehearse this troll">
                  <TrollRehearsal troll={troll} />
                </Disclosure>
              )}
            </article>
          );
        })}
      </div>
      {preview && isScreenTroll(preview.kind) ? (
        <PreviewRun troll={preview} kind={preview.kind} onDone={endPreview} />
      ) : null}
    </section>
  );
}

function PreviewRun({
  troll,
  kind,
  onDone,
}: {
  troll: Troll;
  kind: Parameters<typeof ScreenTroll>[0]["kind"];
  onDone: () => void;
}) {
  // Previews run for the real duration, capped so a long one is not a trap.
  const ms = Math.min(troll.durationMs ?? 5_000, 8_000);
  useEffect(() => {
    const timer = window.setTimeout(onDone, ms);
    return () => window.clearTimeout(timer);
  }, [onDone, ms]);
  return (
    <ScreenTroll
      kind={kind}
      label={troll.assetLabel}
      escape={troll.escape}
      onEscape={onDone}
    />
  );
}

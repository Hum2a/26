import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { nicknameSchema } from "@26/shared";
import { Button, ConfirmDialog, LinkButton, TextField } from "../ui/primitives";
import { EntryNotice } from "../ui/entry-frame";
import { useAdminRoom, type AdminCommand } from "./room-provider";
import { CommandFeedback } from "./command-feedback";

type PlayerRow = {
  playerId: string;
  nickname: string;
  points: number | null;
  connected: boolean | null;
  removed: boolean;
  answered: boolean | null;
};
type PlayerConfirmation = {
  title: string;
  detail: string;
  label: string;
  command: AdminCommand;
  context: string;
  otherNickname?: string;
};
export function PlayersPage() {
  const { snapshot, connection } = useAdminRoom();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const rows: PlayerRow[] =
    snapshot.adminPlayers ??
    snapshot.players.map((player) => ({
      ...player,
      points: null,
      connected: null,
      removed: false,
      answered: null,
    }));
  const selected = rows.find((player) => player.playerId === selectedId);
  const visible = rows.filter((player) =>
    `${player.nickname} ${player.playerId}`
      .toLocaleLowerCase("en-GB")
      .includes(query.trim().toLocaleLowerCase("en-GB")),
  );
  return (
    <section className="admin-section">
      <header className="admin-page-heading">
        <div>
          <p className="entry-eyebrow">Individual help, in context</p>
          <h1>Players</h1>
        </div>
        <LinkButton variant="secondary" to="../live">
          Back to live controls
        </LinkButton>
      </header>
      <CommandFeedback scope="players" />
      <JoiningControls />
      {connection !== "open" ? (
        <p role="status" className="admin-inline-warning">
          Reconnecting. Player actions are unavailable until connected.
        </p>
      ) : null}
      <div className="admin-player-grid">
        <section aria-label="Player list" className="admin-player-list">
          <TextField
            label="Find a player"
            hint="Search by nickname or player ID. Removed players stay available for recovery."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <p>
            {visible.length} of {rows.length} players
          </p>
          <ul>
            {visible.map((player) => (
              <li key={player.playerId}>
                <button
                  type="button"
                  className="admin-player-row"
                  aria-pressed={selected?.playerId === player.playerId}
                  aria-label={`Select ${player.nickname}, ${player.playerId}`}
                  onClick={() => setSelectedId(player.playerId)}
                >
                  <span>
                    <strong className="inline-flex items-center gap-2">
                      <span
                        className="admin-status-dot"
                        data-tone={
                          player.removed ? "danger" : player.connected ? "ok" : "muted"
                        }
                        aria-hidden="true"
                      />
                      {player.nickname}
                    </strong>
                    <small>
                      {player.removed
                        ? "Removed"
                        : player.connected === null
                          ? "Connection unavailable"
                          : player.connected
                            ? "Connected"
                            : "Disconnected"}{" "}
                      ·{" "}
                      {player.answered === null
                        ? "Answer state unavailable"
                        : player.answered
                          ? "Submitted"
                          : "No submission"}
                    </small>
                    <small>ID {player.playerId.slice(0, 8)}</small>
                  </span>
                  <span className="admin-mono-tag">
                    {player.points === null
                      ? "Score unavailable"
                      : `${player.points} pts`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!visible.length ? (
            <p>
              {rows.length
                ? "No players match that search."
                : "No guests have joined this room yet."}
            </p>
          ) : null}
        </section>
        {selected ? (
          <PlayerDetails key={selected.playerId} player={selected} rows={rows} />
        ) : (
          <section className="admin-player-detail">
            <h2>Choose a player.</h2>
            <p>
              Their rename, device transfer, recovery and score tools will appear here.
            </p>
          </section>
        )}
      </div>
    </section>
  );
}

function JoiningControls() {
  const { snapshot, connection, busy, command, execute } = useAdminRoom();
  const admission = snapshot.admission;
  const locked = busy || connection !== "open" || command.retryable || !admission;
  const isOpen = admission?.open ?? false;
  return (
    <section className="admin-task-section" aria-label="Joining controls">
      <div className="admin-page-heading">
        <h2>New players</h2>
        <span className="admin-badge" data-tone={isOpen ? "ok" : "muted"}>
          <span
            className="admin-status-dot"
            data-tone={isOpen ? "ok" : "muted"}
            aria-hidden="true"
          />
          {isOpen ? "Entry Open" : "Entry Closed"}
        </span>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={String(admission?.open)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          role="status"
        >
          {admission
            ? admission.open
              ? "Joining is open, including mid-game."
              : "Joining is closed. Existing players can still reconnect."
            : "Joining status unavailable. Reconnect to load the controls."}
        </motion.p>
      </AnimatePresence>
      <p>
        Late arrivals start at zero and can answer an open ordinary question. A vote,
        duel or kart race already frozen keeps its participants; they join the next
        eligible round.
      </p>
      <Button
        variant="secondary"
        disabled={locked}
        onClick={() =>
          void execute(
            { action: admission?.open ? "close-joining" : "open-joining" },
            admission?.open ? "Close joining" : "Open joining",
            "players",
          )
        }
      >
        {admission?.open ? "Close joining" : "Open joining"}
      </Button>
      <p>
        To rehearse: close entry, try the room’s join link in a private browser, reopen
        entry and join during a question. Reconnecting and private phone-transfer codes
        keep working while entry is closed.
      </p>
      <h3>Recent joining changes</h3>
      <ul className="admin-data-list">
        {admission?.history.map((entry, index) => (
          <li key={`${entry.at}:${index}`} className="admin-data-row">
            <span>
              {entry.open ? "Opened" : "Closed"} by host ·{" "}
              {new Date(entry.at).toLocaleString("en-GB")}
            </span>
          </li>
        ))}
      </ul>
      {!admission?.history.length ? <p>No joining changes recorded.</p> : null}
    </section>
  );
}

function PlayerDetails({ player, rows }: { player: PlayerRow; rows: PlayerRow[] }) {
  const { snapshot, connection, busy, command, execute, transfer, clearTransfer } =
    useAdminRoom();
  const [tool, setTool] = useState<"Nickname" | "Phones" | "Score" | "Remove">(
    "Nickname",
  );
  const toolId = useId();
  const reduced = useReducedMotion();
  const [nickname, setNickname] = useState(player.nickname);
  const [otherId, setOtherId] = useState("");
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<PlayerConfirmation | null>(null);
  const locked = busy || connection !== "open" || command.retryable;
  const context = `${player.playerId}:${player.nickname}:${player.removed}`;
  const other = rows.find(
    (row) =>
      row.playerId === otherId && !row.removed && row.playerId !== player.playerId,
  );
  function ask(value: AdminCommand, title: string, detail: string, label: string) {
    if (!locked) {
      setError("");
      setConfirmation({
        command: value,
        title,
        detail,
        label,
        context,
        ...(value.action === "swap" ? { otherNickname: other?.nickname } : {}),
      });
    }
  }
  const stale =
    confirmation?.context !== context ||
    (confirmation?.command.action === "swap" &&
      (!other || confirmation.otherNickname !== other.nickname));
  function rename() {
    const parsed = nicknameSchema.safeParse(nickname);
    if (!parsed.success) {
      setError("Enter a nickname of 1 to 24 characters.");
      return;
    }
    ask(
      { action: "rename", playerId: player.playerId, nickname: parsed.data },
      `Rename ${player.nickname}?`,
      `Change their nickname to ${parsed.data}. Their player ID, answers and score stay with them.`,
      "Rename player",
    );
  }
  function adjust() {
    const value = Number(points);
    if (
      !points.trim() ||
      !Number.isInteger(value) ||
      value === 0 ||
      value < -1000 ||
      value > 1000 ||
      reason.trim().length < 3 ||
      reason.trim().length > 80
    ) {
      setError(
        "Enter a non-zero whole number from -1000 to 1000 and a reason of 3 to 80 characters.",
      );
      return;
    }
    ask(
      {
        action: "adjust",
        playerId: player.playerId,
        points: value,
        reason: reason.trim(),
      },
      `Adjust ${player.nickname}’s score?`,
      `${value > 0 ? "+" : ""}${value} points. Reason: ${reason.trim()}. This is recorded privately in the adjustment history.`,
      "Confirm score adjustment",
    );
  }
  return (
    <section className="admin-player-detail" aria-label="Player details">
      <header>
        <p className="entry-eyebrow">Selected player</p>
        <h2>{player.nickname}</h2>
        <p className="admin-player-id">{player.playerId}</p>
        <p>
          {player.removed ? "Removed from the room" : "Active player"} ·{" "}
          {player.points === null ? "Score unavailable" : `${player.points} points`}
        </p>
      </header>
      <EntryNotice message={error} />
      {transfer?.playerId === player.playerId ? (
        <div className="admin-private-code">
          <h3>Private {transfer.kind === "recovery" ? "recovery" : "device"} code</h3>
          <p className="admin-side-code">{transfer.code}</p>
          <p>
            Read this only to {player.nickname}. One use, valid for two minutes after
            issue. The server checks expiry.
          </p>
          <Button variant="secondary" onClick={clearTransfer}>
            Hide code
          </Button>
        </div>
      ) : null}
      {player.removed ? (
        <section className="admin-task-section">
          <h3>Bring this player back</h3>
          <p>
            Recovery keeps their player ID and score. Their old phone remains signed
            out; the guest must use the recovery code.
          </p>
          <Button
            disabled={locked}
            onClick={() =>
              ask(
                { action: "recover", playerId: player.playerId },
                `Recover ${player.nickname}?`,
                "Allow this player back into the room and issue a one-use recovery code. Their old phone remains signed out.",
                "Recover player",
              )
            }
          >
            Recover {player.nickname}
          </Button>
        </section>
      ) : (
        <>
          <div className="admin-player-tools" aria-label="Player tools">
            {(["Nickname", "Phones", "Score", "Remove"] as const).map((name) => (
              <Button
                key={name}
                variant="secondary"
                aria-pressed={tool === name}
                aria-controls={toolId}
                onClick={() => {
                  setTool(name);
                  setError("");
                }}
              >
                {name}
              </Button>
            ))}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tool}
              id={toolId}
              initial={{ opacity: 0, y: reduced ? 0 : 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : -4 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
            >
              {tool === "Nickname" ? (
                <>
                  <form
                    className="admin-task-section"
                    onSubmit={(event) => {
                      event.preventDefault();
                      rename();
                    }}
                  >
                    <h3>Nickname</h3>
                    <TextField
                      label="New nickname"
                      hint="Their player ID stays the same."
                      value={nickname}
                      onChange={(event) => setNickname(event.target.value)}
                      maxLength={24}
                    />
                    <Button disabled={locked} type="submit">
                      Review rename
                    </Button>
                  </form>
                  <form
                    className="admin-task-section"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (other)
                        ask(
                          {
                            action: "swap",
                            playerId: player.playerId,
                            otherPlayerId: other.playerId,
                          },
                          "Swap these nicknames?",
                          `${player.nickname} and ${other.nickname} will exchange nicknames. Player IDs, scores and answers do not move.`,
                          "Swap nicknames",
                        );
                    }}
                  >
                    <h3>Swap nicknames</h3>
                    <label htmlFor="swap-player">Swap with</label>
                    <select
                      id="swap-player"
                      value={otherId}
                      onChange={(event) => setOtherId(event.target.value)}
                    >
                      <option value="">Choose another player</option>
                      {rows
                        .filter(
                          (row) => row.playerId !== player.playerId && !row.removed,
                        )
                        .map((row) => (
                          <option key={row.playerId} value={row.playerId}>
                            {row.nickname} · {row.playerId.slice(0, 8)}
                          </option>
                        ))}
                    </select>
                    <Button
                      variant="secondary"
                      type="submit"
                      disabled={locked || !other}
                    >
                      Review swap
                    </Button>
                  </form>
                </>
              ) : tool === "Phones" ? (
                <>
                  <section className="admin-task-section">
                    <h3>Change phones</h3>
                    <p>
                      For an active guest moving to another device. The old phone is
                      signed out when the code is redeemed.
                    </p>
                    <Button
                      variant="secondary"
                      disabled={locked}
                      onClick={() =>
                        ask(
                          { action: "transfer", playerId: player.playerId },
                          `Transfer ${player.nickname} to another phone?`,
                          "Issue a one-use code, valid for two minutes. Read it privately to this guest. Their old phone stops working when the code is used.",
                          "Create transfer code",
                        )
                      }
                    >
                      Transfer {player.nickname}
                    </Button>
                  </section>
                </>
              ) : tool === "Score" ? (
                <>
                  <form
                    className="admin-task-section"
                    onSubmit={(event) => {
                      event.preventDefault();
                      adjust();
                    }}
                  >
                    <h3>Score adjustment</h3>
                    <TextField
                      label="Score adjustment"
                      hint="Signed whole points, -1000 to 1000, not zero."
                      inputMode="numeric"
                      value={points}
                      onChange={(event) => setPoints(event.target.value)}
                    />
                    <TextField
                      label="Reason"
                      hint="3 to 80 characters. Stays private to admin."
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      maxLength={80}
                    />
                    <Button variant="secondary" type="submit" disabled={locked}>
                      Review score change
                    </Button>
                  </form>
                </>
              ) : (
                <>
                  <section className="admin-task-section admin-danger-zone">
                    <h3>Remove this phone</h3>
                    <p>
                      The guest cannot reconnect with their old session. You can recover
                      their player record afterwards.
                    </p>
                    <Button
                      variant="secondary"
                      disabled={locked}
                      onClick={() =>
                        ask(
                          { action: "kick", playerId: player.playerId },
                          `Remove ${player.nickname} from the room?`,
                          "Revoke this guest’s phone session and disconnect it. Their player record and score remain available for recovery.",
                          "Remove player",
                        )
                      }
                    >
                      Remove {player.nickname}
                    </Button>
                  </section>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </>
      )}
      {tool === "Score" || player.removed ? (
        <section className="admin-task-section">
          <h3>Recent score changes</h3>
          <ul>
            {snapshot.adjustments
              ?.filter((row) => row.playerId === player.playerId)
              .map((row, index) => (
                <li key={index}>
                  <strong>
                    {row.points > 0 ? "+" : ""}
                    {row.points}
                  </strong>{" "}
                  · {row.reason}
                </li>
              ))}
          </ul>
          {!snapshot.adjustments?.some((row) => row.playerId === player.playerId) ? (
            <p>No recent adjustments recorded for this player.</p>
          ) : null}
        </section>
      ) : null}
      <ConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation?.title ?? "Review player action"}
        confirmLabel={confirmation?.label ?? "Confirm"}
        disabled={locked || stale}
        onClose={() => setConfirmation(null)}
        onConfirm={() => {
          if (confirmation && !stale && !locked) {
            void execute(confirmation.command, confirmation.label, "players");
            setConfirmation(null);
          }
        }}
      >
        <p>{confirmation?.detail}</p>
        {confirmation && stale ? (
          <p>
            This player has changed. Close this dialog and review their current details.
          </p>
        ) : null}
      </ConfirmDialog>
    </section>
  );
}

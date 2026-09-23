import { useEffect, useState } from "react";
import {
  lobbyCreatedSchema,
  type LobbyCreated,
  type LobbyPlayer,
  type LobbySnapshot,
  type RoomPhaseName,
} from "@26/shared";
import { Button, Panel, TextField } from "../ui/primitives";
import {
  playRoom,
  type PlayAction,
  createLobby,
  downloadScoreSummary,
  issueTransfer,
  readDiagnostics,
} from "../live/room-api";
import type { RoomDiagnostics } from "@26/shared";
import { openRoomSocket } from "../live/room-socket";

function readStoredLobby(): LobbyCreated | undefined {
  try {
    const stored = sessionStorage.getItem("26-lobby");
    if (!stored) {
      return undefined;
    }
    const parsed = lobbyCreatedSchema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

const revealPhases = new Set<RoomPhaseName>(["reveal", "scores", "final", "podium"]);

export function AdminLobby() {
  const [lobby, setLobby] = useState<LobbyCreated | undefined>(readStoredLobby);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [notice, setNotice] = useState(() =>
    readStoredLobby()
      ? "The lobby is open. Guests join with the code."
      : "Create a lobby when the guests are ready.",
  );
  const [connection, setConnection] = useState<
    "connecting" | "open" | "closed" | "idle"
  >("idle");
  const [transferCode, setTransferCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<RoomPhaseName>("lobby");
  const [paused, setPaused] = useState(false);
  const [stageHidden, setStageHidden] = useState(false);
  const [finishAfterRound, setFinishAfterRound] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [otherId, setOtherId] = useState("");
  const [nickname, setNickname] = useState("");
  const [points, setPoints] = useState("10");
  const [reason, setReason] = useState("");
  const [connections, setConnections] = useState<LobbySnapshot["connections"]>();
  const [hostAnswers, setHostAnswers] =
    useState<NonNullable<LobbySnapshot["play"]>["hostAnswers"]>();
  const [hostResponses, setHostResponses] =
    useState<NonNullable<LobbySnapshot["play"]>["hostResponses"]>();
  const [questionOptions, setQuestionOptions] = useState<
    { id: string; label: string }[]
  >([]);
  const [candidateMode, setCandidateMode] = useState<"all" | "shortlist" | null>(null);
  const [adjustments, setAdjustments] = useState<LobbySnapshot["adjustments"]>([]);
  const [hostEffects, setHostEffects] = useState<LobbySnapshot["hostEffects"]>([]);
  const [highlights, setHighlights] = useState<LobbySnapshot["highlights"]>([]);
  const [archive, setArchive] = useState<LobbySnapshot["archive"]>();
  const [health, setHealth] = useState<RoomDiagnostics>();
  const [mediaItems, setMediaItems] = useState<LobbySnapshot["media"]>([]);
  const [announcement, setAnnouncement] =
    useState<LobbySnapshot["trolls"]["announcement"]>();

  useEffect(() => {
    if (!lobby) {
      return;
    }
    const socket = openRoomSocket({
      gameId: lobby.gameId,
      role: "control",
      onSnapshot(snapshot) {
        setPlayers(snapshot.players);
        setPhase(snapshot.phase);
        setPaused(snapshot.paused);
        setStageHidden(snapshot.stageHidden);
        setFinishAfterRound(snapshot.finishAfterRound);
        setConnections(snapshot.connections);
        setHostAnswers(snapshot.play?.hostAnswers);
        setHostResponses(snapshot.play?.hostResponses);
        setQuestionOptions(
          snapshot.play?.question.kind === "choice"
            ? snapshot.play.question.options
            : [],
        );
        setCandidateMode(
          snapshot.play?.question.kind === "vote"
            ? snapshot.play.question.candidateMode
            : null,
        );
        setAdjustments(snapshot.adjustments ?? []);
        setHostEffects(snapshot.hostEffects ?? []);
        setHighlights(snapshot.highlights ?? []);
        setArchive(snapshot.archive);
        setMediaItems(snapshot.media);
        setAnnouncement(snapshot.trolls.announcement);
        setSelectedId((current) =>
          snapshot.players.some((player) => player.playerId === current)
            ? current
            : (snapshot.players[0]?.playerId ?? ""),
        );
      },
      onAck() {},
      onReplaced(message) {
        setNotice(message);
      },
      onConnection(state) {
        setConnection(state);
      },
    });
    return () => {
      socket.close();
    };
  }, [lobby]);

  useEffect(() => {
    if (!lobby) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || busy) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "n" && phase === "lobby") {
        event.preventDefault();
        void onPlay("reveal-names");
      } else if (key === "p" && phase !== "lobby" && phase !== "podium") {
        event.preventDefault();
        void onPlay(paused ? "resume" : "pause");
      } else if (key === "arrowright" && phase !== "lobby" && phase !== "podium") {
        event.preventDefault();
        void onPlay("advance");
      } else if (
        key === "s" &&
        phase !== "lobby" &&
        phase !== "final" &&
        phase !== "podium"
      ) {
        event.preventDefault();
        void onPlay("skip");
      } else if (key === "f" && phase !== "lobby" && phase !== "podium") {
        event.preventDefault();
        void onPlay("finish");
      } else if (key === "h" && revealPhases.has(phase)) {
        event.preventDefault();
        void onPlay(stageHidden ? "show" : "hide");
      } else if (key === "r" && revealPhases.has(phase)) {
        event.preventDefault();
        void onPlay("rereveal");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  });

  async function onCreate() {
    setBusy(true);
    setTransferCode("");
    const created = await createLobby(crypto.randomUUID());
    setBusy(false);
    if ("error" in created) {
      setNotice(created.error);
      return;
    }
    sessionStorage.setItem("26-lobby", JSON.stringify(created));
    setLobby(created);
    setNotice("The lobby is open. Guests join with the code.");
  }

  async function onTransfer(player: LobbyPlayer) {
    if (!lobby) {
      return;
    }
    setBusy(true);
    const issued = await issueTransfer({
      gameId: lobby.gameId,
      playerId: player.playerId,
      requestId: crypto.randomUUID(),
    });
    setBusy(false);
    if ("error" in issued) {
      setNotice(issued.error);
      return;
    }
    setTransferCode(issued.code);
    setNotice(
      `Read this transfer code to ${player.nickname}. It works once, for two minutes.`,
    );
  }

  async function onPlay(
    action: PlayAction,
    extra?: {
      playerId?: string;
      otherPlayerId?: string;
      nickname?: string;
      points?: number;
      reason?: string;
      candidateId?: string;
      effectId?: string;
      mediaId?: string;
    },
  ) {
    if (!lobby) {
      return;
    }
    setBusy(true);
    const result = await playRoom({
      gameId: lobby.gameId,
      action,
      requestId: crypto.randomUUID(),
      ...extra,
    });
    setBusy(false);
    if ("error" in result) {
      setNotice(result.error);
      return;
    }
    setPhase(result.phase);
    setPaused(result.paused);
    if (result.transferCode) {
      setTransferCode(result.transferCode);
    }
    setNotice(playNotice(action, result.phase, result.transferCode));
    if (action === "release-stuck-media" || action === "retry-delivery") {
      await refreshHealth();
    }
  }

  async function refreshHealth() {
    if (!lobby) {
      return;
    }
    const result = await readDiagnostics(lobby.gameId);
    if ("error" in result) {
      setNotice(result.error);
      return;
    }
    setHealth(result);
  }

  async function saveSummary() {
    if (!lobby) {
      return;
    }
    setBusy(true);
    const result = await downloadScoreSummary(lobby.gameId);
    setBusy(false);
    setNotice(result?.error ?? "The score summary downloaded.");
  }

  const selected =
    players.find((player) => player.playerId === selectedId) ?? players[0];
  const canHide = revealPhases.has(phase);

  return (
    <Panel title="Lobby">
      <p>{notice}</p>
      {lobby ? (
        <p>
          {connection === "open"
            ? "Connected to the lobby."
            : connection === "closed"
              ? "The lobby connection is closed."
              : "Connecting to the lobby."}
        </p>
      ) : null}
      {lobby ? (
        <dl className="mt-4 grid gap-2">
          <div>
            <dt className="font-bold">Join code</dt>
            <dd>{lobby.joinCode}</dd>
          </div>
          <div>
            <dt className="font-bold">Game id</dt>
            <dd>{lobby.gameId}</dd>
          </div>
          <div>
            <dt className="font-bold">Players</dt>
            <dd>{players.length}</dd>
          </div>
          {connections ? (
            <div>
              <dt className="font-bold">Connections</dt>
              <dd>
                Phones {connections.guests}. Stage {connections.stage}. Control{" "}
                {connections.control}.
              </dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <Button className="mt-4" disabled={busy} onClick={() => void onCreate()}>
          Create a lobby
        </Button>
      )}
      {selected ? (
        <div className="mt-4">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void onTransfer(selected)}
          >
            Transfer {selected.nickname}
          </Button>
        </div>
      ) : null}
      {transferCode ? <p className="mt-4 text-2xl font-bold">{transferCode}</p> : null}
      {lobby ? (
        <div className="mt-4 grid gap-4">
          <p>These controls stay on this screen. The stage does not show them.</p>
          {finishAfterRound && phase !== "podium" ? (
            <p>The quiz will finish after this question.</p>
          ) : null}
          <div className="flex max-w-full flex-wrap gap-3">
            <Button
              disabled={busy || phase !== "lobby"}
              onClick={() => void onPlay("start")}
            >
              Start the illustrative demo
            </Button>
            <Button
              variant="secondary"
              disabled={busy || phase !== "lobby"}
              onClick={() => void onPlay("reveal-names")}
            >
              Reveal nickname votes
            </Button>
            <Button
              variant="secondary"
              disabled={busy || paused || phase === "lobby" || phase === "podium"}
              onClick={() => void onPlay("pause")}
            >
              Pause
            </Button>
            <Button
              variant="secondary"
              disabled={busy || !paused}
              onClick={() => void onPlay("resume")}
            >
              Resume
            </Button>
            <Button
              variant="secondary"
              disabled={busy || phase === "lobby" || phase === "podium"}
              onClick={() => void onPlay("advance")}
            >
              Advance
            </Button>
            <Button
              variant="secondary"
              disabled={
                busy || phase === "lobby" || phase === "final" || phase === "podium"
              }
              onClick={() => void onPlay("skip")}
            >
              Skip question
            </Button>
            <Button
              variant="secondary"
              disabled={busy || phase === "lobby" || phase === "podium"}
              onClick={() => void onPlay("finish")}
            >
              {phase === "final" ? "Finish quiz" : "Finish after this question"}
            </Button>
            <Button
              variant="secondary"
              disabled={busy || !canHide}
              onClick={() => void onPlay(stageHidden ? "show" : "hide")}
            >
              {stageHidden ? "Show stage content" : "Hide stage content"}
            </Button>
            <Button
              variant="secondary"
              disabled={busy || !canHide}
              onClick={() => void onPlay("rereveal")}
            >
              Show the reveal again
            </Button>
            <Button variant="secondary" disabled>
              Media cue. Not in this build.
            </Button>
            <Button variant="secondary" disabled>
              Effect. Not in this build.
            </Button>
          </div>
          <p>
            Shortcuts: N reveal names, P pause or resume, Right arrow advance, S skip, F
            finish after this question, H hide or show, R show the reveal again. They
            ignore a held key and ignore typing in a field.
          </p>
          {players.length > 0 ? (
            <form
              className="grid max-w-full gap-3"
              onSubmit={(event) => {
                event.preventDefault();
              }}
            >
              <label className="grid gap-1 font-bold">
                Player
                <select
                  className="min-h-11 rounded-xl bg-surface px-3"
                  value={selected?.playerId ?? ""}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  {players.map((player) => (
                    <option key={player.playerId} value={player.playerId}>
                      {player.nickname}
                    </option>
                  ))}
                </select>
              </label>
              <TextField
                label="New nickname"
                hint="The player id stays the same."
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
              />
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy || !selected}
                  onClick={() => {
                    if (!selected) {
                      return;
                    }
                    void onPlay("rename", {
                      playerId: selected.playerId,
                      nickname,
                    });
                  }}
                >
                  Rename
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy || !selected}
                  onClick={() => {
                    if (!selected) {
                      return;
                    }
                    void onPlay("kick", { playerId: selected.playerId });
                  }}
                >
                  Kick
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy || !selected}
                  onClick={() => {
                    if (!selected) {
                      return;
                    }
                    void onPlay("recover", { playerId: selected.playerId });
                  }}
                >
                  Recover
                </Button>
              </div>
              <label className="grid gap-1 font-bold">
                Swap with
                <select
                  className="min-h-11 rounded-xl bg-surface px-3"
                  value={otherId}
                  onChange={(event) => setOtherId(event.target.value)}
                >
                  <option value="">Choose another player</option>
                  {players
                    .filter((player) => player.playerId !== selected?.playerId)
                    .map((player) => (
                      <option key={player.playerId} value={player.playerId}>
                        {player.nickname}
                      </option>
                    ))}
                </select>
              </label>
              <Button
                type="button"
                variant="secondary"
                disabled={busy || !selected || !otherId}
                onClick={() => {
                  if (!selected) {
                    return;
                  }
                  void onPlay("swap", {
                    playerId: selected.playerId,
                    otherPlayerId: otherId,
                  });
                }}
              >
                Swap nicknames
              </Button>
              <TextField
                label="Score adjustment"
                hint="A whole number from -1000 to 1000, not zero."
                value={points}
                onChange={(event) => setPoints(event.target.value)}
                inputMode="numeric"
              />
              <TextField
                label="Reason"
                hint="3 to 80 characters. The stage does not show this."
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={busy || !selected}
                onClick={() => {
                  if (!selected) {
                    return;
                  }
                  const parsed = Number(points);
                  void onPlay("adjust", {
                    playerId: selected.playerId,
                    points: parsed,
                    reason,
                  });
                }}
              >
                Adjust score
              </Button>
            </form>
          ) : null}
          {hostResponses && hostResponses.length > 0 ? (
            <div>
              <p className="font-bold">Responses on this question</p>
              <ul className="grid gap-1">
                {hostResponses.map((row) => (
                  <li key={`${row.playerId}-${row.summary}`} className="grid gap-2">
                    <span>
                      {row.nickname}: {row.summary}
                      {row.included === false ? " (not on the ballot)" : ""}
                      {row.votes !== undefined ? ` · ${row.votes} votes` : ""}
                    </span>
                    {candidateMode === "shortlist" && phase === "collect" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void onPlay(row.included ? "exclude" : "include", {
                            playerId: row.playerId,
                          })
                        }
                      >
                        {row.included
                          ? `Remove ${row.nickname}`
                          : `Include ${row.nickname}`}
                      </Button>
                    ) : null}
                    {row.candidateId &&
                    (phase === "vote" || phase === "reveal" || phase === "scores") ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void onPlay("feature", { candidateId: row.candidateId })
                        }
                      >
                        Feature on the stage
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {hostEffects && hostEffects.length > 0 ? (
            <div className="grid gap-2">
              <p className="font-bold">Running trolls</p>
              {hostEffects.map((effect) => (
                <Button
                  key={effect.effectId}
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void onPlay("cancel-effect", { effectId: effect.effectId })
                  }
                >
                  Cancel {effect.label} on {effect.targetNickname}
                </Button>
              ))}
            </div>
          ) : null}
          {mediaItems.length > 0 ? (
            <div className="grid gap-2">
              <p className="font-bold">Accepted media</p>
              {mediaItems.map((item) => (
                <Button
                  key={item.mediaId}
                  type="button"
                  variant="secondary"
                  disabled={busy || item.hidden === true}
                  onClick={() => void onPlay("hide-media", { mediaId: item.mediaId })}
                >
                  {item.hidden
                    ? `Hidden ${item.kind} from ${item.nickname}`
                    : `Hide ${item.kind} from ${item.nickname}`}
                </Button>
              ))}
            </div>
          ) : null}
          {announcement ? (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void onPlay("dismiss-cue")}
            >
              Dismiss announcement
            </Button>
          ) : null}
          {hostAnswers && hostAnswers.length > 0 ? (
            <div>
              <p className="font-bold">Answers on this question</p>
              <ul className="grid gap-1">
                {hostAnswers.map((row) => (
                  <li key={row.playerId}>
                    {row.nickname}:{" "}
                    {questionOptions.find((option) => option.id === row.optionId)
                      ?.label ?? row.optionId}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {adjustments && adjustments.length > 0 ? (
            <div>
              <p className="font-bold">Score adjustments</p>
              <ul className="grid gap-1">
                {adjustments.map((row) => (
                  <li key={`${row.playerId}-${row.reason}-${row.points}`}>
                    {row.nickname} {row.points > 0 ? `+${row.points}` : row.points}:{" "}
                    {row.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {health ? (
            <div>
              <p className="font-bold">Room health</p>
              <p>
                {health.phase}
                {health.paused ? ", paused" : ""}
                {health.held ? ", held" : ""}. {health.players} players.{" "}
                {health.connections.guests} phones, {health.connections.stage} stage,{" "}
                {health.connections.control} control.
              </p>
              <p>
                Scheduler: {health.scheduler.pending} pending, {health.scheduler.failed}{" "}
                failed.
                {health.scheduler.alarmAt
                  ? ` Next alarm ${new Date(health.scheduler.alarmAt).toLocaleTimeString("en-GB")}.`
                  : " No alarm is armed."}
              </p>
              <p>
                Media: {health.media.accepted} accepted, {health.media.leased} checking,{" "}
                {health.media.rejected} rejected.
              </p>
              {health.media.attention.length > 0 ? (
                <ul className="grid gap-1">
                  {health.media.attention.map((item) => (
                    <li key={`${item.nickname}-${item.status}-${item.failure}`}>
                      {item.nickname}: {item.status}. {item.failure}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p>
                {health.delivery.available
                  ? `Email jobs: ${health.delivery.pending} pending, ${health.delivery.uncertain} uncertain, ${health.delivery.failed} failed, ${health.delivery.sent} sent.`
                  : "Email job counts are unavailable."}
                {health.delivery.testRecipient
                  ? " Test delivery is limited to the configured recipient."
                  : ""}
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void refreshHealth()}
            >
              Refresh room health
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void onPlay("release-stuck-media")}
            >
              Release stuck media
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void onPlay("retry-delivery")}
            >
              Retry email jobs
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void saveSummary()}
            >
              Download score summary
            </Button>
          </div>
          {archive ? (
            <div>
              <p className="font-bold">Archive</p>
              <p className="break-words">
                {archive.status === "completed"
                  ? "The archive export is complete."
                  : archive.status === "failed"
                    ? "The archive export failed. The podium is still available."
                    : "The archive export is waiting. The podium does not wait for it."}
              </p>
              {archive.status === "failed" ? (
                <Button
                  className="mt-2"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void onPlay("retry-archive")}
                >
                  Retry archive export
                </Button>
              ) : null}
            </div>
          ) : null}
          {highlights && highlights.length > 0 ? (
            <div>
              <p className="font-bold">Highlights</p>
              <ul className="grid gap-3">
                {highlights.map((card) => (
                  <li key={card.id}>
                    <p className="font-bold">
                      {card.illustrative ? "Illustrative" : "This room"}
                    </p>
                    <p className="break-words">{card.stage}</p>
                    <p className="break-words">{card.results}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p>
            <a className="font-bold underline" href={`/host?code=${lobby.joinCode}`}>
              Open the stage
            </a>
          </p>
        </div>
      ) : null}
    </Panel>
  );
}

function playNotice(
  action: PlayAction,
  phase: RoomPhaseName,
  transferCode?: string,
): string {
  if (action === "start") {
    return "The illustrative demo has started.";
  }
  if (action === "pause") {
    return "The quiz is paused.";
  }
  if (action === "resume") {
    return "The quiz has resumed.";
  }
  if (action === "skip") {
    return "The question was skipped.";
  }
  if (action === "finish") {
    return phase === "podium"
      ? "The quiz is finished."
      : "The quiz will finish after this question.";
  }
  if (action === "reveal-names") {
    return "The nickname votes are on the stage. They do not change the scores.";
  }
  if (action === "hide") {
    return "The stage content is hidden.";
  }
  if (action === "hide-media") {
    return "That photo or voice clip is hidden from the stage and the gallery.";
  }
  if (action === "show") {
    return "The stage content is visible.";
  }
  if (action === "rereveal") {
    return "The reveal is showing again. Scores were not added again.";
  }
  if (action === "rename") {
    return "The nickname was changed. The player id is the same.";
  }
  if (action === "swap") {
    return "The nicknames were swapped. The player ids are the same.";
  }
  if (action === "kick") {
    return "That phone was removed. Its old session cannot reconnect.";
  }
  if (action === "recover") {
    return transferCode
      ? `Read this recovery code to the guest: ${transferCode}. Their old phone stays signed out.`
      : "That player is back in the room. Read them the recovery code.";
  }
  if (action === "adjust") {
    return "The score was adjusted. The reason stays on this screen.";
  }
  if (action === "include") {
    return "That answer is on the ballot.";
  }
  if (action === "exclude") {
    return "That answer was taken off the ballot.";
  }
  if (action === "feature") {
    return "The stage selection changed. The vote tally did not.";
  }
  if (action === "retry-archive") {
    return "The archive export will try again. The podium stays up.";
  }
  if (action === "release-stuck-media") {
    return "Stuck photo and voice checks were released. Ask the guest to send the file again.";
  }
  if (action === "retry-delivery") {
    return "Waiting email jobs were tried again. Addresses stay on the delivery record.";
  }
  return `The room is on ${phase}.`;
}

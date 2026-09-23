import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { formatPhaseClock, remainingUntil, type LobbySnapshot } from "@26/shared";
import {
  CountdownLayout,
  Button,
  Panel,
  StatusMessage,
  TextField,
} from "../ui/primitives";
import { SurfaceFrame } from "../ui/surface-frame";
import { JoinMark } from "../lobby/join-mark";
import { NameCloud, NameReveal } from "../lobby/name-cloud";
import { withClientApiKey } from "../api/client-key.ts";
import { lookupStage } from "../live/room-api";
import { openRoomSocket } from "../live/room-socket";
import { StagePlay } from "../play/stage-play";
import { StageSound } from "./stage-sound";

export function StagePage() {
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [snapshot, setSnapshot] = useState<LobbySnapshot>();
  const [observedAt, setObservedAt] = useState(() => Date.now());
  const [notice, setNotice] = useState("No room is connected.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Stage · 26";
  }, []);

  const gameId = snapshot?.gameId;
  const countdown = usePhaseCountdown(snapshot, observedAt);

  useEffect(() => {
    if (!gameId) {
      return;
    }
    const socket = openRoomSocket({
      gameId,
      role: "stage",
      onSnapshot(next) {
        setObservedAt(Date.now());
        setSnapshot(next);
        setNotice(
          next.phase === "lobby" ? "The lobby is on screen." : "The quiz is on screen.",
        );
      },
      onAck() {},
      onReplaced(message) {
        setNotice(message);
      },
      onConnection() {},
    });
    return () => {
      socket.close();
    };
  }, [gameId]);

  async function onShow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const found = await lookupStage(code);
    setBusy(false);
    if ("error" in found) {
      setSnapshot(undefined);
      setNotice(found.error);
      return;
    }
    setObservedAt(Date.now());
    setSnapshot(found);
    setNotice(
      found.phase === "lobby" ? "The lobby is on screen." : "The quiz is on screen.",
    );
  }

  return (
    <SurfaceFrame
      current="stage"
      size="stage"
      title="Stage"
      lede="This is the projector. Host controls stay on the admin screen."
    >
      <StatusMessage>{notice}</StatusMessage>
      {snapshot ? (
        <details className="rounded-3xl border border-line px-5 py-4">
          <summary className="cursor-pointer text-xl font-bold">Change room</summary>
          <RoomCodeForm code={code} busy={busy} onCode={setCode} onShow={onShow} />
        </details>
      ) : (
        <RoomCodeForm code={code} busy={busy} onCode={setCode} onShow={onShow} />
      )}
      {countdown ? (
        <CountdownLayout
          label={countdown.label}
          value={countdown.value}
          note={countdown.note}
        />
      ) : snapshot?.phase === "lobby" ? (
        <CountdownLayout label="Lobby" value="—" note="No round is running." />
      ) : snapshot ? null : (
        <CountdownLayout
          label="Countdown preview"
          value="0:30"
          note="Preview only. No round is running."
        />
      )}
      {snapshot?.stageHidden && snapshot.phase !== "lobby" ? (
        <p className="text-3xl font-bold">Hidden by the host.</p>
      ) : null}
      {snapshot?.highlights && snapshot.highlights.length > 0 ? (
        <Panel title="From this room" display="stage">
          <ul className="grid gap-4">
            {snapshot.highlights.map((card) => (
              <li key={card.id}>
                {card.illustrative ? <p className="font-bold">Illustrative</p> : null}
                <p className="break-words text-3xl font-bold">{card.stage}</p>
                <p className="break-words">{card.results}</p>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      {snapshot?.play ? <StagePlay snapshot={snapshot} /> : null}
      {snapshot && snapshot.media.length > 0 ? (
        <div className="grid gap-4">
          {snapshot.media.map((item) =>
            item.kind === "photo" ? (
              <StagePhoto
                key={item.mediaId}
                nickname={item.nickname}
                src={withClientApiKey(
                  `/api/rooms/${snapshot.gameId}/media/${item.mediaId}`,
                )}
              />
            ) : (
              <div key={item.mediaId} className="grid gap-2">
                <p className="text-2xl font-bold">Voice clip from {item.nickname}</p>
                <audio
                  controls
                  preload="none"
                  src={withClientApiKey(
                  `/api/rooms/${snapshot.gameId}/media/${item.mediaId}`,
                )}
                >
                  Voice clip from {item.nickname}
                </audio>
              </div>
            ),
          )}
        </div>
      ) : null}
      {snapshot?.draft ? (
        <p className="text-3xl font-bold" aria-live="polite">
          {snapshot.draft.nickname} is typing: {snapshot.draft.text}
        </p>
      ) : null}
      {snapshot ? (
        <StageSound
          gameId={snapshot.gameId}
          announcement={snapshot.trolls.announcement}
        />
      ) : null}
      {snapshot ? (
        <Panel
          title={snapshot.phase === "lobby" ? "In the lobby" : "Join"}
          display="stage"
        >
          {snapshot.phase === "lobby" ? (
            <div className="grid gap-4">
              <p className="stage-answer tracking-[0.14em]">{snapshot.joinCode}</p>
              <JoinMark code={snapshot.joinCode} />
              {snapshot.namesReveal ? (
                <NameReveal reveal={snapshot.namesReveal} />
              ) : null}
              {snapshot.cloud.length > 0 ? (
                <NameCloud names={snapshot.cloud} minRem={2.75} maxRem={4.5} />
              ) : (
                <p>Nicknames appear here after guests join.</p>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <p className="text-2xl font-bold">{snapshot.players.length} players</p>
              <JoinMark code={snapshot.joinCode} compact />
            </div>
          )}
        </Panel>
      ) : (
        <Panel title="In the lobby">
          <p>Nicknames appear here after guests join.</p>
        </Panel>
      )}
    </SurfaceFrame>
  );
}

function RoomCodeForm({
  code,
  busy,
  onCode,
  onShow,
}: {
  code: string;
  busy: boolean;
  onCode: (value: string) => void;
  onShow: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="mt-4 grid gap-4" onSubmit={onShow}>
      <TextField
        label="Join code"
        hint="The code from the admin screen. This screen does not show secrets."
        value={code}
        onChange={(event) => onCode(event.target.value)}
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
      />
      <Button type="submit" disabled={busy}>
        Show the lobby
      </Button>
    </form>
  );
}

function StagePhoto({ nickname, src }: { nickname: string; src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <p>The photo from {nickname} did not load. The game continues.</p>;
  }
  return (
    <img
      alt={`Photo from ${nickname}`}
      className="max-h-[70vh] w-full object-contain"
      src={src}
      onError={() => setFailed(true)}
    />
  );
}

function usePhaseCountdown(
  snapshot: LobbySnapshot | undefined,
  observedAt: number,
): { label: string; value: string; note: string } | null {
  const deadlineAt = snapshot?.deadlineAt ?? null;
  const serverNow = snapshot?.serverNow ?? 0;
  const [now, setNow] = useState(observedAt);

  useEffect(() => {
    if (deadlineAt === null) {
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setInterval(
      () => {
        setNow(Date.now());
      },
      reduce ? 1000 : 250,
    );
    return () => {
      window.clearInterval(timer);
    };
  }, [deadlineAt, serverNow]);

  if (!snapshot) {
    return null;
  }
  if (snapshot.held) {
    return { label: "Waiting", value: "—", note: "Waiting for the host." };
  }
  if (snapshot.paused) {
    return {
      label: "Paused",
      value: formatPhaseClock(snapshot.remainingMs ?? 0),
      note: "Paused.",
    };
  }
  if (deadlineAt === null) {
    return null;
  }
  return {
    label: "Time left",
    value: formatPhaseClock(remainingUntil(deadlineAt, serverNow, observedAt, now)),
    note: "Time left in this phase.",
  };
}

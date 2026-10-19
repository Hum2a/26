import { useState } from "react";
import type { LobbySnapshot } from "@26/shared";
import { uploadVoiceClip } from "../media/media-transfer";
import { VoiceTake } from "../media/voice-take";
import { Button, Disclosure } from "../ui/primitives";
import { newSelfTroll } from "./applied";
import { TrollConfirm } from "./Confirm";
import { TrollPicker } from "./Picker";
import { VictimToast } from "./VictimToast";

export function GuestTrolls({
  snapshot,
  gameId,
  selfId,
  pending,
  onSend,
  onEscape,
}: {
  snapshot: LobbySnapshot;
  gameId: string;
  selfId: string;
  pending: boolean;
  onSend: (kind: string, targetId: string, mediaId?: string) => void;
  onEscape: (effectId: string) => void;
}) {
  const incoming = snapshot.trolls.active.filter(
    (effect) => effect.role === "target" && effect.status === "active",
  );
  const [tracked, setTracked] = useState<LobbySnapshot["trolls"]["active"] | null>(
    null,
  );
  const [toast, setToast] = useState<{ effectId: string; troller?: string } | null>(
    null,
  );
  if (tracked !== snapshot.trolls.active) {
    const cue = newSelfTroll(tracked, snapshot.trolls.active);
    setTracked(snapshot.trolls.active);
    if (cue) {
      setToast(cue);
    }
  }
  return (
    <div className="grid gap-4" data-troll="">
      {toast ? (
        <VictimToast
          key={toast.effectId}
          event={{ target: "self", troller: toast.troller }}
        />
      ) : null}
      {incoming.map((effect) => (
        <TrollOverlay
          key={effect.effectId}
          effect={effect}
          pending={pending}
          onEscape={onEscape}
        />
      ))}
      <Disclosure title="Play a troll">
        <TrollPanel
          snapshot={snapshot}
          gameId={gameId}
          selfId={selfId}
          pending={pending}
          onSend={onSend}
        />
      </Disclosure>
    </div>
  );
}

function TrollOverlay({
  effect,
  pending,
  onEscape,
}: {
  effect: LobbySnapshot["trolls"]["active"][number];
  pending: boolean;
  onEscape: (effectId: string) => void;
}) {
  if (effect.kind === "yield") {
    return (
      <div className="grid gap-3" role="status">
        <p>
          The send button moves for at most three seconds. The answers stay in place.
        </p>
        {effect.escape ? (
          <Button
            type="button"
            disabled={pending}
            onClick={() => onEscape(effect.effectId)}
          >
            {effect.escape}
          </Button>
        ) : null}
      </div>
    );
  }
  const blocking =
    effect.kind === "invasion" || effect.kind === "call" || effect.kind === "crack";
  return (
    <div
      className={
        blocking
          ? "grid gap-3 rounded-3xl border border-line bg-surface p-4"
          : "grid gap-3"
      }
      role={blocking ? "dialog" : "status"}
      aria-label={effect.assetLabel}
    >
      <p className="text-2xl font-bold">{effect.assetLabel}</p>
      <p>{effect.label}. This is a labelled demo asset.</p>
      {effect.kind === "typing" ? (
        <p>The stage can see what you type. Sending still stores the answer.</p>
      ) : null}
      {effect.kind === "crack" ? (
        <div className="troll-crack" aria-hidden="true" />
      ) : null}
      {effect.escape ? (
        <Button
          type="button"
          disabled={pending}
          onClick={() => onEscape(effect.effectId)}
        >
          {effect.escape}
        </Button>
      ) : (
        <p>This clears on its own.</p>
      )}
    </div>
  );
}

function TrollPanel({
  snapshot,
  gameId,
  selfId,
  pending,
  onSend,
}: {
  snapshot: LobbySnapshot;
  gameId: string;
  selfId: string;
  pending: boolean;
  onSend: (kind: string, targetId: string, mediaId?: string) => void;
}) {
  const [kind, setKind] = useState<string>();
  const [targetId, setTargetId] = useState<string>();
  const [clip, setClip] = useState<Blob | null>(null);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [confirming, setConfirming] = useState(false);
  const used = snapshot.trolls.token === "spent";
  const roundIndex = snapshot.play?.question.index ?? 0;
  const others = snapshot.players.filter((player) => player.playerId !== selfId);
  const target = others.find((player) => player.playerId === targetId);
  const offer = snapshot.trolls.offers.find((item) => item.kind === kind);
  const ready = snapshot.trolls.token === "ready" && roundIndex >= 2;

  function fire() {
    if (!kind || !targetId) {
      return;
    }
    setConfirming(false);
    if (kind === "voice") {
      if (!clip) {
        return;
      }
      const body = clip;
      setVoiceStatus("Checking the file.");
      void uploadVoiceClip(gameId, body, setVoiceStatus).then((mediaId) => {
        if (mediaId) {
          onSend(kind, targetId, mediaId);
        }
      });
      return;
    }
    onSend(kind, targetId);
  }

  return (
    <div className="grid gap-3">
      <p className="font-bold">Your troll</p>
      <TrollPicker
        players={snapshot.players}
        selfId={selfId}
        roundIndex={roundIndex}
        used={used}
        pending={pending}
        selectedId={targetId}
        onSelect={setTargetId}
      />
      <div className="grid gap-2">
        {snapshot.trolls.offers.map((item) => (
          <Button
            key={item.kind}
            type="button"
            variant={kind === item.kind ? "primary" : "secondary"}
            aria-pressed={kind === item.kind}
            disabled={pending || !ready || !item.enabled}
            onClick={() => setKind(item.kind)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {kind === "voice" ? (
        <VoiceTake disabled={pending || !ready} onClip={setClip} />
      ) : null}
      {voiceStatus ? <p aria-live="polite">{voiceStatus}</p> : null}
      <Button
        type="button"
        disabled={
          pending || !ready || !kind || !targetId || (kind === "voice" && !clip)
        }
        onClick={() => setConfirming(true)}
      >
        {kind === "voice" ? "Send this clip" : "Send troll"}
      </Button>
      {confirming && target && offer ? (
        <TrollConfirm
          nickname={target.nickname}
          troll={offer.label}
          onCancel={() => setConfirming(false)}
          onConfirm={fire}
        />
      ) : null}
    </div>
  );
}

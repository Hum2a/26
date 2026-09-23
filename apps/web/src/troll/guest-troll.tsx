import { useState } from "react";
import type { LobbySnapshot } from "@26/shared";
import { uploadVoiceClip } from "../media/media-transfer";
import { VoiceTake } from "../media/voice-take";
import { Button } from "../ui/primitives";

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
  return (
    <div className="grid gap-4" data-troll="">
      {incoming.map((effect) => (
        <TrollOverlay
          key={effect.effectId}
          effect={effect}
          pending={pending}
          onEscape={onEscape}
        />
      ))}
      <TrollPicker
        snapshot={snapshot}
        gameId={gameId}
        selfId={selfId}
        pending={pending}
        onSend={onSend}
      />
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

function TrollPicker({
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
  if (snapshot.trolls.token === "locked") {
    return null;
  }
  if (
    snapshot.trolls.token === "spent" &&
    snapshot.trolls.offers.every((offer) => !offer.enabled)
  ) {
    return <p>You have used your troll.</p>;
  }
  const others = snapshot.players.filter((player) => player.playerId !== selfId);
  return (
    <div className="grid gap-3">
      <p className="font-bold">Your troll</p>
      <div className="grid gap-2">
        {snapshot.trolls.offers.map((offer) => (
          <Button
            key={offer.kind}
            type="button"
            variant={kind === offer.kind ? "primary" : "secondary"}
            aria-pressed={kind === offer.kind}
            disabled={pending || !offer.enabled}
            onClick={() => setKind(offer.kind)}
          >
            {offer.label}
          </Button>
        ))}
      </div>
      <div className="grid gap-2">
        {others.map((player) => (
          <Button
            key={player.playerId}
            type="button"
            variant={targetId === player.playerId ? "primary" : "secondary"}
            aria-label={`Troll ${player.nickname}`}
            aria-pressed={targetId === player.playerId}
            disabled={pending || snapshot.trolls.token !== "ready"}
            onClick={() => setTargetId(player.playerId)}
          >
            {player.nickname}
          </Button>
        ))}
      </div>
      {kind === "voice" ? <VoiceTake disabled={pending} onClip={setClip} /> : null}
      {voiceStatus ? <p aria-live="polite">{voiceStatus}</p> : null}
      <Button
        type="button"
        disabled={
          pending ||
          !kind ||
          !targetId ||
          snapshot.trolls.token !== "ready" ||
          (kind === "voice" && !clip)
        }
        onClick={() => {
          if (!kind || !targetId) {
            return;
          }
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
        }}
      >
        {kind === "voice" ? "Send this clip" : "Send troll"}
      </Button>
    </div>
  );
}

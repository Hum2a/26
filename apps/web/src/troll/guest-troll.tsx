import { useState } from "react";
import type { LobbySnapshot } from "@26/shared";
import { uploadVoiceClip } from "../media/media-transfer";
import { VoiceTake } from "../media/voice-take";
import { Button, Disclosure } from "../ui/primitives";
import { newSelfTroll } from "./applied";
import { TrollConfirm } from "./Confirm";
import { TrollPicker } from "./Picker";
import { VictimToast } from "./VictimToast";
import { isScreenTroll, ScreenTroll } from "./screen-trolls";
import { seedFrom, type TrollSender } from "./classic-trolls";

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
          sender={senderOf(snapshot, gameId, effect.fromPlayerId)}
          others={snapshot.players
            .filter((player) => player.playerId !== selfId)
            .map((player) => player.nickname)}
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

/** What the target is told for trolls that are not drawn as a screen gag. */
const targetLine: Partial<Record<string, string>> = {
  swap: "Your name has swapped with someone else's on every screen.",
  "hide-score": "Your score is hidden from you for now.",
  double: "Your points for this question are double or nothing.",
  typing: "The big screen can see what you type. Sending still stores the answer.",
  voice: "A voice clip about you will play at the reveal.",
  theme: "You have a theme tune now. It plays whenever the scores come up.",
  "temp-nickname": "You have a new name on every screen for a while. Your points are safe.",
  "guest-14": "You are Guest 14 on every screen for a while. Your points are safe.",
  replay: "Your answer will be replayed on the big screen at the reveal.",
  speech: "Get ready: the big screen will ask you for a speech at the scores.",
  "zoom-photo": "One of your photos is on the big screen. Up close.",
  steal: "Someone is stealing half your points for this question.",
  "robin-hood": "Your points for this question go to whoever is in last place.",
  share: "You are splitting your points for this question with someone.",
  "public-vote": "Your vote will be shown on the big screen at the reveal.",
  misattributed: "At the reveal, the big screen will say you wrote someone else's answer.",
};

/** The troller's name and driver face, from the shared player list. */
function senderOf(
  snapshot: LobbySnapshot,
  gameId: string,
  playerId: string | undefined,
): TrollSender | undefined {
  const player = snapshot.players.find((item) => item.playerId === playerId);
  if (!player) {
    return undefined;
  }
  const face = player.driver?.faceMediaId;
  return {
    nickname: player.nickname,
    faceSrc: face ? `/api/rooms/${gameId}/media/${face}` : null,
  };
}

function TrollOverlay({
  effect,
  sender,
  others,
  pending,
  onEscape,
}: {
  effect: LobbySnapshot["trolls"]["active"][number];
  sender: TrollSender | undefined;
  others: string[];
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
  if (isScreenTroll(effect.kind)) {
    return (
      <ScreenTroll
        kind={effect.kind}
        label={effect.assetLabel}
        escape={effect.escape}
        onEscape={pending ? undefined : () => onEscape(effect.effectId)}
        from={sender}
        seed={seedFrom(effect.effectId)}
        others={others}
      />
    );
  }
  return (
    <div className="grid gap-3" role="status" aria-label={effect.assetLabel}>
      <p className="text-2xl font-bold">{effect.label}</p>
      <p>{targetLine[effect.kind] ?? effect.assetLabel}</p>
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

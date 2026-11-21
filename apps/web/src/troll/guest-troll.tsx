import { withClientApiKey } from "../api/client-key";
import { useState } from "react";
import { createPortal } from "react-dom";
import type { LobbySnapshot } from "@26/shared";
import { motion, useReducedMotion } from "motion/react";
import { Icon } from "@iconify/react/dist/offline";
import { Button } from "../ui/primitives";
import { targetLine, trollGroupOf, trollMeta } from "./troll-meta";
import { newSelfTroll } from "./applied";
import { VictimToast } from "./VictimToast";
import { isScreenTroll, ScreenTroll } from "./screen-trolls";
import { seedFrom, type TrollSender } from "./classic-trolls";
import { useTrollSoundUnlock } from "./troll-sound";
import "./troll-tab.css";

/** Trolls aimed at this phone. They show above every tab. */
export function GuestTrolls({
  snapshot,
  gameId,
  selfId,
  pending,
  onEscape,
}: {
  snapshot: LobbySnapshot;
  gameId: string;
  selfId: string;
  pending: boolean;
  onSend?: (kind: string, targetId: string, mediaId?: string) => void;
  onEscape: (effectId: string) => void;
}) {
  useTrollSoundUnlock();
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
    <div className="incoming-trolls" data-troll="">
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
    </div>
  );
}

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
    faceSrc: face ? withClientApiKey(`/api/rooms/${gameId}/media/${face}`) : null,
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
  const reduce = useReducedMotion();
  if (effect.kind === "yield") {
    return (
      <div
        className="incoming-troll glass"
        data-hue={trollGroupOf("yield").hue}
        role="status"
      >
        <span className="incoming-troll-icon" aria-hidden="true">
          <Icon icon={trollMeta.yield.icon} />
        </span>
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
    // Escape the phone scroll area's stacking context: the answer dock must
    // never cover an incoming effect's escape controls.
    return createPortal(
      <ScreenTroll
        kind={effect.kind}
        label={effect.assetLabel}
        escape={effect.escape}
        onEscape={pending ? undefined : () => onEscape(effect.effectId)}
        from={sender}
        seed={seedFrom(effect.effectId)}
        others={others}
      />,
      document.body,
    );
  }
  const group = trollGroupOf(effect.kind);
  const meta = trollMeta[effect.kind];
  return (
    <motion.div
      className="incoming-troll glass"
      data-hue={group.hue}
      role="status"
      aria-label={effect.assetLabel}
      initial={{ opacity: 0, y: reduce ? 0 : -12, scale: reduce ? 1 : 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        reduce ? { duration: 0.15 } : { type: "spring", stiffness: 420, damping: 30 }
      }
    >
      <span className="incoming-troll-icon" aria-hidden="true">
        <Icon icon={meta?.icon ?? group.icon} />
      </span>
      <div className="grid gap-1">
        <p className="incoming-troll-group">{group.label}</p>
        <p className="incoming-troll-title">{effect.label}</p>
        <p>{targetLine[effect.kind] ?? effect.assetLabel}</p>
        {sender ? <p className="incoming-troll-from">From {sender.nickname}</p> : null}
      </div>
      {effect.escape ? (
        <Button
          type="button"
          className="incoming-troll-escape"
          disabled={pending}
          onClick={() => onEscape(effect.effectId)}
        >
          {effect.escape}
        </Button>
      ) : (
        <p className="incoming-troll-note">This clears on its own.</p>
      )}
    </motion.div>
  );
}

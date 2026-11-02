import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon } from "@iconify/react/dist/offline";
import type { LobbySnapshot } from "@26/shared";
import { uploadVoiceClip } from "../media/media-transfer";
import { VoiceTake } from "../media/voice-take";
import { Button } from "../ui/primitives";
import { TrollConfirm } from "./Confirm";
import { TrollPicker } from "./Picker";
import { trollGroupOf, trollGroups, trollMeta, type TrollGroupId } from "./troll-meta";
import "./troll-tab.css";

/** The Troll tab: pick a troll, pick a target, confirm. One per game. */
export function TrollTab({
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
  const reduce = useReducedMotion();
  const [kind, setKind] = useState<string>();
  const [targetId, setTargetId] = useState<string>();
  const [clip, setClip] = useState<Blob | null>(null);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [shownGroup, setShownGroup] = useState<TrollGroupId | null>(null);
  const used = snapshot.trolls.token === "spent";
  const roundIndex = snapshot.play?.question.index ?? 0;
  const target = snapshot.players.find(
    (player) => player.playerId === targetId && player.playerId !== selfId,
  );
  const offer = snapshot.trolls.offers.find((item) => item.kind === kind);
  const ready = snapshot.trolls.token === "ready" && roundIndex >= 2;
  const outgoing = snapshot.trolls.active.filter((effect) => effect.role === "actor");
  const status = used
    ? "You have used your troll for tonight."
    : snapshot.phase === "lobby" || roundIndex < 2
      ? "Your troll unlocks from question 2."
      : ready
        ? "You have one troll. Use it wisely."
        : "Trolls are resting for this part of the show.";
  const step = !kind ? 1 : !targetId ? 2 : 3;
  const groupsOffered = trollGroups
    .map((group) => ({
      ...group,
      offers: snapshot.trolls.offers.filter(
        (item) => trollGroupOf(item.kind).id === group.id,
      ),
    }))
    .filter((group) => group.offers.length > 0);
  const activeGroup =
    groupsOffered.find((group) => group.id === shownGroup) ?? groupsOffered[0];
  const slide = (from: number) => ({
    initial: { opacity: 0, x: reduce ? 0 : from },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: reduce ? 0 : from },
    transition: { duration: 0.2, ease: [0.2, 0, 0, 1] as const },
  });

  function restart() {
    setKind(undefined);
    setTargetId(undefined);
    setConfirming(false);
    setClip(null);
  }

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
    <div className="troll-tab">
      <header className="phone-tab-head">
        <p className="entry-eyebrow">Troll a player</p>
        <h1 className="phone-tab-title">Mischief</h1>
        <p className="troll-token glass" data-ready={ready || undefined}>
          <span aria-hidden="true">{used ? "✓" : ready ? "1" : "·"}</span>
          {status}
        </p>
      </header>
      <AnimatePresence initial={false}>
        {outgoing.map((effect) => (
          <motion.p
            key={effect.effectId}
            layout={!reduce}
            className="troll-outgoing glass"
            data-hue={trollGroupOf(effect.kind).hue}
            initial={{ opacity: 0, y: reduce ? 0 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Icon
              icon={trollMeta[effect.kind]?.icon ?? trollGroupOf(effect.kind).icon}
            />
            {effect.status === "queued" ? "Queued: " : "Running now: "}
            {effect.label}
          </motion.p>
        ))}
      </AnimatePresence>
      {used ? null : (
        <>
          <ol className="troll-steps" aria-label="Steps">
            {["Pick a troll", "Pick a target", "Send it"].map((label, index) => (
              <li
                key={label}
                data-state={
                  index + 1 < step ? "done" : index + 1 === step ? "current" : undefined
                }
                aria-current={index + 1 === step ? "step" : undefined}
              >
                <span aria-hidden="true">{index + 1}</span>
                {label}
              </li>
            ))}
          </ol>
          <AnimatePresence initial={false} mode="wait">
            {step === 1 || !offer ? (
              <motion.div key="kinds" className="troll-groups" {...slide(-16)}>
                <div className="troll-filter" role="group" aria-label="Troll groups">
                  {groupsOffered.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      className="troll-filter-chip glass"
                      data-hue={group.hue}
                      aria-pressed={activeGroup?.id === group.id}
                      onClick={() => setShownGroup(group.id)}
                    >
                      <Icon icon={group.icon} aria-hidden="true" />
                      {group.label}
                      <small>{group.offers.length}</small>
                    </button>
                  ))}
                </div>
                {(activeGroup ? [activeGroup] : []).map((group) => {
                  const offers = group.offers;
                  return (
                    <section
                      key={group.id}
                      className="troll-group"
                      data-hue={group.hue}
                      aria-label={group.label}
                    >
                      <h2>
                        <span className="troll-group-icon" aria-hidden="true">
                          <Icon icon={group.icon} />
                        </span>
                        <span>
                          {group.label}
                          <small>{group.blurb}</small>
                        </span>
                      </h2>
                      <div className="troll-cards">
                        {offers.map((item) => (
                          <button
                            key={item.kind}
                            type="button"
                            className="troll-card glass"
                            aria-pressed={kind === item.kind}
                            disabled={pending || !ready || !item.enabled}
                            onClick={() => setKind(item.kind)}
                          >
                            <span className="troll-card-icon" aria-hidden="true">
                              <Icon icon={trollMeta[item.kind]?.icon ?? group.icon} />
                            </span>
                            <span className="troll-card-name">{item.label}</span>
                            <span className="troll-card-blurb">
                              {item.enabled
                                ? (trollMeta[item.kind]?.blurb ?? "")
                                : "Not on this question"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div key="target" className="troll-target" {...slide(16)}>
                <div
                  className="troll-chosen glass"
                  data-hue={trollGroupOf(offer.kind).hue}
                >
                  <span className="troll-card-icon" aria-hidden="true">
                    <Icon
                      icon={
                        trollMeta[offer.kind]?.icon ?? trollGroupOf(offer.kind).icon
                      }
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="troll-card-name">{offer.label}</p>
                    <p className="troll-card-blurb">{trollMeta[offer.kind]?.blurb}</p>
                  </div>
                  <Button variant="secondary" onClick={restart}>
                    Change
                  </Button>
                </div>
                <TrollPicker
                  players={snapshot.players}
                  selfId={selfId}
                  roundIndex={roundIndex}
                  used={used}
                  pending={pending}
                  selectedId={targetId}
                  onSelect={setTargetId}
                />
                {kind === "voice" ? (
                  <VoiceTake disabled={pending || !ready} onClip={setClip} />
                ) : null}
                {voiceStatus ? <p aria-live="polite">{voiceStatus}</p> : null}
                <Button
                  type="button"
                  className="troll-send"
                  disabled={
                    pending || !ready || !targetId || (kind === "voice" && !clip)
                  }
                  onClick={() => setConfirming(true)}
                >
                  {kind === "voice"
                    ? "Send this clip"
                    : target
                      ? `Send to ${target.nickname}`
                      : "Send troll"}
                </Button>
                <AnimatePresence>
                  {confirming && target ? (
                    <motion.div
                      key="confirm"
                      initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: reduce ? 0 : 10 }}
                      transition={{ duration: 0.18 }}
                    >
                      <TrollConfirm
                        nickname={target.nickname}
                        troll={offer.label}
                        onCancel={() => setConfirming(false)}
                        onConfirm={fire}
                      />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

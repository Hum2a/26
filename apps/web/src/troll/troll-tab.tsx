import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon } from "@iconify/react/dist/offline";
import { formatPhaseClock, trollCooldownMs, type LobbySnapshot } from "@26/shared";
import { buzz } from "../device/haptics";
import { useCooldownSeconds } from "../live/use-cooldown";
import { uploadVoiceClip } from "../media/media-transfer";
import { VoiceTake } from "../media/voice-take";
import { Button } from "../ui/primitives";
import { TrollConfirm } from "./Confirm";
import { TrollPicker } from "./Picker";
import { trollGroupOf, trollGroups, trollMeta, type TrollGroupId } from "./troll-meta";
import "./troll-tab.css";

const STEP_LABELS = ["Pick a troll", "Pick a victim", "Confirm"] as const;

/**
 * The Troll tab: pick a troll, pick a target, confirm. A guest can send
 * whenever their own cooldown has run out; the room refuses an early send.
 */
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
  const [shownGroup, setShownGroup] = useState<TrollGroupId | null>(null);
  const [sentPulse, setSentPulse] = useState(false);
  const locked = snapshot.trolls.token === "locked" || snapshot.phase === "lobby";
  const resting = ["final", "facts", "podium"].includes(snapshot.phase);
  const secondsLeft = useCooldownSeconds(snapshot.trolls.cooldownUntil ?? null);
  const cooling = !locked && secondsLeft > 0;
  const target = snapshot.players.find(
    (player) => player.playerId === targetId && player.playerId !== selfId,
  );
  const offer = snapshot.trolls.offers.find((item) => item.kind === kind);
  const ready = !locked && !resting && !cooling;
  const countdown = formatPhaseClock(secondsLeft * 1_000);
  const outgoing = snapshot.trolls.active.filter((effect) => effect.role === "actor");
  const blocked = locked || resting;
  const voiceReady = kind !== "voice" || Boolean(clip);
  const canSend = ready && !pending && Boolean(kind && targetId) && voiceReady;
  const status = sentPulse
    ? pending
      ? "Sending your troll…"
      : "Sent. Watch their phone."
    : locked
      ? "Trolls open once the questions start."
      : resting
        ? "Trolls are resting for this part of the show."
        : cooling
          ? `Next troll in ${countdown}.`
          : "Troll ready. Send one whenever you like.";
  const step = sentPulse ? 4 : !kind ? 1 : !targetId ? 2 : 3;
  const stepName = step === 4 ? "Sent" : (STEP_LABELS[step - 1] ?? STEP_LABELS[0]);
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
  const lockReason = locked
    ? "Waiting for the first question."
    : resting
      ? "Trolls are resting for this part of the show."
      : cooling
        ? `Recharging — ready in ${countdown}.`
        : pending
          ? "Sending…"
          : undefined;

  function restart() {
    setKind(undefined);
    setTargetId(undefined);
    setClip(null);
    setSentPulse(false);
  }

  function fire() {
    if (!kind || !targetId || !canSend) {
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
          buzz([16, 40, 28, 40, 48]);
          setSentPulse(true);
          onSend(kind, targetId, mediaId);
        }
      });
      return;
    }
    buzz([16, 40, 28, 40, 48]);
    setSentPulse(true);
    onSend(kind, targetId);
  }

  useEffect(() => {
    if (!sentPulse || pending) return;
    const timer = window.setTimeout(() => {
      restart();
    }, 2_200);
    return () => window.clearTimeout(timer);
  }, [sentPulse, pending]);

  return (
    <div className="troll-tab">
      <header className="phone-tab-head">
        <p className="entry-eyebrow">Troll a player</p>
        <h1 className="phone-tab-title">Mischief</h1>
        <p
          className="troll-token glass"
          data-ready={ready && !sentPulse ? "" : undefined}
          data-cooling={cooling || undefined}
          data-blocked={blocked || undefined}
          aria-live="polite"
        >
          <CooldownMark
            cooling={cooling}
            ready={ready && !sentPulse}
            secondsLeft={secondsLeft}
          />
          {status}
        </p>
        <p className="sr-only" aria-live="polite">
          {stepName}. {status}
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
      <ol className="troll-steps" aria-label="Steps">
        {STEP_LABELS.map((label, index) => {
          const number = index + 1;
          const state =
            step === 4 || number < step
              ? "done"
              : number === step
                ? "current"
                : undefined;
          return (
            <li
              key={label}
              data-state={state}
              aria-current={number === step ? "step" : undefined}
            >
              <span aria-hidden="true">{number}</span>
              {label}
            </li>
          );
        })}
      </ol>
      <div
        className="troll-progress"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={Math.min(step, 3)}
        aria-label="Troll steps"
      >
        <span
          style={{
            width: `${step >= 4 ? 100 : ((step - 1) / 2) * 100}%`,
          }}
        />
      </div>
      <AnimatePresence initial={false}>
        {sentPulse ? (
          <motion.div
            key="sent"
            className="troll-sent glass"
            initial={{ opacity: 0, scale: reduce ? 1 : 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            role="status"
          >
            <p className="troll-sent-mark" aria-hidden="true">
              ✓
            </p>
            <p className="troll-sent-title">Troll sent</p>
            <p>
              {pending
                ? "On its way."
                : cooling
                  ? `Next one in ${countdown}.`
                  : "Line up another whenever you like."}
            </p>
          </motion.div>
        ) : step === 1 || !offer ? (
          <motion.div key="kinds" className="troll-groups" {...slide(-16)}>
            {blocked ? (
              <p className="troll-lock-banner" role="status">
                {lockReason}
              </p>
            ) : null}
            <div className="troll-filter" role="group" aria-label="Troll groups">
              {groupsOffered.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  className="troll-filter-chip glass"
                  data-hue={group.hue}
                  aria-pressed={activeGroup?.id === group.id}
                  disabled={pending}
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
                    {offers.map((item) => {
                      const pressable = !pending && !blocked && item.enabled;
                      const why = blocked
                        ? lockReason
                        : item.enabled
                          ? (trollMeta[item.kind]?.blurb ?? "")
                          : "Not on this question";
                      return (
                        <button
                          key={item.kind}
                          type="button"
                          className="troll-card glass"
                          aria-pressed={kind === item.kind}
                          disabled={!pressable}
                          aria-disabled={!pressable}
                          onClick={() => setKind(item.kind)}
                        >
                          <span className="troll-card-icon" aria-hidden="true">
                            <Icon icon={trollMeta[item.kind]?.icon ?? group.icon} />
                          </span>
                          <span className="troll-card-name">{item.label}</span>
                          <span className="troll-card-blurb">{why}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </motion.div>
        ) : step === 2 ? (
          <motion.div key="target" className="troll-target" {...slide(16)}>
            <div className="troll-chosen glass" data-hue={trollGroupOf(offer.kind).hue}>
              <span className="troll-card-icon" aria-hidden="true">
                <Icon
                  icon={trollMeta[offer.kind]?.icon ?? trollGroupOf(offer.kind).icon}
                />
              </span>
              <div className="min-w-0">
                <p className="troll-card-name">{offer.label}</p>
                <p className="troll-card-blurb">{trollMeta[offer.kind]?.blurb}</p>
              </div>
              <Button variant="secondary" onClick={restart}>
                Back
              </Button>
            </div>
            <TrollPicker
              players={snapshot.players}
              selfId={selfId}
              locked={blocked}
              cooling={cooling}
              pending={pending}
              selectedId={targetId}
              onSelect={setTargetId}
            />
            {kind === "voice" ? (
              <VoiceTake disabled={pending || blocked} onClip={setClip} />
            ) : null}
            {voiceStatus ? <p aria-live="polite">{voiceStatus}</p> : null}
            {kind === "voice" && !clip ? (
              <p className="troll-lock-banner" role="status">
                Record a clip, then confirm.
              </p>
            ) : null}
          </motion.div>
        ) : (
          <motion.div key="confirm" className="troll-target" {...slide(16)}>
            <div className="troll-chosen glass" data-hue={trollGroupOf(offer.kind).hue}>
              <span className="troll-card-icon" aria-hidden="true">
                <Icon
                  icon={trollMeta[offer.kind]?.icon ?? trollGroupOf(offer.kind).icon}
                />
              </span>
              <div className="min-w-0">
                <p className="troll-card-name">{offer.label}</p>
                <p className="troll-card-blurb">
                  Victim: {target?.nickname ?? "someone"}
                </p>
              </div>
              <Button variant="secondary" onClick={() => setTargetId(undefined)}>
                Back
              </Button>
            </div>
            {target ? (
              <TrollConfirm
                nickname={target.nickname}
                troll={offer.label}
                disabled={!canSend}
                reason={
                  cooling
                    ? `Ready in ${countdown}`
                    : blocked
                      ? lockReason
                      : pending
                        ? "Sending…"
                        : undefined
                }
                onCancel={() => setTargetId(undefined)}
                onConfirm={fire}
              />
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CooldownMark({
  cooling,
  ready,
  secondsLeft,
}: {
  cooling: boolean;
  ready: boolean;
  secondsLeft: number;
}) {
  const total = trollCooldownMs / 1_000;
  const fraction = cooling ? Math.max(0, Math.min(1, 1 - secondsLeft / total)) : 1;
  const radius = 11;
  return (
    <span className="troll-cooldown" aria-hidden="true">
      <svg viewBox="0 0 28 28" className="troll-cooldown-ring">
        <circle cx="14" cy="14" r={radius} pathLength="100" />
        <circle
          cx="14"
          cy="14"
          r={radius}
          pathLength="100"
          strokeDasharray={`${fraction * 100} 100`}
          data-ready={ready ? "" : undefined}
        />
      </svg>
      <span>{cooling ? "◔" : ready ? "✓" : "·"}</span>
    </span>
  );
}

import { AnimatePresence, motion } from "motion/react";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";
import type { LobbySnapshot, KartInput, KartControls } from "@26/shared";
import { KartDriverView } from "./KartDriverView";
import { TouchController } from "./TouchController";
import { useKartSocket } from "./useKartSocket";
import { PowerUpControl } from "./PowerUpControl";
import { Button } from "../ui/primitives";
import { DriftGauge } from "./DriftGauge";
import { useCallback, useState } from "react";
import { kartNeutral, resolveKartSettings } from "@26/shared";
import { createSelfPrediction } from "./self-prediction";
import { KartCountdown } from "./KartCountdown";
import { useKartContactFeedback } from "./useKartContactFeedback";
import { KartRecapPanel } from "./KartRecapPanel";

export function GuestKart({
  snapshot,
  connected = true,
  onInput,
  onRecover,
  onUseItem,
  itemPending,
  itemNotice,
  recoveryPending = false,
  recoveryNotice = "",
  observedAt,
}: {
  snapshot: LobbySnapshot;
  connected?: boolean;
  onInput?: (input: KartInput) => void;
  onRecover?: (raceId: string) => void;
  onUseItem?: (raceId: string) => void;
  itemPending?: boolean;
  itemNotice?: string;
  recoveryPending?: boolean;
  recoveryNotice?: string;
  /** When this snapshot arrived, for the race-start countdown. */
  observedAt?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const race = snapshot.play?.kart;
  const timeLimitMs =
    race?.timeLimitMs ??
    (snapshot.play?.question.kind === "kart"
      ? snapshot.play.question.timeLimitMs
      : 45_000);
  const self = race?.participants.find((d) => d.playerId === race.selfPlayerId);
  const place = race?.leaderboard.find((d) => d.playerId === self?.playerId)?.place;
  const complete = self && self.status !== "RACING";
  const recap =
    race?.presentation && race.presentation.version !== 2
      ? race.presentation.recap
      : undefined;
  const heldItem =
    race?.presentation?.version === 3
      ? race.presentation.items.heldItem
      : (race?.powers?.selfItem ?? null);
  const hostEnded = recap?.reason === "host-ended";
  const earlyEnded = Boolean(race?.ended && race.elapsedMs < timeLimitMs);
  const stunned =
    (race?.presentation?.version === 2 || race?.presentation?.version === 3) &&
    (race.presentation.handling?.stunMs ?? 0) > 0;
  const [viewReadiness, setViewReadiness] = useState({ raceId: "", usable: false });
  const onReadiness = useCallback((raceId: string, usable: boolean) => {
    setViewReadiness((previous) =>
      previous.raceId === raceId && previous.usable === usable
        ? previous
        : { raceId, usable },
    );
  }, []);
  const viewUsable =
    !race ||
    !self ||
    complete ||
    (viewReadiness.raceId === race.raceId && viewReadiness.usable);
  const open =
    snapshot.phase === "collect" && !snapshot.paused && !snapshot.held && connected;
  const driveOpen = open && viewUsable;
  const send = useKartSocket(race, driveOpen && !recoveryPending, onInput);
  const contactFeedback = useKartContactFeedback({
    raceId: race?.raceId ?? "",
    elapsedMs: race?.elapsedMs ?? 0,
    active: Boolean(
      driveOpen &&
      self &&
      !complete &&
      !recoveryPending &&
      race?.effectsEnabled !== false,
    ),
    contact: Boolean(self?.contact),
    eventMode: race?.presentation?.version === 2 || race?.presentation?.version === 3,
    event:
      race?.presentation?.version === 2 || race?.presentation?.version === 3
        ? race.presentation.contacts.find((event) => event.playerId === self?.playerId)
        : undefined,
  });
  // Draws this phone's kart from its own controls straight away; the room
  // still decides where the kart really is and corrects the drawing.
  const [prediction] = useState(createSelfPrediction);
  const feel = resolveKartSettings(race?.settings);
  if (feel.prediction !== "off") prediction.configure(feel.prediction);
  const change = (value: KartControls) => {
    prediction.input(
      driveOpen && !recoveryPending ? value : kartNeutral,
      performance.now(),
    );
    send(value);
  };
  const rehearsal = !onInput && !race;
  // Short landscape phones use these to lay the race out full screen; see kart.css.
  const layout = !race
    ? undefined
    : !self
      ? "watch"
      : complete
        ? "finish"
        : snapshot.phase === "collect"
          ? "race"
          : "grid";
  // Shown over the full-screen driving view, where the ordinary status line is hidden.
  const raceNotice = !connected
    ? "Connection lost — controls released"
    : snapshot.paused || snapshot.held
      ? "Paused — controls released"
      : recoveryPending
        ? "Returning to the track — controls released"
        : !viewUsable
          ? "Preparing your driving view — choose Map view to drive now"
          : layout === "grid"
            ? self?.gridPosition
              ? `Grid slot ${self.gridPosition}${race?.participantCount ? ` of ${race.participantCount}` : ""} · hold A when the race starts`
              : "Hold A when the race starts"
            : "";
  const instruction = !connected
    ? "Connection lost — controls released"
    : snapshot.paused || snapshot.held
      ? "Paused — controls released"
      : race?.ended || complete
        ? "Race complete — watch the stage"
        : snapshot.phase !== "collect" && !rehearsal
          ? "Your driving view opens here. Wait for the race to start."
          : race && !self
            ? snapshot.mode === "kart"
              ? "You’re watching this race from the side."
              : "You’re watching this race. Join the next round."
            : "Drive on this screen. Hold A and follow the circuit.";
  return (
    <section
      className="kart-phone"
      aria-label="Sprint controller"
      // Short landscape phones turn this into a full-screen driving view.
      data-layout={layout}
    >
      {contactFeedback.overlay}
      {self && !complete ? (
        <KartCountdown
          snapshot={snapshot}
          observedAt={observedAt ?? snapshot.serverNow}
          haptics={Boolean(onInput)}
          enabled={connected && viewUsable}
        />
      ) : null}
      {layout === "grid" || layout === "race" ? (
        <div className="kart-race-status" role="status" aria-live="polite">
          <AnimatePresence initial={false} mode="wait">
            {raceNotice ? (
              <motion.p
                key={raceNotice}
                initial={{ opacity: 0, y: reduced ? 0 : -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0.12 : 0.2, ease: "easeOut" }}
              >
                {raceNotice}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
      <header className="kart-phone-heading">
        <p className="kart-eyebrow">
          ONE LAP · {timeLimitMs === 180_000 ? "3 MINUTES" : "45 SECONDS"}
        </p>
        <h1 className="phone-prompt">
          {complete
            ? self.status === "FINISHED"
              ? "Lap complete"
              : hostEnded || earlyEnded
                ? "Race ended"
                : "Time’s up"
            : self
              ? `Kart ${self.number}`
              : "Start your engines"}
        </h1>
      </header>
      {self?.gridPosition && snapshot.phase !== "collect" ? (
        <p>
          Starting grid: {self.gridPosition} of {race?.participantCount} · seeded by
          quiz score
        </p>
      ) : null}
      <p role="status">
        {rehearsal ? "Controller rehearsal — no race is running." : instruction}
      </p>
      {self ? (
        <div className="kart-phone-hud">
          <div>
            <strong>
              {self.status === "FINISHED"
                ? self.lapTimeMs === null
                  ? "Time unavailable"
                  : `${(self.lapTimeMs / 1000).toFixed(2)}s`
                : `Sector ${Math.min(8, self.checkpoint + 1)} / 8`}
            </strong>
            <p>
              {complete
                ? self.status === "FINISHED"
                  ? `Position ${place ?? "—"}`
                  : `${Math.round(self.progress * 100)}% of the lap`
                : `${Math.max(0, (timeLimitMs - (race?.elapsedMs ?? 0)) / 1000).toFixed(1)}s left`}
            </p>
            <p>
              {complete
                ? "Your result is saved by the server."
                : `Position ${place ?? "—"}${race?.participantCount === undefined ? "" : ` of ${race.participantCount}`}`}
            </p>
          </div>
        </div>
      ) : null}
      {race && self && !complete ? (
        <KartDriverView
          key={`view-${race.raceId}`}
          race={race}
          reducedMotion={reduced}
          paused={!driveOpen}
          onReadiness={onReadiness}
          prediction={
            onInput && !recoveryPending && feel.prediction !== "off"
              ? prediction
              : undefined
          }
        />
      ) : null}
      {!complete ? (
        <TouchController
          key={race?.raceId ?? "kart-rehearsal"}
          disabled={
            !driveOpen ||
            recoveryPending ||
            (!rehearsal && (!self || self.status !== "RACING" || race?.ended))
          }
          onChange={change}
          steeringDefault={feel.steering}
          onUseItem={race && onUseItem ? () => onUseItem(race.raceId) : undefined}
          onRecover={race && onRecover ? () => onRecover(race.raceId) : undefined}
          itemDisabled={Boolean(itemPending) || !heldItem}
          recoveryDisabled={recoveryPending}
          extraSettings={contactFeedback.settings}
        />
      ) : (
        <motion.div
          className="kart-finish-card"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <strong>{self.status === "FINISHED" ? "Chequered flag" : "DNF"}</strong>
          <p>
            {self.status === "FINISHED"
              ? "You made it. Take your hands off the wheel."
              : hostEnded
                ? "The host ended this race. Thanks for driving."
                : earlyEnded
                  ? "This race ended before you finished. Thanks for driving."
                  : snapshot.mode === "kart"
                    ? "The race time is up. Thanks for driving."
                    : "The race time is up. There’s always the next round."}
          </p>
          <p>Watch the stage for the results.</p>
        </motion.div>
      )}
      {race?.ended && self ? (
        <KartRecapPanel
          recap={recap}
          selfPlayerId={self.playerId}
          names={{ [self.playerId]: self.name }}
        />
      ) : null}
      {self && !complete ? (
        <div className="kart-telemetry" aria-label="Driving feedback">
          <p className="kart-driving-state" role="status">
            {!driveOpen
              ? "Controls released"
              : stunned
                ? "Barrier impact — controls resume in a moment"
                : self.wrongWay
                  ? "Wrong way — turn around"
                  : self.contact
                    ? "Barrier contact — steer away"
                    : self.boostRemainingMs > 0
                      ? "BOOST! Keep holding A"
                      : (self.driftLevel ?? 0) >= 1
                        ? "Drift ready — release R!"
                        : self.drifting
                          ? "Charging drift…"
                          : "Hold A · steer gently to the right"}
          </p>
          <DriftGauge
            chargeMs={self.driftChargeMs ?? self.driftCharge * 700}
            boostLevel={self.boostRemainingMs > 0 ? self.boostLevel || 1 : 0}
          />
          {(self.height ?? 0) > 0 ? (
            <p>Gliding · {self.height!.toFixed(1)} m · A: glide · B: descend</p>
          ) : null}
          <div className="kart-telemetry-labels">
            <span>R: hold to charge, release to boost</span>
            <span>{Math.round(Math.abs(self.speed) * 3.6)} km/h</span>
          </div>
        </div>
      ) : null}
      {race?.powers && self && !complete && onUseItem ? (
        <PowerUpControl
          item={heldItem}
          pending={itemPending}
          disabled={!open || recoveryPending}
          notice={itemNotice}
          effect={
            race.powers.effects.find((e) => e.playerId === self.playerId)?.shieldMs
              ? "Shield active — blocks one item hit"
              : race.powers.effects.find((e) => e.playerId === self.playerId)?.slowedMs
                ? "Item hit — briefly slowed"
                : race.powers.effects.find((e) => e.playerId === self.playerId)?.turboMs
                  ? "Turbo active — keep holding A"
                  : ""
          }
          onUse={() => onUseItem(race.raceId)}
        />
      ) : null}
      {!complete ? (
        <div className="kart-recovery">
          {race && self && onRecover ? (
            <Button
              variant="secondary"
              disabled={!open || recoveryPending || race.ended}
              onClick={() => onRecover(race.raceId)}
            >
              {recoveryPending ? "Returning…" : "Back to track"}
            </Button>
          ) : null}
          <p role="status">
            {recoveryPending
              ? "Returning to the track — controls released"
              : recoveryNotice}
          </p>
        </div>
      ) : null}
      {!complete ? (
        <p className="kart-help">
          A: accelerate · B: brake / reverse · R: drift / boost
          <br />
          Keyboard: arrows or WASD · Space: drift · E: item · R: back to track.
        </p>
      ) : null}
      {snapshot.play?.selfAward != null ? (
        <p className="kart-result">+{snapshot.play.selfAward} points</p>
      ) : null}
    </section>
  );
}

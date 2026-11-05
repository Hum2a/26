import { AnimatePresence, motion } from "motion/react";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";
import type { LobbySnapshot, KartInput, KartControls } from "@26/shared";
import { KartDriverView } from "./KartDriverView";
import { TouchController } from "./TouchController";
import { useKartSocket } from "./useKartSocket";
import { PowerUpControl } from "./PowerUpControl";
import { Button } from "../ui/primitives";
import { DriftGauge } from "./DriftGauge";
import { useState } from "react";
import { kartNeutral, resolveKartSettings } from "@26/shared";
import { createSelfPrediction } from "./self-prediction";
import { KartCountdown } from "./KartCountdown";

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
  const open =
    snapshot.phase === "collect" && !snapshot.paused && !snapshot.held && connected;
  const send = useKartSocket(race, open && !recoveryPending, onInput);
  // Draws this phone's kart from its own controls straight away; the room
  // still decides where the kart really is and corrects the drawing.
  const [prediction] = useState(createSelfPrediction);
  const feel = resolveKartSettings(race?.settings);
  if (feel.prediction !== "off") prediction.configure(feel.prediction);
  const change = (value: KartControls) => {
    prediction.input(open && !recoveryPending ? value : kartNeutral, performance.now());
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
            ? "You’re watching this race. Join the next round."
            : "Drive on this screen. Hold A and follow the circuit.";
  return (
    <section
      className="kart-phone"
      aria-label="Sprint controller"
      // Short landscape phones turn this into a full-screen driving view.
      data-layout={layout}
    >
      {self && !complete ? (
        <KartCountdown
          snapshot={snapshot}
          observedAt={observedAt ?? snapshot.serverNow}
          haptics={Boolean(onInput)}
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
                ? `${(self.lapTimeMs! / 1000).toFixed(2)}s`
                : `${self.checkpoint} / 8 gates`}
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
          race={race}
          reducedMotion={reduced}
          paused={!open}
          prediction={
            onInput && !recoveryPending && feel.prediction !== "off"
              ? prediction
              : undefined
          }
        />
      ) : null}
      {!complete ? (
        <TouchController
          disabled={
            !open ||
            recoveryPending ||
            (!rehearsal && (!self || self.status !== "RACING" || race?.ended))
          }
          onChange={change}
          steeringDefault={feel.steering}
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
              : "The race time is up. There’s always the next round."}
          </p>
          <p>Watch the stage for the results.</p>
        </motion.div>
      )}
      {self && !complete ? (
        <div className="kart-telemetry" aria-label="Driving feedback">
          <p className="kart-driving-state" role="status">
            {!open
              ? "Controls released"
              : self.wrongWay
                ? "Wrong way — turn around"
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
          item={race.powers.selfItem}
          pending={itemPending}
          disabled={!open || recoveryPending}
          notice={itemNotice}
          effect={
            race.powers.effects.find((e) => e.playerId === self.playerId)?.shieldMs
              ? "Shield active — blocks one slick"
              : race.powers.effects.find((e) => e.playerId === self.playerId)?.slowedMs
                ? "Oil hit — slowing down"
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
          Keyboard: arrows and space. Follow the circuit.
        </p>
      ) : null}
      {snapshot.play?.selfAward != null ? (
        <p className="kart-result">+{snapshot.play.selfAward} points</p>
      ) : null}
    </section>
  );
}
